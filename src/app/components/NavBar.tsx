import { MapPin, LogOut, Bus, Users, Menu } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

const accountLabels = {
  driver:   "Driver",
  commuter: "Commuter",
};

const accountIcons = {
  driver:   Bus,
  commuter: Users,
};

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!user) return null;

  const Icon = accountIcons[user.accountType];

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm z-50 relative">
      <div className="px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <MapPin className="text-blue-600 shrink-0" size={20} />
          <span className="text-blue-700 tracking-tight">BiyaheHub</span>
        </div>

        {/* Desktop right section */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
            <Icon size={14} />
            <span>{accountLabels[user.accountType]}</span>
          </div>
          <span className="text-gray-500 text-sm">{user.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition-colors text-sm"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>

        {/* Mobile right section */}
        <div className="flex sm:hidden items-center gap-2">
          {/* Account type badge — compact */}
          <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
            <Icon size={12} />
            <span>{accountLabels[user.accountType]}</span>
          </div>

          {/* Hamburger → dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Menu"
            >
              <Menu size={20} />
            </button>

            {menuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs text-gray-500">Signed in as</p>
                    <p className="text-sm text-gray-800 truncate">{user.name}</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}