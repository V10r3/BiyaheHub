import React, { createContext, useContext, useState } from "react";
import type { User, AccountType } from "../services/api";
import { authApi } from "../services/api";

const AUTH_KEY = "biyahehub_user";

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, accountType: AccountType) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);

  const login = async (email: string, password: string) => {
    const u = await authApi.login(email, password);
    localStorage.setItem(AUTH_KEY, JSON.stringify(u));
    setUser(u);
  };

  const register = async (name: string, email: string, password: string, accountType: AccountType) => {
    const u = await authApi.register(name, email, password, accountType);
    localStorage.setItem(AUTH_KEY, JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}