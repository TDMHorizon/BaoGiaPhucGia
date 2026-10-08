import * as React from "react";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, User, Loader2, ShieldAlert } from "lucide-react";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [allowQuickLogin, setAllowQuickLogin] = useState(false);
  const { login } = useAuth();

  // Load remembered username if it exists
  useEffect(() => {
    const saved = localStorage.getItem("rememberedUsername");
    if (saved) {
      setUsername(saved);
      setRememberMe(true);
    }
    api.getConfig().then((c) => setAllowQuickLogin(!!c.allowQuickLogin)).catch(() => setAllowQuickLogin(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMessage("Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const user = await api.login(username, password);
      
      // Save or clear remembered username
      if (rememberMe) {
        localStorage.setItem("rememberedUsername", username);
      } else {
        localStorage.removeItem("rememberedUsername");
      }

      login(user);
      toast.success("Đăng nhập thành công!");
    } catch (error: any) {
      console.error("Login failed:", error);
      setErrorMessage("Tên đăng nhập hoặc mật khẩu không chính xác.");
      toast.error("Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (role: "admin" | "manager" | "user") => {
    const defaultUser = role === "admin" ? "admin" : role === "manager" ? "manager" : "user";
    const defaultPass = "password";

    setUsername(defaultUser);
    setPassword(defaultPass);
    setIsLoading(true);
    setErrorMessage("");

    try {
      const user = await api.login(defaultUser, defaultPass);
      login(user);
      const roleLabel = role === "admin" ? "Quản trị" : role === "manager" ? "Quản lý" : "Nhân viên";
      toast.success(`Đăng nhập nhanh thành công với quyền ${roleLabel}!`);
    } catch (error: any) {
      setErrorMessage(error.message || "Không thể thực hiện đăng nhập nhanh. Vui lòng thử lại.");
      toast.error("Đăng nhập nhanh thất bại!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-955 via-indigo-955 to-slate-900 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md bg-slate-900/60 border-slate-800/80 backdrop-blur-xl shadow-2xl relative z-10 text-slate-100 overflow-hidden">
        {/* Border accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
        
        <CardHeader className="pt-8 pb-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-indigo-500/10 p-3.5 rounded-2xl border border-indigo-500/30 flex items-center justify-center shadow-inner">
              <svg className="size-8 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">BÁO GIÁ PHÚC GIA</CardTitle>
          <CardDescription className="text-slate-400 mt-1 text-sm">
            Hệ thống Quản lý và Biên tập Báo giá Excel Chuyên nghiệp
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-8 pb-8 space-y-6">
          {errorMessage && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/35 text-red-200 px-4 py-3 rounded-lg text-sm transition-all duration-300">
              <ShieldAlert className="size-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Tên đăng nhập</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none">
                  <User className="size-4" />
                </div>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  disabled={isLoading}
                  placeholder="admin hoặc user"
                  className="pl-10 h-10 border-slate-800 bg-slate-950/40 text-slate-200 placeholder:text-slate-600 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Mật khẩu</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none">
                  <Lock className="size-4" />
                </div>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-10 border-slate-800 bg-slate-950/40 text-slate-200 placeholder:text-slate-600 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  disabled={isLoading}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950/40 text-indigo-650 focus:ring-indigo-500/30 cursor-pointer size-4"
                />
                <span>Ghi nhớ tài khoản</span>
              </label>
            </div>

            <Button 
              type="submit" 
              disabled={isLoading} 
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all rounded-lg cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Đang kết nối...</span>
                </>
              ) : (
                <span>Đăng nhập</span>
              )}
            </Button>
          </form>

          {allowQuickLogin && (
            <>
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800/80"></div>
                <span className="flex-shrink mx-4 text-slate-500 text-xs font-semibold tracking-wider uppercase">Đăng nhập nhanh</span>
                <div className="flex-grow border-t border-slate-800/80"></div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin("admin")}
                  className="flex flex-col items-center justify-center py-2 px-2 bg-slate-950/40 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition-all rounded-lg group cursor-pointer"
                >
                  <span className="text-xs text-indigo-400 font-semibold group-hover:text-indigo-300">Quản trị</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">Admin</span>
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin("manager")}
                  className="flex flex-col items-center justify-center py-2 px-2 bg-slate-950/40 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-950/20 transition-all rounded-lg group cursor-pointer"
                >
                  <span className="text-xs text-amber-400 font-semibold group-hover:text-amber-300">Quản lý</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">Manager</span>
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin("user")}
                  className="flex flex-col items-center justify-center py-2 px-2 bg-slate-950/40 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 transition-all rounded-lg group cursor-pointer"
                >
                  <span className="text-xs text-emerald-400 font-semibold group-hover:text-emerald-300">Nhân viên</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">Staff</span>
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
