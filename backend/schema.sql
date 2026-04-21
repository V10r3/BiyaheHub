-- ============================================================
--  BiyaheHub — MySQL Schema + Seed Data
--  Run: mysql -u root -p < backend/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS BiyaheHub_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE BiyaheHub_db;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  userName      VARCHAR(100)                              NOT NULL,
  email         VARCHAR(150)                              NOT NULL UNIQUE,
  password_hash VARCHAR(255)                              NOT NULL,
  account_type  ENUM('puvpuj','private','commuter')       NOT NULL,
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

-- ============================================================
--  SEED DATA
-- ============================================================

-- Demo users (plain-text passwords for dev only — use bcrypt in production)
INSERT INTO users (userName, email, password_hash, account_type) VALUES
  ('Juan Driver',    'puvpuj@demo.com',   'demo123', 'puvpuj'),
  ('Maria Private',  'private@demo.com',  'demo123', 'private'),
  ('Pedro Commuter', 'commuter@demo.com', 'demo123', 'commuter');

-- ── Routes ────────────────────────────────────────────────────────────────────
-- Waypoints trace along actual Cebu City roads so OSRM can snap them cleanly.

INSERT INTO routes (routeName, designation, start_point, end_point, fare, routeType, waypoints) VALUES

-- ============================================================
--  ZONE 01 — Urgello, Sambag & Pier Area
-- ============================================================

-- 01B  Urgello → Colon → Pier Area
(
  'Urgello to Pier Area', '01B',
  'Urgello', 'Pier Area',
  13.00, 'jeepney',
  '[[10.2950,123.8900],[10.2937,123.9009],[10.2980,123.9060],[10.3000,123.9100]]'
),

-- 01C  Sambag → Colon → Pier Area
(
  'Sambag to Pier Area', '01C',
  'Sambag', 'Pier Area',
  13.00, 'jeepney',
  '[[10.3010,123.8870],[10.2990,123.8950],[10.2937,123.9009],[10.2980,123.9060],[10.3000,123.9100]]'
),

-- 02S  South Bus Terminal → Colon
(
  'South Bus to Colon', '02S',
  'South Bus Terminal', 'Colon Street',
  13.00, 'jeepney',
  '[[10.2803,123.8827],[10.2870,123.8880],[10.2937,123.9009]]'
),

-- ============================================================
--  ZONE 02 — Pier Area
-- ============================================================

-- 02B  Pier Area → Colon → Ayala
(
  'Pier Area to Ayala', '02B',
  'Pier Area', 'Ayala Center Cebu',
  13.00, 'jeepney',
  '[[10.3000,123.9100],[10.2980,123.9060],[10.2937,123.9009],[10.3024,123.8944],[10.3185,123.9054]]'
),

-- 21D  Pier Area → Cathedral → Mandaue
(
  'Pier Area to Mandaue', '21D',
  'Pier Area', 'Mandaue City',
  17.00, 'jeepney',
  '[[10.3000,123.9100],[10.3050,123.9070],[10.3116,123.9185],[10.3236,123.9448]]'
),

-- ============================================================
--  ZONE 03 — Mabolo
-- ============================================================

-- 03A  Sindulan → M.J. Cuenco
(
  'Sindulan to M.J. Cuenco', '03A',
  'Sindulan', 'M.J. Cuenco',
  13.00, 'jeepney',
  '[[10.3230,123.9060],[10.3200,123.9120],[10.3185,123.9054]]'
),

-- 03L  Panagdait → M.J. Cuenco
(
  'Panagdait to M.J. Cuenco', '03L',
  'Panagdait', 'M.J. Cuenco',
  13.00, 'jeepney',
  '[[10.3280,123.9100],[10.3250,123.9090],[10.3200,123.9120],[10.3185,123.9054]]'
),

