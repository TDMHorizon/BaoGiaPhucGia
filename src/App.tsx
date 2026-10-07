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
<<<<<<< HEAD
  const { user, loading } = useAuth();
=======
  const { user, logout, loading } = useAuth();
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Đang tải...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

<<<<<<< HEAD
  if (user.role === "admin" || user.role === "manager") {
    return <AdminDashboard />;
  }

  return <UserDashboard />;
=======
  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans overflow-hidden">
      <header className="bg-white shadow-xs border-b border-slate-200/90 shrink-0 z-20">
        <div className="w-full px-4 py-2.5 flex justify-between items-center">
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="bg-indigo-600 text-white rounded-md p-1 px-2 text-xs font-black uppercase shadow-2xs">BG</span>
            Báo Giá Phúc Gia
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">
              Xin chào <strong className="text-slate-900">{user.username}</strong>
              {" "}({user.role === "admin" ? "Quản trị" : user.role === "manager" ? "Quản lý" : "Nhân viên"})
            </span>
            <button
              onClick={logout}
              className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col h-[calc(100vh-56px)] overflow-hidden">
        {user.role === "admin" || user.role === "manager" ? <AdminDashboard /> : <UserDashboard />}
      </main>
    </div>
  );
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}
