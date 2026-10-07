import * as React from "react";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { toast } from "sonner";
<<<<<<< HEAD
import { Eye, EyeOff, FileSpreadsheet, Lock, User, Loader2, ShieldAlert } from "lucide-react";
=======
import { Eye, EyeOff, Lock, User, Loader2, ShieldAlert } from "lucide-react";
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879

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

  const handleQuickLogin = async (role: "admin" | "user") => {
    const defaultUser = role === "admin" ? "admin" : "user";
    const defaultPass = "password";

    setUsername(defaultUser);
    setPassword(defaultPass);
    setIsLoading(true);
    setErrorMessage("");

    try {
      const user = await api.login(defaultUser, defaultPass);
      login(user);
      toast.success(`Đăng nhập nhanh thành công với quyền ${role === "admin" ? "Quản trị" : "Nhân viên"}!`);
    } catch (error) {
      setErrorMessage("Không thể thực hiện đăng nhập nhanh. Vui lòng thử lại.");
      toast.error("Đăng nhập nhanh thất bại!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-[#f4f8ff] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <Card className="grid w-full overflow-hidden border-blue-100 bg-white shadow-[0_24px_70px_rgba(15,75,145,0.14)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative hidden overflow-hidden bg-[#0b4f9c] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full border-[28px] border-white/10" />
            <div className="absolute -bottom-24 -left-16 h-52 w-52 rounded-full border-[22px] border-white/10" />
            <div className="relative">
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#0b4f9c] shadow-lg"><FileSpreadsheet className="h-6 w-6" /></div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">Phúc Gia Workspace</p>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">Quản lý báo giá<br />rõ ràng hơn.</h1>
              <p className="mt-5 max-w-xs text-sm leading-6 text-blue-100">Một không gian tập trung để quản lý dự án, biên tập Excel và theo dõi lịch sử cập nhật.</p>
            </div>
            <div className="relative flex items-center gap-2 text-xs font-medium text-blue-100"><span className="h-2 w-2 rounded-full bg-emerald-300" />Hệ thống quản trị báo giá</div>
          </div>

          <div className="p-6 sm:p-10">
            <CardHeader className="p-0 pb-6">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#0b4f9c] lg:hidden"><FileSpreadsheet className="h-5 w-5" /></div>
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Đăng nhập</CardTitle>
              <CardDescription className="mt-2 text-sm leading-5 text-slate-500">Đăng nhập để tiếp tục quản lý và biên tập báo giá.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 p-0">
          {errorMessage && (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 transition-all duration-300">
              <ShieldAlert className="size-4 shrink-0 text-red-500" />
=======
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
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
<<<<<<< HEAD
              <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Tên đăng nhập</Label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
=======
              <Label htmlFor="username" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Tên đăng nhập</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none">
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
                  <User className="size-4" />
                </div>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  disabled={isLoading}
<<<<<<< HEAD
                  placeholder="Nhập tên đăng nhập"
                  className="h-11 border-slate-200 bg-slate-50 pl-10 text-slate-900 placeholder:text-slate-400 focus-visible:border-[#0b4f9c] focus-visible:ring-[#0b4f9c]/20"
=======
                  placeholder="admin hoặc user"
                  className="pl-10 h-10 border-slate-800 bg-slate-950/40 text-slate-200 placeholder:text-slate-600 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
<<<<<<< HEAD
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Mật khẩu</Label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
=======
              <Label htmlFor="password" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Mật khẩu</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none">
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
                  <Lock className="size-4" />
                </div>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isLoading}
<<<<<<< HEAD
                  placeholder="Nhập mật khẩu"
                  className="h-11 border-slate-200 bg-slate-50 pl-10 pr-10 text-slate-900 placeholder:text-slate-400 focus-visible:border-[#0b4f9c] focus-visible:ring-[#0b4f9c]/20"
=======
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-10 border-slate-800 bg-slate-950/40 text-slate-200 placeholder:text-slate-600 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
<<<<<<< HEAD
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-colors hover:text-[#0b4f9c] focus:outline-none"
=======
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
<<<<<<< HEAD
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-500">
=======
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
                <input
                  type="checkbox"
                  checked={rememberMe}
                  disabled={isLoading}
                  onChange={(e) => setRememberMe(e.target.checked)}
<<<<<<< HEAD
                  className="size-4 cursor-pointer rounded border-slate-300 bg-white text-[#0b4f9c] focus:ring-[#0b4f9c]/30"
=======
                  className="rounded border-slate-800 bg-slate-950/40 text-indigo-650 focus:ring-indigo-500/30 cursor-pointer size-4"
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
                />
                <span>Ghi nhớ tài khoản</span>
              </label>
            </div>

            <Button 
              type="submit" 
              disabled={isLoading} 
<<<<<<< HEAD
              className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#0b4f9c] font-semibold text-white shadow-lg shadow-blue-900/15 transition-all hover:bg-[#083f7d]"
=======
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all rounded-lg cursor-pointer flex items-center justify-center gap-2 mt-2"
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
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
<<<<<<< HEAD
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="mx-4 flex-shrink text-xs font-semibold uppercase tracking-wider text-slate-400">Đăng nhập nhanh</span>
                <div className="flex-grow border-t border-slate-200"></div>
=======
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800/80"></div>
                <span className="flex-shrink mx-4 text-slate-500 text-xs font-semibold tracking-wider uppercase">Đăng nhập nhanh</span>
                <div className="flex-grow border-t border-slate-800/80"></div>
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin("admin")}
<<<<<<< HEAD
                  className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 transition-all hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="text-xs font-semibold text-[#0b4f9c]">Quản trị viên</span>
                  <span className="mt-0.5 text-[10px] text-slate-500">Admin Dashboard</span>
=======
                  className="flex flex-col items-center justify-center py-2 px-3 bg-slate-955/30 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition-all rounded-lg group cursor-pointer"
                >
                  <span className="text-xs text-indigo-400 font-semibold group-hover:text-indigo-300">Quản trị viên</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Admin Dashboard</span>
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin("user")}
<<<<<<< HEAD
                  className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 transition-all hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <span className="text-xs font-semibold text-emerald-700">Nhân viên</span>
                  <span className="mt-0.5 text-[10px] text-slate-500">User Dashboard</span>
=======
                  className="flex flex-col items-center justify-center py-2 px-3 bg-slate-955/30 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 transition-all rounded-lg group cursor-pointer"
                >
                  <span className="text-xs text-emerald-400 font-semibold group-hover:text-emerald-300">Nhân viên</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">User Dashboard</span>
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
                </button>
              </div>
            </>
          )}
<<<<<<< HEAD
            </CardContent>
          </div>
        </Card>
      </div>
=======
        </CardContent>
      </Card>
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
    </div>
  );
}
