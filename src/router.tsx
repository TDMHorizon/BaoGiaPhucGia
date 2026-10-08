import { createBrowserRouter, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Login } from "./components/Login";
import { AdminDashboard } from "./components/AdminDashboard";
import { UserDashboard } from "./components/UserDashboard";
import { AccountManagementPage } from "./components/pages/AccountManagementPage";
import { UpdateProfile } from "./components/pages/UpdateProfile";
import { ListHistFilePage } from "./components/pages/ListHistFilePage";

export const ROUTES = {
  home: "/",
  accountManagement: "/admin/accounts",
  profile: "/admin/profile",
  deletedProjects: "/admin/deleted-projects",
  userProjects: "/user/projects",

} as const;

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      Đang tải...
    </div>
  );
}

function RootRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;
  if (user.role === "admin" || user.role === "manager") return <AdminDashboard />;
  return <UserDashboard />;
}

function AccountManagementRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "admin") return <Navigate to={ROUTES.home} replace />;
  return <AccountManagementPage />;
}

function ProfileRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={ROUTES.home} replace />;
  return <UpdateProfile />;
}

function DeletedProjectsRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user || (user.role !== "admin" && user.role !== "manager")) return <Navigate to={ROUTES.home} replace />;
  return <ListHistFilePage />;
}

export const router = createBrowserRouter([
  {
    path: ROUTES.home,
    Component: RootRoute,
  },
  {
    path: ROUTES.accountManagement,
    Component: AccountManagementRoute,
  },
  {
    path: ROUTES.profile,
    Component: ProfileRoute,
  },
  {
    path: ROUTES.deletedProjects,
    Component: DeletedProjectsRoute,
  },
  // {
  //   path: ROUTES.userProjects,
  //   Component: UserProjectsRoute,
  // },

  {
    path: "*",
    element: <Navigate to={ROUTES.home} replace />,
  },
]);
