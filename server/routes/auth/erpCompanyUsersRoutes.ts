import type { Express, Request, Response, NextFunction } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { requireAuth, requireRole } from "../../auth";
import { users, userCompanyRoles } from "@shared/schema";
import { canChangeCompanyUserRole, ERP_COMPANY_USER_ROLES } from "@shared/erpCompanyUserRoles";
import { hashPassword, logAudit } from "../_helpers";
import { storage } from "../../storage";
import { getErrorMessage } from "../../lib/httpHandlers";

const roleSchema = z.enum(ERP_COMPANY_USER_ROLES);
const createSchema = z.object({
  username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: roleSchema,
}).strict();
const changeRoleSchema = z.object({ role: roleSchema }).strict();

type CompanyAdminRequest = Request & { companyAdminId?: number };

async function requireSelectedCompanyAdmin(req: CompanyAdminRequest, res: Response, next: NextFunction) {
  try {
    // Never accept a client-supplied company ID for user administration.
    const companyId = Number(req.session.currentCompanyId);
    if (!Number.isSafeInteger(companyId) || companyId <= 0) {
      return res.status(400).json({ message: "Select a company first" });
    }
    if (req.user?.role !== "Developer") {
      const [membership] = await db
        .select({ role: userCompanyRoles.role })
        .from(userCompanyRoles)
        .where(and(
          eq(userCompanyRoles.userId, req.user!.id),
          eq(userCompanyRoles.companyId, companyId),
        ))
        .limit(1);
      if (req.user?.role !== "Admin" || membership?.role !== "Admin") {
        return res.status(403).json({ message: "Only this company's admin can manage users" });
      }
    }
    req.companyAdminId = companyId;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function targetHasDeveloperRole(userId: string): Promise<boolean> {
  const roles = await db
    .select({ role: userCompanyRoles.role })
    .from(userCompanyRoles)
    .where(eq(userCompanyRoles.userId, userId));
  return roles.some((row) => row.role === "Developer");
}

export function registerErpCompanyUsersRoutes(app: Express) {
  const guards = [requireAuth, requireRole("Admin"), requireSelectedCompanyAdmin] as const;

  app.get("/api/erp-company-users", ...guards, async (req: CompanyAdminRequest, res) => {
    try {
      const companyId = req.companyAdminId!;
      const records = await db
        .select({
          id: users.id,
          username: users.username,
          active: users.active,
          role: userCompanyRoles.role,
        })
        .from(userCompanyRoles)
        .innerJoin(users, eq(userCompanyRoles.userId, users.id))
        .where(eq(userCompanyRoles.companyId, companyId))
        .orderBy(users.username);

      const developers = await db.select({ userId: userCompanyRoles.userId })
        .from(userCompanyRoles).where(eq(userCompanyRoles.role, "Developer"));
      const developerIds = new Set(developers.map((row) => row.userId));
      return res.json(records.filter((row) => !developerIds.has(row.id)));
    } catch (error) {
      return res.status(500).json({ message: getErrorMessage(error) });
    }
  });

  app.post("/api/erp-company-users", ...guards, async (req: CompanyAdminRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid user details" });
    }

    try {
      const companyId = req.companyAdminId!;
      const { username, password, role } = parsed.data;
      if (await storage.getUserByUsername(username)) {
        return res.status(409).json({ message: "Username already exists" });
      }
      const passwordHash = await hashPassword(password);
      const created = await db.transaction(async (tx) => {
        const [user] = await tx.insert(users)
          .values({ username, password: passwordHash })
          .returning({ id: users.id, username: users.username, active: users.active });
        const [membership] = await tx.insert(userCompanyRoles)
          .values({ userId: user.id, companyId, role })
          .returning({ id: userCompanyRoles.id });
        await logAudit({
          userId: req.user!.id,
          username: req.user!.username || "unknown",
          companyId,
          action: "create",
          tableName: "user_company_roles",
          recordId: membership.id,
          recordIdentifier: `userId:${user.id} role:${role} company:${companyId}`,
          changes: null,
        }, tx);
        return { ...user, role };
      });
      return res.status(201).json(created);
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        return res.status(409).json({ message: "Username already exists" });
      }
      return res.status(500).json({ message: getErrorMessage(error) });
    }
  });

  app.patch("/api/erp-company-users/:userId/role", ...guards, async (req: CompanyAdminRequest, res) => {
    const parsed = changeRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid role" });
    }
    const companyId = req.companyAdminId!;
    const targetUserId = req.params.userId;
    try {
      const [membership] = await db
        .select({ id: userCompanyRoles.id, companyId: userCompanyRoles.companyId, role: userCompanyRoles.role })
        .from(userCompanyRoles)
        .where(and(eq(userCompanyRoles.userId, targetUserId), eq(userCompanyRoles.companyId, companyId)))
        .limit(1);
      if (!membership) return res.status(404).json({ message: "User is not assigned to this company" });
      const isDeveloper = await targetHasDeveloperRole(targetUserId);
      if (!canChangeCompanyUserRole(
        req.user!.id, targetUserId, companyId, membership.companyId,
        isDeveloper ? [membership.role, "Developer"] : [membership.role],
      )) {
        return res.status(403).json({ message: "This user's role cannot be changed" });
      }

      const role = parsed.data.role;
      await db.transaction(async (tx) => {
        await tx.update(userCompanyRoles)
          .set({
            role,
            assignedLocationId: null,
            cashAccountId: null,
            posStation: null,
            canSellNegativeStock: false,
            posViewOnly: false,
            daybookEditDays: 0,
            canAccessCustomers: false,
            canDeleteRecords: false,
          })
          .where(and(eq(userCompanyRoles.id, membership.id), eq(userCompanyRoles.companyId, companyId)));
        await logAudit({
          userId: req.user!.id,
          username: req.user!.username || "unknown",
          companyId,
          action: "update",
          tableName: "user_company_roles",
          recordId: membership.id,
          recordIdentifier: `userId:${targetUserId} company:${companyId}`,
          changes: { role: { old: membership.role, new: role } },
        }, tx);
      });
      // A role change must take effect on the target user's next login.
      await db.execute(sql`DELETE FROM session WHERE sess::jsonb ->> 'userId' = ${targetUserId}`);
      return res.json({ id: targetUserId, role });
    } catch (error) {
      return res.status(500).json({ message: getErrorMessage(error) });
    }
  });
}
