import { useEffect, useState } from 'react';
import {
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  MapPin,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORIES } from '../data/categories';
import { t } from '../i18n';
import {
  CategoryId,
  Language,
  PoiCollection,
  PoiFeature,
  TrailReport,
} from '../types';
import { downloadJsonFile } from '../utils/fieldStorage';

interface AddPoiModalProps {
  coords: [number, number] | null;
  editingPoi?: PoiFeature | null;
  lang: Language;
  onClose: () => void;
  onSave: (poi: PoiFeature) => void;
}

export function AddPoiModal({
  coords,
  editingPoi,
  lang,
  onClose,
  onSave,
}: AddPoiModalProps) {
  const [category, setCategory] = useState<CategoryId>('panchina');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (editingPoi) {
      setCategory(editingPoi.properties.categoria);
      setName(editingPoi.properties.nome);
      setDescription(editingPoi.properties.descrizione);
    } else {
      setCategory('panchina');
      setName('');
      setDescription('');
    }
  }, [editingPoi, coords]);

  const effectiveCoords = editingPoi?.geometry.coordinates ?? coords;
  if (!effectiveCoords) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = CATEGORIES.find((c) => c.id === category);
    const fallbackName = lang === 'en' ? cat?.label_en : cat?.label_it;
    const today = new Date().toISOString().slice(0, 10);

    const savedPoi: PoiFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          Number(effectiveCoords[0].toFixed(6)),
          Number(effectiveCoords[1].toFixed(6)),
        ],
      },
      properties: {
        ...(editingPoi?.properties ?? {}),
        id: editingPoi?.properties.id ?? `field-${Date.now()}`,
        nome: name.trim() || fallbackName || 'Nuovo POI',
        categoria: category,
        descrizione:
          description.trim() || 'Rilevato durante sopralluogo sul campo.',
        aggiornato_il: today,
        fonte: 'Sopralluogo',
      },
    };

    onSave(savedPoi);
    setName('');
    setDescription('');
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="liquid-glass-elevated animate-liquid-sheet w-full max-w-md rounded-[32px] p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="liquid-tint-emerald flex h-9 w-9 items-center justify-center rounded-2xl text-white">
              <MapPin className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              {editingPoi ? t(lang, 'fieldEditPoiTitle') : t(lang, 'fieldNewPoiTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'close')}
            className="liquid-interactive rounded-full bg-slate-900/8 p-2 text-slate-600 hover:bg-slate-900/14 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="liquid-subcard mt-3 rounded-2xl px-3.5 py-2 text-[11px] font-mono tabular-nums text-slate-600">
          {t(lang, 'fieldCoords')}: {effectiveCoords[1].toFixed(5)},{' '}
          {effectiveCoords[0].toFixed(5)}
        </div>

        <div className="mt-3.5">
          <label className="text-xs font-semibold text-slate-700">
            {t(lang, 'fieldCategory')}
          </label>
          <div className="mt-1.5 grid max-h-36 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`liquid-interactive flex items-center gap-1 rounded-2xl px-2.5 py-1.5 text-left text-[11px] font-semibold ${
                  category === cat.id
                    ? 'liquid-tint-emerald text-white'
                    : 'liquid-subcard text-slate-700 hover:bg-white/80'
                }`}
              >
                <span>{cat.emoji}</span>
                <span className="truncate">
                  {lang === 'en' ? cat.label_en : cat.label_it}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3.5">
          <label className="text-xs font-semibold text-slate-700">
            {t(lang, 'fieldPoiName')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(lang, 'fieldPoiNamePlaceholder')}
            className="liquid-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="mt-3">
          <label className="text-xs font-semibold text-slate-700">
            {t(lang, 'fieldPoiDesc')}
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(lang, 'fieldPoiDescPlaceholder')}
            className="liquid-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <button
          type="submit"
          className="liquid-tint-emerald liquid-interactive mt-4 w-full rounded-full py-2.5 text-sm font-semibold text-white"
        >
          {t(lang, 'fieldSavePoi')}
        </button>
      </form>
    </div>
  );
}

interface FieldDraftsModalProps {
  open: boolean;
  lang: Language;
  mergedPois: PoiCollection;
  customPois: PoiFeature[];
  trailReports: Record<string, TrailReport>;
  onClose: () => void;
  onDeleteCustomPoi: (id: string) => void;
  onClearAll: () => void;
}

export function FieldDraftsModal({
  open,
  lang,
  mergedPois,
  customPois,
  trailReports,
  onClose,
  onDeleteCustomPoi,
  onClearAll,
}: FieldDraftsModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const reportList = Object.values(trailReports);
  const hasDrafts = customPois.length > 0 || reportList.length > 0;

  const handleCopyJson = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      customPois,
      trailReports: reportList,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildGithubIssueUrl = () => {
    const title = `Sopralluogo: ${customPois.length} POI, ${reportList.length} sentieri`;
    const payload = {
      exportedAt: new Date().toISOString(),
      customPois,
      trailReports: reportList,
    };
    const jsonStr = JSON.stringify(payload, null, 2).slice(0, 5500);
    const body = `### Segnalazione dal campo (Bosco della Partecipanza 3D)\n\n\`\`\`json\n${jsonStr}\n\`\`\`\n`;
    return `https://github.com/lukeonesto/bosco-partecipanza-3d/issues/new?title=${encodeURIComponent(
      title
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center">
      <div className="liquid-glass-elevated animate-liquid-sheet w-full max-w-md rounded-[32px] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            {t(lang, 'fieldDraftsTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'close')}
            className="liquid-interactive rounded-full bg-slate-900/8 p-2 text-slate-600 hover:bg-slate-900/14 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!hasDrafts ? (
          <p className="liquid-subcard mt-4 rounded-2xl p-4 text-center text-xs font-medium text-slate-500">
            {t(lang, 'fieldDraftsEmpty')}
          </p>
        ) : (
          <div className="mt-3.5 max-h-64 space-y-2 overflow-y-auto pr-1">
            {customPois.map((p) => (
              <div
                key={p.properties.id}
                className="liquid-subcard flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">
                    {p.properties.nome}
                  </div>
                  <div className="text-[11px] tabular-nums text-slate-500">
                    {p.properties.categoria} ·{' '}
                    {p.geometry.coordinates[1].toFixed(5)},{' '}
                    {p.geometry.coordinates[0].toFixed(5)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteCustomPoi(p.properties.id)}
                  className="liquid-interactive ml-2 rounded-full p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {reportList.map((r) => (
              <div
                key={r.trailId}
                className="rounded-2xl border border-amber-200/80 bg-amber-500/10 px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center justify-between font-semibold text-slate-900">
                  <span className="truncate">{r.trailName}</span>
                  <span className="ml-2 rounded-full bg-white/80 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                    {r.status}
                  </span>
                </div>
                {r.note && (
                  <p className="mt-1 text-[11px] text-slate-600">{r.note}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {hasDrafts && (
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={buildGithubIssueUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="liquid-interactive flex items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <ExternalLink className="h-4 w-4" />
              <span>{t(lang, 'fieldSendGithub')}</span>
            </a>

            <button
              type="button"
              onClick={() => downloadJsonFile('pois.geojson', mergedPois)}
              className="liquid-tint-emerald liquid-interactive flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold text-white"
            >
              <Download className="h-4 w-4" />
              <span>{t(lang, 'fieldDownloadGeoJson')}</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="liquid-glass liquid-interactive flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold text-slate-800 hover:bg-white/80"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <ClipboardCopy className="h-4 w-4" />
                )}
                <span>
                  {copied ? t(lang, 'fieldCopied') : t(lang, 'fieldCopyDiff')}
                </span>
              </button>

              <button
                type="button"
                onClick={onClearAll}
                className="liquid-glass liquid-interactive flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50/70"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t(lang, 'fieldClearDrafts')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
