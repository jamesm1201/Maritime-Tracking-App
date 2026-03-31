using Confluent.Kafka;
using Microsoft.AspNetCore.SignalR;

// Background service that consumes messages from Kafka and broadcasts them to SignalR clients
public class KafkaConsumerService : BackgroundService
{
    private readonly IHubContext<MissionHub> _hub;
    private readonly IConsumer<string, string> _consumer;

    public KafkaConsumerService(IHubContext<MissionHub> hub)
    {
        _hub = hub;

        var config = new ConsumerConfig
        {
            BootstrapServers = "localhost:9092",
            GroupId = "hormuz-backend",
            AutoOffsetReset = AutoOffsetReset.Latest,
        };

        _consumer = new ConsumerBuilder<string, string>(config).Build();
    }
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _consumer.Subscribe("vessel.positions");
        Console.WriteLine("Kafka consumer subscribed to vessel.positions");

        while (!ct.IsCancellationRequested)
        {
            var result = _consumer.Consume(ct);
            var payload = result.Message.Value;

            await _hub.Clients.All.SendAsync("VesselUpdate", payload);
            Console.WriteLine($"Sent to SignalR: {payload}");
        }
    }
}

