import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { VehicleProvider } from "./context/VehicleContext";

// Inner wrapper so VehicleProvider can read userId from AuthContext
function AppWithProviders() {
  const { user } = useAuth();
  return (
    <VehicleProvider userId={user?.id ?? null}>
      <RouterProvider router={router} />
    </VehicleProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppWithProviders />
    </AuthProvider>
  );
}
