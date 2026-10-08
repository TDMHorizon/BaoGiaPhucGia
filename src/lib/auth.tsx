import * as React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { api, getToken, setToken } from "./api";

export type User = { id: string; username: string; role: "admin" | "manager" | "user" } | null;

const AuthContext = createContext<{
  user: User;
  login: (u: User & { token?: string }) => void;
  logout: () => void;
  loading: boolean;
}>({
  user: null,
  login: () => {},
  logout: () => {},
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        setUser(me);
        localStorage.setItem("user", JSON.stringify(me));
      } catch {
        setToken(null);
        localStorage.removeItem("user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const login = (u: User & { token?: string }) => {
    if (!u) return;
    const { token, ...rest } = u as any;
    if (token) setToken(token);
    setUser(rest);
    localStorage.setItem("user", JSON.stringify(rest));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
