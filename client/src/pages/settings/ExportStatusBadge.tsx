import { StatusBadge as SharedStatusBadge } from "@/components/StatusBadge";

export function StatusBadge({ active, needsSetup }: { active: boolean; needsSetup: boolean }) {
  if (active) return <SharedStatusBadge status="active" showIcon={false} />;
  if (needsSetup) return <SharedStatusBadge status="needs_setup" showIcon={false} />;
  return <SharedStatusBadge status="disabled" showIcon={false} />;
}
