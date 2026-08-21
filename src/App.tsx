/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthProvider, useAuth } from "./lib/auth";
import { Login } from "./components/Login";
import { AdminDashboard } from "./components/AdminDashboard";
import { UserDashboard } from "./components/UserDashboard";
import { Toaster } from "./components/ui/sonner";

function AppContent() {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-secondary text-body-md">
        Đang tải...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="h-screen flex flex-col bg-surface font-sans overflow-hidden">
      <header className="bg-surface-container-lowest shadow-xs border-b border-outline shrink-0 z-20">
        <div className="w-full px-6 py-3 flex justify-between items-center">
          <h1 className="text-lg font-extrabold text-on-surface tracking-tight flex items-center gap-3">
            <span className="bg-primary text-primary-foreground rounded-lg p-1.5 px-2.5 text-xs font-black uppercase shadow-sm">BG</span>
            Báo Giá Phúc Gia
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-body-md text-secondary">
              Xin chào <strong className="text-on-surface">{user.username}</strong>
              {" "}({user.role === "admin" ? "Quản trị" : user.role === "manager" ? "Quản lý" : "Nhân viên"})
            </span>
            <button
              onClick={logout}
              className="text-body-md text-destructive hover:text-destructive font-medium px-3 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {user.role === "admin" || user.role === "manager" ? <AdminDashboard /> : <UserDashboard />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}
