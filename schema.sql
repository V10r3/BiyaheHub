-- ============================================================
--  RouteMap PH — MySQL Schema + Seed Data
--  Run: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS routemap_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE routemap_db;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100)                                NOT NULL,
  email        VARCHAR(150)                                NOT NULL UNIQUE,
  password_hash VARCHAR(255)                               NOT NULL,
  account_type ENUM('puvpuj','private','commuter')         NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Routes ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150)                                  NOT NULL,
  designation VARCHAR(20)                                   NOT NULL,
  start_point VARCHAR(150)                                  NOT NULL,
  end_point   VARCHAR(150)                                  NOT NULL,
  fare        DECIMAL(6,2)                                  NOT NULL DEFAULT 13.00,
  type        ENUM('jeepney','bus','taxi','train')           NOT NULL,
  waypoints   JSON                                          NOT NULL COMMENT '[[lat,lng],...]',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Vehicles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  driver_id      INT                                        NULL,
  route_id       INT                                        NOT NULL,
  type           ENUM('jeepney','bus','taxi')               NOT NULL,
  plate_no       VARCHAR(20)                                NOT NULL,
  seats_total    INT                                        NOT NULL DEFAULT 16,
  seats_occupied INT                                        NOT NULL DEFAULT 0,
  lat            DECIMAL(10,7)                              NOT NULL,
  lng            DECIMAL(10,7)                              NOT NULL,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id) REFERENCES routes(id)
);

-- ── Traffic Segments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traffic_segments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  segment_name VARCHAR(150)                                 NOT NULL,
  level        ENUM('clear','moderate','heavy')             NOT NULL DEFAULT 'clear',
  lat_start    DECIMAL(10,7)                                NOT NULL,
  lng_start    DECIMAL(10,7)                                NOT NULL,
  lat_end      DECIMAL(10,7)                                NOT NULL,
  lng_end      DECIMAL(10,7)                                NOT NULL,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
--  SEED DATA
-- ============================================================

-- Demo users (password stored as plain text for dev only — use bcrypt in production!)
INSERT INTO users (name, email, password_hash, account_type) VALUES
  ('Juan Driver',   'puvpuj@demo.com',   'demo123', 'puvpuj'),
  ('Maria Private', 'private@demo.com',  'demo123', 'private'),
  ('Pedro Commuter','commuter@demo.com', 'demo123', 'commuter');

-- Jeepney routes in Cebu City
INSERT INTO routes (name, designation, start_point, end_point, fare, type, waypoints) VALUES
(
  'Urgello to Parkmall', '01K',
  'Urgello', 'Parkmall',
  13.00, 'jeepney',
  '[[10.295,123.89],[10.300,123.895],[10.305,123.900],[10.310,123.905]]'
),
(
  'Carbon to SM Cebu', '04C',
  'Carbon Market', 'SM City Cebu',
  13.00, 'jeepney',
  '[[10.291,123.901],[10.295,123.905],[10.300,123.908],[10.308,123.910]]'
),
(
  'South Terminal to North Terminal', 'B-01',
  'South Bus Terminal', 'North Bus Terminal',
  25.00, 'bus',
  '[[10.280,123.880],[10.290,123.890],[10.300,123.900],[10.320,123.905]]'
);

-- Traffic segments
INSERT INTO traffic_segments (segment_name, level, lat_start, lng_start, lat_end, lng_end) VALUES
  ('Colon Street',  'heavy',    10.2940, 123.9000, 10.2980, 123.9030),
  ('Osmeña Blvd',   'moderate', 10.2980, 123.8930, 10.3080, 123.8950),
  ('N. Bacalso Ave','clear',    10.2800, 123.8850, 10.2900, 123.8880);

-- Vehicles (linked to route IDs 1, 2, 3 above)
INSERT INTO vehicles (driver_id, route_id, type, plate_no, seats_total, seats_occupied, lat, lng) VALUES
  (1, 1, 'jeepney', 'ABC-1234', 16, 9,  10.2970, 123.8920),
  (2, 2, 'jeepney', 'DEF-5678', 16, 3,  10.2930, 123.9030),
  (3, 3, 'bus',     'BUS-0001', 50, 35, 10.2840, 123.8820);
