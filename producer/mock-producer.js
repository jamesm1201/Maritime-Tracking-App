require('dotenv').config(); // Gets port to send to from .env file
const { Kafka } = require('kafkajs'); // Kafka client library

// clientId: so Kafka knows which application is connecting. 
// Useful when you have multiple producers and want to identify them in Kafka UI. It doesn't affect functionality.
// brokers: list of Kafka broker addresses. Here there is one broker running locally on port 9092 (forwarded from Docker).
// In production, this would be the address of Kafka cluster. 
const kafka = new Kafka({
  clientId: 'mock-ais-producer',
  brokers: [process.env.KAFKA_BROKER],
});

// Create a Kafka producer instance. 
// Opens channel to send messages to Kafka.
const producer = kafka.producer();

// Function to generate random vessel position data within the bounding box
const BOUNDING_BOX = {
  minLat: 24.0, maxLat: 28.0,
  minLon: 55.0, maxLon: 60.0,
};

// Lists for generating random vessel attributes
const SHIP_NAMES = ['ATLANTIC STAR', 'GULF PIONEER', 'PERSIAN TRADER', 
                    'HORMUZ EXPRESS', 'STRAIT RUNNER', 'DESERT WIND'];

const FLAGS = ['IR', 'US', 'GB', 'AE', 'SA', 'CN'];

const VESSEL_TYPES = ['Tanker', 'Cargo', 'Military', 'Fishing', 'Passenger'];

function generateVessel() {
  return {
    // mmsi is unique ID for vessel, generate random 9-digit number as string
    mmsi:        String(Math.floor(Math.random() * 900000000) + 100000000),
    shipName:    SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)],
    lat:         Math.random() * (BOUNDING_BOX.maxLat - BOUNDING_BOX.minLat) + BOUNDING_BOX.minLat,
    lon:         Math.random() * (BOUNDING_BOX.maxLon - BOUNDING_BOX.minLon) + BOUNDING_BOX.minLon,
    speed:       Math.random() * 20,
    heading:     Math.floor(Math.random() * 360),
    vesselType:  VESSEL_TYPES[Math.floor(Math.random() * VESSEL_TYPES.length)],
    flag:        FLAGS[Math.floor(Math.random() * FLAGS.length)],
    destination: 'BANDAR ABBAS',
    timestamp:   Date.now(),
  };
}

async function startMockProducer() {
  await producer.connect();
  console.log('Mock Kafka producer connected');

  setInterval(async () => {
    const vessel = generateVessel();

    await producer.send({
      topic: 'vessel.positions',
      messages: [
        {
          key:   vessel.mmsi,
          value: JSON.stringify(vessel),
        },
      ],
    });

    console.log(`${vessel.shipName} (${vessel.mmsi}) — ${vessel.lat.toFixed(4)}, ${vessel.lon.toFixed(4)} — ${vessel.speed.toFixed(1)}kts`);
  }, 1000);
}

// Shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down mock producer...');
  await producer.disconnect();
  process.exit(0);
});


// Starts process when run with `node mock-producer.js`
startMockProducer().catch(console.error);