import type { IconType } from "react-icons";
import {
  FiHome,
  FiGrid,
  FiCheckSquare,
  FiTrendingUp,
  FiUsers,
  FiLock,
  FiFolder,
  FiLayers,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { RiShieldStarLine } from "react-icons/ri";

export type Role = "admin" | "manager" | "user";

export interface NavChildItem {
  id: string;
  label: string;
  path: string;
  icon: IconType;
  roles: Role[];
  badge?: string;
}

export interface NavGroupItem {
  id: string;
  label: string;
  icon: IconType;
  roles: Role[];
  path?: string;
  children?: NavChildItem[];
}

export const NAVIGATION_CONFIG: NavGroupItem[] = [
  {
    id: "home",
    label: "Trang chủ",
    icon: FiHome,
    roles: ["admin", "manager", "user"],
    path: "/",
  },
  {
    id: "management",
    label: "Quản trị & Điều hành",
    icon: RiShieldStarLine,
    roles: ["admin", "manager"],
    children: [
      {
        id: "overview",
        label: "Tổng quan quản lý",
        path: "/management/overview",
        icon: FiGrid,
        roles: ["admin", "manager"],
      },
      {
        id: "tasks",
        label: "Quản lý công việc / Task",
        path: "/management/tasks",
        icon: FiCheckSquare,
        roles: ["admin", "manager"],
      },
      {
        id: "revenue",
        label: "Báo cáo doanh thu",
        path: "/management/revenue",
        icon: FiTrendingUp,
        roles: ["admin", "manager"],
      },
      {
        id: "users",
        label: "Quản lý người dùng",
        path: "/management/users",
        icon: FiUsers,
        roles: ["admin"], // Admin only
      },
      {
        id: "roles",
        label: "Phân quyền hệ thống",
        path: "/management/roles",
        icon: FiLock,
        roles: ["admin"], // Admin only
      },
    ],
  },
  {
    id: "quotes-group",
    label: "Quản lý báo giá",
    icon: FiFolder,
    roles: ["admin", "manager"],
    children: [
      {
        id: "quotes-list",
        label: "Danh sách báo giá",
        path: "/quotes",
        icon: FiFolder,
        roles: ["admin", "manager"],
      },
      {
        id: "templates",
        label: "Thư viện mẫu",
        path: "/templates",
        icon: FiLayers,
        roles: ["admin", "manager"],
      },
      {
        id: "trash",
        label: "Thùng rác",
        path: "/quotes/trash",
        icon: FiTrash2,
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    id: "user-quotes-group",
    label: "Báo giá của tôi",
    icon: FiFolder,
    roles: ["user"],
    children: [
      {
        id: "my-quotes",
        label: "Danh sách báo giá",
        path: "/quotes",
        icon: FiFolder,
        roles: ["user"],
      },
      {
        id: "user-templates",
        label: "Thư viện mẫu",
        path: "/templates",
        icon: FiLayers,
        roles: ["user"],
      },
    ],
  },
  {
    id: "profile",
    label: "Hồ sơ cá nhân",
    icon: FiUser,
    roles: ["admin", "manager", "user"],
    path: "/admin/profile",
  },
];
