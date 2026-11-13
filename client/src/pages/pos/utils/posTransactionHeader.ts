import type { Worksheet } from "exceljs";

/** Keep the existing POS transaction Excel layout and column sizing unchanged. */
export function populatePosTransactionHeader(ws: Worksheet): void {
  // ── Header row ──────────────────────────────────────────────────────────
  const headerRow = ws.addRow(["#", "Item", "Code", "Qty", "Rate", "Amt", "P/L", "T.P/L"]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    };
    cell.alignment = { horizontal: "center" };
  });
  // ── Column widths ────────────────────────────────────────────────────────
  ws.getColumn(1).width = 5; // #
  ws.getColumn(2).width = 30; // Item
  ws.getColumn(3).width = 14; // Code
  ws.getColumn(4).width = 8; // Qty
  ws.getColumn(5).width = 10; // Rate
  ws.getColumn(6).width = 12; // Amt
  ws.getColumn(7).width = 10; // P/L
  ws.getColumn(8).width = 12; // T.P/L
}
