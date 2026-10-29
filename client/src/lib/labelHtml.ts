import { getPriorityScanLetter, getPriorityScanLetterInk } from "@shared/priorityScanColors";

const DAKZO_LOGO_URL = "/dakzo-icon.svg";

export function formatLabelNum(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return String(val);
  return n % 1 === 0 ? n.toFixed(0) : parseFloat(n.toFixed(3)).toString();
}

export type LabelData = {
  referenceNumber: string;
  articleCode: string;
  pieces: number;
  approxWeightKg: string;
  productName: string;
  designColor?: A4DesignColor | null;
  customerLogoUrl?: string;
  barcodeDataUrl?: string;
  /** Immutable assigned Priority Scan color; omitted for ordinary labels. */
  priorityColor?: string | null;
  priorityOrderId?: number | null;
  priorityNumber?: number | null;
};

// Session-level barcode cache: referenceNumber → base64 data URL.
// Barcodes are immutable so we never need to invalidate this.

// Session-level logo cache: logoId → base64 data URL.

function getHeaderImage(code: string): string {
  if (!code) return DAKZO_LOGO_URL;
  if (code.startsWith("HMD11")) return "/labels/dakzo-purple.svg";
  if (code.startsWith("HMD12")) return "/labels/dakzo-green.svg";
  if (code.startsWith("HMD13")) return "/labels/dakzo-gold.svg";
  if (code.startsWith("HMD14")) return "/labels/dakzo-white.svg";
  return DAKZO_LOGO_URL;
}

function isBrandUrl(src: string): boolean {
  return src.startsWith("/labels/");
}

/**
 * Priority colors are historic server snapshots, not today's queue colors.
 * The queue UI stores #RRGGBB; a few legacy configs use names like "Red".
 * Never inject an arbitrary string into print HTML/CSS.
 */
const PRIORITY_NAMED_COLORS: Record<string, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#f97316",
  yellow: "#eab308",
  purple: "#7c3aed",
  pink: "#db2777",
  black: "#111827",
  white: "#ffffff",
  gray: "#6b7280",
  grey: "#6b7280",
  cyan: "#0891b2",
  aqua: "#00ffff",
  navy: "#000080",
  lime: "#00ff00",
  teal: "#008080",
  magenta: "#ff00ff",
  maroon: "#800000",
  olive: "#808000",
  silver: "#c0c0c0",
  violet: "#8b5cf6",
  indigo: "#4f46e5",
  coral: "#ff7f50",
  turquoise: "#40e0d0",
  gold: "#b8860b",
  brown: "#92400e",
};

export function resolvePriorityLabelColor(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  const color = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = color.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return PRIORITY_NAMED_COLORS[color.toLowerCase()] || null;
}

/** Invalid saved colors are a print error, never a silently wrong bale label. */
export function validatePriorityLabelColor(label: LabelData): string | null {
  const raw = label.priorityColor;
  if (raw == null || raw.trim() === "") return null;
  const color = resolvePriorityLabelColor(raw);
  if (!color) {
    throw new Error(`Unrecognized Priority Scan label color for ${label.referenceNumber}. Printing cancelled.`);
  }
  return color;
}

function escapePriorityText(value: string | number | null | undefined): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char
  );
}

/**
 * Show the immutable recorded priority color as a large solid print-safe box.
 * Ordinary labels retain their Dakzo logo instead.
 */
