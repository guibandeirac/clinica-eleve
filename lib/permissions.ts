import type { Role } from "./types";

export type Action =
  | "patient.view"
  | "patient.create"
  | "patient.edit"
  | "patient.delete"
  | "treatment.view"
  | "treatment.create"
  | "treatment.edit"
  | "treatment.delete"
  | "charge.view"
  | "charge.markPaid"
  | "charge.revert"
  | "user.manage";

const MATRIX: Record<Action, Role[]> = {
  "patient.view": ["admin", "recepcao", "profissional"],
  "patient.create": ["admin", "recepcao", "profissional"],
  "patient.edit": ["admin", "recepcao", "profissional"],
  "patient.delete": ["admin"],
  "treatment.view": ["admin", "recepcao", "profissional"],
  "treatment.create": ["admin", "recepcao", "profissional"],
  "treatment.edit": ["admin", "recepcao", "profissional"],
  "treatment.delete": ["admin"],
  "charge.view": ["admin", "recepcao", "profissional"],
  "charge.markPaid": ["admin", "recepcao", "profissional"],
  "charge.revert": ["admin", "recepcao"],
  "user.manage": ["admin"],
};

export function can(action: Action, role: Role): boolean {
  return MATRIX[action].includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  recepcao: "Recepção",
  profissional: "Profissional",
};
