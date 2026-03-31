using HormuzBackend.Hubs;
using HormuzBackend.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR(); // Register SignalR services
// Configure CORS to allow requests from the React app
builder.Services.AddCors(options => {
    options.AddPolicy("ReactApp", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// Register the Kafka consumer background service.
builder.Services.AddHostedService<KafkaConsumerService>();

var app = builder.Build();

// Activates CORS policy for the React app and maps the SignalR hub
app.UseCors("ReactApp");
// Registers SignalR hub endpoint at specified URL
app.MapHub<MissionHub>("/hubs/mission");

app.Run();