-- 03B  Cabantan → Osmeña Blvd
(
  'Cabantan to Osmena Blvd', '03B',
  'Cabantan', 'Osmeña Boulevard',
  13.00, 'jeepney',
  '[[10.3180,123.9020],[10.3150,123.8990],[10.3100,123.8940]]'
),

-- 030  Ayala → M.J. Cuenco
(
  'Ayala to M.J. Cuenco', '030',
  'Ayala Center Cebu', 'M.J. Cuenco',
  13.00, 'jeepney',
  '[[10.3185,123.9054],[10.3200,123.9080],[10.3200,123.9120]]'
),

-- ============================================================
--  ZONE 04 — Oppra & Apas
-- ============================================================

-- 04D  Oppra → Lahug → Ayala
(
  'Oppra to Ayala', '04D',
  'Oppra', 'Ayala Center Cebu',
  13.00, 'jeepney',
  '[[10.3390,123.8980],[10.3320,123.9010],[10.3277,123.9055],[10.3185,123.9054]]'
),

-- 04H  Oppra → Colon
(
  'Oppra to Colon', '04H',
  'Oppra', 'Colon Street',
  13.00, 'jeepney',
  '[[10.3390,123.8980],[10.3320,123.9010],[10.3100,123.8960],[10.2937,123.9009]]'
),

