import { Document, HeadingLevel, ImageRun, Packer, Paragraph, Table, TextRun } from "docx";
import Docxtemplater from "docxtemplater";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import PizZip from "pizzip";
import * as XLSX from "xlsx";
import initSqlJs from "sql.js";
import { Geometry } from "wkx";
import proj4 from "proj4";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { documentTypeLabels, getExtension, normalizeEnrollment, normalizeFieldName } from "../shared/urbanDocs";
import { documentSchemas, getSchemaSections } from "../shared/documentFields";
import { storageGetSignedUrl } from "./storage";

export type ExtractedLotData = Record<string, unknown> & {
  sourceNames?: string;
  geometry?: unknown;
};

type ImageAttachment = { name: string; content: Uint8Array; mimeType: string };
export type TemplateProfile = {
  markerNames: string[];
  textPartNames: string[];
  hasHeader: boolean;
  hasFooter: boolean;
  fillMode: "markers" | "legacy";
};
const execFileAsync = promisify(execFile);

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

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function firstField(fields: Record<string, string | number | boolean>, ...keys: string[]) {
  for (const key of keys) {
    const value = fields[key];
    if (value !== undefined && value !== "") return String(value);
  }
  return undefined;
}

function replaceWordText(xml: string, sample: string, replacement: string) {
  const escapedSample = xmlEscape(sample);
  if (xml.includes(escapedSample)) return xml.replace(escapedSample, xmlEscape(replacement));
  const matcher = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  const segments: Array<{ contentStart: number; contentEnd: number; text: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(xml))) {
    const token = match[0];
    const openingEnd = token.indexOf(">") + 1;
    segments.push({ contentStart: match.index + openingEnd, contentEnd: matcher.lastIndex - 6, text: match[1] });
  }
  const joined = segments.map((segment) => segment.text).join("");
  const start = joined.indexOf(sample);
  if (start < 0) return xml;
  const end = start + sample.length;
  let cursor = 0;
  let firstIndex = -1;
  let lastIndex = -1;
  let firstOffset = 0;
  let lastOffset = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const next = cursor + segments[index].text.length;
    if (firstIndex === -1 && start >= cursor && start < next) { firstIndex = index; firstOffset = start - cursor; }
    if (end > cursor && end <= next) { lastIndex = index; lastOffset = end - cursor; break; }
    cursor = next;
  }
  if (firstIndex === -1 || lastIndex === -1) return xml;
  if (firstIndex === lastIndex) {
    const segment = segments[firstIndex];
    const nextText = `${segment.text.slice(0, firstOffset)}${xmlEscape(replacement)}${segment.text.slice(lastOffset)}`;
    return `${xml.slice(0, segment.contentStart)}${nextText}${xml.slice(segment.contentEnd)}`;
  }
  const first = segments[firstIndex];
  const last = segments[lastIndex];
  const before = `${xml.slice(0, first.contentStart)}${first.text.slice(0, firstOffset)}${xmlEscape(replacement)}`;
  const after = `${last.text.slice(lastOffset)}${xml.slice(last.contentEnd)}`;
  return `${before}${after}`;
}

