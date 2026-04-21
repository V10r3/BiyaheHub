import React from "react";
import ReactDOM from "react-dom/client";

// App data (same as your PHP array)
const appDetails = {
  overview:
    "A route map that displays traffic. The app has three dashboards: one for PUV/PUJ, one for Private Drivers, and one for commuters.",
  features: {
    "PUV/PUJ Driver Dashboard": [
      "A map showing traffic details for fixed routes.",
      "Optional: Integration with RF card payment to track passengers based on seat availability.",
    ],
    "Private Driver Dashboard": [
      "Interactive map to plot destinations with options to type, pick manually, or use GPS.",
      "Traffic notifications with alternate route suggestions.",
    ],
    "Commuter Dashboard": [
      "Interactive map to plot destinations with traffic details.",
      "Clock to set arrival time.",
      "Shows jeeps, buses, taxis, and trains (if applicable).",
      "Jeepney selection based on designation (e.g., 01K Urgello to Parkmall).",
      "Bus tracking with pickup/drop-off stops.",
      "Shows occupied/unoccupied seats for integrated buses/PUVs.",
      "Taxi tracking with pickup/unload areas.",
      "Best route suggestions with minimal rides and fare.",
      "Traffic notifications with alternate route suggestions.",
    ],
  },
};

function App() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", margin: 0 }}>
      <header style={{ background: "#0078D7", color: "#fff", padding: "10px", textAlign: "center" }}>
        <h1>Welcome to the Traffic Route App</h1>
      </header>

      <nav style={{ background: "#333", color: "#fff", padding: "10px", textAlign: "center" }}>
        <a href="#overview" style={{ color: "#fff", margin: "0 10px" }}>Overview</a>
        <a href="#features" style={{ color: "#fff", margin: "0 10px" }}>Features</a>
      </nav>

      <section id="overview" style={{ padding: "20px" }}>
        <h2 style={{ color: "#0078D7" }}>App Overview</h2>
        <p>{appDetails.overview}</p>
      </section>

      <section id="features" style={{ padding: "20px" }}>
        <h2 style={{ color: "#0078D7" }}>App Features</h2>

        {Object.entries(appDetails.features).map(([dashboard, features]) => (
          <div key={dashboard}>
            <h3 style={{ color: "#0078D7" }}>{dashboard}</h3>
            <ul>
              {features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

// Render to root
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);