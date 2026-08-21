import * as React from "react";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, User, Loader2, ShieldAlert } from "lucide-react";

// Stitch Design System Colors
const STITCH = {
  primary: "#2563eb",
  onPrimary: "#ffffff",
  surface: "#f8fafc",
  onSurface: "#0f172a",
  surfaceContainer: "#ffffff",
  outline: "#e2e8f0",
  background: "#faf8ff",
  onBackground: "#191b23",
  error: "#ef4444",
  onError: "#ffffff",
  primaryContainer: "#dbe1ff",
  onPrimaryContainer: "#00174b",
  secondary: "#565e74",
  onSecondary: "#ffffff",
  outlineVariant: "#c3c6d7",
  hoverState: "#f1f5f9",
};

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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        background: STITCH.background,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background decorative elements */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "-5%",
          width: "40%",
          height: "40%",
          background: `radial-gradient(circle, ${STITCH.primaryContainer}40 0%, transparent 70%)`,
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "-5%",
          width: "30%",
          height: "30%",
          background: `radial-gradient(circle, ${STITCH.primaryContainer}30 0%, transparent 70%)`,
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      {/* Login Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "26rem",
          background: STITCH.surfaceContainer,
          borderRadius: "12px",
          border: `1px solid ${STITCH.outline}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.05)",
          position: "relative",
          zIndex: 10,
          overflow: "hidden",
        }}
      >
        {/* Header with Logo */}
        <div
          style={{
            padding: "2rem 2rem 1.5rem",
            textAlign: "center",
            borderBottom: `1px solid ${STITCH.outline}`,
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "1.5rem",
            }}
          >
            <img
              src="/images/logo.png"
              alt="Báo Giá Phúc Gia Logo"
              style={{
                height: "64px",
                width: "auto",
                objectFit: "contain",
              }}
              onError={(e) => {
                // Fallback to text logo if image fails
                e.currentTarget.style.display = "none";
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const fallback = document.createElement("div");
                  fallback.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 64px;
                    height: 64px;
                    background: ${STITCH.primary};
                    color: ${STITCH.onPrimary};
                    font-size: 24px;
                    font-weight: 900;
                    border-radius: 8px;
                  `;
                  fallback.textContent = "BG";
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: STITCH.onSurface,
              margin: 0,
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
            }}
          >
            BÁO GIÁ PHÚC GIA
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              color: STITCH.secondary,
              lineHeight: 1.5,
            }}
          >
            Hệ thống Quản lý và Biên tập Báo giá Excel
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: "1.5rem 2rem 2rem" }}>
          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                marginBottom: "1.25rem",
                fontSize: "0.875rem",
                backgroundColor: "#fef2f2",
                border: `1px solid #fecaca`,
                color: STITCH.error,
              }}
            >
              <ShieldAlert style={{ width: "1rem", height: "1rem", flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Username Field */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label
                htmlFor="username"
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: STITCH.secondary,
                }}
              >
                Tên đăng nhập
              </label>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "0.875rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: STITCH.secondary,
                  }}
                >
                  <User style={{ width: "1.125rem", height: "1.125rem" }} />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  disabled={isLoading}
                  placeholder="admin hoặc user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    width: "100%",
                    height: "2.75rem",
                    paddingLeft: "2.75rem",
                    paddingRight: "0.875rem",
                    borderRadius: "8px",
                    border: `1px solid ${STITCH.outline}`,
                    backgroundColor: STITCH.surfaceContainer,
                    color: STITCH.onSurface,
                    fontSize: "0.875rem",
                    outline: "none",
                    transition: "border-color 150ms, box-shadow 150ms",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = STITCH.primary;
                    e.target.style.boxShadow = `0 0 0 3px ${STITCH.primaryContainer}`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = STITCH.outline;
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label
                htmlFor="password"
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: STITCH.secondary,
                }}
              >
                Mật khẩu
              </label>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "0.875rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: STITCH.secondary,
                  }}
                >
                  <Lock style={{ width: "1.125rem", height: "1.125rem" }} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isLoading}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    height: "2.75rem",
                    paddingLeft: "2.75rem",
                    paddingRight: "2.75rem",
                    borderRadius: "8px",
                    border: `1px solid ${STITCH.outline}`,
                    backgroundColor: STITCH.surfaceContainer,
                    color: STITCH.onSurface,
                    fontSize: "0.875rem",
                    outline: "none",
                    transition: "border-color 150ms, box-shadow 150ms",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = STITCH.primary;
                    e.target.style.boxShadow = `0 0 0 3px ${STITCH.primaryContainer}`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = STITCH.outline;
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "0.875rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: STITCH.secondary,
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff style={{ width: "1.125rem", height: "1.125rem" }} />
                  ) : (
                    <Eye style={{ width: "1.125rem", height: "1.125rem" }} />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.875rem",
                  color: STITCH.secondary,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  disabled={isLoading}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    width: "1rem",
                    height: "1rem",
                    borderRadius: "4px",
                    border: `1px solid ${STITCH.outline}`,
                    backgroundColor: STITCH.surfaceContainer,
                    cursor: "pointer",
                    accentColor: STITCH.primary,
                  }}
                />
                <span>Ghi nhớ tài khoản</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                height: "2.75rem",
                marginTop: "0.5rem",
                backgroundColor: STITCH.primary,
                color: STITCH.onPrimary,
                fontWeight: 600,
                fontSize: "0.875rem",
                borderRadius: "8px",
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                transition: "background-color 150ms, transform 100ms",
                opacity: isLoading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = "#1d4ed8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = STITCH.primary;
              }}
              onMouseDown={(e) => {
                if (!isLoading) e.currentTarget.style.transform = "translateY(1px)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 style={{ width: "1rem", height: "1rem", animation: "spin 1s linear infinite" }} />
                  <span>Đang kết nối...</span>
                </>
              ) : (
                <span>Đăng nhập</span>
              )}
            </button>
          </form>

          {/* Quick Login */}
          {allowQuickLogin && (
            <>
              {/* Divider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  margin: "1.5rem 0 1.25rem",
                }}
              >
                <div style={{ flex: 1, borderTop: `1px solid ${STITCH.outline}` }} />
                <span
                  style={{
                    flexShrink: 0,
                    margin: "0 1rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: STITCH.secondary,
                  }}
                >
                  Đăng nhập nhanh
                </span>
                <div style={{ flex: 1, borderTop: `1px solid ${STITCH.outline}` }} />
              </div>

              {/* Quick Login Buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin("admin")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.875rem 0.75rem",
                    borderRadius: "8px",
                    border: `1px solid ${STITCH.outline}`,
                    backgroundColor: STITCH.surfaceContainer,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    transition: "border-color 150ms, background-color 150ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.borderColor = STITCH.primary;
                      e.currentTarget.style.backgroundColor = STITCH.hoverState;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = STITCH.outline;
                    e.currentTarget.style.backgroundColor = STITCH.surfaceContainer;
                  }}
                >
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: STITCH.primary }}>
                    Quản trị viên
                  </span>
                  <span style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: STITCH.secondary }}>
                    Admin Dashboard
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin("user")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.875rem 0.75rem",
                    borderRadius: "8px",
                    border: `1px solid ${STITCH.outline}`,
                    backgroundColor: STITCH.surfaceContainer,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    transition: "border-color 150ms, background-color 150ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.borderColor = STITCH.primary;
                      e.currentTarget.style.backgroundColor = STITCH.hoverState;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = STITCH.outline;
                    e.currentTarget.style.backgroundColor = STITCH.surfaceContainer;
                  }}
                >
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: STITCH.primary }}>
                    Nhân viên
                  </span>
                  <span style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: STITCH.secondary }}>
                    User Dashboard
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Keyframes for animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
