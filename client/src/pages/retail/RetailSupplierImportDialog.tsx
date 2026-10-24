import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, FileSpreadsheet, Image as ImageIcon, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { read, utils, writeFile } from "@/lib/excelHelper";
import { getJson, type Location } from "./retailInventoryTypes";
import { matchRetailSupplierImages, readRetailSupplierImageZip, type RetailSupplierImageArchive } from "./retailSupplierImageZip";
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

type CatalogDecision = {
  rowNumber: number;
  status: "new-product" | "new-variant" | "existing-variant" | "conflict";
  productId: number | null;
  variantId: number | null;
  existingBarcode: string | null;
  messages: string[];
};
type CatalogPreview = {
  decisions: CatalogDecision[];
  summary: { newProducts: number; newVariants: number; existingVariants: number; conflicts: number };
};
const catalogLabels: Record<CatalogDecision["status"], string> = {
  "new-product": "New product",
  "new-variant": "New variant",
  "existing-variant": "Existing variant — restock",
  conflict: "Catalog conflict",
};

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
  const [photoArchive, setPhotoArchive] = useState<RetailSupplierImageArchive | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Map<number, string>>(new Map());
  const [rows, setRows] = useState<RetailSupplierImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState("");

  useEffect(() => {
    setSupplierId("");
    setLocationId("");
    setFileName("");
    setPhotoArchiveName("");
    setPhotoArchive(null);
    setPhotoError("");
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
  const imageMatches = useMemo(() => matchRetailSupplierImages(rows, photoArchive), [rows, photoArchive]);
  const imageIssueCount = useMemo(() => [...imageMatches.values()].filter(result => result.errors.length > 0).length, [imageMatches]);
  const imageMatchedCount = useMemo(() =>
    [...imageMatches.values()].reduce((count, result) => count + result.files.length, 0), [imageMatches]);
  const { data: catalogPreview, isFetching: catalogChecking, isError: catalogFailed } = useQuery<CatalogPreview>({
    queryKey: ["retail-supplier-catalog-preview", companyId, rows],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/retail/supplier-import/catalog-preview", {
        rows: rows.map(row => ({
          rowNumber: row.rowNumber, name: row.name, brand: row.brand,
          category: row.category, size: row.size, color: row.color,
          sku: row.sku, barcode: row.barcode,
        })),
      });
      return response.json();
    },
    enabled: enabled && rows.length > 0 && summary.invalidRows === 0,
    staleTime: 30000,
    retry: false,
  });
  const catalogByRow = useMemo(() => new Map(
    (catalogPreview?.decisions ?? []).map(decision => [decision.rowNumber, decision])
  ), [catalogPreview]);
  const hasMissingContext = !supplierId || !locationId || !invoiceDate.trim();
  const readyForFuturePosting = rows.length > 0 && !summary.invalidRows &&
    !imageIssueCount && !hasMissingContext && Boolean(catalogPreview) && !catalogPreview.summary.conflicts;
  useEffect(() => {
    const previews = new Map<number, string>();
    for (const row of rows.slice(0, 100)) {
      const file = imageMatches.get(row.rowNumber)?.files[0];
      if (file) previews.set(row.rowNumber, URL.createObjectURL(file));
    }
    setPhotoPreviewUrls(previews);
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [rows, imageMatches]);

  const handlePhotoArchive = async (file?: File) => {
    setPhotoArchive(null);
    setPhotoArchiveName("");
    setPhotoError("");
    if (!file) return;
    setPhotoBusy(true);
    try {
      const archive = await readRetailSupplierImageZip(file);
      setPhotoArchive(archive);
      setPhotoArchiveName(archive.filename);
      toast({ title: "Image archive checked", description: `${archive.imageCount} images available for matching` });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Cannot open image ZIP");
    } finally {
      setPhotoBusy(false);
    }
  };
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
          <strong>Phase 2 — catalog and picture matching preview.</strong> The supplier Excel and
          image ZIP are checked against existing brands, styles, SKUs and barcodes.
          <strong> No products, images, stock, supplier balances, vouchers or labels are saved yet.</strong>
          Final creation and inventory/accounting posting are enabled only after the linked purchase flow is implemented.
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
              <Input id="retail-supplier-photos" type="file" accept=".zip" disabled={photoBusy}
                onChange={event => void handlePhotoArchive(event.target.files?.[0])} />
              <p className="text-xs text-muted-foreground">
                <ImageIcon className="mr-1 inline h-3 w-3" />
                {photoArchiveName ? `${photoArchiveName} — ${photoArchive?.imageCount ?? 0} verified images`
                  : photoBusy ? "Checking picture ZIP…" : "Choose ZIP with JPG/PNG/WEBP/GIF files referenced by their filenames in Excel."}
              </p>
              {photoError && <p role="alert" className="text-xs text-destructive">{photoError}</p>
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
              <span className="rounded-md border px-2 py-1">{imageMatchedCount} images matched</span>
              {imageIssueCount > 0 && <span className="text-destructive">{imageIssueCount} rows missing/invalid pictures</span>}
            </div>
            {catalogChecking && <p className="text-xs text-muted-foreground">Checking product / variant identities against this company's catalog…</p>}
            {catalogFailed && <p role="alert" className="text-xs text-destructive">
              Catalog check failed; supplier import cannot be confirmed without reconciling existing items.
            </p>}
            {catalogPreview && (
              <p className="text-xs font-medium">
                Catalog: {catalogPreview.summary.newProducts} new styles ·
                {" "}{catalogPreview.summary.newVariants} new variants ·
                {" "}{catalogPreview.summary.existingVariants} existing variants ·
                {" "}{catalogPreview.summary.conflicts} conflicts
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Supplier: {knownSupplier?.legalName || knownSupplier?.name || "not selected"} ·
              Location: {knownLocation?.name || "not selected"} ·
              Reference: {invoiceReference || "not provided"} · Date: {invoiceDate || "not selected"}.
              These are preview details only, not a saved receipt.
            </p>
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>{["Row", "Picture", "Item / Brand", "Category", "Variant", "Qty", "Unit cost", "Sell price", "Barcode", "Catalog / Validation"].map(col =>
                    <th className="whitespace-nowrap px-2 py-2 font-semibold" key={col}>{col}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map(row => (
                    <tr key={row.rowNumber} className="border-t align-top">
                      <td className="px-2 py-2">{row.rowNumber}</td>
                      <td className="px-2 py-2">
                        {photoPreviewUrls.get(row.rowNumber) ? (
                          <img src={photoPreviewUrls.get(row.rowNumber)} alt={row.name}
                            className="h-12 w-12 rounded border object-contain" />
                        ) : <span className="text-muted-foreground">—</span>}
                        <span className="whitespace-nowrap text-muted-foreground">
                          {imageMatches.get(row.rowNumber)?.files.length ?? 0} image(s)
                        </span>
                      </td>
                      <td className="px-2 py-2"><strong>{row.name || "—"}</strong><div>{row.brand}</div></td>
                      <td className="px-2 py-2">{row.category || "—"}</td>
                      <td className="px-2 py-2">{row.color} / {row.size || "Standard"}</td>
                      <td className="px-2 py-2">{row.quantity}</td>
                      <td className="px-2 py-2">{row.costPrice.toFixed(2)}</td>
                      <td className="px-2 py-2">{row.sellingPrice.toFixed(2)}</td>
                      <td className="px-2 py-2">{row.barcode || catalogByRow.get(row.rowNumber)?.existingBarcode || "Generate later"}</td>
                      <td className="px-2 py-2">
                        {row.errors.length || imageMatches.get(row.rowNumber)?.errors.length ||
                          catalogByRow.get(row.rowNumber)?.status === "conflict" ? (
                          <span className="text-destructive">
                            {[...row.errors, ...(imageMatches.get(row.rowNumber)?.errors ?? []),
                              ...(catalogByRow.get(row.rowNumber)?.status === "conflict"
                                ? catalogByRow.get(row.rowNumber)?.messages ?? [] : [])].join("; ")}
                          </span>
                        ) : <span className="text-green-700 dark:text-green-400">
                          {catalogByRow.get(row.rowNumber)
                            ? catalogLabels[catalogByRow.get(row.rowNumber)!.status] : "Local validation passed"}
                        </span>}
                        {catalogByRow.get(row.rowNumber)?.status !== "conflict" &&
                          catalogByRow.get(row.rowNumber)?.messages.map((msg, index) => (
                            <div key={index} className="text-muted-foreground">{msg}</div>
                          ))}
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
                ? "All rows and image filenames match safely. This is still a non-persistent preview; stock and supplier credit posting arrive in Phase 4."
                : "Select a supplier/location and resolve spreadsheet, image and catalog conflicts. No stock or accounting changes were made."}
            </p>
          </div>
        )}
        <div className="flex justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
