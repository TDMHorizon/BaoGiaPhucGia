const TOKEN_KEY = "baogia_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(url: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    try {
      const cloned = await res.clone().json();
      if (cloned?.code === "ACCOUNT_LOCKED" || cloned?.error?.includes("khóa")) {
        window.dispatchEvent(new CustomEvent("baogia:account_locked", { detail: cloned }));
      }
    } catch {
      /* ignore */
    }
    setToken(null);
    localStorage.removeItem("user");
  }
  if (!res.ok) {
    let message = "Request failed";
    let data: any = null;
    try {
      data = await res.json();
      message = data?.error || message;
    } catch {
      /* ignore */
    }
    const err: any = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  async getConfig() {
    return request("/api/config");
  },

  async login(username: string, password: string) {
    const data = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (data.token) setToken(data.token);
    return data;
  },

  async refreshToken() {
    const data = await request("/api/auth/refresh", { method: "POST" });
    if (data?.token) setToken(data.token);
    return data;
  },

  async me() {
    return request("/api/me");
  },

  async getUsers() {
    return request("/api/users");
  },

  async getActiveUsers() {
    return request("/api/users/active");
  },

  async createUser(payload: { username: string; password: string; role?: string }) {
    return request("/api/users", { method: "POST", body: JSON.stringify(payload) });
  },

  async updateUser(id: string, payload: Record<string, unknown>) {
    return request(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  async deleteUser(id: string) {
    return request(`/api/users/${id}`, { method: "DELETE" });
  },

  async getProjects(params?: { q?: string; status?: string; assignee?: string }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.status) qs.set("status", params.status);
    if (params?.assignee) qs.set("assignee", params.assignee);
    const query = qs.toString();
    return request(`/api/projects${query ? `?${query}` : ""}`);
  },

  async getProjectByUserId() {
    return request("/api/projects/me");
  },

  async getDeletedProjects() {
    return request("/api/projects/deleted");
  },

  async getDeletedProject(id: string) {
    return request(`/api/projects/deleted/${encodeURIComponent(id)}`);
  },

  async getPendingCount() {
    return request("/api/projects/pending-count");
  },

  async createProject(
    name: string,
    fileBase64: string,
    sheets: string[],
    editableRanges?: Record<string, string>,
    meta?: Record<string, unknown>
  ) {
    return request("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, fileBase64, sheets, editableRanges, ...meta }),
    });
  },

  async getProject(id: string) {
    return request(`/api/projects/${id}`);
  },

  async updateProject(id: string, payload: Record<string, unknown>) {
    return request(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  async deleteProject(id: string) {
    return request(`/api/projects/${id}`, { method: "DELETE" });
  },

  async restoreProject(id: string) {
    return request(`/api/projects/${id}/restore`, { method: "POST" });
  },

  async updateRanges(id: string, editableRanges: Record<string, string>) {
    return request(`/api/projects/${id}/ranges`, {
      method: "PUT",
      body: JSON.stringify({ editableRanges }),
    });
  },

  async updateProjectFile(id: string, fileBase64: string, sheets?: string[]) {
    return request(`/api/projects/${id}/file`, {
      method: "PUT",
      body: JSON.stringify({ fileBase64, sheets }),
    });
  },

  async changeStatus(id: string, trangThai: string, note?: string) {
    return request(`/api/projects/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ trangThai, note }),
    });
  },

  async getVersions(id: string) {
    return request(`/api/projects/${id}/versions`);
  },

  async getVersionFile(id: string, version: number) {
    return request(`/api/projects/${id}/versions/${version}`);
  },

  async saveEdit(id: string, editData: Record<string, unknown>, expectedRevision?: number) {
    return request(`/api/projects/${id}/edits`, {
      method: "POST",
      body: JSON.stringify({ ...editData, expectedRevision }),
    });
  },

  async saveBatchEdits(id: string, edits: any[]) {
    return request(`/api/projects/${id}/edits/batch`, {
      method: "POST",
      body: JSON.stringify({ edits }),
    });
  },

  async getCellValues(id: string) {
    return request(`/api/projects/${id}/cell-values`);
  },

  async getCellStates(id: string) {
    return request(`/api/projects/${id}/cell-states`);
  },

  async getProjectFile(id: string) {
    return request(`/api/projects/${id}/file`);
  },

  async downloadDraftExcel(id: string): Promise<Blob> {
    const res = await fetch(`/api/projects/${id}/export/draft`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Không thể xuất bản nháp" }));
      throw new Error(err.error || "Không thể xuất bản nháp");
    }
    return res.blob();
  },

  async updateProjectMembers(id: string, payload: { memberIds: string[]; nguoiPhuTrachId?: string | null }) {
    return request(`/api/projects/${id}/members`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async createBlankProject(name: string, meta?: Record<string, unknown>) {
    return request("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, mode: "blank", sheets: ["BaoGia"], ...meta }),
    });
  },

  async getMemberPermissions(id: string) {
    return request(`/api/projects/${id}/member-permissions`);
  },

  async setMemberPermissions(id: string, permissions: { userId: string; sheetName: string; editableRanges: string }[]) {
    return request(`/api/projects/${id}/member-permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    });
  },

  async getAuditLogs(limit: number = 100) {
    return request(`/api/audit-logs?limit=${limit}`);
  },

  async getEdits(id: string, page?: number, limit?: number) {
    const qs = new URLSearchParams();
    if (page !== undefined) qs.set("page", String(page));
    if (limit !== undefined) qs.set("limit", String(limit));
    const q = qs.toString();
    return request(`/api/projects/${id}/edits${q ? `?${q}` : ""}`);
  },

  async getTemplates() {
    return request("/api/templates");
  },

  async createTemplate(payload: {
    name: string;
    fileBase64: string;
    sheets: string[];
    editableRanges?: Record<string, string>;
  }) {
    return request("/api/templates", { method: "POST", body: JSON.stringify(payload) });
  },

  async cloneTemplate(id: string, payload?: Record<string, unknown>) {
    return request(`/api/templates/${id}/clone`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },
  async deleteTemplate(id: string) {
    return request(`/api/templates/${id}`, { method: "DELETE" });
  },

  async getDisabledRanges(id: string) {
    return request(`/api/projects/${id}/disabled-ranges`);
  },

  async disableRange(
    id: string,
    payload: { sheetName: string; type: "CELL" | "ROW" | "COLUMN"; target: string | number }
  ) {
    return request(`/api/projects/${id}/disable-range`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async enableRange(
    id: string,
    payload: { sheetName: string; type: "CELL" | "ROW" | "COLUMN"; target: string | number }
  ) {
    return request(`/api/projects/${id}/enable-range`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