export function renderPriorityColorBox(
  label: Pick<LabelData, "referenceNumber" | "priorityColor">,
  cssClass = "priority-color-box",
  showPaperLetter = false
): string {
  const color = validatePriorityLabelColor(label as LabelData);
  if (!color) return "";
  // The fixed letter belongs to the exact saved color, not a priority position.
  // Legacy colors without an M-W assignment retain the Dakzo text.
  const letter = showPaperLetter ? getPriorityScanLetter(color) : null;
  const ink = letter ? getPriorityScanLetterInk(color) : "#000000";
  const content = letter
    ? `<span class="priority-color-box-letter" data-priority-letter="${letter}" style="color: ${ink} !important; -webkit-text-fill-color: ${ink} !important;">${letter}</span>`
    : '<span class="priority-color-box-text">DAKZO</span>';
  return `<div class="${cssClass}" style="background-color: ${color} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;" data-priority-color="${color}" role="img" aria-label="${letter ? `Priority letter ${letter}, color ${color}` : `HMD priority color ${color}`}">${content}</div>`;
}

/**
 * Screen and print share one size per format so the browser preview matches the
 * printed label; the box replaces the small logo without growing past its area.
 */
export function priorityColorBoxCss(widthMm: number, heightMm: number): string {
  // A4=30pt in 25×14mm, A5=25pt in 22×12mm, smaller legacy boxes scale down.
  const letterPt = heightMm >= 14 ? 30 : heightMm >= 12 ? 25 : 20;
  return `.priority-color-box { width: ${widthMm}mm; height: ${heightMm}mm; border-radius: 2mm; display: flex !important; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .priority-color-box-text { color: #000000 !important; -webkit-text-fill-color: #000000 !important; font: 900 7pt/1 Arial, sans-serif; letter-spacing: 0.2mm; text-align: center; } .priority-color-box-letter { display: block; max-width: 100%; font: 900 ${letterPt}pt/1 Arial, Helvetica, sans-serif; text-align: center; white-space: nowrap; letter-spacing: 0; }`;
}

/** Used by legacy Pressing and Production labels to retain their Dakzo logo. */
export function renderLegacyPriorityLogo(label: Pick<LabelData, "referenceNumber" | "priorityColor">): string {
  return (
    renderPriorityColorBox(label) ||
    '<div class="logo-text">DAKZO</div><div class="logo-subtitle">SYSTEMS</div>'
  );
}

/** Preserve customer logos; print the default Dakzo logo without a gray image filter. */
function renderSmallDakzoLogo(label: LabelData, cssClass = "logo-img", showPriorityColor = true): string {
  // Keep validation for all formats, but only paper labels visualize priority colors.
  const color = validatePriorityLabelColor(label);
  if (!color || !showPriorityColor) {
    const logoClass = label.customerLogoUrl ? cssClass : `${cssClass} dakzo-default-logo`;
    return `<img class="${logoClass}" src="${label.customerLogoUrl || DAKZO_LOGO_URL}" alt="Logo" />`;
  }
  return renderPriorityColorBox(label, `${cssClass} priority-color-box`, true);
}

function buildDetailBlock(label: LabelData) {
  return `<div class="code-label">
    <div class="label-top">
      <div class="logo-section">
        ${renderSmallDakzoLogo(label)}
      </div>
      <div class="info-section">
        <div class="info-row"><span class="info-key">PIECES:</span> <span class="info-val">${formatLabelNum(label.pieces)}</span></div>
        <div class="info-row"><span class="info-key">ARTICLE:</span> <span class="info-val">${escapePriorityText(label.articleCode)}</span></div>
        <div class="info-row"><span class="info-key">APRX WEIGHT:</span> <span class="info-val">${formatLabelNum(label.approxWeightKg)} KGS</span></div>
      </div>
    </div>
    <div class="barcode-area">
      <img class="barcode-img" src="${label.barcodeDataUrl || `/api/barcode/${encodeURIComponent(label.referenceNumber)}`}" alt="Barcode" />
      <div class="barcode-number">${escapePriorityText(label.referenceNumber)}</div>
      <div class="barcode-subtext">${escapePriorityText(label.productName)}</div>
    </div>
  </div>`;
}

