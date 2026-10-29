import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { UserPlus, Users, ShieldCheck } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useApplicationLanguage } from "@/contexts/ApplicationLanguageContext";
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

const ERP_USER_COPY = {
  en: {
    heading: "Company Users & Roles",
    manage: "Manage logins and roles for",
    only: "only.",
    selected: "the selected company",
    addUser: "Add User",
    loading: "Loading company users…",
    choose: "Select a company to manage its users.",
    empty: "No users are assigned to this company.",
    inactive: "Inactive",
    changeRole: "Change Role",
    newRole: "New user type",
    save: "Save",
    cancel: "Cancel",
    createHeading: "Create company user",
    createInfo: "This login will only be assigned to",
    username: "Username",
    password: "Temporary password",
    passwordHelp: "At least 8 characters. Share securely and ask the user to change it.",
    userType: "User type",
    elevated: "This role has elevated administrative privileges.",
    creating: "Creating…",
    create: "Create User",
    created: "User created",
    createdInfo: "The user can now sign in to this company.",
    createFailed: "Could not create user",
    changed: "Role updated",
    changedInfo: "The user's sessions were ended so the new permissions take effect.",
    changeFailed: "Could not update role",
  },
  ar: {
    heading: "مستخدمو الشركة والأدوار",
    manage: "إدارة حسابات الدخول والأدوار للشركة",
    only: "فقط.",
    selected: "الشركة المحددة",
    addUser: "إضافة مستخدم",
    loading: "جارٍ تحميل مستخدمي الشركة…",
    choose: "اختر شركة لإدارة مستخدميها.",
    empty: "لا يوجد مستخدمون مرتبطون بهذه الشركة.",
    inactive: "غير نشط",
    changeRole: "تغيير الدور",
    newRole: "نوع المستخدم الجديد",
    save: "حفظ",
    cancel: "إلغاء",
    createHeading: "إنشاء مستخدم للشركة",
    createInfo: "سيتم ربط حساب الدخول هذا بالشركة فقط:",
    username: "اسم المستخدم",
    password: "كلمة مرور مؤقتة",
    passwordHelp: "ثمانية أحرف على الأقل. شاركها بأمان واطلب من المستخدم تغييرها.",
    userType: "نوع المستخدم",
    elevated: "يمنح هذا الدور صلاحيات إدارية موسعة.",
    creating: "جارٍ الإنشاء…",
    create: "إنشاء مستخدم",
    created: "تم إنشاء المستخدم",
    createdInfo: "يمكن للمستخدم الآن تسجيل الدخول إلى هذه الشركة.",
    createFailed: "تعذر إنشاء المستخدم",
    changed: "تم تحديث الدور",
    changedInfo: "تم إنهاء جلسات المستخدم لتطبيق الصلاحيات الجديدة.",
    changeFailed: "تعذر تحديث الدور",
  },
  fr: {
    heading: "Utilisateurs et rôles de l’entreprise",
    manage: "Gérer les comptes et les rôles de",
    only: "uniquement.",
    selected: "l’entreprise sélectionnée",
    addUser: "Ajouter un utilisateur",
    loading: "Chargement des utilisateurs…",
    choose: "Sélectionnez une entreprise pour gérer ses utilisateurs.",
    empty: "Aucun utilisateur n’est affecté à cette entreprise.",
    inactive: "Inactif",
    changeRole: "Modifier le rôle",
    newRole: "Nouveau type d’utilisateur",
    save: "Enregistrer",
    cancel: "Annuler",
    createHeading: "Créer un utilisateur",
    createInfo: "Ce compte sera affecté uniquement à",
    username: "Nom d’utilisateur",
    password: "Mot de passe temporaire",
    passwordHelp: "Au moins 8 caractères. Communiquez-le en sécurité et demandez sa modification.",
    userType: "Type d’utilisateur",
    elevated: "Ce rôle accorde des privilèges administratifs élevés.",
    creating: "Création…",
    create: "Créer l’utilisateur",
    created: "Utilisateur créé",
    createdInfo: "L’utilisateur peut maintenant accéder à cette entreprise.",
    createFailed: "Échec de la création de l’utilisateur",
    changed: "Rôle modifié",
    changedInfo: "Les sessions de l’utilisateur ont été fermées pour appliquer les nouveaux droits.",
    changeFailed: "Échec de la modification du rôle",
  },
} as const;

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
  const { language } = useApplicationLanguage();
  const copy = ERP_USER_COPY[language];
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
      toast({ title: copy.created, description: copy.createdInfo });
      setForm(emptyForm());
      setOpen(false);
    },
    onError: (err: Error) => toast({ title: copy.createFailed, description: err.message, variant: "destructive" }),
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
    onError: (err: Error) => toast({ title: copy.changeFailed, description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Users className="h-5 w-5" />{copy.heading}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {copy.manage} <strong>{selectedCompany?.name ?? copy.selected}</strong> {copy.only}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!companyId} data-testid="button-add-company-user">
          <UserPlus className="h-4 w-4 mr-2" /> {copy.addUser}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-5 space-y-2">
          {!companyId && <p className="text-sm text-muted-foreground">{copy.choose}</p>}
          {isLoading && <p className="text-sm text-muted-foreground">{copy.loading}</p>}
          {error && <p className="text-sm text-destructive" role="alert">{(error as Error).message}</p>}
          {!isLoading && !error && companyId && users.length === 0 && (
            <p className="text-sm text-muted-foreground">{copy.empty}</p>
          )}
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 flex-wrap rounded-lg border p-3" data-testid={`company-user-${user.id}`}>
              <div className="min-w-0">
                <p className="font-medium break-all">{user.username}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">{user.role}</Badge>
                  {!user.active && <Badge variant="outline">{copy.inactive}</Badge>}
                </div>
              </div>
              {editingId === user.id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={editedRole} onValueChange={(value) => setEditedRole(value as ErpCompanyUserRole)}>
                    <SelectTrigger className="w-40" aria-label={copy.newRole} data-testid="select-edit-company-user-role"><SelectValue /></SelectTrigger>
                    <SelectContent>{ERP_COMPANY_USER_ROLES.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" disabled={changeRoleMutation.isPending || editedRole === user.role} onClick={() => changeRoleMutation.mutate({ userId: user.id, role: editedRole })}>{copy.save}</Button>
                  <Button size="sm" variant="outline" disabled={changeRoleMutation.isPending} onClick={() => setEditingId(null)}>{copy.cancel}</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { setEditingId(user.id); setEditedRole(user.role); }} data-testid={`button-edit-role-${user.id}`}>
                  <ShieldCheck className="h-4 w-4 mr-2" /> {copy.changeRole}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={(next) => { if (!next) setForm(emptyForm()); setOpen(next); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.createHeading}</DialogTitle>
            <DialogDescription>
              {copy.createInfo} {selectedCompany?.name ?? copy.selected}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="erp-user-name">{copy.username}</Label>
              <Input id="erp-user-name" autoComplete="off" required minLength={3} maxLength={64}
                value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })}
                data-testid="input-company-username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="erp-user-password">{copy.password}</Label>
              <Input id="erp-user-password" type="password" autoComplete="new-password" required minLength={8}
                value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}
                data-testid="input-company-password" />
              <p className="text-xs text-muted-foreground">{copy.passwordHelp}</p>
            </div>
            <div className="space-y-2">
              <Label>{copy.userType}</Label>
              <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value as ErpCompanyUserRole })}>
                <SelectTrigger data-testid="select-new-company-user-role"><SelectValue /></SelectTrigger>
                <SelectContent>{ERP_COMPANY_USER_ROLES.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
              </Select>
              {(form.role === "Admin" || form.role === "Owner") && (
                <p className="text-xs text-amber-600">{copy.elevated}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>{copy.cancel}</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-company-user">
                {createMutation.isPending ? copy.creating : copy.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
