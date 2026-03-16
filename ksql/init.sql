-- ─────────────────────────────────────────────
-- ksqlDB Init Script
-- Run via CLI: docker exec -it hormuz_ksqldb_cli ksql http://ksqldb-server:8088
-- Then paste queries below one at a time, or: RUN SCRIPT '/path/to/init.sql';
-- ─────────────────────────────────────────────

-- Step 1: Declare the raw Kafka topic as a ksqlDB stream
CREATE STREAM IF NOT EXISTS vessel_positions (
  mmsi        VARCHAR,
  shipName    VARCHAR,
  lat         DOUBLE,
  lon         DOUBLE,
  speed       DOUBLE,
  heading     DOUBLE,
  vesselType  VARCHAR,
  flag        VARCHAR,
  destination VARCHAR,
  timestamp   BIGINT
) WITH (
  KAFKA_TOPIC = 'vessel.positions',
  VALUE_FORMAT = 'JSON',
  TIMESTAMP = 'timestamp'
);

-- Step 2: Tankers only
CREATE STREAM IF NOT EXISTS tankers_only
  WITH (KAFKA_TOPIC = 'tankers.only', VALUE_FORMAT = 'JSON')
AS SELECT *
   FROM vessel_positions
   WHERE vesselType = 'Tanker'
   EMIT CHANGES;

-- Step 3: Iranian-flagged vessels
CREATE STREAM IF NOT EXISTS iranian_vessels
  WITH (KAFKA_TOPIC = 'iranian.vessels', VALUE_FORMAT = 'JSON')
AS SELECT *
   FROM vessel_positions
   WHERE flag = 'IR'
   EMIT CHANGES;

-- Step 4: Loitering vessels (speed under 2 knots)
CREATE STREAM IF NOT EXISTS loitering_vessels
  WITH (KAFKA_TOPIC = 'loitering.vessels', VALUE_FORMAT = 'JSON')
AS SELECT *
   FROM vessel_positions
   WHERE speed < 2.0
   EMIT CHANGES;

-- Step 5: Geofence alerts — non-Iranian vessels entering Iranian waters
CREATE STREAM IF NOT EXISTS geofence_alerts
  WITH (KAFKA_TOPIC = 'geofence.alerts', VALUE_FORMAT = 'JSON')
AS SELECT *
   FROM vessel_positions
   WHERE lat BETWEEN 25.5 AND 27.5
     AND lon BETWEEN 56.0 AND 57.5
     AND flag != 'IR'
   EMIT CHANGES;

-- Step 6: Vessel count by flag — 5 minute tumbling window
CREATE TABLE IF NOT EXISTS vessels_by_flag
  WITH (KAFKA_TOPIC = 'vessels.by.flag', VALUE_FORMAT = 'JSON')
AS SELECT
    flag,
    COUNT(*) AS vessel_count,
    WINDOWSTART AS window_start,
    WINDOWEND AS window_end
  FROM vessel_positions
  WINDOW TUMBLING (SIZE 5 MINUTES)
  GROUP BY flag
  EMIT CHANGES;