/** ERP-only roles a company administrator may assign. No Developer or POS elevation. */
export const ERP_COMPANY_USER_ROLES = [
  "Admin",
  "Owner",
  "Manager",
  "Normal User",
  "View Only",
] as const;

export type ErpCompanyUserRole = (typeof ERP_COMPANY_USER_ROLES)[number];

export function isErpCompanyUserRole(value: unknown): value is ErpCompanyUserRole {
  return typeof value === "string" && ERP_COMPANY_USER_ROLES.some((role) => role === value);
}

/** Refuse modifications to self, other-company memberships and Developer identities. */
export function canChangeCompanyUserRole(
  actorUserId: string,
  targetUserId: string,
  activeCompanyId: number,
  membershipCompanyId: number,
  targetRoles: readonly string[],
): boolean {
  return actorUserId !== targetUserId &&
    activeCompanyId === membershipCompanyId &&
    !targetRoles.includes("Developer");
}
