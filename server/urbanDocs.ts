import { Document, HeadingLevel, ImageRun, Packer, Paragraph, Table, TextRun } from "docx";
import Docxtemplater from "docxtemplater";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import PizZip from "pizzip";
import * as XLSX from "xlsx";
import initSqlJs from "sql.js";
import { Geometry } from "wkx";
import path from "node:path";
import { documentTypeLabels, getExtension, normalizeEnrollment, normalizeFieldName } from "../shared/urbanDocs";
import { storageGetSignedUrl } from "./storage";

export type ExtractedLotData = Record<string, string | number | boolean | null | undefined> & {
  sourceNames?: string;
  geometry?: unknown;
};

type ImageAttachment = { name: string; content: Uint8Array; mimeType: string };

function safeFilename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80) || "documento";
}

function flattenTemplateData(data: Record<string, unknown>) {
  const normalized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    normalized[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  return normalized;
}

function toLines(value: string, maxLength: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function gpkgHeaderSize(value: Uint8Array): number {
  if (value.length < 8 || value[0] !== 0x47 || value[1] !== 0x50) return 0;
  const envelopeIndicator = (value[3] >> 1) & 0x07;
  const envelopeSizes: Record<number, number> = { 0: 0, 1: 32, 2: 48, 3: 48, 4: 64 };
  return 8 + (envelopeSizes[envelopeIndicator] ?? 0);
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function recordFromRow(columns: string[], row: unknown[]) {
  return Object.fromEntries(columns.map((column, index) => [column, row[index] as string | number | boolean | null]));
}

function enrollmentColumn(columns: string[]) {
  const preferred = ["inscricaoimobiliaria", "inscricao", "cadastroimobiliario", "matricula", "codimovel", "codigolote", "codigo"];
  const normalized = columns.map((column) => ({ original: column, normalized: normalizeFieldName(column) }));
  return preferred.map((candidate) => normalized.find((column) => column.normalized === candidate)?.original).find(Boolean) ?? normalized.find((column) => column.normalized.includes("inscricao"))?.original;
}

function geometryFromGpkg(value: unknown) {
  if (!(value instanceof Uint8Array) && !Buffer.isBuffer(value)) return undefined;
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const headerSize = gpkgHeaderSize(bytes);
  if (!headerSize || bytes.length <= headerSize) return undefined;
  try {
    return Geometry.parse(Buffer.from(bytes.slice(headerSize))).toGeoJSON();
  } catch {
    return undefined;
  }
}

export async function downloadStorageBytes(fileKey: string) {
  const signedUrl = await storageGetSignedUrl(fileKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Não foi possível recuperar o arquivo do armazenamento.");
  return new Uint8Array(await response.arrayBuffer());
}

export async function extractSpreadsheetLot(fileKey: string, enrollment: string): Promise<ExtractedLotData | undefined> {
  const bytes = await downloadStorageBytes(fileKey);
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
  const target = normalizeEnrollment(enrollment);
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
    for (const record of records) {
      const key = enrollmentColumn(Object.keys(record));
      if (key && normalizeEnrollment(record[key]) === target) {
        return { ...record, sourceNames: sheetName } as ExtractedLotData;
      }
    }
  }
  return undefined;
}

export async function extractGeoPackageLot(fileKey: string, enrollment: string): Promise<ExtractedLotData | undefined> {
  const bytes = await downloadStorageBytes(fileKey);
  const SQL = await initSqlJs({ locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file) });
  const database = new SQL.Database(bytes);
  const tables = database.exec("SELECT table_name FROM gpkg_contents WHERE data_type = 'features'")[0]?.values ?? [];
  const target = normalizeEnrollment(enrollment);
  for (const [tableRaw] of tables) {
    const table = String(tableRaw);
    const tableInfo = database.exec(`PRAGMA table_info(${quoteIdentifier(table)})`)[0];
    const columns = tableInfo?.values.map((row) => String(row[1])) ?? [];
    const candidateColumn = enrollmentColumn(columns);
    if (!candidateColumn) continue;
    const result = database.exec(`SELECT * FROM ${quoteIdentifier(table)}`)[0];
    if (!result) continue;
    const candidateIndex = result.columns.indexOf(candidateColumn);
    for (const row of result.values) {
      if (normalizeEnrollment(row[candidateIndex]) !== target) continue;
      const record = recordFromRow(result.columns, row);
      const geometryColumn = columns.find((column) => normalizeFieldName(column).includes("geom"));
      const geometry = geometryColumn ? geometryFromGpkg(record[geometryColumn]) : undefined;
      return { ...record, sourceNames: table, ...(geometry ? { geometry } : {}) } as ExtractedLotData;
    }
  }
  return undefined;
}

export async function renderDocument(input: {
  documentType: keyof typeof documentTypeLabels;
  fields: Record<string, unknown>;
  templateBytes?: Uint8Array;
  images?: ImageAttachment[];
}) {
  const title = documentTypeLabels[input.documentType];
  const fields = flattenTemplateData({
    tipo_documento: title,
    data_emissao: new Intl.DateTimeFormat("pt-BR").format(new Date()),
    ...input.fields,
  });

  let docxBytes: Buffer;
  if (input.templateBytes) {
    const zip = new PizZip(input.templateBytes);
    const template = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    template.render(fields);
    docxBytes = template.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  } else {
    const details = Object.entries(fields).filter(([key]) => !["tipo_documento", "data_emissao"].includes(key));
    const children: (Paragraph | Table)[] = [
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
      new Paragraph({ children: [new TextRun({ text: `Emitido em ${fields.data_emissao}.`, italics: true, color: "52655E" })] }),
      new Paragraph({ text: "Dados de referência", heading: HeadingLevel.HEADING_2 }),
      ...details.map(([key, value]) => new Paragraph({ children: [new TextRun({ text: `${key.replace(/_/g, " ")}: `, bold: true }), new TextRun(String(value))] })),
    ];
    if (input.images?.length) {
      children.push(new Paragraph({ text: "Anexos cartográficos", heading: HeadingLevel.HEADING_2 }));
      for (const image of input.images.slice(0, 4)) {
        children.push(new Paragraph({ children: [new TextRun({ text: image.name, bold: true })] }));
        children.push(new Paragraph({ children: [new ImageRun({ data: image.content, type: image.mimeType.includes("png") ? "png" : "jpg", transformation: { width: 520, height: 280 } })] }));
      }
    }
    const document = new Document({ sections: [{ properties: {}, children }] });
    docxBytes = await Packer.toBuffer(document);
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let cursorY = 786;
  const writeLine = (text: string, useBold = false, fontSize = 10) => {
    if (cursorY < 62) {
      page = pdf.addPage([595.28, 841.89]);
      cursorY = 786;
    }
    page.drawText(text, { x: 54, y: cursorY, size: fontSize, font: useBold ? bold : font, color: rgb(0.12, 0.23, 0.2) });
    cursorY -= fontSize + 6;
  };
  writeLine(title, true, 18);
  cursorY -= 10;
  writeLine(`Emitido em ${fields.data_emissao}.`, false, 10);
  cursorY -= 14;
  writeLine("Dados de referência", true, 12);
  for (const [key, value] of Object.entries(fields)) {
    if (["tipo_documento", "data_emissao"].includes(key)) continue;
    for (const line of toLines(`${key.replace(/_/g, " ")}: ${value}`, 90)) writeLine(line);
  }
  if (input.images?.length) {
    cursorY -= 10;
    writeLine("Anexos visuais", true, 12);
    for (const image of input.images.slice(0, 4)) {
      try {
        const embedded = image.mimeType.includes("png") ? await pdf.embedPng(image.content) : await pdf.embedJpg(image.content);
        const availableWidth = 487;
        const availableHeight = 410;
        const ratio = Math.min(availableWidth / embedded.width, availableHeight / embedded.height);
        const width = embedded.width * ratio;
        const height = embedded.height * ratio;
        if (cursorY - height - 34 < 50) {
          page = pdf.addPage([595.28, 841.89]);
          cursorY = 786;
        }
        writeLine(image.name, true, 9);
        page.drawImage(embedded, { x: 54, y: cursorY - height, width, height });
        cursorY -= height + 18;
      } catch {
        writeLine(`Imagem anexada sem prévia disponível: ${image.name}.`, false, 9);
      }
    }
  }
  const pdfBytes = await pdf.save();
  return { docxBytes, pdfBytes, filename: safeFilename(title.toLocaleLowerCase("pt-BR")) };
}