function buildDetailBlockNoBanner(label: LabelData) {
  return `<div class="code-label">
    <div class="label-top">
      <div class="logo-section">
        ${renderSmallDakzoLogo(label)}
      </div>
      <div class="info-section">
        <div class="info-row"><span class="info-key">PIECES:</span> <span class="info-val">${formatLabelNum(label.pieces)}</span></div>
        <div class="info-row"><span class="info-key">ARTICLE:</span> <span class="info-val">${escapePriorityText(label.articleCode)}</span></div>
        <div class="info-row"><span class="info-key">APRX WEIGHT:</span> <span class="info-val">${formatLabelNum(label.approxWeightKg)} KGS</span></div>
      </div>
    </div>
    <div class="barcode-area">
      <img class="barcode-img" src="${label.barcodeDataUrl || `/api/barcode/${encodeURIComponent(label.referenceNumber)}`}" alt="Barcode" />
      <div class="barcode-number">${escapePriorityText(label.referenceNumber)}</div>
      <div class="barcode-subtext">${escapePriorityText(label.productName)}</div>
    </div>
  </div>`;
}

const detailBlockCss = `
    .code-label { width: 76mm; height: 58.5mm; padding: 2mm 3mm; display: flex; flex-direction: column; justify-content: flex-start; gap: 1mm; background: #fff; overflow: hidden; }
    .header-banner-img { width: 100%; height: 14mm; object-fit: cover; display: block; flex-shrink: 0; }
    .info-section-row { font-size: 7.5pt; font-weight: 900; line-height: 1.4; white-space: nowrap; overflow: hidden; text-align: left; }
    .label-top { display: flex; justify-content: space-between; align-items: center; }
    .logo-section { flex-shrink: 0; }
    .logo-img { height: 14mm; width: auto; object-fit: contain; display: block; }
    .dakzo-default-logo { background: #fff !important; filter: contrast(3) !important; }
    ${priorityColorBoxCss(25, 14)}
    .info-section { text-align: right; font-size: 8pt; line-height: 1.4; }
    .info-key { font-weight: 900; }
    .info-val { font-weight: 900; }
    .barcode-area { text-align: center; margin-top: 1mm; flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .barcode-img { width: 100%; height: 16mm; object-fit: fill; }
    .barcode-number { font-size: 13pt; font-weight: 900; font-family: Arial, Helvetica, sans-serif; margin-top: 0.5mm; letter-spacing: 2px; text-transform: uppercase; -webkit-text-stroke: 0.5px #000; }
    .barcode-subtext { font-size: 8pt; font-weight: 900; margin-top: 0.5mm; text-transform: uppercase; letter-spacing: 1px; line-height: 1.1; word-break: break-word; -webkit-text-stroke: 0.4px #000; }
    `;

// A4DesignColor is now a plain string (slug) — kept as an alias for
// backward-compatibility with existing type annotations.
export type A4DesignColor = string;

// Static fallback used when the API hasn't loaded yet and as seed data.
// previewUrl → small WebP thumbnail used for UI/screen display only.
// Print paths always use the full-res /labels/dakzo-*.jpg originals (via getDesignBannerUrl).
export const A4_DESIGN_OPTIONS: { value: string; label: string; color: string; previewUrl: string }[] = [
  { value: "purple", label: "Purple (#1)", color: "#5B21B6", previewUrl: "/labels/previews/hmd-purple-preview.svg" },
  { value: "green", label: "Green (#2)", color: "#047857", previewUrl: "/labels/previews/hmd-green-preview.svg" },
  { value: "gold", label: "Gold (#3)", color: "#B8860B", previewUrl: "/labels/previews/hmd-gold-preview.svg" },
  { value: "white", label: "White (#4)", color: "#F5F5F5", previewUrl: "/labels/previews/hmd-white-preview.svg" },
  { value: "red", label: "Dakzo Red (#5)", color: "#B91C1C", previewUrl: "/labels/previews/hmd-red-preview.svg" },
];

