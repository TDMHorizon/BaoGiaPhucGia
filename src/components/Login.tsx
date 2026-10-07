import * as React from "react";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, FileSpreadsheet, Lock, User, Loader2, ShieldAlert } from "lucide-react";

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
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Tên đăng nhập</Label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="size-4" />
                </div>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  disabled={isLoading}
                  placeholder="Nhập tên đăng nhập"
                  className="h-11 border-slate-200 bg-slate-50 pl-10 text-slate-900 placeholder:text-slate-400 focus-visible:border-[#0b4f9c] focus-visible:ring-[#0b4f9c]/20"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Mật khẩu</Label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="size-4" />
                </div>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isLoading}
                  placeholder="Nhập mật khẩu"
                  className="h-11 border-slate-200 bg-slate-50 pl-10 pr-10 text-slate-900 placeholder:text-slate-400 focus-visible:border-[#0b4f9c] focus-visible:ring-[#0b4f9c]/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-colors hover:text-[#0b4f9c] focus:outline-none"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-500">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  disabled={isLoading}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 cursor-pointer rounded border-slate-300 bg-white text-[#0b4f9c] focus:ring-[#0b4f9c]/30"
                />
                <span>Ghi nhớ tài khoản</span>
              </label>
            </div>

            <Button 
              type="submit" 
              disabled={isLoading} 
              className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#0b4f9c] font-semibold text-white shadow-lg shadow-blue-900/15 transition-all hover:bg-[#083f7d]"
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
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="mx-4 flex-shrink text-xs font-semibold uppercase tracking-wider text-slate-400">Đăng nhập nhanh</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin("admin")}
                  className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 transition-all hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="text-xs font-semibold text-[#0b4f9c]">Quản trị viên</span>
                  <span className="mt-0.5 text-[10px] text-slate-500">Admin Dashboard</span>
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin("user")}
                  className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 transition-all hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <span className="text-xs font-semibold text-emerald-700">Nhân viên</span>
                  <span className="mt-0.5 text-[10px] text-slate-500">User Dashboard</span>
                </button>
              </div>
            </>
          )}
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}
