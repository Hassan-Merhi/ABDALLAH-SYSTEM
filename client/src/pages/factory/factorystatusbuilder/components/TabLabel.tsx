/**
 * TabLabel — extracted sub-component.
 *
 * Extracted from FactoryStatusBuilder.tsx during the Phase 4 god-file split.
 */
import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useActiveTabVisibility } from "@/components/ui/tabs";

export function TabLabel({
  name,
  active,
  onActivate,
  onRename,
  onDelete,
  canDelete,
}: {
  name: string;
  active: boolean;
  onActivate: () => void;
  onRename: (v: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  useActiveTabVisibility(tabRef, active);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== name) onRename(v);
    else setDraft(name);
    setEditing(false);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  return (
    <div
      ref={tabRef}
      data-testid={`sb-tab-${name}`}
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        } else if (event.key === "F2") {
          // Keyboard equivalent of double-click rename.
          event.preventDefault();
          setEditing(true);
          setDraft(name);
        }
      }}
      onDoubleClick={() => {
        setEditing(true);
        setDraft(name);
      }}
      className={`relative flex min-h-11 sm:min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 py-2 cursor-pointer select-none whitespace-nowrap transition-colors motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${active ? "bg-background text-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent border-none outline-hidden w-24 text-sm font-medium"
          data-testid={`sb-tab-input-${name}`}
        />
      ) : (
        <span className="text-sm">{name}</span>
      )}
      {active && canDelete && (
        <button
          type="button"
          aria-label={`Delete page ${name}`}
          data-testid={`sb-tab-delete-${name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1 rounded-xs opacity-60 hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          style={{ visibility: "visible" }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── Link Dialog ────────────────────────────────────────────────────────────────
