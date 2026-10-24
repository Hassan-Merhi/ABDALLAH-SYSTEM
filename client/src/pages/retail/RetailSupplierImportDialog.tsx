import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileSpreadsheet, Image as ImageIcon, Package, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { read, utils, writeFile } from "@/lib/excelHelper";
import { getJson, type Location } from "./retailInventoryTypes";
import {
  RETAIL_SUPPLIER_IMPORT_LIMIT, RETAIL_SUPPLIER_TEMPLATE_COLUMNS,
  parseRetailSupplierImportRows, summarizeRetailSupplierImport,
  type RetailSupplierImportRow,
} from "./retailSupplierImportDraft";

interface SupplierOption {
  id: number;
  code?: string | null;
  legalName?: string | null;
  name?: string | null;
}
type SourceRow = { rowNumber: number; values: Record<string, unknown> };

function localISODate() {
  const date = new Date();
  const digits = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${digits(date.getMonth() + 1)}-${digits(date.getDate())}`;
}

function spreadsheetText(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if ("result" in value) return value.result;
  if ("text" in value) return value.text;
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part: { text?: string }) => part.text ?? "").join("");
  }
  return value;
}

async function downloadSupplierTemplate() {
  const sample = [
    {
      "Item Name": "Runner 270", Category: "Shoes", Brand: "Acme", Size: "42", Color: "Black",
      Quantity: 10, "Cost Price": 35, "Selling Price": 65,
      "Main Image": "runner-black.jpg", "Extra Images": "runner-black-side.jpg; runner-black-back.jpg",
      SKU: "", Barcode: "", Description: "Demo example - replace before uploading",
    },
    {
      "Item Name": "Cotton T-Shirt", Category: "Clothing", Brand: "Acme", Size: "M", Color: "White",
      Quantity: 20, "Cost Price": 12, "Selling Price": 24.99,
      "Main Image": "tee-white.jpg", "Extra Images": "", SKU: "", Barcode: "",
      Description: "Demo example - replace before uploading",
    },
  ];
  const workbook = utils.book_new();
  const sheet = utils.json_to_sheet(sample, { header: [...RETAIL_SUPPLIER_TEMPLATE_COLUMNS] });
  const worksheet = utils.book_append_sheet(workbook, sheet, "Supplier Stock");
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).height = 24;
  worksheet.getRow(1).eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B365D" } };
  });
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.columns.forEach((column, index) => {
    column.width = index === 0 || index === 8 || index === 9 ? 29 : 17;
  });
  await writeFile(workbook, "retail_supplier_stock_template.xlsx");
}

export function RetailSupplierImportDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? 0;
  const enabled = open && selectedCompany?.companyType === "retail";
  const { toast } = useToast();

  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(localISODate);
  const [fileName, setFileName] = useState("");
  const [photoArchiveName, setPhotoArchiveName] = useState("");
  const [rows, setRows] = useState<RetailSupplierImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState("");

  useEffect(() => {
    setSupplierId("");
    setLocationId("");
    setFileName("");
    setPhotoArchiveName("");
    setRows([]);
    setFileError("");
  }, [companyId]);

  const { data: suppliers = [], isError: suppliersFailed } = useQuery<SupplierOption[]>({
    queryKey: ["retail-supplier-import-suppliers", companyId],
    queryFn: () => getJson("/api/suppliers"),
    enabled,
  });
  const { data: locations = [], isError: locationsFailed } = useQuery<Location[]>({
    queryKey: ["retail-locations", companyId],
    queryFn: () => getJson("/api/locations"),
    enabled,
  });
  const summary = useMemo(() => summarizeRetailSupplierImport(rows), [rows]);
  const hasMissingContext = !supplierId || !locationId || !invoiceDate.trim();
  const readyForFuturePosting = rows.length > 0 && !summary.invalidRows && !hasMissingContext;
  const knownSupplier = suppliers.find(supplier => String(supplier.id) === supplierId);
  const knownLocation = locations.find(location => String(location.id) === locationId);

  const handleSpreadsheet = async (file?: File) => {
    setFileName("");
    setRows([]);
    setFileError("");
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setFileError("Choose an .xlsx or .csv spreadsheet");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setFileError("Spreadsheet must be 15 MB or smaller");
      return;
    }
    setBusy(true);
    try {
      const workbook = await read(await file.arrayBuffer());
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) throw new Error("Spreadsheet has no worksheets");
      const headers: string[] = [];
      const sourceRows: SourceRow[] = [];
      worksheet.eachRow((excelRow, rowNumber) => {
        if (rowNumber === 1) {
          excelRow.eachCell((cell, colNumber) => {
            headers[colNumber - 1] = String(spreadsheetText(cell.value) ?? "").trim();
          });
          return;
        }
        const values: Record<string, unknown> = {};
        excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) values[header] = spreadsheetText(cell.value);
        });
        if (Object.values(values).some(value => value !== null && value !== undefined && String(value).trim())) {
          sourceRows.push({ rowNumber, values });
        }
      });
      const normalizedHeaders = headers.map(header => header.toLowerCase().replace(/[ _-]+/g, ""));
      if (!normalizedHeaders.some(header => header === "itemname" || header === "name")) {
        throw new Error("Missing Item Name column. Download the supplier template and keep its header row.");
      }
      if (!normalizedHeaders.includes("quantity") && !normalizedHeaders.includes("qty")) {
        throw new Error("Missing Quantity column");
      }
      if (!sourceRows.length) throw new Error("No stock rows found in the spreadsheet");
      if (sourceRows.length > RETAIL_SUPPLIER_IMPORT_LIMIT) {
        throw new Error(`Maximum ${RETAIL_SUPPLIER_IMPORT_LIMIT.toLocaleString()} rows per import`);
      }
      const parsed = parseRetailSupplierImportRows(sourceRows);
      setRows(parsed);
      setFileName(file.name);
      const invalid = parsed.filter(row => row.errors.length).length;
      toast({
        title: invalid ? "Spreadsheet needs corrections" : "Spreadsheet preview ready",
        description: invalid
          ? `${invalid} row(s) have validation errors. No stock was changed.`
          : `${parsed.length} row(s) checked. No stock or ledger changes were made.`,
      });
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Could not read spreadsheet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Supplier Stock Import
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
          <strong>Phase 1 — preview only.</strong> You can download the template, choose a supplier and
          warehouse, upload a spreadsheet and correct errors. <strong>No products, stock, supplier
          balances, vouchers or labels are created yet.</strong> Posting becomes available after
          the linked stock-receipt and payable flow is implemented.
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="retail-import-supplier">Supplier *</Label>
            <select id="retail-import-supplier" value={supplierId}
              onChange={event => setSupplierId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select an existing supplier</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={String(supplier.id)}>
                  {supplier.legalName || supplier.name || supplier.code || `Supplier #${supplier.id}`}
                </option>
              ))}
            </select>
            {suppliersFailed && <p className="text-xs text-destructive">Suppliers could not be loaded.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="retail-import-location">Receiving location *</Label>
            <select id="retail-import-location" value={locationId}
              onChange={event => setLocationId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select a stock location</option>
              {locations.filter(location => location.active !== false).map(location => (
                <option key={location.id} value={String(location.id)}>
                  {location.name} ({location.code})
                </option>
              ))}
            </select>
            {locationsFailed && <p className="text-xs text-destructive">Locations could not be loaded.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="retail-import-invoice">Supplier invoice / reference</Label>
            <Input id="retail-import-invoice" value={invoiceReference}
              onChange={event => setInvoiceReference(event.target.value)} placeholder="INV-0001" maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="retail-import-date">Receipt date *</Label>
              <Input id="retail-import-date" type="date" value={invoiceDate}
                onChange={event => setInvoiceDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retail-import-currency">Invoice currency</Label>
              <select id="retail-import-currency" value={currency}
                onChange={event => setCurrency(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {["USD", "EUR", "CDF", "CFA", "GBP", "AUD"].map(code =>
                  <option key={code} value={code}>{code}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">1. Download the supplier Excel template</h3>
              <p className="text-xs text-muted-foreground">One line per product color/size, with unit quantity and cost.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() =>
              downloadSupplierTemplate().catch(error => toast({
                title: "Template download failed",
                description: error instanceof Error ? error.message : String(error),
                variant: "destructive",
              }))}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Download template
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="retail-supplier-excel">2. Upload Excel / CSV *</Label>
              <Input id="retail-supplier-excel" type="file" accept=".xlsx,.csv"
                onChange={event => void handleSpreadsheet(event.target.files?.[0])} disabled={busy} />
              {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retail-supplier-photos">3. Product image ZIP (optional)</Label>
              <Input id="retail-supplier-photos" type="file" accept=".zip"
                onChange={event => setPhotoArchiveName(event.target.files?.[0]?.name ?? "")} />
              <p className="text-xs text-muted-foreground">
                <ImageIcon className="mr-1 inline h-3 w-3" />
                {photoArchiveName ? `${photoArchiveName} selected — image matching arrives in Phase 2`
                  : "Use filenames in Main Image / Extra Images. ZIP linking arrives in Phase 2."}
              </p>
            </div>
          </div>
          {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
        </div>

        {rows.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md border px-2 py-1"><Package className="mr-1 inline h-4 w-4" />
                {summary.totalRows} lines
              </span>
              <span className="rounded-md border px-2 py-1">{summary.validRows} valid</span>
              <span className="rounded-md border px-2 py-1">{summary.totalUnits} valid units</span>
              <span className="rounded-md border px-2 py-1">
                {currency} {summary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                {" "}estimated cost (valid lines)
              </span>
              {summary.invalidRows > 0 && <span className="text-destructive">
                <AlertTriangle className="mr-1 inline h-4 w-4" />{summary.invalidRows} invalid lines
              </span>}
            </div>
            <p className="text-xs text-muted-foreground">
              Supplier: {knownSupplier?.legalName || knownSupplier?.name || "not selected"} ·
              Location: {knownLocation?.name || "not selected"} ·
              Reference: {invoiceReference || "not provided"} · Date: {invoiceDate || "not selected"}.
              These are preview details only, not a saved receipt.
            </p>
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>{["Row", "Item / Brand", "Category", "Variant", "Qty", "Unit cost", "Sell price", "Barcode", "Status"].map(col =>
                    <th className="whitespace-nowrap px-2 py-2 font-semibold" key={col}>{col}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map(row => (
                    <tr key={row.rowNumber} className="border-t align-top">
                      <td className="px-2 py-2">{row.rowNumber}</td>
                      <td className="px-2 py-2"><strong>{row.name || "—"}</strong><div>{row.brand}</div></td>
                      <td className="px-2 py-2">{row.category || "—"}</td>
                      <td className="px-2 py-2">{row.color} / {row.size || "Standard"}</td>
                      <td className="px-2 py-2">{row.quantity}</td>
                      <td className="px-2 py-2">{row.costPrice.toFixed(2)}</td>
                      <td className="px-2 py-2">{row.sellingPrice.toFixed(2)}</td>
                      <td className="px-2 py-2">{row.barcode || "Generate later"}</td>
                      <td className="px-2 py-2">
                        {row.errors.length ? (
                          <span className="text-destructive">{row.errors.join("; ")}</span>
                        ) : <span className="text-green-700 dark:text-green-400">Valid</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 100 && <p className="text-xs text-muted-foreground">
              Displaying first 100 of {rows.length} lines; all lines were checked.
            </p>}
            <p className="text-xs text-muted-foreground">
              {readyForFuturePosting
                ? "Preflight is ready. Final import will be enabled only when atomic receiving and supplier credit posting are implemented."
                : "Select a supplier and location, then fix invalid rows before a future import can be posted."}
            </p>
          </div>
        )}
        <div className="flex justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            <Upload className="mr-2 h-4 w-4" /> Close preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
