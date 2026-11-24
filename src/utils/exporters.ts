import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportRowsToCsv(rows: Record<string, any>[], filename: string) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function exportRowsToXlsx(rows: Record<string, any>[], filename: string, sheetName = 'Data') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportJsonFile(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename);
}

export function exportTextFile(content: string, filename: string, mime = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  triggerDownload(blob, filename);
}

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  sections: { heading: string; body: string }[];
  table?: {
    title?: string;
    columns: string[];
    rows: (string | number | null)[][];
  };
  filename: string;
}

export function exportStructuredPdf(opts: PdfReportOptions) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 48;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(opts.title, 40, y);
  y += 20;

  if (opts.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(opts.subtitle, 40, y);
    y += 18;
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(40, y, 555, y);
  y += 20;

  for (const sec of opts.sections) {
    if (y > 740) {
      doc.addPage();
      y = 48;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(sec.heading, 40, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(sec.body || '—', 515);
    for (const line of lines) {
      if (y > 760) {
        doc.addPage();
        y = 48;
      }
      doc.text(line, 40, y);
      y += 14;
    }
    y += 10;
  }

  if (opts.table && opts.table.columns.length > 0 && opts.table.rows.length > 0) {
    if (y > 660) {
      doc.addPage();
      y = 48;
    }
    if (opts.table.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(opts.table.title, 40, y);
      y += 12;
    }
    autoTable(doc, {
      startY: y,
      head: [opts.table.columns],
      body: opts.table.rows.slice(0, 60).map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v)))),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
  }

  doc.save(opts.filename.endsWith('.pdf') ? opts.filename : `${opts.filename}.pdf`);
}

export async function exportStructuredDocx(opts: {
  title: string;
  subtitle?: string;
  sections: { heading: string; body: string }[];
  filename: string;
}) {
  const children: Paragraph[] = [
    new Paragraph({
      text: opts.title,
      heading: HeadingLevel.TITLE,
    }),
  ];

  if (opts.subtitle) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: opts.subtitle, italics: true, color: '64748B', size: 20 })],
        spacing: { after: 240 },
      })
    );
  }

  for (const sec of opts.sections) {
    children.push(
      new Paragraph({
        text: sec.heading,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
      })
    );
    const lines = (sec.body || '—').split('\n');
    for (const line of lines) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 80 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, opts.filename.endsWith('.docx') ? opts.filename : `${opts.filename}.docx`);
}