function applyLegacyOfficialMapping(documentType: keyof typeof documentTypeLabels, xml: string, fields: Record<string, string | number | boolean>) {
  const address = firstField(fields, "endereco", "localizacao", "rua");
  const zone = firstField(fields, "zoneamento");
  const lot = firstField(fields, "lote", "numero_lote");
  const neighborhood = firstField(fields, "bairro", "gleba");
  const enterprise = firstField(fields, "empreendimento", "nome_empreendimento");
  const registry = firstField(fields, "matricula", "registro_imobiliario");
  const area = firstField(fields, "area", "area_lote", "area_imovel");
  const coordinates = firstField(fields, "coordenadas", "coordenadas_geograficas");
  const company = firstField(fields, "empresa_empreendedora", "interessado", "requerente");
  const taxpayerId = firstField(fields, "cnpj_cpf", "cnpj", "cpf");
  const activity = firstField(fields, "cnae_atividades", "atividade");
  const perimeter = firstField(fields, "perimetro_urbano_ou_zona_rural", "perimetro");
  const compliance = firstField(fields, "enquadramento");
  const protocol = firstField(fields, "protocolo");
  const certificateNumber = firstField(fields, "numero_certidao", "numero_documento") ?? protocol;
  const replacements: Array<[string, string | undefined]> = [["8684/2025", firstField(fields, "protocolo")], ["86842/2025", firstField(fields, "protocolo")]];
  if (documentType === "laudo_viabilidade") replacements.push(["Estrada da Colônia Esperança", address], ["Gleba Pirapó", neighborhood], ["ZRCH – Zona Residencial de Chácaras", zone], ["268", lot]);
  if (documentType === "parecer_eiv") replacements.push(["CONDOMÍNIO RECANTO MUNDO NOVO", enterprise], ["LEBI CONSTRUTORA LTDA", firstField(fields, "interessado", "requerente")], ["Rua México, S/ N", address], ["Rua México", address], ["ZR3 – Zona Residencial Três", zone]);
  if (documentType === "diretriz_loteamento") replacements.push(["Rua Mutsumi Ohara Nishikawa", address], ["108-Remanescente/107-3/H-Remanescente", lot], ["449321.55L, 7393491.80N", coordinates], ["161.446,58m²", area], ["32.379", registry], ["ZR2 – Zona Residencial Dois", zone]);
  if (documentType === "certidao_uso_ocupacao_solo") replacements.push(
    ["77/2026", certificateNumber],
    ["48337/2026", protocol],
    ["NACIONAL GAS BUTANO DISTRIBUIDORA LTDA", company],
    ["NACIONAL GAS BUTANO DISTRIBUIDORA LTDA", enterprise],
    ["06.980.064/0110-36", taxpayerId],
    ["46.82-6-00 - Comércio atacadista de gás liquefeito de petróleo (GLP);47.84-9-00 - Comércio varejista de gás liquefeito de petróleo (GLP);49.30-2-03 - Transporte rodoviário de produtos perigosos;52.11-7-99 - Depósitos de mercadorias para terceiros, exceto armazéns gerais e guarda-móveis;82.92-0-00 - Envasamento e empacotamento sob contrato.", activity],
    ["Av. Francisco Kitano, 267 – Zona Norte – Gleba Pirapó – CEP: 86.806-385", address],
    ["Latitude: -23.521097°; Longitude: -51.440117°", coordinates],
    ["Lote N° 265-266/2", lot ?? "Não informado"],
    ["Perímetro Urbano", perimeter],
    ["ZI2 – Zona Industrial Dois", zone],
    ["ZI2 – Zona Industrial Dois", zone],
    ["PERMITIDO", compliance],
    ["Apucarana, 7 de agosto de 2026", `Apucarana, ${firstField(fields, "data_emissao") ?? ""}`],
  );
  let mapped = xml;
  for (const [sample, replacement] of replacements) {
    if (replacement) mapped = replaceWordText(mapped, sample, replacement);
  }
  if (documentType === "laudo_viabilidade" && neighborhood) {
    mapped = mapped.replace(/(<w:t[^>]*>)Gleba\s*(<\/w:t>[\s\S]*?<w:t[^>]*>)Pirapó(<\/w:t>)/, `$1$2${xmlEscape(neighborhood)}$3`);
  }
  return mapped;
}

