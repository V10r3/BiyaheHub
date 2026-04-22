-- ============================================================
--  BiyaheHub — MySQL Schema + Seed Data
--  Run: mysql -u root -p < backend/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS BiyaheHub_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE BiyaheHub_db;

-- ── Migration: update account_type ENUM if the table already exists ───────────
-- Safe to run repeatedly; ALTER only fires when the column definition differs.
ALTER TABLE users
  MODIFY COLUMN account_type ENUM('driver','commuter') NOT NULL;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  userName      VARCHAR(100)                              NOT NULL,
  email         VARCHAR(150)                              NOT NULL UNIQUE,
  password_hash VARCHAR(255)                              NOT NULL,
  account_type  ENUM('driver','commuter')                 NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Routes ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  routeName   VARCHAR(150)                                NOT NULL,
  designation VARCHAR(20)                                 NOT NULL,
  start_point VARCHAR(150)                                NOT NULL,
  end_point   VARCHAR(150)                                NOT NULL,
  fare        DECIMAL(6,2)                                NOT NULL DEFAULT 13.00,
  routeType   ENUM('jeepney','bus','taxi','train')        NOT NULL,
  waypoints   JSON                                        NOT NULL COMMENT '[[lat,lng],...]',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Vehicles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  driver_id      INT                                      NULL,
  route_id       INT                                      NOT NULL,
  vehicleType    ENUM('jeepney','bus','taxi')              NOT NULL,
  plate_no       VARCHAR(20)                              NOT NULL,
  seats_total    INT                                      NOT NULL DEFAULT 16,
  seats_occupied INT                                      NOT NULL DEFAULT 0,
  lat            DECIMAL(10,7)                            NOT NULL,
  lng            DECIMAL(10,7)                            NOT NULL,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id) REFERENCES routes(id)
);

-- ── Traffic Segments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_segments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  segment_name VARCHAR(150)                               NOT NULL,
  trafficLevel ENUM('clear','moderate','heavy')           NOT NULL DEFAULT 'clear',
  lat_start    DECIMAL(10,7)                              NOT NULL,
  lng_start    DECIMAL(10,7)                              NOT NULL,
  lat_end      DECIMAL(10,7)                              NOT NULL,
  lng_end      DECIMAL(10,7)                              NOT NULL,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── User Vehicles  (one row per driver, upserted by user_id) ──────────────────
