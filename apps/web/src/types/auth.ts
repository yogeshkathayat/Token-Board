export enum RolesEnum {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

interface Desk {
  slug: string;
  name: string;
  url: string;
  icon: string;
}

interface Role {
  slug: RolesEnum;
  name: string;
}

interface DeskAccess {
  desk?: Desk;
  role?: Role;
}

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  role?: string;
  desk_access?: DeskAccess[];
}

export interface Session {
  user: User;
}
