import { createBrowserRouter, redirect } from "react-router";
import Landing from "./pages/Landing";
import DriverDashboard from "./pages/DriverDashboard";
import CommuterDashboard from "./pages/CommuterDashboard";

export const router = createBrowserRouter([
  { path: "/", Component: Landing },
  // Both PUV/PUJ and Private drivers share the unified DriverDashboard
  { path: "/dashboard/puvpuj",   Component: DriverDashboard },
  { path: "/dashboard/private",  Component: DriverDashboard },
  { path: "/dashboard/commuter", Component: CommuterDashboard },
  { path: "*", loader: () => redirect("/") },
]);
