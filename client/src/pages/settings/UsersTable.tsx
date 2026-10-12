import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { PaginationBar } from "@/components/PaginationBar";
import { TableViewOptions, type TableColumnOption } from "@/components/TableViewOptions";
import { useTablePrefs } from "@/hooks/use-table-prefs";
import { useClientTablePagination } from "@/hooks/use-client-table-pagination";
import { Edit, Trash2, Key } from "lucide-react";
import type { SettingsUserRow } from "./settingsTypes";

interface UsersTableProps {
  users: SettingsUserRow[];
  onEdit: (user: Record<string, unknown>) => void;
  onDelete: (user: Record<string, unknown>) => void;
  onResetPassword: (user: Record<string, unknown>) => void;
}

const COLUMNS: TableColumnOption[] = [
  { key: "username", label: "Username", required: true },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", required: true },
];

export function UsersTable({ users, onEdit, onDelete, onResetPassword }: UsersTableProps) {
  const [search, setSearch] = useState("");

  const { prefs, setPrefs } = useTablePrefs("settings-users");
  const pageSize = prefs.pageSize ?? 25;
  const visibility = prefs.columns ?? {};
  const show = (column: string) => visibility[column] !== false;
  const filtered = users.filter((user) =>
    [user.username, user.role].some((value) => String(value ?? "").toLowerCase().includes(search.toLowerCase().trim()))
  );
  const { page: safePage, setPage, totalPages: pages, paginate } = useClientTablePagination(filtered.length, pageSize);
  const visible = paginate(filtered);

  return (
    <div className="min-w-0 space-y-3">
      <DataTableToolbar
        search={search}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        searchPlaceholder="Search users or roles..."
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
            <TableHead>Username</TableHead>
            {show("role") && <TableHead>Role</TableHead>}
            {show("status") && <TableHead>Status</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow><TableCell colSpan={COLUMNS.filter((column) => column.required || show(column.key)).length} className="py-8 text-center text-muted-foreground">No matching users</TableCell></TableRow>
          ) : visible.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.username}</TableCell>
              {show("role") && <TableCell>
                <Badge variant="outline" className="capitalize">{user.role || "Normal User"}</Badge>
              </TableCell>}
              {show("status") && <TableCell>
                <StatusBadge status={user.active ? "active" : "inactive"} showIcon={false} />
              </TableCell>}
              <TableCell className="space-x-2 text-right">
                <Button size="icon" variant="ghost" onClick={() => onResetPassword(user)} title="Reset Password" aria-label={`Reset ${user.username} password`}><Key className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onEdit(user)} aria-label={`Edit ${user.username}`}><Edit className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(user)} aria-label={`Delete ${user.username}`}><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PaginationBar
        page={safePage}
        totalPages={pages}
        total={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPrefs({ pageSize: size }); setPage(1); }}
        noun="users"
      />
    </div>
  );
}