-- 04I  Oppra → Carbon
(
  'Oppra to Carbon', '04I',
  'Oppra', 'Carbon Market',
  15.00, 'jeepney',
  '[[10.3390,123.8980],[10.3320,123.9010],[10.3100,123.8960],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- 04B  Camp Lapulapu → Colon
(
  'Camp Lapulapu to Colon', '04B',
  'Camp Lapulapu', 'Colon Street',
  13.00, 'jeepney',
  '[[10.3460,123.9080],[10.3350,123.9040],[10.3185,123.9054],[10.3050,123.8960],[10.2937,123.9009]]'
),

-- 04C  Plaza Housing → Carbon
(
  'Plaza Housing to Carbon', '04C',
  'Plaza Housing', 'Carbon Market',
  13.00, 'jeepney',
  '[[10.3500,123.9060],[10.3400,123.9050],[10.3185,123.9054],[10.3050,123.8960],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- 04L  Lahug → Ayala → SM Cebu
(
  'Lahug to SM City Cebu', '04L',
  'Lahug', 'SM City Cebu',
  13.00, 'jeepney',
  '[[10.3261,123.8978],[10.3277,123.9055],[10.3185,123.9054],[10.3116,123.9185]]'
),

-- 04M  Lahug → Ayala → SM Cebu (via Mango Ave)
(
  'Lahug to SM City via Mango', '04M',
  'Lahug', 'SM City Cebu',
  13.00, 'jeepney',
  '[[10.3261,123.8978],[10.3200,123.9000],[10.3185,123.9054],[10.3116,123.9185]]'
),

-- 14D  Apas → Lahug → Ayala
(
  'Apas to Ayala', '14D',
  'Apas', 'Ayala Center Cebu',
  13.00, 'jeepney',
  '[[10.3350,123.9000],[10.3310,123.9020],[10.3277,123.9055],[10.3185,123.9054]]'
),

-- ============================================================
--  ZONE 06/07 — Guadalupe & Banawa
-- ============================================================

-- 06B  Guadalupe → Ayala → SM Cebu
(
  'Guadalupe to SM City', '06B',
  'Guadalupe', 'SM City Cebu',
  13.00, 'jeepney',
  '[[10.3024,123.8756],[10.3050,123.8840],[10.3185,123.9054],[10.3116,123.9185]]'
),

-- 06C  Guadalupe → Capitol → Carbon
(
  'Guadalupe to Carbon via Capitol', '06C',
  'Guadalupe', 'Carbon Market',
  13.00, 'jeepney',
  '[[10.3024,123.8756],[10.3060,123.8840],[10.3100,123.8900],[10.3050,123.8960],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- 06F  Guadalupe → Fuente → SM Cebu
(
  'Guadalupe to SM City via Fuente', '06F',
  'Guadalupe', 'SM City Cebu',
  13.00, 'jeepney',
  '[[10.3024,123.8756],[10.3050,123.8840],[10.3100,123.8940],[10.3185,123.9054],[10.3116,123.9185]]'
),

-- 06G  Guadalupe → V. Rama → Carbon
(
  'Guadalupe to Carbon via V.Rama', '06G',
  'Guadalupe', 'Carbon Market',
  13.00, 'jeepney',
  '[[10.3024,123.8756],[10.2980,123.8800],[10.2950,123.8870],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- 06H  Guadalupe → Ayala → SM Cebu (express)
(
  'Guadalupe to SM City Express', '06H',
  'Guadalupe', 'SM City Cebu',
  13.00, 'jeepney',
  '[[10.3024,123.8756],[10.3100,123.8900],[10.3185,123.9054],[10.3116,123.9185]]'
),

-- 07B  Banawa → V. Rama → C. Padilla
(
  'Banawa to C. Padilla', '07B',
  'Banawa', 'C. Padilla Street',
  13.00, 'jeepney',
  '[[10.3070,123.8700],[10.3020,123.8780],[10.2980,123.8840],[10.2960,123.8900]]'
),

-- 07D  Banawa → Fuente → Colon
(
  'Banawa to Colon', '07D',
  'Banawa', 'Colon Street',
  13.00, 'jeepney',
  '[[10.3070,123.8700],[10.3050,123.8800],[10.3024,123.8944],[10.2937,123.9009]]'
),

-- 07E  Banawa → Carbon
(
  'Banawa to Carbon', '07E',
  'Banawa', 'Carbon Market',
  13.00, 'jeepney',
  '[[10.3070,123.8700],[10.3050,123.8800],[10.3024,123.8944],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- ============================================================
--  ZONE 08/11 — Alumnos & Inayawan
-- ============================================================

-- 08G  Inayawan → Alumnos → Colon
(
  'Inayawan to Colon', '08G',
  'Inayawan', 'Colon Street',
  13.00, 'jeepney',
  '[[10.2620,123.8780],[10.2680,123.8820],[10.2750,123.8870],[10.2800,123.8920],[10.2937,123.9009]]'
),

-- 11A  Alumnos → Colon
(
  'Alumnos to Colon', '11A',
  'Alumnos', 'Colon Street',
  13.00, 'jeepney',
  '[[10.2700,123.8800],[10.2780,123.8880],[10.2850,123.8940],[10.2937,123.9009]]'
),

-- 11A (Magallanes variant)  Alumnos → Magallanes
(
  'Alumnos to Magallanes', '11AM',
  'Alumnos', 'Magallanes',
  13.00, 'jeepney',
  '[[10.2700,123.8800],[10.2780,123.8880],[10.2870,123.8960],[10.2900,123.9000],[10.2920,123.9030]]'
),

-- ============================================================
--  ZONE 09/10 — Bulacao & Basak
-- ============================================================

-- 09C  Basak → N. Bacalso → Colon
(
  'Basak to Colon', '09C',
  'Basak', 'Colon Street',
  13.00, 'jeepney',
  '[[10.2833,123.8867],[10.2820,123.8900],[10.2850,123.8940],[10.2900,123.8970],[10.2937,123.9009]]'
),

-- 09F  Basak → Carbon (via Fuente)
(
  'Basak to Carbon via Fuente', '09F',
  'Basak', 'Carbon Market',
  13.00, 'jeepney',
  '[[10.2833,123.8867],[10.2900,123.8900],[10.3024,123.8944],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- 09G  Basak → SM Cebu
(
  'Basak to SM City', '09G',
  'Basak', 'SM City Cebu',
  15.00, 'jeepney',
  '[[10.2833,123.8867],[10.2900,123.8900],[10.3024,123.8944],[10.3116,123.9185]]'
),

-- 10F  Bulacao → N. Bacalso → Carbon
(
  'Bulacao to Carbon', '10F',
  'Bulacao', 'Carbon Market',
  13.00, 'jeepney',
  '[[10.2700,123.8750],[10.2800,123.8830],[10.2900,123.8880],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- 10G  Bulacao → N. Bacalso → Colon → SM Cebu
(
  'Bulacao to SM City', '10G',
  'Bulacao', 'SM City Cebu',
  15.00, 'jeepney',
  '[[10.2700,123.8750],[10.2800,123.8830],[10.2950,123.8900],[10.2937,123.9009],[10.3116,123.9185]]'
),

-- 10H  Bulacao → Urgello → Colon
(
  'Bulacao to Colon via Urgello', '10H',
  'Bulacao', 'Colon Street',
  13.00, 'jeepney',
  '[[10.2700,123.8750],[10.2800,123.8830],[10.2900,123.8880],[10.2950,123.8900],[10.2937,123.9009]]'
),

-- 10M  Bulacao → SM Cebu (express)
(
  'Bulacao to SM City Express', '10M',
  'Bulacao', 'SM City Cebu',
  15.00, 'jeepney',
  '[[10.2700,123.8750],[10.2850,123.8870],[10.3024,123.8944],[10.3116,123.9185]]'
),

-- ============================================================
--  ZONE 12 — Labangon
-- ============================================================

-- 12A  Labangon → Colon
(
  'Labangon to Colon', '12A',
  'Labangon', 'Colon Street',
  13.00, 'jeepney',
  '[[10.2880,123.8820],[10.2900,123.8870],[10.2920,123.8950],[10.2937,123.9009]]'
),

-- 12B  Labangon → Carbon
(
  'Labangon to Carbon', '12B',
  'Labangon', 'Carbon Market',
  13.00, 'jeepney',
  '[[10.2880,123.8820],[10.2900,123.8870],[10.2920,123.8950],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- 12D  Punta Princesa → Labangon → Colon → SM Cebu
(
  'Punta Princesa to SM City via Labangon', '12D',
  'Punta Princesa', 'SM City Cebu',
  15.00, 'jeepney',
  '[[10.3011,123.8756],[10.2950,123.8800],[10.2880,123.8820],[10.2937,123.9009],[10.3116,123.9185]]'
),

-- 12G  Magallanes → Cathedral → SM Cebu
(
  'Magallanes to SM City via Cathedral', '12G',
  'Magallanes', 'SM City Cebu',
  15.00, 'jeepney',
  '[[10.2920,123.9030],[10.2970,123.9050],[10.3050,123.9070],[10.3116,123.9185]]'
),

-- 12I  Magallanes → Colon → Carbon
(
  'Magallanes to Carbon', '12I',
  'Magallanes', 'Carbon Market',
  13.00, 'jeepney',
  '[[10.2920,123.9030],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- 12L  Punta Princesa → Cathedral → Carbon
(
  'Punta Princesa to Carbon via Cathedral', '12L',
  'Punta Princesa', 'Carbon Market',
  13.00, 'jeepney',
  '[[10.3011,123.8756],[10.3000,123.8820],[10.3024,123.8944],[10.2980,123.8960],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- ============================================================
--  ZONE 13 — Talamban
-- ============================================================

-- 13A  Pit-os → Talamban → Colon
(
  'Pit-os to Colon', '13A',
  'Pit-os', 'Colon Street',
  15.00, 'jeepney',
  '[[10.3750,123.9150],[10.3671,123.9103],[10.3550,123.9090],[10.3277,123.9055],[10.3100,123.8960],[10.2937,123.9009]]'
),

-- 13B  Talamban → Ayala → Colon
(
  'Talamban to Colon via Ayala', '13B',
  'Talamban', 'Colon Street',
  15.00, 'jeepney',
  '[[10.3671,123.9103],[10.3450,123.9080],[10.3185,123.9054],[10.3050,123.8960],[10.2937,123.9009]]'
),

-- 13C  Talamban → Carbon
(
  'Talamban to Carbon', '13C',
  'Talamban', 'Carbon Market',
  15.00, 'jeepney',
  '[[10.3671,123.9103],[10.3450,123.9080],[10.3185,123.9054],[10.3050,123.8960],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- 13E  Talamban → Mandaue (alternate)
(
  'Talamban to Mandaue Alternate', '13E',
  'Talamban', 'Mandaue City',
  17.00, 'jeepney',
  '[[10.3671,123.9103],[10.3600,123.9150],[10.3517,123.9358],[10.3400,123.9400],[10.3236,123.9448]]'
),

-- 13H  Talamban → Mandaue (via highway)
(
  'Talamban to Mandaue via Highway', '13H',
  'Talamban', 'Mandaue City',
  17.00, 'jeepney',
  '[[10.3671,123.9103],[10.3650,123.9200],[10.3550,123.9300],[10.3400,123.9350],[10.3236,123.9448]]'
),

-- ============================================================
--  ZONE 15/17 — Lahug / IT Park / Apas Extension
-- ============================================================

-- 15   Oppra → Osmeña Blvd → South Bus Terminal
(
  'Oppra to South Bus Terminal', '15',
  'Oppra', 'South Bus Terminal',
  13.00, 'jeepney',
  '[[10.3390,123.8980],[10.3200,123.8970],[10.3100,123.8940],[10.2980,123.8930],[10.2803,123.8827]]'
),

-- 17D  Carbon → Colon → Jones → Lahug → IT Park → Talamban (express)
(
  'Carbon to Talamban Express', '17D',
  'Carbon Market', 'Talamban',
  15.00, 'jeepney',
  '[[10.2922,123.9012],[10.2937,123.9009],[10.3050,123.8960],[10.3185,123.9054],[10.3277,123.9055],[10.3450,123.9080],[10.3671,123.9103]]'
),

-- ============================================================
--  ZONE 20/21/22 — Cathedral, Mandaue & Banilad
-- ============================================================

-- 20    Cathedral → Mandaue
(
  'Cathedral to Mandaue', '20',
  'Metropolitan Cathedral', 'Mandaue City',
  17.00, 'jeepney',
  '[[10.3050,123.9070],[10.3116,123.9185],[10.3236,123.9448]]'
),

-- 21    Cathedral → Mandaue (alternate)
(
  'Cathedral to Mandaue Alternate', '21',
  'Metropolitan Cathedral', 'Mandaue City',
  17.00, 'jeepney',
  '[[10.3050,123.9070],[10.3150,123.9200],[10.3300,123.9350],[10.3236,123.9448]]'
),

-- 21A   Mandaue (Even) → Ayala
(
  'Mandaue Even to Ayala', '21A',
  'Mandaue City', 'Ayala Center Cebu',
  17.00, 'jeepney',
  '[[10.3236,123.9448],[10.3300,123.9350],[10.3185,123.9054]]'
),

-- 22    Banilad → SM Cebu
(
  'Banilad to SM City', '22',
  'Banilad', 'SM City Cebu',
  13.00, 'jeepney',
  '[[10.3373,123.9000],[10.3277,123.9055],[10.3185,123.9054],[10.3116,123.9185]]'
),

-- 22A   Banilad → Carbon
(
  'Banilad to Carbon', '22A',
  'Banilad', 'Carbon Market',
  15.00, 'jeepney',
  '[[10.3373,123.9000],[10.3261,123.8978],[10.3100,123.8960],[10.2937,123.9009],[10.2922,123.9012]]'
),

-- 22C   Mandaue (Even) → CM Cabahug → Ayala
(
  'Mandaue Even to Ayala via CM Cabahug', '22C',
  'Mandaue City', 'Ayala Center Cebu',
  17.00, 'jeepney',
  '[[10.3236,123.9448],[10.3280,123.9300],[10.3240,123.9150],[10.3185,123.9054]]'
),

-- 22D   CM Cabahug → New Public Market
(
  'CM Cabahug to New Public Market', '22D',
  'CM Cabahug', 'New Public Market',
  13.00, 'jeepney',
  '[[10.3240,123.9100],[10.3260,123.9050],[10.3300,123.9020]]'
),

-- 22I   New Public Market → Banilad
(
  'New Public Market to Banilad', '22I',
  'New Public Market', 'Banilad',
  13.00, 'jeepney',
  '[[10.3300,123.9020],[10.3330,123.9010],[10.3373,123.9000]]'
),

-- 22X   Mandaue (Even) → Ayala (Express)
(
  'Mandaue Even to Ayala Express', '22X',
  'Mandaue City', 'Ayala Center Cebu',
  17.00, 'jeepney',
  '[[10.3236,123.9448],[10.3185,123.9054]]'
),

-- 23L   Extended Mandaue → SM Cebu
(
  'Extended Mandaue to SM City', '23L',
  'Mandaue City', 'SM City Cebu',
  17.00, 'jeepney',
  '[[10.3300,123.9500],[10.3236,123.9448],[10.3350,123.9280],[10.3116,123.9185]]'
),

-- ============================================================
--  ZONE 23/MI — Mactan Island
-- ============================================================

-- 23    Parkmall → Lapulapu City Proper → Cordova
(
  'Parkmall to Cordova', '23',
  'Parkmall', 'Cordova',
  20.00, 'jeepney',
  '[[10.3517,123.9358],[10.3400,123.9400],[10.3200,123.9600],[10.3074,123.9797],[10.2900,123.9900]]'
),

-- 23D   Parkmall → Lapulapu City Proper
(
  'Parkmall to Lapulapu City', '23D',
  'Parkmall', 'Lapulapu City Proper',
  17.00, 'jeepney',
  '[[10.3517,123.9358],[10.3400,123.9400],[10.3200,123.9600],[10.3074,123.9797]]'
),

-- 23E   Parkmall → Lapulapu (via alternate)
(
  'Parkmall to Lapulapu Alternate', '23E',
  'Parkmall', 'Lapulapu City Proper',
  17.00, 'jeepney',
  '[[10.3517,123.9358],[10.3450,123.9420],[10.3300,123.9550],[10.3074,123.9797]]'
),

-- MI-01A  MEPZ 1 → Punta Engaño
(
  'MEPZ 1 to Punta Engano', 'MI-01A',
  'MEPZ 1', 'Punta Engaño',
  13.00, 'jeepney',
  '[[10.3130,123.9620],[10.3150,123.9700],[10.3170,123.9800],[10.3074,123.9900]]'
),

-- MI-02B  Lapulapu City Proper → MEPZ 1
(
  'Lapulapu City to MEPZ 1', 'MI-02B',
  'Lapulapu City Proper', 'MEPZ 1',
  13.00, 'jeepney',
  '[[10.3074,123.9797],[10.3100,123.9700],[10.3130,123.9620]]'
),

-- MI-03A  Lapulapu → MEPZ 2 / Tamiya Terminal
(
  'Lapulapu City to MEPZ 2', 'MI-03A',
  'Lapulapu City Proper', 'MEPZ 2 Tamiya Terminal',
  13.00, 'jeepney',
  '[[10.3074,123.9797],[10.3000,123.9850],[10.2950,123.9900]]'
),

-- MI-03B  Lapulapu → Maribago
(
  'Lapulapu City to Maribago', 'MI-03B',
  'Lapulapu City Proper', 'Maribago',
  13.00, 'jeepney',
  '[[10.3074,123.9797],[10.3050,123.9870],[10.3000,123.9950],[10.2980,124.0050]]'
),

-- MI-04A  MEPZ 1 → Mactan-Cebu Airport
(
  'MEPZ 1 to Mactan Airport', 'MI-04A',
  'MEPZ 1', 'Mactan-Cebu International Airport',
  13.00, 'jeepney',
  '[[10.3130,123.9620],[10.3074,123.9797]]'
),

-- MI-04B  MEPZ 2 → Mactan-Cebu Airport
(
  'MEPZ 2 to Mactan Airport', 'MI-04B',
  'MEPZ 2 Tamiya Terminal', 'Mactan-Cebu International Airport',
  13.00, 'jeepney',
  '[[10.2950,123.9900],[10.3000,123.9850],[10.3074,123.9797]]'
),

-- MI-05B  Maribago → Marigondon
(
  'Maribago to Marigondon', 'MI-05B',
  'Maribago', 'Marigondon',
  13.00, 'jeepney',
  '[[10.2980,124.0050],[10.2950,124.0150],[10.2900,124.0300]]'
),

-- MI-06A  Lapulapu City Proper → Airport (direct)
(
  'Lapulapu City to Airport Direct', 'MI-06A',
  'Lapulapu City Proper', 'Mactan-Cebu International Airport',
  15.00, 'jeepney',
  '[[10.3074,123.9797],[10.3074,123.9797]]'
),

-- ============================================================
--  MyBus (MY) — Air-conditioned bus routes
-- ============================================================

-- MY01  Talisay → SM Seaside → M.C. Briones → Pier Area → J Centre Mall → MCIA
(
  'Talisay to MCIA via SM Seaside', 'MY01',
  'Talisay City', 'Mactan-Cebu International Airport',
  50.00, 'bus',
  '[[10.2444,123.8456],[10.2600,123.8600],[10.2700,123.8750],[10.2803,123.8827],[10.3000,123.9100],[10.3517,123.9358],[10.3600,123.9400],[10.3074,123.9797]]'
),

-- MY02  Mambaling → Fuente (Free Ride) → SM Seaside → Talisay
(
  'Mambaling to Talisay via Fuente', 'MY02',
  'Mambaling', 'Talisay City',
  0.00, 'bus',
  '[[10.2700,123.8900],[10.3024,123.8944],[10.2700,123.8750],[10.2444,123.8456]]'
),

-- MY03  SM Cebu → North Bus Terminal → Parkmall → J Centre Mall → MCIA
(
  'SM Cebu to MCIA via North Bus', 'MY03',
  'SM City Cebu', 'Mactan-Cebu International Airport',
  45.00, 'bus',
  '[[10.3116,123.9185],[10.3550,123.9108],[10.3517,123.9358],[10.3600,123.9400],[10.3074,123.9797]]'
),

-- MY04  Talisay → Pier Area → J Centre Mall → MCIA
(
  'Talisay to MCIA via Pier', 'MY04',
  'Talisay City', 'Mactan-Cebu International Airport',
  50.00, 'bus',
  '[[10.2444,123.8456],[10.2803,123.8827],[10.3000,123.9100],[10.3517,123.9358],[10.3600,123.9400],[10.3074,123.9797]]'
),

-- MY05  J Centre Mall → Parkmall → MCIA
(
  'J Centre Mall to MCIA', 'MY05',
  'J Centre Mall', 'Mactan-Cebu International Airport',
  35.00, 'bus',
  '[[10.3600,123.9380],[10.3517,123.9358],[10.3600,123.9400],[10.3074,123.9797]]'
),

-- MY06  Mambaling → Fuente (Free Ride)
(
  'Mambaling to Fuente Free Ride', 'MY06',
  'Mambaling', 'Fuente Osmeña',
  0.00, 'bus',
  '[[10.2700,123.8900],[10.2800,123.8930],[10.2950,123.8960],[10.3024,123.8944]]'
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
