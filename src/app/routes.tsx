import { createBrowserRouter, redirect } from "react-router";
import Landing from "./pages/Landing";
import DriverDashboard from "./pages/DriverDashboard";
import CommuterDashboard from "./pages/CommuterDashboard";

export const router = createBrowserRouter([
  { path: "/",                    Component: Landing },
  { path: "/dashboard/driver",    Component: DriverDashboard },
  { path: "/dashboard/commuter",  Component: CommuterDashboard },
  { path: "*", loader: () => redirect("/") },
]);