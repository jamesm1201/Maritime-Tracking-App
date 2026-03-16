# Hormuz Maritime Surveillance

A real-time maritime domain awareness dashboard tracking vessel activity in the Strait of Hormuz. Live AIS data is ingested, filtered through a Kafka stream pipeline, and pushed to a React map interface showing live ship positions, alerts, and analytics.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Data Source | aisstream.io WebSocket (live AIS feed) |
| Message Broker | Apache Kafka |
| Stream Processing | ksqlDB |
| Backend | ASP.NET Core 8 + SignalR |
| Frontend | React + Vite + Mapbox GL |
| Persistent Store | PostgreSQL + PostGIS *(planned)* |
| Infrastructure | Docker |

---

## Architecture

```
aisstream.io
     ↓
Node.js Producer  →  Kafka (vessel.positions)
                           ↓
                        ksqlDB
                     ↙    ↓    ↘
              tankers  iranian  loitering  geofence.alerts
                           ↓
                     .NET Backend
                      ↙        ↘
                SignalR        PostGIS
                   ↓
            React Dashboard
```

---

## Current Progress

- [x] Docker Compose — Kafka, Zookeeper, ksqlDB, Kafka UI
- [x] ksqlDB init SQL — vessel.positions stream and derived topics
- [x] Node.js AIS producer — connects to aisstream.io, publishes to Kafka
- [ ] .NET backend — Kafka consumers + SignalR hub
- [ ] React frontend — Mapbox GL live map
- [ ] Alerts and analytics panels
- [ ] PostGIS persistent storage and playback

---

## Getting Started

### Prerequisites

- Docker Desktop
- Node.js 20+
- .NET 8 SDK

### 1. Start Infrastructure

```bash
docker compose up -d
```

Kafka UI available at http://localhost:8080

### 2. Start AIS Producer

```bash
cd producer
npm install
node producer.js
```

Create a `.env` file in the `producer/` folder:

```
AISSTREAM_API_KEY=your_key_here
KAFKA_BROKER=localhost:9092
```

---

## Kafka Topics

| Topic | Description |
|-------|-------------|
| `vessel.positions` | Raw AIS positions — all vessels |
| `tankers.only` | Filtered by vessel type = Tanker |
| `iranian.vessels` | Filtered by flag = IR |
| `loitering.vessels` | Speed under 2 knots |
| `geofence.alerts` | Non-Iranian vessels entering Iranian waters |
| `vessels.by.flag` | Live vessel count grouped by nationality |