async function convertDocxToPdf(docxBytes: Uint8Array, filename: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "urban-docs-pdf-"));
  const sourcePath = path.join(directory, `${safeFilename(filename)}.docx`);
  const pdfPath = sourcePath.replace(/\.docx$/i, ".pdf");
  try {
    await writeFile(sourcePath, docxBytes);
    const profile = pathToFileURL(path.join(directory, "libreoffice-profile")).href;
    await execFileAsync("libreoffice", [`-env:UserInstallation=${profile}`, "--headless", "--convert-to", "pdf:writer_pdf_Export", "--outdir", directory, sourcePath], { timeout: 100_000, maxBuffer: 2 * 1024 * 1024 });
    return await readFile(pdfPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    throw new Error(`Não foi possível converter o modelo DOCX oficial para PDF: ${message}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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

function labelFromKey(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function structuredSections(documentType: keyof typeof documentTypeLabels, fields: Record<string, string | number | boolean>) {
  const schema = documentSchemas[documentType];
  const knownKeys = new Set(schema.fields.map((field) => field.key));
  const sections = getSchemaSections(documentType).map(([section, items]) => ({
    title: section,
    entries: items.filter((field) => fields[field.key] !== undefined && fields[field.key] !== "").map((field) => [field.label, String(fields[field.key])] as const),
  })).filter((section) => section.entries.length > 0);
  const extractedEntries = Object.entries(fields)
    .filter(([key, value]) => !["tipo_documento", "data_emissao", "protocolo", "interessado", "empreendimento", "responsavel_tecnico"].includes(key) && !knownKeys.has(key) && value !== "")
    .map(([key, value]) => [labelFromKey(key), String(value)] as const);
  if (extractedEntries.length) sections.push({ title: "Dados complementares", entries: extractedEntries });
  return sections;
}

function structuredNarrative(documentType: keyof typeof documentTypeLabels, fields: Record<string, string | number | boolean>) {
  const address = fields.endereco ? ` no endereço ${fields.endereco}` : "";
  if (documentType === "certidao_uso_ocupacao_solo") return `Certifica-se que a atividade ${fields.cnae_atividades ?? "declarada"}${address} está vinculada ao enquadramento ${fields.enquadramento ?? "em análise"}, observadas as condições urbanísticas e ambientais aplicáveis.`;
  if (documentType === "certidao_tombamento") return `Após consulta aos registros patrimoniais disponíveis, o resultado informado para o imóvel${address} é: ${fields.resultado_tombamento ?? "pendente de validação técnica"}.`;
  if (documentType === "certidao_desapropriacao") return `Após consulta aos atos administrativos disponíveis, o resultado informado para o imóvel${address} é: ${fields.resultado_desapropriacao ?? "pendente de validação técnica"}.`;
  if (documentType === "certidao_perimetro_urbano") return `A situação territorial informada para o imóvel${address} é: ${fields.perimetro ?? "pendente de validação"}.`;
  return "O presente documento consolida os dados declarados, os elementos territoriais disponíveis e as evidências anexadas para revisão técnica.";
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

export function projectPosition(position: unknown, srid: number): unknown {
  if (!Array.isArray(position)) return position;
  if (typeof position[0] === "number" && typeof position[1] === "number") {
    if (srid === 4326 || (Math.abs(position[0]) <= 180 && Math.abs(position[1]) <= 90)) return position;
    const definitions: Record<number, string> = {
      31982: "+proj=utm +zone=22 +south +ellps=GRS80 +units=m +no_defs",
      31983: "+proj=utm +zone=23 +south +ellps=GRS80 +units=m +no_defs",
      31984: "+proj=utm +zone=24 +south +ellps=GRS80 +units=m +no_defs",
      32722: "+proj=utm +zone=22 +south +datum=WGS84 +units=m +no_defs",
      32723: "+proj=utm +zone=23 +south +datum=WGS84 +units=m +no_defs",
      32724: "+proj=utm +zone=24 +south +datum=WGS84 +units=m +no_defs",
    };
    const source = definitions[srid];
    if (!source) return position;
    const [longitude, latitude] = proj4(source, "WGS84", [position[0], position[1]]);
    return [longitude, latitude, ...position.slice(2)];
  }
  return position.map((item) => projectPosition(item, srid));
}

function geometryFromGpkg(value: unknown, srid: number) {
  if (!(value instanceof Uint8Array) && !Buffer.isBuffer(value)) return undefined;
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const headerSize = gpkgHeaderSize(bytes);
  if (!headerSize || bytes.length <= headerSize) return undefined;
  try {
    const geometry = Geometry.parse(Buffer.from(bytes.slice(headerSize))).toGeoJSON() as { type?: string; coordinates?: unknown };
    if (!geometry?.type || geometry.coordinates === undefined) return undefined;
    return { ...geometry, coordinates: projectPosition(geometry.coordinates, srid) };
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

export function inspectDocxTemplate(templateBytes: Uint8Array): TemplateProfile {
  const zip = new PizZip(templateBytes);
  const textPartNames = Object.keys(zip.files).filter((name) => /^word\/(?:document|header\d+|footer\d+)\.xml$/.test(name));
  const markerNames = Array.from(new Set(textPartNames.flatMap((name) => Array.from((zip.file(name)?.asText() ?? "").matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)).map((match) => match[1]))));
  return {
    markerNames,
    textPartNames,
    hasHeader: textPartNames.some((name) => /^word\/header\d+\.xml$/.test(name)),
    hasFooter: textPartNames.some((name) => /^word\/footer\d+\.xml$/.test(name)),
    fillMode: markerNames.length ? "markers" : "legacy",
  };
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
  const tables = database.exec("SELECT table_name, srs_id FROM gpkg_contents WHERE data_type = 'features'")[0]?.values ?? [];
  const target = normalizeEnrollment(enrollment);
  for (const [tableRaw, sridRaw] of tables) {
    const table = String(tableRaw);
    const srid = Number(sridRaw) || 4326;
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
      const geometry = geometryColumn ? geometryFromGpkg(record[geometryColumn], srid) : undefined;
      return { ...record, sourceNames: table, sistema_referencia: `EPSG:${srid}`, ...(geometry ? { geometry } : {}) } as ExtractedLotData;
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
  const templateFieldDefaults = Object.fromEntries([
    "protocolo",
    "inscricao_imobiliaria",
    "interessado",
    "objeto",
    "tipo_documento",
    "data_emissao",
    ...documentSchemas[input.documentType].fields.map((field) => field.key),
  ].map((key) => [key, ""]));
  const fields = flattenTemplateData({
    ...templateFieldDefaults,
    tipo_documento: title,
    data_emissao: new Intl.DateTimeFormat("pt-BR").format(new Date()),
    ...input.fields,
  });

  let docxBytes: Buffer | undefined;
  if (input.templateBytes) {
    const zip = new PizZip(input.templateBytes);
    const textPartNames = Object.keys(zip.files).filter((name) => /^word\/(?:document|header\d+|footer\d+)\.xml$/.test(name));
    const textParts = textPartNames.map((name) => ({ name, xml: zip.file(name)?.asText() ?? "" }));
    const hasSupportedMarker = Object.keys(fields).some((key) => textParts.some((part) => part.xml.includes(`{${key}}`)));
    if (hasSupportedMarker) {
      try {
      const template = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      template.render(fields);
      docxBytes = template.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
      } catch (error) {
        console.warn("[UrbanDocs] Não foi possível preencher os marcadores do modelo; gerando versão estruturada de contingência.", error instanceof Error ? error.message : error);
      }
    }
    if (!docxBytes) {
      let hasLegacyMapping = false;
      for (const part of textParts) {
        const mappedXml = applyLegacyOfficialMapping(input.documentType, part.xml, fields);
        if (mappedXml !== part.xml) {
          zip.file(part.name, mappedXml);
          hasLegacyMapping = true;
        }
      }
      if (hasLegacyMapping) {
        docxBytes = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
      }
    }
  }
  if (input.templateBytes && !docxBytes) throw new Error("O modelo DOCX oficial não possui marcadores ou mapeamentos compatíveis para esta certidão.");
  if (!docxBytes) {
    const sections = structuredSections(input.documentType, fields);
    const children: (Paragraph | Table)[] = [
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
      new Paragraph({ children: [new TextRun({ text: `Emitido em ${fields.data_emissao}.`, italics: true, color: "52655E" })] }),
      new Paragraph({ text: structuredNarrative(input.documentType, fields) }),
      ...sections.flatMap((section) => [new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2 }), ...section.entries.map(([label, value]) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)] }))]),
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

  if (input.templateBytes) {
    const pdfBytes = await convertDocxToPdf(docxBytes, safeFilename(title.toLocaleLowerCase("pt-BR")));
    return { docxBytes, pdfBytes, filename: safeFilename(title.toLocaleLowerCase("pt-BR")) };
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
  for (const line of toLines(structuredNarrative(input.documentType, fields), 90)) writeLine(line);
  cursorY -= 12;
  for (const section of structuredSections(input.documentType, fields)) {
    writeLine(section.title, true, 12);
    for (const [label, value] of section.entries) {
      for (const line of toLines(`${label}: ${value}`, 90)) writeLine(line);
    }
    cursorY -= 6;
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

export async function signPdfWithSystemStamp(input: { pdfBytes: Uint8Array; signerName: string; signerRole: string; signedAt?: Date }) {
  const signedAt = input.signedAt ?? new Date();
  const documentDigest = createHash("sha256").update(input.pdfBytes).digest("hex");
  const signatureCode = `URB-${documentDigest.slice(0, 16).toUpperCase()}-${signedAt.getTime().toString(36).toUpperCase()}`;
  const pdf = await PDFDocument.load(input.pdfBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const formattedDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "medium" }).format(signedAt);
  page.drawRectangle({ x: 42, y: 590, width: 511, height: 170, borderColor: rgb(0.18, 0.42, 0.32), borderWidth: 1.2, color: rgb(0.97, 0.985, 0.95) });
  page.drawText("Assinatura institucional de sistema", { x: 66, y: 718, size: 18, font: bold, color: rgb(0.13, 0.28, 0.22) });
  page.drawText("Documento aprovado e assinado após conferência humana no UrbanDocs.", { x: 66, y: 688, size: 10, font, color: rgb(0.2, 0.34, 0.28) });
  page.drawText(`Assinante: ${input.signerName} (${input.signerRole})`, { x: 66, y: 653, size: 10, font: bold, color: rgb(0.13, 0.28, 0.22) });
  page.drawText(`Data e hora: ${formattedDate}`, { x: 66, y: 632, size: 10, font, color: rgb(0.2, 0.34, 0.28) });
  page.drawText(`Código de verificação: ${signatureCode}`, { x: 66, y: 611, size: 9, font, color: rgb(0.2, 0.34, 0.28) });
  page.drawText(`SHA-256 do PDF original: ${documentDigest}`, { x: 66, y: 596, size: 7.6, font, color: rgb(0.26, 0.38, 0.32) });
  return { signedPdfBytes: await pdf.save(), documentDigest, signatureCode };
}