CREATE TABLE IF NOT EXISTS user_vehicles (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  make         VARCHAR(100) NOT NULL,
  model        VARCHAR(100) NOT NULL,
  year         INT          NOT NULL,
  engineType   VARCHAR(100),
  fuelType     ENUM('gasoline','diesel','premium','lpg','electric') NOT NULL DEFAULT 'gasoline',
  mileage      DECIMAL(8,2) COMMENT 'L/100km city average',
  tankMax      DECIMAL(6,2) NOT NULL DEFAULT 40.00 COMMENT 'full tank in liters',
  tankCurrent  DECIMAL(6,2) NOT NULL DEFAULT 0.00  COMMENT 'current level in liters',
  isManual     TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '1 = advanced/manual entry',
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_vehicle (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Fuel Logs  (refuel events per driver) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT           NOT NULL,
  liters_added DECIMAL(6,2)  NOT NULL,
  price_per_L  DECIMAL(6,2)  NOT NULL,
  total_cost   DECIMAL(8,2)  NOT NULL,
  odometer_km  DECIMAL(10,2),
  notes        VARCHAR(255),
  logged_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
--  SEED DATA
-- ============================================================

-- Demo users (plain-text passwords for dev only — use bcrypt in production)
INSERT INTO users (userName, email, password_hash, account_type) VALUES
  ('Juan Driver',    'driver@demo.com',   'demo123', 'driver'),
  ('Pedro Commuter', 'commuter@demo.com', 'demo123', 'commuter');

-- ── Routes ────────────────────────────────────────────────────────────────────
-- Waypoints trace along actual Cebu City roads so OSRM can snap them cleanly.

INSERT INTO routes (routeName, designation, start_point, end_point, fare, routeType, waypoints) VALUES

-- 01K  Urgello → Colon → SM City → Parkmall (Mandaue)
(
  'Urgello to Parkmall', '01K',
  'Urgello', 'Parkmall',
  13.00, 'jeepney',
  '[[10.2950,123.8900],[10.2937,123.9009],[10.3000,123.9060],[10.3116,123.9185],[10.3350,123.9280],[10.3517,123.9358]]'
),

-- 04C  Carbon Market → Colon → Jones Ave → IT Park → SM City
(
  'Carbon to SM City', '04C',
  'Carbon Market', 'SM City Cebu',
  13.00, 'jeepney',
  '[[10.2922,123.9012],[10.2937,123.9009],[10.3050,123.8960],[10.3150,123.9000],[10.3116,123.9185]]'
),

-- 17B  Carbon → Colon → Jones Ave → Lahug → IT Park → Talamban
(
  'Carbon to Talamban', '17B',
  'Carbon Market', 'Talamban',
  15.00, 'jeepney',
  '[[10.2922,123.9012],[10.2937,123.9009],[10.3050,123.8960],[10.3185,123.9054],[10.3277,123.9055],[10.3450,123.9080],[10.3671,123.9103]]'
),

-- 10C  Bulacao → N. Bacalso Ave → Urgello → Colon → Carbon
(
  'Bulacao to Carbon', '10C',
  'Bulacao', 'Carbon Market',
  13.00, 'jeepney',
  '[[10.2700,123.8750],[10.2800,123.8830],[10.2900,123.8880],[10.2950,123.8900],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- B-01  South Bus Terminal → Osmeña Blvd → Fuente → Ayala → North Terminal
(
  'South Terminal to North Terminal', 'B-01',
  'South Bus Terminal', 'North Bus Terminal',
  25.00, 'bus',
  '[[10.2803,123.8827],[10.2980,123.8930],[10.3100,123.8940],[10.3185,123.9054],[10.3400,123.9100],[10.3550,123.9108]]'
),

-- B-02  Ayala → SM City → Mandaue → Mactan Bridge → Airport
(
  'Ayala to Mactan Airport', 'B-02',
  'Ayala Center Cebu', 'Mactan Airport',
  35.00, 'bus',
  '[[10.3185,123.9054],[10.3116,123.9185],[10.3300,123.9270],[10.3200,123.9500],[10.3074,123.9797]]'
);

-- ── Traffic Segments ──────────────────────────────────────────────────────────
INSERT INTO traffic_segments (segment_name, trafficLevel, lat_start, lng_start, lat_end, lng_end) VALUES
  ('Colon Street',      'heavy',    10.2922, 123.9000, 10.2980, 123.9030),
  ('Osmeña Blvd',       'moderate', 10.2980, 123.8930, 10.3100, 123.8950),
  ('N. Bacalso Ave',    'clear',    10.2700, 123.8750, 10.2900, 123.8880),
  ('Jones Avenue',      'moderate', 10.2950, 123.8960, 10.3185, 123.9054),
  ('N. Escario Street', 'clear',    10.3000, 123.9060, 10.3116, 123.9185),
  ('Mandaue Bridge',    'heavy',    10.3300, 123.9270, 10.3400, 123.9350);

-- ── Vehicles ──────────────────────────────────────────────────────────────────
-- One vehicle per route, positioned somewhere along its path
INSERT INTO vehicles (driver_id, route_id, vehicleType, plate_no, seats_total, seats_occupied, lat, lng) VALUES
  (1, 1, 'jeepney', 'ABC-1234', 16,  9, 10.3000, 123.9060),
  (2, 2, 'jeepney', 'DEF-5678', 16,  3, 10.2980, 123.9020),
  (3, 3, 'jeepney', 'GHI-9012', 16, 12, 10.3185, 123.9054),
  (1, 4, 'jeepney', 'JKL-3456', 16,  7, 10.2850, 123.8850),
  (2, 5, 'bus',     'BUS-0001', 50, 35, 10.3100, 123.8940),
  (3, 6, 'bus',     'BUS-0002', 50, 28, 10.3200, 123.9400);