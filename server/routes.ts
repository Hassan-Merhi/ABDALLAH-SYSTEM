import type { Express } from "express";
import type { Server } from "http";

import { registerAbdallahErpRetiredBoundaries } from "./middleware/abdallahErpRetiredFeatureBoundary";
import { registerApplicationRoutes } from "./routes/applicationRoutes";
import { registerOperationalMonitoringRoutes } from "./routes/admin/operationalMonitoringRoutes";
import { registerTenantIsolationBoundary } from "./routes/tenantBoundaryRegistrar";
import { registerOperationalVoucherRequestBoundary } from "./services/accounting/operationalVoucherRequestBoundary";
import { registerVoucherPathPhase5to6Boundary } from "./services/accounting/voucherPathPhase5to6Boundary";

export function registerRoutes(app: Express): Promise<Server> {
  // Retired mode APIs and retired ERP modules are refused before any route.
  registerAbdallahErpRetiredBoundaries(app);
  registerTenantIsolationBoundary(app);
  registerOperationalVoucherRequestBoundary(app);
  registerVoucherPathPhase5to6Boundary(app);
  registerOperationalMonitoringRoutes(app);
  return registerApplicationRoutes(app);
}
