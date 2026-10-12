import { searchAny } from "@shared/searchNormalization";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { TableViewOptions, type TableColumnOption } from "@/components/TableViewOptions";
import { PaginationBar } from "@/components/PaginationBar";
import { useTablePrefs } from "@/hooks/use-table-prefs";
import { useClientTablePagination } from "@/hooks/use-client-table-pagination";
import { ArrowDown, ArrowUp, Edit, Trash2 } from "lucide-react";
import type { Company } from "@shared/schema";

interface CompaniesTableProps {
  companies: Company[];
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
}

const COLUMNS: TableColumnOption[] = [
  { key: "name", label: "Company Name", required: true },
  { key: "code", label: "Code" },
  { key: "type", label: "Type" },
  { key: "currency", label: "Currency" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", required: true },
];

export function CompaniesTable({ companies, onEdit, onDelete }: CompaniesTableProps) {
  const [search, setSearch] = useState("");

  const { prefs, setPrefs } = useTablePrefs("settings-companies");
  const pageSize = prefs.pageSize ?? 25;
  const visibility = prefs.columns ?? {};
  const show = (key: string) => visibility[key] !== false;
  const sortKey = prefs.sortKey === "code" ? "code" : "name";
  const sortDir = prefs.sortDir === "desc" ? -1 : 1;

  const filtered = companies
    .filter((company) => searchAny(search, company.name, company.code))
    .sort((a, b) => String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? "")) * sortDir);
  const { page: safePage, setPage, totalPages: pages, paginate } = useClientTablePagination(filtered.length, pageSize);
  const visible = paginate(filtered);

  const toggleSort = (key: "name" | "code") => {
    setPrefs({ sortKey: key, sortDir: prefs.sortKey === key && prefs.sortDir === "asc" ? "desc" : "asc" });
    setPage(1);
  };

  return (
    <div className="min-w-0 space-y-3">
      <DataTableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search companies..."
        actions={
          <TableViewOptions
            columns={COLUMNS}
            visibility={visibility}
            density={prefs.density}
            onVisibilityChange={(key, value) => setPrefs({ columns: { ...visibility, [key]: value } })}
            onDensityChange={(value) => setPrefs({ density: value })}
          />
        }
      />
      <Table mobileLayout="cards" density={prefs.density}>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button
                type="button"
                className="flex items-center gap-1"
                onClick={() => toggleSort("name")}
                aria-label="Sort companies by name"
              >
                Company Name
                {sortKey === "name" &&
                  (sortDir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
              </button>
            </TableHead>
            {show("code") && (
              <TableHead>
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => toggleSort("code")}
                  aria-label="Sort companies by code"
                >
                  Code
                  {sortKey === "code" &&
                    (sortDir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </button>
              </TableHead>
            )}
            {show("type") && <TableHead>Type</TableHead>}
            {show("currency") && <TableHead>Currency</TableHead>}
            {show("status") && <TableHead>Status</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.filter((column) => column.required || show(column.key)).length}
                className="py-8 text-center text-muted-foreground"
              >
                No matching companies
              </TableCell>
            </TableRow>
          ) : (
            visible.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">{company.name}</TableCell>
                {show("code") && <TableCell className="font-mono text-xs uppercase">{company.code}</TableCell>}
                {show("type") && (
                  <TableCell>
                    <Badge variant="outline" className="text-[11px] uppercase">
                      {company.companyType}
                    </Badge>
                  </TableCell>
                )}
                {show("currency") && (
                  <TableCell className="text-xs font-medium">
                    {company.baseCurrency} / {company.displayCurrency}
                  </TableCell>
                )}
                {show("status") && (
                  <TableCell>
                    <StatusBadge status={company.active ? "active" : "inactive"} showIcon={false} />
                  </TableCell>
                )}
                <TableCell className="space-x-2 text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEdit(company)}
                    aria-label={`Edit ${company.name}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(company)}
                    aria-label={`Delete ${company.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <PaginationBar
        page={safePage}
        totalPages={pages}
        total={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPrefs({ pageSize: size });
          setPage(1);
        }}
        noun="companies"
      />
    </div>
  );
}