// Cache-busting timestamps for custom banner images.
// Populated by useLabelDesignColors after every successful API fetch.
// Key = slug (e.g. "purple"), value = imageUpdatedAt ms timestamp.
let _bannerTimestamps: Record<string, number | null> = {};

// In-memory base64 cache: slug → data URL. Avoids slow image fetch in print window.
const _bannerBase64Cache: Record<string, string> = {};

function _getBannerNetworkUrl(design: string): string {
  const ts = _bannerTimestamps[design];
  return ts ? `/labels/dakzo-${design}.jpg?t=${ts}` : `/labels/dakzo-${design}.svg`;
}

function _prefetchBanner(slug: string): void {
  if (_bannerBase64Cache[slug]) return;
  const url = _getBannerNetworkUrl(slug);
  fetch(url, { credentials: "include" })
    .then((r) => (r.ok ? r.blob() : Promise.reject()))
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    )
    .then((b64) => {
      _bannerBase64Cache[slug] = b64;
    })
    .catch(() => {});
}

export function setBannerTimestamps(ts: Record<string, number | null>) {
  _bannerTimestamps = ts;
  // Clear stale base64 cache for any slug whose timestamp changed.
  // Do NOT eagerly prefetch here — wait until user explicitly requests print.
  for (const slug of Object.keys(ts)) delete _bannerBase64Cache[slug];
}

/**
 * Prefetch all banner images into the base64 cache so the print window
 * can render them instantly without a second network round-trip.
 * Call this when the user opens the print dialog or clicks Print, NOT on page load.
 */
export function prefetchBannersForPrint(): void {
  if (typeof window === "undefined") return;
  const allSlugs = new Set([...A4_DESIGN_OPTIONS.map((o) => o.value), ...Object.keys(_bannerTimestamps)]);
  for (const slug of allSlugs) _prefetchBanner(slug);
}

function getDesignBannerUrl(design: string): string {
  // Prefer cached base64 (instant), fall back to network URL
  return _bannerBase64Cache[design] ?? _getBannerNetworkUrl(design);
}

