import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function joinProjectRoom(projectId: string) {
  const s = getSocket();
  if (s.connected) {
    s.emit("join_project", projectId);
  } else {
    s.once("connect", () => {
      s.emit("join_project", projectId);
    });
  }
}

export function leaveProjectRoom(projectId: string) {
  const s = getSocket();
  if (s.connected) {
    s.emit("leave_project", projectId);
  }
}

export function identifyUser(userId: string) {
  if (!userId) return;
  const s = getSocket();
  if (s.connected) {
    s.emit("identify_user", userId);
  } else {
    s.once("connect", () => {
      s.emit("identify_user", userId);
    });
  }
}

export function emitCellFocus(payload: {
  projectId: string;
  sheetName: string;
  r: number;
  c: number;
  cell: string;
  user: { id: string; username: string; color?: string };
}) {
  const s = getSocket();
  s.emit("cell_focus", payload);
}

export function emitCellBlur(payload: {
  projectId: string;
  sheetName: string;
  r: number;
  c: number;
  cell: string;
  userId: string;
}) {
  const s = getSocket();
  s.emit("cell_blur", payload);
}
