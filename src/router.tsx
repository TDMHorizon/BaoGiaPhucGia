import { createBrowserRouter, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Login } from "./components/Login";
import { ManagementWorkspacePage } from "./components/pages/ManagementWorkspacePage";
import { QuoteEditorPage } from "./components/pages/QuoteEditorPage";
import { QuotesListPage } from "./components/pages/QuotesListPage";
import { TemplatesPage } from "./components/pages/TemplatesPage";
import { UpdateProfile } from "./components/pages/UpdateProfile";
import { ListHistFilePage } from "./components/pages/ListHistFilePage";

export const ROUTES = {
  home: "/",
  management: "/management",
  managementOverview: "/management/overview",
  managementTasks: "/management/tasks",
  managementRevenue: "/management/revenue",
  managementUsers: "/management/users",
  managementRoles: "/management/roles",
  quotes: "/quotes",
  quoteEditor: "/quotes/:projectId/editor",
  templates: "/templates",
  trash: "/quotes/trash",
  accountManagement: "/admin/accounts",
  profile: "/admin/profile",
  deletedProjects: "/admin/deleted-projects",
} as const;

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F0F7FF] text-sm text-[#105CB3]">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#105CB3] border-t-transparent" />
        <span>Đang tải hệ thống Báo Giá Phúc Gia...</span>
      </div>
    </div>
  );
}

// Root route: Redirect based on authentication & role
function RootRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;

  // Admin or Manager goes to Management Overview (UC01)
  if (user.role === "admin" || user.role === "manager") {
    return <Navigate to={ROUTES.managementOverview} replace />;
  }

  // User goes to My Quotes
  return <Navigate to={ROUTES.quotes} replace />;
}

// Protected Route for Admin/Manager (UC01 Workspace)
function ManagementRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={ROUTES.home} replace />;
  if (user.role !== "admin" && user.role !== "manager") {
    return <Navigate to={ROUTES.quotes} replace />;
  }

  return <ManagementWorkspacePage />;
}

// Protected Route for Quotes List
function QuotesRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={ROUTES.home} replace />;

  return <QuotesListPage />;
}

// Protected Route for Quote Editor (UC05)
function EditorRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={ROUTES.home} replace />;

  return <QuoteEditorPage />;
}

// Protected Route for Templates
function TemplatesRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={ROUTES.home} replace />;

  return <TemplatesPage />;
}

// Profile Route
function ProfileRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={ROUTES.home} replace />;

  return <UpdateProfile />;
}

// Trash / Deleted Projects Route
function DeletedProjectsRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return <ListHistFilePage />;
}

export const router = createBrowserRouter([
  {
    path: ROUTES.home,
    Component: RootRoute,
  },
  // UC01 Routes
  {
    path: ROUTES.management,
    element: <Navigate to={ROUTES.managementOverview} replace />,
  },
  {
    path: ROUTES.managementOverview,
    Component: ManagementRoute,
  },
  {
    path: ROUTES.managementTasks,
    Component: ManagementRoute,
  },
  {
    path: ROUTES.managementRevenue,
    Component: ManagementRoute,
  },
  {
    path: ROUTES.managementUsers,
    Component: ManagementRoute,
  },
  {
    path: ROUTES.managementRoles,
    Component: ManagementRoute,
  },

  // Quotes & UC05 Editor Routes
  {
    path: ROUTES.quotes,
    Component: QuotesRoute,
  },
  {
    path: ROUTES.quoteEditor,
    Component: EditorRoute,
  },
  {
    path: ROUTES.trash,
    Component: DeletedProjectsRoute,
  },
  {
    path: ROUTES.templates,
    Component: TemplatesRoute,
  },

  // Backward compatibility routes
  {
    path: ROUTES.accountManagement,
    element: <Navigate to={ROUTES.managementUsers} replace />,
  },
  {
    path: ROUTES.deletedProjects,
    Component: DeletedProjectsRoute,
  },
  {
    path: ROUTES.profile,
    Component: ProfileRoute,
  },

  // Fallback
  {
    path: "*",
    element: <Navigate to={ROUTES.home} replace />,
  },
]);
