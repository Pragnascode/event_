export type RoomRoleKeys = {
  head?: string | null;
  volunteer?: string | null;
};

export type RoomDoc = {
  eventName?: string | null;
  duration?: number | string | null;
  roleKeys?: RoomRoleKeys | null;
};
