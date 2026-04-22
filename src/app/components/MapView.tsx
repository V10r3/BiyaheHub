import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Route, TrafficSegment, Vehicle } from "../services/api";

// Fix default marker icons for Leaflet + Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const trafficColors: Record<string, string> = {
  clear: "#22c55e",
  moderate: "#f59e0b",
  heavy: "#ef4444",
};

const vehicleColors: Record<string, string> = {
  jeepney: "#3b82f6",
  bus: "#8b5cf6",
  taxi: "#f59e0b",
};

function createVehicleIcon(type: string) {
  const emoji = type === "jeepney" ? "🚌" : type === "bus" ? "🚍" : "🚕";
  return L.divIcon({
    html: `<div style="font-size:22px;line-height:1">${emoji}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createMarkerIcon(color: string, label: string) {
  return L.divIcon({
    html: `<div style="background:${color};color:white;padding:2px 6px;border-radius:4px;font-size:11px;white-space:nowrap;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${label}</div>`,
    className: "",
    iconAnchor: [0, 10],
  });
}

interface RecenterProps {
  center: [number, number];
}
function Recenter({ center }: RecenterProps) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 14);
  }, [center, map]);
  return null;
}

interface MapViewProps {
  center?: [number, number];
  routes?: Route[];
  traffic?: TrafficSegment[];
  vehicles?: Vehicle[];
  selectedRouteId?: number | null;
  originPin?: [number, number] | null;
  destPin?: [number, number] | null;
  onMapClick?: (latlng: [number, number]) => void;
  children?: React.ReactNode;
}

function ClickHandler({ onMapClick }: { onMapClick: (latlng: [number, number]) => void }) {
  useMapEvents({ click(e) { onMapClick([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

export function MapView({
  center = [10.3157, 123.8854],
  routes = [],
  traffic = [],
  vehicles = [],
  selectedRouteId = null,
  originPin = null,
  destPin = null,
  onMapClick,
  children,
}: MapViewProps) {
  return (
    <MapContainer
      center={center}
      zoom={14}
      className="w-full h-full rounded-lg z-0"
      style={{ minHeight: "100%", height: "100%" }}
    >
      <Recenter center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {onMapClick && <ClickHandler onMapClick={onMapClick} />}

      {/* Routes — static polylines (no OSRM) */}
      {routes.map((route) => (
        <Polyline
          key={route.id}
          positions={route.waypoints}
          pathOptions={{
            color: selectedRouteId === route.id
              ? (vehicleColors[route.type] ?? "#2563eb")
              : "#94a3b8",
            weight: selectedRouteId === route.id ? 5 : 2,
            opacity: selectedRouteId === route.id ? 0.9 : 0.6,
          }}
        />
      ))}

      {/* Vehicles */}
      {vehicles.map((v) => (
        <Marker key={v.id} position={[v.lat, v.lng]} icon={createVehicleIcon(v.type)}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold capitalize">{v.type} · {v.plateNo}</p>
              <p className="text-gray-500">Seats: {v.seatsOccupied}/{v.seatsTotal}</p>
              <div className="mt-1 bg-gray-200 rounded h-2 w-full">
                <div
                  className="h-2 rounded"
                  style={{
                    width: `${(v.seatsOccupied / v.seatsTotal) * 100}%`,
                    background: v.seatsOccupied / v.seatsTotal > 0.8 ? "#ef4444" : "#22c55e",
                  }}
                />
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Origin & Destination pins */}
      {originPin && (
        <Marker position={originPin} icon={createMarkerIcon("#22c55e", "Start")}>
          <Popup>Origin</Popup>
        </Marker>
      )}
      {destPin && (
        <Marker position={destPin} icon={createMarkerIcon("#ef4444", "End")}>
          <Popup>Destination</Popup>
        </Marker>
      )}

      {/* Slot for RoutingMachine or other overlays */}
      {children}
    </MapContainer>
  );
}