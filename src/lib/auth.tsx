import * as React from "react";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, getToken, setToken } from "./api";
import { getSocket, identifyUser } from "./socket";
import { toast } from "sonner";

export type User = { id: string; username: string; role: "admin" | "manager" | "user"; fullName?: string; email?: string } | null;

const AuthContext = createContext<{
  user: User;
  login: (u: User & { token?: string }) => void;
  logout: () => void;
  refreshAuth: () => Promise<User>;
  loading: boolean;
}>({
  user: null,
  login: () => {},
  logout: () => {},
  refreshAuth: async () => null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
  }, []);

  const refreshAuth = useCallback(async (): Promise<User> => {
    try {
      const res = await api.refreshToken();
      if (res?.token) {
        setToken(res.token);
      }
      if (res?.user) {
        setUser(res.user);
        localStorage.setItem("user", JSON.stringify(res.user));
        return res.user;
      }
      return null;
    } catch (err: any) {
      console.warn("Refresh auth failed:", err);
      if (err?.data?.code === "ACCOUNT_LOCKED" || err?.message?.includes("khoá") || err?.message?.includes("khóa")) {
        toast.error("Tài khoản nhân viên của bạn đã bị khoá. Vui lòng liên hệ Admin để xử lý!");
        logout();
      }
      return null;
    }
  }, [logout]);

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
        if (me?.id) identifyUser(me.id);
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

  // Lắng nghe Socket realtime cho tài khoản bị khóa (UC19-T3) hoặc đổi role (UC19-T5)
  useEffect(() => {
    if (!user?.id) return;
    identifyUser(user.id);
    const s = getSocket();

    const handleAccountLocked = (payload: any) => {
      if (payload?.userId === user.id) {
        toast.error(payload.message || "Tài khoản nhân viên của bạn đã bị khoá. Vui lòng liên hệ Admin để xử lý!", {
          duration: 8000,
        });
        window.dispatchEvent(new CustomEvent("baogia:account_locked", { detail: payload }));
        setTimeout(() => {
          logout();
        }, 1500);
      }
    };

    const handleRoleUpdated = async (payload: any) => {
      if (payload?.userId === user.id) {
        const roleLabel =
          payload.newRole === "manager"
            ? "Kế toán / Quản lý"
            : payload.newRole === "admin"
            ? "Quản trị viên"
            : "Nhân viên";
        toast.info(
          payload.message || `Vai trò tài khoản của bạn đã được cập nhật thành: ${roleLabel}. Đang làm mới quyền truy cập...`,
          { duration: 6000 }
        );
        // Tự động cấp lại token mới và cập nhật vai trò mới từ database
        await refreshAuth();
      }
    };

    s.on("account.locked", handleAccountLocked);
    s.on("account.role_updated", handleRoleUpdated);

    const handleWindowLocked = (e: any) => {
      toast.error(e.detail?.error || "Tài khoản nhân viên của bạn đã bị khoá. Vui lòng liên hệ Admin để xử lý!");
      logout();
    };
    window.addEventListener("baogia:account_locked", handleWindowLocked);

    return () => {
      s.off("account.locked", handleAccountLocked);
      s.off("account.role_updated", handleRoleUpdated);
      window.removeEventListener("baogia:account_locked", handleWindowLocked);
    };
  }, [user?.id, logout, refreshAuth]);

  const login = (u: User & { token?: string }) => {
    if (!u) return;
    const { token, ...rest } = u as any;
    if (token) setToken(token);
    setUser(rest);
    localStorage.setItem("user", JSON.stringify(rest));
    if (rest?.id) identifyUser(rest.id);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshAuth, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
