import type { Express } from "express";
import type { Server } from "http";

import { registerApplicationRoutes } from "./routes/applicationRoutes";
import { registerOperationalMonitoringRoutes } from "./routes/admin/operationalMonitoringRoutes";
import { registerTenantIsolationBoundary } from "./routes/tenantBoundaryRegistrar";
import { registerOperationalVoucherRequestBoundary } from "./services/accounting/operationalVoucherRequestBoundary";
import { registerVoucherPathPhase5to6Boundary } from "./services/accounting/voucherPathPhase5to6Boundary";

export function registerRoutes(app: Express): Promise<Server> {
  // Retired mode APIs are not exposed by the ABDALLAH ERP deployment.
  app.use(["/api/factory", "/api/properties", "/api/retail", "/api/sp", "/api/supplier-partner"], (_req, res) => {
    res.status(403).json({ message: "Only ERP mode is available in ABDALLAH-SYSTEM" });
  });
  registerTenantIsolationBoundary(app);
  registerOperationalVoucherRequestBoundary(app);
  registerVoucherPathPhase5to6Boundary(app);
  registerOperationalMonitoringRoutes(app);
  return registerApplicationRoutes(app);
}
