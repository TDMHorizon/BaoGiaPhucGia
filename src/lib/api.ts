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
    setToken(null);
    localStorage.removeItem("user");
  }
  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
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

<<<<<<< HEAD
  async getDeletedProjects() {
    return request("/api/projects/deleted");
  },

=======
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
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

<<<<<<< HEAD
  async restoreProject(id: string) {
    return request(`/api/projects/${id}/restore`, { method: "POST" });
  },

=======
>>>>>>> b5c205dd1b5eba611c0e83ab261673cb36b2d879
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

  async saveEdit(id: string, editData: Record<string, unknown>) {
    return request(`/api/projects/${id}/edits`, {
      method: "POST",
      body: JSON.stringify(editData),
    });
  },

  async getEdits(id: string) {
    return request(`/api/projects/${id}/edits`);
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
};
