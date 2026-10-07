import { Button } from "./ui/button";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  ADMIN_STATUS_ACTIONS,
  USER_STATUS_ACTIONS,
  TRANG_THAI_LABELS,
  normalizeTrangThai,
  type TrangThai,
} from "../lib/constants";
import { StatusBadge } from "./StatusBadge";

type Props = {
  project: any;
  role: "admin" | "user";
  onUpdated: (project: any) => void;
};

export function StatusWorkflow({ project, role, onUpdated }: Props) {
  const status = normalizeTrangThai(project.trangThai);
  const actions =
    role === "admin"
      ? ADMIN_STATUS_ACTIONS[status] || []
      : USER_STATUS_ACTIONS[status] || [];

  const handleChange = async (next: TrangThai) => {
    try {
      const updated = await api.changeStatus(project.id, next);
      onUpdated(updated);
      toast.success(`Đã chuyển: ${TRANG_THAI_LABELS[next]}`);
    } catch (e: any) {
      toast.error(e.message || "Không thể đổi trạng thái");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={status} />
      {actions.map((a) => (
        <Button
          key={a.next + a.label}
          size="sm"
          variant="outline"
          className="h-7 text-xs font-semibold"
          onClick={() => handleChange(a.next)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
