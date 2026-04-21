import { MapPin, LogOut, Bus, Car, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";

const accountLabels = {
  puvpuj: "PUV/PUJ Driver",
  private: "Private Driver",
  commuter: "Commuter",
};

const accountIcons = {
  puvpuj: Bus,
  private: Car,
  commuter: Users,
};

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!user) return null;

  const Icon = accountIcons[user.accountType];

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm z-50 relative">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="text-blue-600" size={20} />
          <span className="text-blue-700 tracking-tight">BiyaheHub</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
            <Icon size={14} />
            <span>{accountLabels[user.accountType]}</span>
          </div>
          <span className="text-gray-500 text-sm hidden sm:block">{user.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition-colors text-sm"
          >
            <LogOut size={16} />
            <span className="hidden sm:block">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
