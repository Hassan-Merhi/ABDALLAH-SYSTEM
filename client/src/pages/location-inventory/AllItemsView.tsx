import { SearchField } from "@/components/ui/search-field";
import { InventoryTable } from "./InventoryTable";
import type { InventoryItem } from "./locationInventoryTypes";

interface AllItemsViewProps {
  totalItems: number;
  totalQty: number;
  totalValue: number;
  canViewCost: boolean;
  formatAmount: (v: number) => string;
  itemSearchTerm: string;
  setItemSearchTerm: (v: string) => void;
  allItemsFiltered: InventoryItem[];
  showMovement: boolean;
  openingInventoryMap: Map<number, number>;
  selectedRowIndex: number;
  setSelectedRowIndex: (v: number) => void;
  navigate: (path: string) => void;
  inventory: InventoryItem[];
}

export function AllItemsView({
  totalItems,
  totalQty,
  totalValue,
  canViewCost,
  formatAmount,
  itemSearchTerm,
  setItemSearchTerm,
  allItemsFiltered,
  showMovement,
  openingInventoryMap,
  selectedRowIndex,
  setSelectedRowIndex,
  navigate,
  inventory,
}: AllItemsViewProps) {
  return (
    <>
      {/* Stats */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
        <span className="font-semibold text-foreground">{totalItems}</span> Items
        <span className="text-muted-foreground">·</span>
        <span className="font-semibold text-foreground font-mono">{Math.floor(totalQty).toLocaleString()}</span> BL
        total
        {canViewCost && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold text-foreground">{formatAmount(totalValue)}</span> total value
          </>
        )}
      </div>

      {/* Search */}
      <SearchField
        value={itemSearchTerm}
        onValueChange={setItemSearchTerm}
        placeholder="Search items by name..."
        wrapperClassName="max-w-sm"
        data-testid="input-all-item-search"
      />

      <InventoryTable
        filteredStockItems={allItemsFiltered}
        showMovement={showMovement}
        openingInventoryMap={openingInventoryMap}
        selectedRowIndex={selectedRowIndex}
        setSelectedRowIndex={setSelectedRowIndex}
        navigate={navigate}
        formatAmount={formatAmount}
        canViewCost={canViewCost}
        itemSearchTerm={itemSearchTerm}
        inventory={inventory}
        selectedGroup={null}
      />
    </>
  );
}
