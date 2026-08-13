import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";
import { MapPinned, MousePointer2 } from "lucide-react";

type GeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

function FitGeometry({ geometry }: { geometry?: GeoJsonGeometry }) {
  const map = useMap();
  useEffect(() => {
    if (!geometry) return;
    const bounds = L.geoJSON(geometry as GeoJSON.GeoJsonObject).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [34, 34], maxZoom: 18 });
  }, [geometry, map]);
  return null;
}

export default function LotGeometryMap({ geometry, enrollment }: { geometry?: GeoJsonGeometry; enrollment: string }) {
  return <div className="overflow-hidden rounded-[18px] border border-[#cbdcc5] bg-[#e7f1de] shadow-[0_10px_28px_rgba(52,88,67,.09)]"><div className="flex flex-col gap-3 border-b border-[#d5e2cf] bg-[#fbfcf8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8f2da] text-[#4f7b30]"><MapPinned className="h-4 w-4" /></span><div><p className="font-mono-ui text-[9px] uppercase tracking-[.15em] text-[#6c866a]">pré-visualização geográfica</p><p className="mt-0.5 font-mono-ui text-[10px] font-medium text-[#315548]">{enrollment || "Inscrição aguardando preenchimento"}</p></div></div><div className="flex items-center gap-1.5 text-[10px] font-medium text-[#688043]"><MousePointer2 className="h-3.5 w-3.5" />Arraste, amplie e confira</div></div><div className="relative h-[360px] bg-[#dbe9d2]"><MapContainer center={[-23.55, -51.46]} zoom={12} scrollWheelZoom className="h-full w-full" aria-label="Mapa interativo da geometria do lote"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{geometry && <><GeoJSON data={geometry as GeoJSON.GeoJsonObject} style={{ color: "#173d36", weight: 3, fillColor: "#c9e26d", fillOpacity: 0.52 }} /><FitGeometry geometry={geometry} /></>}</MapContainer>{!geometry && <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-[#e9f1df]/88 px-7 text-center"><div className="max-w-xs rounded-2xl border border-white/80 bg-[#fbfcf8]/95 p-5 shadow-sm"><MapPinned className="mx-auto h-6 w-6 text-[#5a833a]" /><p className="mt-3 text-[12px] font-bold text-[#385b4f]">Geometria ainda não localizada</p><p className="mt-2 text-[10px] leading-5 text-[#71847a]">Envie uma fonte GeoPackage com a inscrição imobiliária e processe as bases para destacar o lote.</p></div></div>}</div><div className="grid grid-cols-3 divide-x divide-[#e0e9dc] bg-[#fbfcf8] px-4 py-3"><div><p className="font-mono-ui text-[8px] uppercase tracking-wider text-[#819386]">fonte</p><p className="mt-1 text-[10px] font-bold text-[#3d6253]">GeoPackage</p></div><div className="pl-4"><p className="font-mono-ui text-[8px] uppercase tracking-wider text-[#819386]">geometria</p><p className="mt-1 text-[10px] font-bold text-[#3d6253]">{geometry?.type ?? "Aguardando"}</p></div><div className="pl-4"><p className="font-mono-ui text-[8px] uppercase tracking-wider text-[#819386]">referência</p><p className="mt-1 text-[10px] font-bold text-[#3d6253]">WGS 84</p></div></div></div>;
}
