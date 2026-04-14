import ExcelJS from 'exceljs';

interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  type?: 'text' | 'number' | 'currency' | 'percent';
}

interface ExcelExportOptions {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ExcelColumn[];
  rows: Record<string, string | number>[];
  summaryRow?: Record<string, string | number>;
  accentColor?: string;
  /** Group rows by this key to create per-group tabs (e.g. 'company') */
  tabGroupKey?: string;
  /** Human-readable labels for tab group values */
  tabGroupLabels?: Record<string, string>;
}

function addLogoHeader(ws: ExcelJS.Worksheet, colCount: number) {
  const logoRow = ws.addRow(['MetalPress Fleet']);
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, colCount);
  logoRow.height = 36;
  const logoCell = logoRow.getCell(1);
  logoCell.font = { size: 20, bold: true, color: { argb: '007AFF' } };
  logoCell.alignment = { horizontal: 'right', vertical: 'middle' };
  logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F7FF' } };

  const tagRow = ws.addRow([`ניהול צי רכבים | ${new Date().toLocaleDateString('he-IL')}`]);
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, colCount);
  tagRow.height = 20;
  const tagCell = tagRow.getCell(1);
  tagCell.font = { size: 9, color: { argb: '86868B' } };
  tagCell.alignment = { horizontal: 'right', vertical: 'middle' };
  tagCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F7FF' } };

  const lineRow = ws.addRow([]);
  lineRow.height = 4;
  for (let i = 1; i <= colCount; i++) {
    lineRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '007AFF' } };
  }

  ws.addRow([]);
}

function buildSheet(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string | undefined,
  columns: ExcelColumn[],
  rows: Record<string, string | number>[],
  summaryRow: Record<string, string | number> | undefined,
  accentColor: string
) {
  addLogoHeader(ws, columns.length);

  // Title
  const titleRow = ws.addRow([title]);
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, columns.length);
  titleRow.height = 40;
  titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: '1D1D1F' } };
  titleRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `${accentColor}15` } };

  // Subtitle
  if (subtitle) {
    const subRow = ws.addRow([subtitle]);
    ws.mergeCells(ws.rowCount, 1, ws.rowCount, columns.length);
    subRow.height = 24;
    subRow.getCell(1).font = { size: 10, color: { argb: '86868B' } };
    subRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
  }

  ws.addRow([]);

  // Header
  const headerRowNum = ws.rowCount + 1;
  const headerRow = ws.addRow(columns.map(c => c.header));
  headerRow.height = 32;
  headerRow.eachCell((cell, colNum) => {
    cell.font = { size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentColor } };
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: accentColor } } };
    ws.getColumn(colNum).width = columns[colNum - 1]?.width || 16;
  });

  // Data
  rows.forEach((row, i) => {
    const values = columns.map(c => row[c.key] ?? '');
    const dataRow = ws.addRow(values);
    dataRow.height = 28;
    const isEven = i % 2 === 0;

    dataRow.eachCell((cell, colNum) => {
      const colDef = columns[colNum - 1];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'F8F8FA' : 'FFFFFF' } };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = { size: 11, color: { argb: '424245' } };

      if (colDef?.type === 'currency' && typeof cell.value === 'number') {
        cell.numFmt = '₪#,##0';
        cell.font = { size: 11, bold: true, color: { argb: '1D1D1F' } };
      } else if (colDef?.type === 'number' && typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
      } else if (colDef?.type === 'percent') {
        cell.font = { size: 11, bold: true, color: { argb: String(cell.value).startsWith('-') ? '34C759' : 'FF3B30' } };
      }

      cell.border = { bottom: { style: 'thin', color: { argb: 'ECECEC' } } };
    });
  });

  // Summary
  if (summaryRow) {
    const sumValues = columns.map(c => summaryRow[c.key] ?? '');
    const sumRow = ws.addRow(sumValues);
    sumRow.height = 34;
    sumRow.eachCell((cell, colNum) => {
      const colDef = columns[colNum - 1];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `${accentColor}20` } };
      cell.font = { size: 12, bold: true, color: { argb: '1D1D1F' } };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.border = {
        top: { style: 'medium', color: { argb: accentColor } },
        bottom: { style: 'medium', color: { argb: accentColor } },
      };
      if (colDef?.type === 'currency' && typeof cell.value === 'number') {
        cell.numFmt = '₪#,##0';
        cell.font = { size: 12, bold: true, color: { argb: accentColor } };
      } else if (colDef?.type === 'number' && typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
      }
    });
  }

  // Auto filter
  ws.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: headerRowNum, column: columns.length },
  };

  // Footer
  ws.addRow([]);
  const footerRow = ws.addRow(['הופק אוטומטית מ-MetalPress Fleet Dashboard']);
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, columns.length);
  footerRow.getCell(1).font = { size: 8, italic: true, color: { argb: 'C7C7CC' } };
  footerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
}

/** Sanitize sheet name for Excel (max 31 chars, no special chars) */
function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:\[\]]/g, '').slice(0, 31);
}

export async function exportExcel(options: ExcelExportOptions) {
  const { sheetName, title, subtitle, columns, rows, summaryRow, accentColor = '007AFF', tabGroupKey, tabGroupLabels } = options;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MetalPress Fleet';
  wb.created = new Date();

  // Main sheet — all data
  const mainWs = wb.addWorksheet(sanitizeSheetName(`${sheetName} — הכל`), {
    views: [{ rightToLeft: true }],
  });
  buildSheet(mainWs, title, subtitle, columns, rows, summaryRow, accentColor);

  // Per-group tabs
  if (tabGroupKey) {
    const groups = new Map<string, Record<string, string | number>[]>();
    for (const row of rows) {
      const groupVal = String(row[tabGroupKey] || 'אחר');
      if (!groups.has(groupVal)) groups.set(groupVal, []);
      groups.get(groupVal)!.push(row);
    }

    // Sort groups by row count descending
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

    for (const [groupVal, groupRows] of sorted) {
      const label = tabGroupLabels?.[groupVal] || groupVal;
      const tabName = sanitizeSheetName(label);
      const ws = wb.addWorksheet(tabName, { views: [{ rightToLeft: true }] });

      const groupTitle = `${title} — ${label}`;
      const groupSubtitle = `${groupRows.length} שורות`;

      // Build summary for this group if main summary exists
      let groupSummary: Record<string, string | number> | undefined;
      if (summaryRow) {
        groupSummary = { ...summaryRow };
        // Recalculate numeric sums for the group
        for (const col of columns) {
          if (col.type === 'number' || col.type === 'currency') {
            const sum = groupRows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
            groupSummary[col.key] = sum;
          }
        }
        // First column gets label
        if (columns.length > 0) {
          groupSummary[columns[0].key] = `סה"כ ${label}`;
        }
      }

      buildSheet(ws, groupTitle, groupSubtitle, columns, groupRows, groupSummary, accentColor);
    }
  }

  // Generate & download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sheetName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
