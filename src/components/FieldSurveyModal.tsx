import { useState } from 'react';
import {
  Check,
  ClipboardCopy,
  Download,
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
  lang: Language;
  onClose: () => void;
  onSave: (poi: PoiFeature) => void;
}

export function AddPoiModal({ coords, lang, onClose, onSave }: AddPoiModalProps) {
  const [category, setCategory] = useState<CategoryId>('panchina');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!coords) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = CATEGORIES.find((c) => c.id === category);
    const fallbackName = lang === 'en' ? cat?.label_en : cat?.label_it;
    const today = new Date().toISOString().slice(0, 10);

    const newPoi: PoiFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          Number(coords[0].toFixed(6)),
          Number(coords[1].toFixed(6)),
        ],
      },
      properties: {
        id: `field-${Date.now()}`,
        nome: name.trim() || fallbackName || 'Nuovo POI',
        categoria: category,
        descrizione: description.trim() || 'Rilevato durante sopralluogo sul campo.',
        aggiornato_il: today,
        fonte: 'Sopralluogo',
      },
    };

    onSave(newPoi);
    setName('');
    setDescription('');
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-3 backdrop-blur-xs sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-900">
              {t(lang, 'fieldNewPoiTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'close')}
            className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2 rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-mono text-slate-600">
          {t(lang, 'fieldCoords')}: {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
        </div>

        <div className="mt-3">
          <label className="text-xs font-semibold text-slate-700">
            {t(lang, 'fieldCategory')}
          </label>
          <div className="mt-1.5 grid max-h-36 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 text-left text-[11px] font-medium transition ${
                  category === cat.id
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
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

        <div className="mt-3">
          <label className="text-xs font-semibold text-slate-700">
            {t(lang, 'fieldPoiName')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(lang, 'fieldPoiNamePlaceholder')}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
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
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="mt-4 w-full rounded-2xl bg-emerald-800 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900"
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

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-3 backdrop-blur-xs sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            {t(lang, 'fieldDraftsTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'close')}
            className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!hasDrafts ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-500">
            {t(lang, 'fieldDraftsEmpty')}
          </p>
        ) : (
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {customPois.map((p) => (
              <div
                key={p.properties.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">
                    {p.properties.nome}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {p.properties.categoria} ·{' '}
                    {p.geometry.coordinates[1].toFixed(5)},{' '}
                    {p.geometry.coordinates[0].toFixed(5)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteCustomPoi(p.properties.id)}
                  className="ml-2 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {reportList.map((r) => (
              <div
                key={r.trailId}
                className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between font-semibold text-slate-900">
                  <span className="truncate">{r.trailName}</span>
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] uppercase">
                    {r.status}
                  </span>
                </div>
                {r.note && (
                  <p className="mt-0.5 text-[11px] text-slate-600">{r.note}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {hasDrafts && (
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => downloadJsonFile('pois.geojson', mergedPois)}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-800 py-2.5 text-xs font-semibold text-white hover:bg-emerald-900"
            >
              <Download className="h-4 w-4" />
              <span>{t(lang, 'fieldDownloadGeoJson')}</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
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
