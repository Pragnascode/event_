import type { RoleType } from "../types";

export type AuthState = {
  jwt: string;
  roomId: string;
  roleType: RoleType;
  deviceId?: string;
};

const LS_JWT = "auth.jwt";
const LS_ROOM = "auth.roomId";
const LS_ROLE = "auth.roleType";
const LS_DEVICE = "auth.deviceId";

export function readAuth(): AuthState | null {
  const jwt = localStorage.getItem(LS_JWT);
  const roomId = localStorage.getItem(LS_ROOM);
  const roleType = localStorage.getItem(LS_ROLE) as RoleType | null;
  const deviceId = localStorage.getItem(LS_DEVICE) ?? undefined;

  if (!jwt || !roomId || !roleType) return null;
  return { jwt, roomId, roleType, deviceId };
}

export function writeAuth(state: AuthState) {
  localStorage.setItem(LS_JWT, state.jwt);
  localStorage.setItem(LS_ROOM, state.roomId);
  localStorage.setItem(LS_ROLE, state.roleType);
  if (state.deviceId) localStorage.setItem(LS_DEVICE, state.deviceId);
}

export function clearAuth() {
  localStorage.removeItem(LS_JWT);
  localStorage.removeItem(LS_ROOM);
  localStorage.removeItem(LS_ROLE);
  localStorage.removeItem(LS_DEVICE);
}

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(LS_DEVICE);
  if (existing) return existing;
  const id = crypto.randomUUID?.() ?? `dev_${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(LS_DEVICE, id);
  return id;
}

