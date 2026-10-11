# Responsive Tabs — Phase 2

Phase 2 of the cross-module shared UI standardization program.

## One shared implementation

Use `Tabs`, `TabsList`, `TabsTrigger` and `TabsContent` from
`@/components/ui/tabs` for real switchable content tabs in ERP, Factory,
POS, Properties, and Supplier Partner. Do not create custom `<button>` tab
rows with handwritten active-state CSS or repeat `role="tablist"`.

### Appearance

| Variant | Use |
|---|---|
| `pill` | Normal page/hub selection, contextual filters and settings panels |
| `underline` | Section navigation directly under a page header |

Both variants use **the same styling on phone and desktop**. On narrow screens
the tab strip scrolls horizontally; the selected item is kept in view, without
triggering a vertical page scroll. Touch controls are at least 44px tall on
phones, and standard-density controls remain on desktop. Individual pages
choose a variant based on hierarchy, **not** on device width.

### Keyboard and assistive technology

- `Tab` focuses the current selected tab.
- Left/Right arrows move between visible enabled tabs for horizontal strips.
  In RTL, Left/Right direction reverses. Vertical tablists use Up/Down.
- `Home` and `End` move to the first/last enabled tab.
- Default automatic activation changes the panel and calls the caller's
  `onValueChange`. Optional `activationMode="manual"` moves focus only.
- Disabled, hidden, or inaccessible tabs are skipped.
- Triggers get `role="tab"`, `aria-selected`, a roving `tabIndex`,
  and stable instance-scoped IDs. Matching panels get `role="tabpanel"`
  and `aria-labelledby`. IDs remain unique even with nested tab sets.
- Content is unmounted when inactive by default, retaining the old memory
  and data-fetching behavior. `forceMount` is opt-in.

### Controlled tabs and permissions

Keep route/query state in existing hooks. Do **not** move app state into a
shared presentation component.

```tsx
const [activeTab, setTab] = useHubQueryState({
  key: "tab",
  knownValues: ALL_TABS,
  allowedValues: visibleTabValues,
  defaultValue: visibleTabValues[0] ?? "items",
});
if (!visibleTabValues.length) return <RestrictedTabsState />;

return (
  <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabKey)}>
    <TabsList variant="pill" aria-label="Stock sections">
      {visibleTabs.map((tab) => (
        <TabsTrigger key={tab.value} value={tab.value}>
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
    {visibleTabValues.includes("items") && (
      <TabsContent value="items"><Items /></TabsContent>
    )}
  </Tabs>
);
```

Filter the tab definitions **before** rendering triggers, based on existing
permission/feature flags. Do not render restricted triggers with CSS
`display:none` and do not reset tab route parameters independently of
`useHubQueryState`. Parent switching must keep its existing `clearKeys`
contract. Tab click behavior is delegated through `onValueChange` and
does not issue fetches directly.

### Migrated applications

- ERP Stock Hub and Inventory Hub.
- Factory Invoicing, Payroll & Benefits, Loadings, Import, Worker, and
  Employee Hubs.
- Factory Sheets & Sacks, Dispatch Batches, Raw Stock Recalculate, and
  legacy Stock Allocation V3 (retained as a fallback).
- The Notifications Center category switcher.
- All other pages already importing the canonical `ui/tabs` also
  inherit the shared keyboard and visual contracts.

Other navigation surfaces, including the Voucher mobile grouped sheet,
Voucher desktop sidebar, Settings sidebar, Factory Production module
navigation, and Remote Support browser-tab selection, remain separate
navigation/selection patterns: they are **not** horizontal tab bars. Their
routing, screen real estate and permission behavior must be preserved.

### Scope

No domain calculations, API calls, permission checks, URL semantics,
dialog logic or routes were deliberately changed. No tests, lint, build,
CI, or browser checks were run for this phase, as requested.
