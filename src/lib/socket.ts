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
