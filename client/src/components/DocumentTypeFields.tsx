import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { documentSchemas, getSchemaSections, type DocumentField } from "@shared/documentFields";
import type { DocumentType } from "@shared/urbanDocs";

function FieldControl({ field, value, onChange }: { field: DocumentField; value: string; onChange: (value: string) => void }) {
  const label = <Label className="text-[10px] font-bold text-[#47665b]">{field.label}{field.required && <span className="ml-1 text-[#8a6933]">*</span>}</Label>;
  return <div className="space-y-2">{label}{field.multiline ? <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} className="min-h-20 rounded-xl border-[#d6dfd4] bg-white text-[11px] leading-5" /> : <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} className="h-10 rounded-xl border-[#d6dfd4] bg-white text-[11px]" />}{field.help && <p className="text-[9px] text-[#80938b]">{field.help}</p>}</div>;
}

export default function DocumentTypeFields({ type, fields, onChange }: { type: DocumentType; fields: Record<string, string>; onChange: (key: string, value: string) => void }) {
  const schema = documentSchemas[type];
  return <div className="mt-6 space-y-5 border-t border-[#e3e9df] pt-6"><div><p className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[#688178]">Campos da tipologia</p><p className="mt-1 text-[11px] leading-5 text-[#71857d]">{schema.summary}</p></div>{getSchemaSections(type).map(([section, items]) => <section key={section} className="rounded-xl bg-[#f7f9f3] p-4"><h3 className="mb-3 text-[11px] font-bold text-[#34594c]">{section}</h3><div className="grid gap-4 sm:grid-cols-2">{items.map((field) => <div key={field.key} className={field.multiline ? "sm:col-span-2" : ""}><FieldControl field={field} value={fields[field.key] ?? ""} onChange={(value) => onChange(field.key, value)} /></div>)}</div></section>)}</div>;
}
