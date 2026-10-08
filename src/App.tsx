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
  const { user, loading } = useAuth();

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

  if (user.role === "admin" || user.role === "manager") {
    return <AdminDashboard />;
  }

  return <UserDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}
