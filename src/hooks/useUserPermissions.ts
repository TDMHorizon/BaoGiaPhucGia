import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { PermissionEngine } from "../lib/permissionEngine";
import { toast } from "sonner";
import { clientLogger } from "../lib/logger";

export interface SheetPermissionRange {
  read: string;
  edit: string;
}

export type PermissionRangesBySheet = Record<string, SheetPermissionRange>;

export interface ActivePermissionField {
  sheetName: string;
  type: "read" | "edit";
}

export interface UseUserPermissionsOptions {
  projectId: string | undefined;
  sheets: string[];
  activeSheet?: string;
  onSwitchSheet?: (sheetName: string) => void;
  onFocusSpreadsheetRange?: (rangeStr: string) => void;
}

export function useUserPermissions({
  projectId,
  sheets,
  activeSheet,
  onSwitchSheet,
  onFocusSpreadsheetRange,
}: UseUserPermissionsOptions) {
  const [permissionUsers, setPermissionUsers] = useState<Array<{ id: string; username: string; role: string; active?: boolean }>>([]);
  const [permissionUserId, setPermissionUserId] = useState<string>("");
  const [permissionRanges, setPermissionRanges] = useState<PermissionRangesBySheet>({});
  const [activePermissionField, setActivePermissionField] = useState<ActivePermissionField | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Initial user list loading
  useEffect(() => {
    let cancelled = false;
    api.getActiveUsers()
      .then((users: any[]) => {
        if (cancelled) return;
        const employeeList = (users || []).filter((u) => u.role === "user");
        setPermissionUsers(employeeList);
        if (employeeList.length > 0) {
          setPermissionUserId((current) => current || employeeList[0].id);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        clientLogger.error("PERMISSIONS", "LOAD_EMPLOYEES_ERROR", { error: String(error) });
        toast.error("Không thể tải danh sách nhân viên.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch permissions when project or user changes
  useEffect(() => {
    if (!projectId || !permissionUserId) {
      setPermissionRanges({});
      setIsDirty(false);
      return;
    }

    const abortController = new AbortController();
    setIsLoading(true);

    api.getProjectPermissions(projectId, permissionUserId)
      .then((response: any) => {
        if (abortController.signal.aborted) return;

        const next: PermissionRangesBySheet = {};
        for (const sheet of sheets) {
          next[sheet] = { read: "", edit: "" };
        }

        for (const grant of response.grants || []) {
          const current = next[grant.sheetName] ?? { read: "", edit: "" };
          const field = grant.canEdit ? "edit" : "read";
          const list = current[field]
            .split(/[,;\n]/)
            .map((p: string) => p.trim())
            .filter(Boolean);

          if (!list.includes(grant.rangeRef)) {
            list.push(grant.rangeRef);
          }
          current[field] = list.join(", ");

          // Edit implies read
          if (grant.canEdit) {
            const readList = current.read
              .split(/[,;\n]/)
              .map((p: string) => p.trim())
              .filter(Boolean);
            if (!readList.includes(grant.rangeRef)) {
              readList.push(grant.rangeRef);
              current.read = readList.join(", ");
            }
          }
          next[grant.sheetName] = current;
        }

        setPermissionRanges(next);
        setIsDirty(false);
        setIsLoading(false);
        clientLogger.action("PERMISSIONS_LOADED", projectId, {
          userId: permissionUserId,
          grantsCount: (response.grants || []).length,
        });
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return;
        setIsLoading(false);
        clientLogger.error("PERMISSIONS", "LOAD_USER_PERMISSIONS_ERROR", { projectId, userId: permissionUserId, error: String(error) });
        toast.error("Không thể tải quyền của nhân viên.");
      });

    return () => {
      abortController.abort();
    };
  }, [projectId, permissionUserId, sheets.join(",")]);

  const updateRange = useCallback((sheetName: string, type: "read" | "edit", value: string) => {
    setPermissionRanges((prev) => {
      const current = prev[sheetName] ?? { read: "", edit: "" };
      return {
        ...prev,
        [sheetName]: {
          ...current,
          [type]: value,
        },
      };
    });
    setIsDirty(true);
  }, []);

  const captureSelection = useCallback((sheetName: string, type: "read" | "edit", currentSelectionStr: string) => {
    if (!currentSelectionStr) {
      toast.warning("Vui lòng chọn một ô hoặc một vùng trên bảng tính trước!");
      return;
    }

    try {
      const normalizedRange = PermissionEngine.normalizeRange(currentSelectionStr);
      setPermissionRanges((prev) => {
        const current = prev[sheetName] ?? { read: "", edit: "" };
        const existingList = current[type]
          .split(/[,;\n]/)
          .map((p) => p.trim())
          .filter(Boolean);

        // Replace or append
        let newList: string[];
        if (!existingList.includes(normalizedRange)) {
          newList = [...existingList, normalizedRange];
        } else {
          newList = existingList;
        }

        const newRangeStr = newList.join(", ");
        const updatedSheet = {
          ...current,
          [type]: newRangeStr,
        };

        // If editing is added, ensure read also includes it
        if (type === "edit") {
          const readList = current.read
            .split(/[,;\n]/)
            .map((p) => p.trim())
            .filter(Boolean);
          if (!readList.includes(normalizedRange)) {
            updatedSheet.read = [...readList, normalizedRange].join(", ");
          }
        }

        return {
          ...prev,
          [sheetName]: updatedSheet,
        };
      });

      setIsDirty(true);
      toast.success(`Đã lấy vùng ${normalizedRange} cho Sheet ${sheetName} (${type === "read" ? "Vùng đọc" : "Vùng sửa"})`);
      clientLogger.action("PERMISSION_RANGE_CAPTURED", sheetName, { type, range: normalizedRange });
    } catch (err) {
      toast.error(`Vùng chọn '${currentSelectionStr}' không hợp lệ.`);
    }
  }, []);

  const clearRange = useCallback((sheetName: string, type?: "read" | "edit") => {
    setPermissionRanges((prev) => {
      const current = prev[sheetName] ?? { read: "", edit: "" };
      if (type) {
        return {
          ...prev,
          [sheetName]: {
            ...current,
            [type]: "",
          },
        };
      }
      return {
        ...prev,
        [sheetName]: { read: "", edit: "" },
      };
    });
    setIsDirty(true);
  }, []);

  const viewRange = useCallback((sheetName: string, rangeStr: string) => {
    if (!rangeStr || !rangeStr.trim()) {
      toast.info(`Chưa có vùng nào được cấu hình cho Sheet ${sheetName}`);
      return;
    }

    const firstRange = rangeStr.split(/[,;\n]/)[0]?.trim();
    if (onSwitchSheet && activeSheet !== sheetName) {
      onSwitchSheet(sheetName);
    }

    if (onFocusSpreadsheetRange && firstRange) {
      setTimeout(() => {
        onFocusSpreadsheetRange(firstRange);
      }, 100);
    }

    toast.info(`Đang xem vùng ${firstRange} trên sheet ${sheetName}`);
  }, [activeSheet, onSwitchSheet, onFocusSpreadsheetRange]);

  const savePermissions = useCallback(async () => {
    if (!projectId || !permissionUserId) {
      toast.warning("Vui lòng chọn nhân viên để lưu quyền.");
      return;
    }

    setIsSaving(true);
    try {
      const grantsMap = new Map<string, { sheetName: string; rangeRef: string; canRead: boolean; canEdit: boolean }>();

      for (const [sheetName, values] of Object.entries(permissionRanges) as [string, SheetPermissionRange][]) {
        const readRanges = values.read.split(/[,;\n]/).map((r) => r.trim()).filter(Boolean);
        const editRanges = values.edit.split(/[,;\n]/).map((r) => r.trim()).filter(Boolean);

        for (const [rangeText, canEdit] of [
          ...readRanges.map((r) => [r, false] as const),
          ...editRanges.map((r) => [r, true] as const),
        ]) {
          try {
            const rangeRef = PermissionEngine.normalizeRange(rangeText);
            const key = `${sheetName}\u0000${rangeRef}`;
            const existing = grantsMap.get(key);
            grantsMap.set(key, {
              sheetName,
              rangeRef,
              canRead: true, // Edit implies Read
              canEdit: canEdit || existing?.canEdit || false,
            });
          } catch (e) {
            throw new Error(`Định dạng vùng '${rangeText}' trên sheet '${sheetName}' không hợp lệ (ví dụ đúng: A1:D10, A:D, 1:10).`);
          }
        }
      }

      const grantList = Array.from(grantsMap.values());
      await api.replaceUserProjectPermissions(projectId, permissionUserId, grantList);

      setIsDirty(false);
      toast.success("Đã cập nhật quyền đọc & sửa thành công!");
      clientLogger.action("PERMISSIONS_SAVED", projectId, {
        userId: permissionUserId,
        grantsCount: grantList.length,
      });
    } catch (error) {
      clientLogger.error("PERMISSIONS", "SAVE_PERMISSIONS_ERROR", { error: String(error) });
      toast.error(error instanceof Error ? error.message : "Lỗi khi lưu phân quyền.");
    } finally {
      setIsSaving(false);
    }
  }, [projectId, permissionUserId, permissionRanges]);

  return {
    permissionUsers,
    permissionUserId,
    setPermissionUserId,
    permissionRanges,
    setPermissionRanges,
    activePermissionField,
    setActivePermissionField,
    isLoading,
    isSaving,
    isDirty,
    updateRange,
    captureSelection,
    clearRange,
    viewRange,
    savePermissions,
  };
}
