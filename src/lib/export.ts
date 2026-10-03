/** Client-side exports: CSV (UTF-8 BOM so Excel reads Persian) and SpreadsheetML (.xls, opens in Excel). No third-party library. */
export type Cell = string | number | boolean | null | undefined;

const esc = (v: Cell) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (head: string[], rows: Cell[][]) => "﻿" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");

const x = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function toSpreadsheetML(name: string, head: string[], rows: Cell[][]) {
  const cell = (v: Cell) => (typeof v === "number" && Number.isFinite(v) ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${x(v === null || v === undefined ? "" : String(v))}</Data></Cell>`);
  const row = (r: Cell[]) => `<Row>${r.map(cell).join("")}</Row>`;
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${x(name.slice(0, 28))}" ss:RightToLeft="1"><Table>${row(head)}${rows.map(row).join("")}</Table></Worksheet></Workbook>`;
}

export function download(filename: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const exportCsv = (name: string, head: string[], rows: Cell[][]) => download(`${name}.csv`, "text/csv", toCsv(head, rows));
export const exportXls = (name: string, head: string[], rows: Cell[][]) => download(`${name}.xls`, "application/vnd.ms-excel", toSpreadsheetML(name, head, rows));
