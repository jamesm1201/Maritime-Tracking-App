require("dotenv").config();
const { Kafka } = require("kafkajs");
const WebSocket = require("ws");

// Producer config - send messages to Kafka topic "vessel.positions"
const kafka = new Kafka({
  clientId: "ais-producer",
  // Points to local port 9092 which is forwarded to the Kafka broker in Docker
  brokers: [process.env.KAFKA_BROKER],
});

const producer = kafka.producer();


// Tells AISStream.io to only send messages for vessels in the Strait of Hormuz area (lat 24-28, lon 55-60)
const BOUNDING_BOX = [[55.0, 24.0, 60.0, 28.0]];

// Connects to AISStream.io via WebSocket, subscribes to the bounding box, and forwards position reports to Kafka
async function startProducer() {
  await producer.connect();
  console.log("Kafka producer connected");
  // Websocket means data is pushed continuously without request
  const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

  // When connection is open, send API key and bounding box
  // Position reports for vessels in the Strait of Hormuz will start streaming in real-time
  ws.on("open", () => {
    console.log("Connected to aisstream.io");

    const subscribeMessage = {
      APIKey: process.env.AISSTREAM_API_KEY,
      BoundingBoxes: BOUNDING_BOX,
      FilterMessageTypes: ["PositionReport"],
    };

    ws.send(JSON.stringify(subscribeMessage));
    console.log("Subscribed to Strait of Hormuz bounding box");
  });

  // Message handler - fires everytime API pushes a new message
  // Reshapes into a clean object (vessel) and sends to Kafka topic "vessel.positions"
  ws.on("message", async (data) => {
    try {
      const aisMessage = JSON.parse(data);

      // Only process position reports
      if (aisMessage.MessageType !== "PositionReport") return;

      const meta = aisMessage.MetaData;
      const pos = aisMessage.Message?.PositionReport;

      if (!meta || !pos) return;

      // mmsi is unique ID for vessel
      const vessel = {
        mmsi: String(meta.MMSI),
        shipName: meta.ShipName?.trim() || "UNKNOWN",
        lat: meta.latitude,
        lon: meta.longitude,
        speed: pos.Sog, // Speed over ground (knots)
        heading: pos.TrueHeading ?? pos.Cog,
        vesselType: meta.ShipType || "Unknown",
        flag: meta.flag || "",
        destination: meta.Destination?.trim() || "",
        timestamp: Date.now(),
      };

      // Publish to Kafka
      await producer.send({
        topic: "vessel.positions",
        messages: [
          {
            key: vessel.mmsi, // MMSI as key — ensures same ship goes to same partition
            value: JSON.stringify(vessel),
          },
        ],
      });

      console.log(
        `${vessel.shipName} (${vessel.mmsi}) — ${vessel.lat}, ${vessel.lon} — ${vessel.speed}kts`,
      );
    } catch (err) {
      console.error("Error processing AIS message:", err.message);
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });
 // If connection closes, attempt to reconnect after a delay
  ws.on("close", () => {
    console.warn("⚠️  WebSocket closed — reconnecting in 5s...");
    setTimeout(startProducer, 5000);
  });
}

// Shutdown handler
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await producer.disconnect();
  process.exit(0);
});

startProducer().catch(console.error);
