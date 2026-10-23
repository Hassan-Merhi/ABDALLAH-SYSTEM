import { useLocation } from "wouter";
import { Boxes, Camera, ScanLine, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/retail/inventory", label: "Inventory", icon: Boxes },
  { href: "/retail/quick-add", label: "Quick add", icon: Camera },
  { href: "/retail/stock", label: "Stock operations", icon: ScanLine },
  { href: "/retail/selling", label: "Selling settings", icon: Settings2 },
] as const;

/** Compact, scrollable switcher between the retail fashion workspaces (phone friendly). */
export function RetailNav() {
  const [location, navigate] = useLocation();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Retail">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = location === href || (href === "/retail/inventory" && location.startsWith("/retail/products/"));
        return (
          <button
            key={href}
            type="button"
            onClick={() => navigate(href)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
              active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
