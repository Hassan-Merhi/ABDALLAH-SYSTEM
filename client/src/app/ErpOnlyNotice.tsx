/** Shown instead of any workspace when the selected company is not an ERP company. */
export function ErpOnlyNotice() {
  return (
    <div role="alert" className="flex min-h-screen items-center justify-center p-6 text-center">
      ABDALLAH-SYSTEM supports ERP workspaces only. Ask your administrator to assign an ERP company.
    </div>
  );
}
