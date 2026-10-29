import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { UserPlus, Users, ShieldCheck } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ERP_COMPANY_USER_ROLES, type ErpCompanyUserRole } from "@shared/erpCompanyUserRoles";

interface CompanyUser {
  id: string;
  username: string;
  role: ErpCompanyUserRole;
  active: boolean;
}

const emptyForm = () => ({ username: "", password: "", role: "Normal User" as ErpCompanyUserRole });

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Unable to save user");
  return data as T;
}

export function ErpCompanyUsers() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedRole, setEditedRole] = useState<ErpCompanyUserRole>("Normal User");

  const { data: users = [], isLoading, error } = useQuery<CompanyUser[]>({
    queryKey: ["/api/erp-company-users", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const res = await fetch("/api/erp-company-users", { credentials: "include" });
      return parseResponse<CompanyUser[]>(res);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => parseResponse<CompanyUser>(
      await apiRequest("POST", "/api/erp-company-users", form),
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp-company-users"] });
      toast({ title: "User created", description: "The user can now sign in to this company." });
      setForm(emptyForm());
      setOpen(false);
    },
    onError: (err: Error) => toast({ title: "Could not create user", description: err.message, variant: "destructive" }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: ErpCompanyUserRole }) =>
      parseResponse<CompanyUser>(
        await apiRequest("PATCH", `/api/erp-company-users/${userId}/role`, { role }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/erp-company-users"] });
      setEditingId(null);
      toast({ title: "Role updated", description: "The user's sessions were ended so the new permissions take effect." });
    },
    onError: (err: Error) => toast({ title: "Could not update role", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Company Users & Roles</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage logins and roles for <strong>{selectedCompany?.name ?? "the selected company"}</strong> only.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!companyId} data-testid="button-add-company-user">
          <UserPlus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>
      <Card>
        <CardContent className="pt-5 space-y-2">
          {!companyId && <p className="text-sm text-muted-foreground">Select a company to manage its users.</p>}
          {isLoading && <p className="text-sm text-muted-foreground">Loading company users…</p>}
          {error && <p className="text-sm text-destructive" role="alert">{(error as Error).message}</p>}
          {!isLoading && !error && companyId && users.length === 0 && (
            <p className="text-sm text-muted-foreground">No users are assigned to this company.</p>
          )}
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 flex-wrap rounded-lg border p-3" data-testid={`company-user-${user.id}`}>
              <div className="min-w-0">
                <p className="font-medium break-all">{user.username}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">{user.role}</Badge>
                  {!user.active && <Badge variant="outline">Inactive</Badge>}
                </div>
              </div>
              {editingId === user.id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={editedRole} onValueChange={(value) => setEditedRole(value as ErpCompanyUserRole)}>
                    <SelectTrigger className="w-40" aria-label="New user type" data-testid="select-edit-company-user-role"><SelectValue /></SelectTrigger>
                    <SelectContent>{ERP_COMPANY_USER_ROLES.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" disabled={changeRoleMutation.isPending || editedRole === user.role} onClick={() => changeRoleMutation.mutate({ userId: user.id, role: editedRole })}>Save</Button>
                  <Button size="sm" variant="outline" disabled={changeRoleMutation.isPending} onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { setEditingId(user.id); setEditedRole(user.role); }} data-testid={`button-edit-role-${user.id}`}>
                  <ShieldCheck className="h-4 w-4 mr-2" /> Change Role
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={(next) => { if (!next) setForm(emptyForm()); setOpen(next); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create company user</DialogTitle>
            <DialogDescription>
              This login will only be assigned to {selectedCompany?.name ?? "the active company"}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="erp-user-name">Username</Label>
              <Input id="erp-user-name" autoComplete="off" required minLength={3} maxLength={64}
                value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })}
                data-testid="input-company-username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="erp-user-password">Temporary password</Label>
              <Input id="erp-user-password" type="password" autoComplete="new-password" required minLength={8}
                value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}
                data-testid="input-company-password" />
              <p className="text-xs text-muted-foreground">At least 8 characters. Share securely and ask the user to change it.</p>
            </div>
            <div className="space-y-2">
              <Label>User type</Label>
              <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value as ErpCompanyUserRole })}>
                <SelectTrigger data-testid="select-new-company-user-role"><SelectValue /></SelectTrigger>
                <SelectContent>{ERP_COMPANY_USER_ROLES.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
              </Select>
              {(form.role === "Admin" || form.role === "Owner") && (
                <p className="text-xs text-amber-600">This role has elevated administrative privileges.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-company-user">
                {createMutation.isPending ? "Creating…" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