export function generateCombinedLabelsHtml(labels: LabelData[], designColor?: A4DesignColor) {
  let labelsHtml = "";
  for (const label of labels) {
    // Priority bales use the ordinary layout; only the small logo differs.
    validatePriorityLabelColor(label);
    const effectiveColor = label.designColor || designColor;
    const bannerUrl = effectiveColor ? getDesignBannerUrl(effectiveColor) : getHeaderImage(label.articleCode);
    const hasBanner = effectiveColor || isBrandUrl(bannerUrl);
    const gapContent = hasBanner
      ? `<div class="a4-preprint-gap"><img class="a4-banner-img" src="${bannerUrl}" alt="Dakzo Systems" /></div>`
      : `<div class="a4-preprint-gap"></div>`;

    labelsHtml += `
      <div class="a4-page">
        <div class="a4-top-half">
          ${gapContent}
          <div class="a4-top-content">
            <div class="a4-detail-left">
              ${buildDetailBlock(label)}
            </div>
            <div class="a4-name-right">
              <div class="a4-name-right-text">${escapePriorityText(label.productName)}</div>
            </div>
          </div>
        </div>
        <div class="a4-bottom-half">
          ${gapContent}
          <div class="a4-bottom-namebox">
            <div class="a4-bottom-name-text">${escapePriorityText(label.productName)}</div>
          </div>
        </div>
      </div>`;
  }
  return `<html><head><title>Stock Entry Labels - A4</title><style>
    @page { size: 210mm 297mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; }
${detailBlockCss}

    .a4-page { width: 210mm; height: 297mm; page-break-after: always; page-break-inside: avoid; break-inside: avoid; overflow: hidden; display: flex; flex-direction: column; background: #fff; }
    .a4-page:last-child { page-break-after: auto; }

    .a4-top-half { height: 148.5mm; flex-shrink: 0; overflow: hidden; display: flex; flex-direction: column; }
    .a4-preprint-gap { height: 90mm; flex-shrink: 0; overflow: hidden; }
    .a4-banner-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .a4-top-content { height: 58.5mm; flex-shrink: 0; display: flex; flex-direction: row; gap: 6mm; align-items: flex-start; padding: 0 10mm; }
    .a4-detail-left { flex-shrink: 0; width: 76mm; max-height: 58.5mm; overflow: hidden; border: 0.3mm solid #ccc; }
    .a4-name-right { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; height: 58.5mm; }
    .a4-name-right-text { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; overflow: hidden; font-size: clamp(18pt, 3.5vw, 36pt); line-height: 1.15; color: #000; word-break: break-word; }

    .a4-bottom-half { height: 148.5mm; flex-shrink: 0; overflow: hidden; display: flex; flex-direction: column; }
    .a4-bottom-namebox { height: 58.5mm; width: 100%; display: flex; align-items: center; justify-content: center; padding: 0 10mm; }
    .a4-bottom-name-text { width: 100%; text-align: center; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; overflow: hidden; font-size: clamp(28pt, 6vw, 56pt); line-height: 1.15; color: #000; word-break: break-word; }

    .print-note { text-align: center; font-size: 9pt; color: #666; padding: 4px; background: #fffbe6; border-bottom: 1px solid #eee; }
    @media print {
      .print-note { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      * { color: #000 !important; }
      .priority-color-box { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .info-key, .info-val, .barcode-number, .barcode-subtext { -webkit-text-stroke: 0.3px #000; }
      .a4-name-right-text, .a4-bottom-name-text { -webkit-text-stroke: 0.7px #000; text-shadow: 0 0 0.5px #000; }
      img:not(.header-banner-img):not(.a4-banner-img):not(.barcode-img) { filter: contrast(3) brightness(0.9); image-rendering: crisp-edges; image-rendering: -webkit-optimize-contrast; }
      .header-banner-img, .a4-banner-img { filter: none; }
      .barcode-img { filter: none; image-rendering: pixelated; }
    }
  </style></head><body><div class="print-note">A4 Bale Labels. Set printer to BEST quality, max darkness. Disable "Headers and Footers".</div>${labelsHtml}</body></html>`;
}

