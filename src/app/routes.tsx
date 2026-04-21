import { createBrowserRouter, redirect } from "react-router";
import Landing from "./pages/Landing";
import PUVDashboard from "./pages/PUVDashboard";
import PrivateDashboard from "./pages/PrivateDashboard";
import CommuterDashboard from "./pages/CommuterDashboard";

export const router = createBrowserRouter([
  { path: "/", Component: Landing },
  { path: "/dashboard/puvpuj", Component: PUVDashboard },
  { path: "/dashboard/private", Component: PrivateDashboard },
  { path: "/dashboard/commuter", Component: CommuterDashboard },
  { path: "*", loader: () => redirect("/") },
]);
