using Confluent.Kafka;
using Microsoft.AspNetCore.SignalR;
using HormuzBackend.Hubs;


namespace HormuzBackend.Services;

// Background service runs for lifetime of the app. Includes ExecuteAsync method.
public class KafkaConsumerService : BackgroundService
{
    // SignalR - lets you send messages to clients from outside a hub method
    private readonly IHubContext<MissionHub> _hub;
    // Smarter logging than Console.writeline.
    private readonly ILogger<KafkaConsumerService> _logger;
    private readonly IConfiguration _config;

    // Constructor with dependency injection for SignalR hub context, logging, and configuration
    // ASP.NET Core will automatically provide these services when it creates an instance of KafkaConsumerService
    public KafkaConsumerService(
        IHubContext<MissionHub> hub,
        ILogger<KafkaConsumerService> logger,
        IConfiguration config)
    {
        _hub = hub;
        _logger = logger;
        _config = config;
    }

    // Builds kafka consumer config from app settings with fallback.
    // Kafka tracks which messages have been processed. Latest offset means we only get new messages.
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var consumerConfig = new ConsumerConfig
        {
            BootstrapServers = _config["Kafka:BootstrapServers"] ?? "localhost:9092",
            GroupId            = "hormuz-signalr-bridge",
            AutoOffsetReset    = AutoOffsetReset.Latest,
            EnableAutoCommit   = true,
        };

        // Run consume loop in background to avoid blocking main thread. 
        await Task.Run(() => ConsumeLoop(consumerConfig, stoppingToken), stoppingToken);
    }

   
    private void ConsumeLoop(ConsumerConfig config, CancellationToken ct)
    {
        // Setup Kafka consumer with error and log handlers that write to ASP.NET Core logging
        using var consumer = new ConsumerBuilder<Ignore, string>(config) // Ignores message keys, only cares about string values (JSON)
            .SetErrorHandler((_, e) =>
                _logger.LogError("Kafka error [{Code}]: {Reason}", e.Code, e.Reason))
            .SetLogHandler((_, m) =>
                _logger.LogDebug("Kafka log [{Level}]: {Message}", m.Level, m.Message))
            .Build();
        // Subscribes to the vessel positions topic
        consumer.Subscribe("vessel.positions");
        _logger.LogInformation("Kafka consumer subscribed to vessel.positions");

        // Main consume loop. Runs until cancellation is requested.
        try
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    // 500 ms timeout keeps the loop responsive to cancellation
                    var result = consumer.Consume(TimeSpan.FromMilliseconds(500));
                    if (result?.Message?.Value is null) continue;

                    var json = result.Message.Value;

                    // Fire-and-forget broadcast — don't await inside the sync loop
                    _ = _hub.Clients.All.SendAsync("VesselUpdate", json, ct);
                }

                catch (ConsumeException ex)
                {
                    _logger.LogError(ex, "Consume error on vessel.positions");
                }
            }
        }
        // Catch the expected cancellation exception to allow graceful shutdown
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Kafka consumer loop cancelled — shutting down");
        }
        // Guarantees consumer is closed and offsets are committed even if an unexpected error occurs.
        finally
        {
            consumer.Close();
            _logger.LogInformation("Kafka consumer closed");
        }
    }
}