export function generateA5LabelsHtml(labels: LabelData[]) {
  let labelsHtml = "";
  for (const label of labels) {
    // Priority bales use the ordinary layout; only the small logo differs.
    validatePriorityLabelColor(label);
    labelsHtml += `
      <div class="a5-page a5-page1">
        <div class="a5-top-content">
          <div class="a5-detail-left">
            ${buildDetailBlockNoBanner(label)}
          </div>
          <div class="a5-name-right">
            <div class="a5-name-right-text">${escapePriorityText(label.productName)}</div>
          </div>
        </div>
      </div>
      <div class="a5-page a5-page2">
        <div class="a5-bottom-namebox">
          <div class="a5-bottom-name-text">${escapePriorityText(label.productName)}</div>
        </div>
      </div>`;
  }
  return `<html><head><title>Stock Entry Labels - A5</title><style>
    @page { size: 148mm 210mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; }

    .code-label { width: 62mm; padding: 2mm 2mm; display: flex; flex-direction: column; justify-content: flex-start; gap: 1mm; background: #fff; overflow: hidden; }
    .header-banner-img { width: 100%; height: 12mm; object-fit: cover; display: block; flex-shrink: 0; }
    .info-section-row { font-size: 7pt; font-weight: 900; line-height: 1.4; white-space: nowrap; overflow: hidden; text-align: left; }
    .label-top { display: flex; justify-content: space-between; align-items: center; }
    .logo-section { flex-shrink: 0; }
    .logo-img { height: 12mm; width: auto; object-fit: contain; display: block; }
    .dakzo-default-logo { background: #fff !important; filter: contrast(3) !important; }
    ${priorityColorBoxCss(22, 12)}
    .info-section { text-align: right; font-size: 7pt; line-height: 1.4; }
    .info-key { font-weight: 900; }
    .info-val { font-weight: 900; }
    .barcode-area { text-align: center; margin-top: 1mm; flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .barcode-img { width: 100%; height: 14mm; object-fit: fill; }
    .barcode-number { font-size: 11pt; font-weight: 900; font-family: Arial, Helvetica, sans-serif; margin-top: 0.5mm; letter-spacing: 1.5px; text-transform: uppercase; -webkit-text-stroke: 0.5px #000; }
    .barcode-subtext { font-size: 7pt; font-weight: 900; margin-top: 0.5mm; text-transform: uppercase; letter-spacing: 1px; line-height: 1.1; word-break: break-word; -webkit-text-stroke: 0.4px #000; }
    .a5-page { width: 148mm; height: 210mm; page-break-after: always; page-break-inside: avoid; break-inside: avoid; overflow: hidden; display: flex; flex-direction: column; background: #fff; }
    .a5-page:last-child { page-break-after: auto; }
    .a5-page1 { padding-top: 80mm; }
    .a5-page2 { padding-top: 10mm; }

    .a5-top-content { flex: none; display: flex; flex-direction: row; gap: 4mm; align-items: stretch; padding: 2mm 5mm; }
    .a5-detail-left { flex-shrink: 0; width: 62mm; border: 0.3mm solid #ccc; }
    .a5-name-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2mm 2mm; }
    .a5-name-right-text { width: 100%; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; font-size: clamp(14pt, 3.5vw, 26pt); line-height: 1.15; color: #000; word-break: break-word; }

    .a5-bottom-namebox { flex: 1; width: 100%; display: flex; align-items: center; justify-content: center; padding: 0 5mm; }
    .a5-bottom-name-text { width: 100%; text-align: center; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; overflow: hidden; font-size: clamp(22pt, 5vw, 42pt); line-height: 1.15; color: #000; word-break: break-word; }

    .print-note { text-align: center; font-size: 9pt; color: #666; padding: 4px; background: #fffbe6; border-bottom: 1px solid #eee; }
    @media print {
      .print-note { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      * { color: #000 !important; }
      .priority-color-box { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .info-key, .info-val, .barcode-number, .barcode-subtext { -webkit-text-stroke: 0.3px #000; }
      .a5-name-right-text, .a5-bottom-name-text { -webkit-text-stroke: 0.7px #000; text-shadow: 0 0 0.5px #000; }
      img:not(.header-banner-img):not(.a4-banner-img):not(.barcode-img) { filter: contrast(3) brightness(0.9); image-rendering: crisp-edges; image-rendering: -webkit-optimize-contrast; }
      .header-banner-img, .a4-banner-img { filter: none; }
      .barcode-img { filter: none; image-rendering: pixelated; }
    }
  </style></head><body><div class="print-note">A5 Bale Labels (preprinted paper). Select A5 paper, Portrait, 100% scale. Set BEST quality, max darkness. Disable "Headers and Footers".</div>${labelsHtml}</body></html>`;
}

export function generateStickerLabelsHtml(labels: LabelData[]) {
  let labelsHtml = "";
  for (const label of labels) {
    // Stickers stay black-on-white. Only approved palette colors get an M-W letter.
    const priorityLetter = getPriorityScanLetter(validatePriorityLabelColor(label));
    labelsHtml += `
      <div class="sticker-page">
        <div class="label">
          <div class="label-content">
            <div class="label-top">
              <div class="logo-section${priorityLetter ? " sticker-logo-with-letter" : ""}">${renderSmallDakzoLogo(label, "sticker-logo", false)}${priorityLetter ? `<span class="sticker-priority-letter" data-priority-letter="${priorityLetter}" aria-label="Priority letter ${priorityLetter}">${priorityLetter}</span>` : ""}</div>
              <div class="info-section">
                <div><span class="info-label">PIECES:</span> <span class="info-value">${formatLabelNum(label.pieces)}</span></div>
                <div><span class="info-label">ARTICLE:</span> <span class="info-value">${escapePriorityText(label.articleCode)}</span></div>
                <div><span class="info-label">APRX WEIGHT:</span> <span class="info-value">${formatLabelNum(label.approxWeightKg)} KGS</span></div>
              </div>
            </div>
            <div class="ref-barcode-section">
              <img class="ref-barcode-img" src="${label.barcodeDataUrl || `/api/barcode/${encodeURIComponent(label.referenceNumber)}`}" alt="Barcode" />
              <div class="ref-barcode-number">${escapePriorityText(label.referenceNumber)}</div>
            </div>
            <div class="name-barcode-section">
              <div class="ref-bale-name">${escapePriorityText(label.productName)}</div>
            </div>
          </div>
        </div>
      </div>`;
  }
  return `<html><head><title>Sticker Labels</title><style>
    @page { size: 3in 1.97in; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; }
    .sticker-page { width: 3in; height: 1.97in; page-break-after: always; page-break-inside: avoid; break-inside: avoid; overflow: hidden; }
    .sticker-page:last-child { page-break-after: auto; }
    .label { width: 3in; height: 1.97in; padding: 1.5mm 3mm; display: flex; flex-direction: column; overflow: hidden; position: relative; background: #fff; }
    .label-content { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 0.5mm; height: 100%; }
    .label-top { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
    .logo-section { flex-shrink: 0; }
    .sticker-logo { height: 10mm; width: auto; object-fit: contain; display: block; }
    .sticker-logo-with-letter { display: flex; align-items: center; gap: 2mm; max-width: 37mm; }
    .sticker-logo-with-letter .sticker-logo { max-width: 25mm; min-width: 0; flex-shrink: 1; }
    .sticker-priority-letter { width: 9mm; height: 10mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #000 !important; -webkit-text-fill-color: #000 !important; font: 900 24pt/1 Arial, Helvetica, sans-serif; text-align: center; white-space: nowrap; background: transparent !important; }
    .dakzo-default-logo { background: #fff !important; filter: contrast(3) !important; }
    .info-section { text-align: right; font-size: 7.5pt; line-height: 1.3; }
    .info-label { font-weight: 900; }
    .info-value { font-weight: 900; }
    .ref-barcode-section { text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .ref-barcode-img { width: 100%; height: 11mm; object-fit: fill; }
    .ref-barcode-number { font-size: 12pt; font-weight: 900; font-family: Arial, Helvetica, sans-serif; margin-top: 0.3mm; letter-spacing: 2px; text-transform: uppercase; -webkit-text-stroke: 0.5px #000; }
    .name-barcode-section { text-align: center; flex-shrink: 0; }
    .ref-bale-name { font-size: 7.5pt; font-weight: 900; margin-top: 0.2mm; text-transform: uppercase; letter-spacing: 1px; line-height: 1.1; word-break: break-word; -webkit-text-stroke: 0.4px #000; }

    .print-note { text-align: center; font-size: 9pt; color: #666; padding: 4px; background: #fffbe6; border-bottom: 1px solid #eee; }
    @media print {
      .print-note { display: none !important; }
      * { color: #000 !important; }
      .info-label, .info-value, .ref-barcode-number, .ref-bale-name { -webkit-text-stroke: 0.3px #000; }
      img { filter: contrast(3) brightness(0.9); image-rendering: crisp-edges; image-rendering: -webkit-optimize-contrast; }
      .sticker-logo, .ref-barcode-img { filter: none; image-rendering: pixelated; }
    }
  </style></head><body><div class="print-note">Sticker Labels. Set printer to BEST quality, max darkness. Disable "Headers and Footers".</div>${labelsHtml}</body></html>`;
}
