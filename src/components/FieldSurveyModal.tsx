import { useEffect, useState } from 'react';
import {
  Check,
  CloudUpload,
  Download,
  KeyRound,
  Lock,
  MapPin,
  MapPinPlus,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_MAP } from '../data/categories';
import { t } from '../i18n';
import {
  CategoryId,
  Language,
  PoiCollection,
  PoiFeature,
} from '../types';
import {
  downloadJsonFile,
  publishPoisToSharedStorage,
} from '../utils/fieldStorage';
import { getSavedGithubToken, saveGithubToken } from '../utils/adminAuth';

interface AddPoiModalProps {
  coords: [number, number] | null;
  editingPoi?: PoiFeature | null;
  lang: Language;
  onClose: () => void;
  onSave: (poi: PoiFeature) => void;
  onDelete?: (id: string) => void;
}

export function AddPoiModal({
  coords,
  editingPoi,
  lang,
  onClose,
  onSave,
  onDelete,
}: AddPoiModalProps) {
  const [category, setCategory] = useState<CategoryId>('panchina');
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [latStr, setLatStr] = useState('');
  const [lonStr, setLonStr] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    if (editingPoi) {
      setCategory(editingPoi.properties.categoria);
      setName(editingPoi.properties.nome);
      setNameEn(editingPoi.properties.nome_en || '');
      setDescription(editingPoi.properties.descrizione);
      setDescriptionEn(editingPoi.properties.descrizione_en || '');
      setLonStr(editingPoi.geometry.coordinates[0].toFixed(6));
      setLatStr(editingPoi.geometry.coordinates[1].toFixed(6));
    } else if (coords) {
      setCategory('panchina');
      setName('');
      setNameEn('');
      setDescription('');
      setDescriptionEn('');
      setLonStr(coords[0].toFixed(6));
      setLatStr(coords[1].toFixed(6));
    }
  }, [editingPoi, coords]);

  const effectiveCoords = editingPoi?.geometry.coordinates ?? coords;
  if (!effectiveCoords) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = CATEGORIES.find((c) => c.id === category);
    const fallbackName = lang === 'en' ? cat?.label_en : cat?.label_it;
    const today = new Date().toISOString().slice(0, 10);

    const parsedLon = parseFloat(lonStr);
    const parsedLat = parseFloat(latStr);
    const finalLon = Number.isFinite(parsedLon)
      ? Number(parsedLon.toFixed(6))
      : Number(effectiveCoords[0].toFixed(6));
    const finalLat = Number.isFinite(parsedLat)
      ? Number(parsedLat.toFixed(6))
      : Number(effectiveCoords[1].toFixed(6));

    const savedPoi: PoiFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [finalLon, finalLat],
      },
      properties: {
        ...(editingPoi?.properties ?? {}),
        id: editingPoi?.properties.id ?? `poi-admin-${Date.now()}`,
        nome: name.trim() || fallbackName || 'Nuovo POI',
        ...(nameEn.trim() ? { nome_en: nameEn.trim() } : {}),
        categoria: category,
        descrizione:
          description.trim() || 'Punto di interesse del Bosco della Partecipanza.',
        ...(descriptionEn.trim() ? { descrizione_en: descriptionEn.trim() } : {}),
        aggiornato_il: today,
        fonte: editingPoi?.properties.fonte || 'Admin',
      },
    };

    onSave(savedPoi);
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="liquid-glass-elevated animate-liquid-sheet max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[32px] p-5"
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

        {/* Editable Coordinates */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-semibold text-slate-600">
              {t(lang, 'fieldLat')}
            </label>
            <input
              type="number"
              step="0.000001"
              value={latStr}
              onChange={(e) => setLatStr(e.target.value)}
              className="liquid-input mt-1 w-full rounded-2xl px-3 py-1.5 font-mono text-xs tabular-nums text-slate-900"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600">
              {t(lang, 'fieldLon')}
            </label>
            <input
              type="number"
              step="0.000001"
              value={lonStr}
              onChange={(e) => setLonStr(e.target.value)}
              className="liquid-input mt-1 w-full rounded-2xl px-3 py-1.5 font-mono text-xs tabular-nums text-slate-900"
            />
          </div>
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

        <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
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
          <div>
            <label className="text-xs font-semibold text-slate-700">
              {t(lang, 'fieldPoiNameEn')}
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Bench near canal"
              className="liquid-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="mt-2.5">
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

        <div className="mt-2.5">
          <label className="text-xs font-semibold text-slate-700">
            {t(lang, 'fieldPoiDescEn')}
          </label>
          <textarea
            rows={2}
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            placeholder="Optional English description..."
            className="liquid-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          {editingPoi && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                onDelete(editingPoi.properties.id);
              }}
              className={`liquid-interactive flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold ${
                confirmDelete
                  ? 'liquid-tint-red text-white'
                  : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              <span>
                {confirmDelete
                  ? `${t(lang, 'fieldDeletePoiBtn')}?`
                  : t(lang, 'fieldDeletePoiBtn')}
              </span>
            </button>
          )}

          <button
            type="submit"
            className="liquid-tint-emerald liquid-interactive flex-1 rounded-full py-2.5 text-sm font-semibold text-white"
          >
            {t(lang, 'fieldSavePoi')}
          </button>
        </div>
      </form>
    </div>
  );
}

interface AdminPoiManagerModalProps {
  open: boolean;
  lang: Language;
  mergedPois: PoiCollection;
  customPois: PoiFeature[];
  deletedPoiIds: string[];
  onClose: () => void;
  onAddNewPoi: () => void;
  onEditPoi: (poi: PoiFeature) => void;
  onDeletePoi: (id: string) => void;
  onFocusPoi: (poi: PoiFeature) => void;
  onPublishedSuccess: (publishedPois: PoiCollection) => void;
  onClearAll: () => void;
  onLockAdmin: () => void;
}

export function FieldDraftsModal({
  open,
  lang,
  mergedPois,
  customPois,
  deletedPoiIds,
  onClose,
  onAddNewPoi,
  onEditPoi,
  onDeletePoi,
  onFocusPoi,
  onPublishedSuccess,
  onClearAll,
  onLockAdmin,
}: AdminPoiManagerModalProps) {
  const [filterText, setFilterText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showTokenPrompt, setShowTokenPrompt] = useState(false);
  const [ghToken, setGhToken] = useState(() => getSavedGithubToken());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!open) return null;

  const pendingChangesCount = customPois.length + deletedPoiIds.length;
  const modifiedIds = new Set(customPois.map((p) => p.properties.id));

  const q = filterText.trim().toLowerCase();
  const filteredPois = mergedPois.features.filter((p) => {
    if (!q) return true;
    return (
      p.properties.nome.toLowerCase().includes(q) ||
      p.properties.categoria.toLowerCase().includes(q) ||
      p.properties.descrizione.toLowerCase().includes(q)
    );
  });

  const handlePublish = async (overrideToken?: string) => {
    setPublishing(true);
    setPublishMessage(null);
    const res = await publishPoisToSharedStorage(mergedPois, overrideToken);
    setPublishing(false);

    if (res.ok) {
      setShowTokenPrompt(false);
      setPublishMessage({
        type: 'success',
        text:
          res.mode === 'github'
            ? t(lang, 'adminPublishedGithub')
            : t(lang, 'adminPublishedLocal'),
      });
      onPublishedSuccess(mergedPois);
    } else {
      if (res.needsToken) {
        setShowTokenPrompt(true);
      }
      setPublishMessage({
        type: 'error',
        text: res.error || 'Errore durante il salvataggio',
      });
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center">
      <div className="liquid-glass-elevated animate-liquid-sheet flex max-h-[88vh] w-full max-w-lg flex-col rounded-[32px] p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              {t(lang, 'adminManagerTitle')}
            </h2>
            <p className="text-[11px] font-medium text-slate-500">
              {pendingChangesCount > 0
                ? `${pendingChangesCount} ${t(lang, 'adminUnsavedChanges')}`
                : t(lang, 'adminNoUnsavedChanges')}{' '}
              · {mergedPois.features.length} POI
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onLockAdmin}
              className="liquid-subcard liquid-interactive flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-red-700"
              title={t(lang, 'adminLockBtn')}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>{t(lang, 'adminLockBtn')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t(lang, 'close')}
              className="liquid-interactive rounded-full bg-slate-900/8 p-2 text-slate-600 hover:bg-slate-900/14 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Top action buttons: Add POI + Publish */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onAddNewPoi();
            }}
            className="liquid-tint-amber liquid-interactive flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold text-white"
          >
            <MapPinPlus className="h-4 w-4" />
            <span>{t(lang, 'fieldNewPoiTitle')}</span>
          </button>

          <button
            type="button"
            disabled={publishing}
            onClick={() => handlePublish()}
            className="liquid-tint-emerald liquid-interactive flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            <CloudUpload className="h-4 w-4" />
            <span>
              {publishing ? t(lang, 'adminPublishing') : t(lang, 'adminPublishBtn')}
            </span>
          </button>
        </div>

        {publishMessage && (
          <div
            className={`mt-2.5 flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-semibold ${
              publishMessage.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-900'
                : 'bg-red-500/15 text-red-800'
            }`}
          >
            {publishMessage.type === 'success' && <Check className="h-4 w-4 shrink-0" />}
            <span>{publishMessage.text}</span>
          </div>
        )}

        {showTokenPrompt && (
          <div className="liquid-subcard mt-2.5 rounded-2xl p-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <KeyRound className="h-3.5 w-3.5 text-amber-700" />
              <span>{t(lang, 'adminGithubTokenLabel')}</span>
            </label>
            <div className="mt-2 flex gap-2">
              <input
                type="password"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                placeholder={t(lang, 'adminGithubTokenPlaceholder')}
                className="liquid-input flex-1 rounded-full px-3.5 py-1.5 text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={() => {
                  saveGithubToken(ghToken);
                  handlePublish(ghToken);
                }}
                className="liquid-tint-emerald liquid-interactive rounded-full px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                {t(lang, 'adminGithubTokenSave')}
              </button>
            </div>
          </div>
        )}

        {/* Filter bar for all POIs */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={t(lang, 'adminSearchPoiPlaceholder')}
            className="liquid-input w-full rounded-full py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400"
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Scrollable list of all POIs with Edit & Delete */}
        <div className="mt-2.5 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {filteredPois.map((p) => {
            const cat = CATEGORY_MAP[p.properties.categoria] ?? CATEGORY_MAP.altro;
            const isModified = modifiedIds.has(p.properties.id);
            const isConfirming = confirmDeleteId === p.properties.id;
            return (
              <div
                key={p.properties.id}
                className={`liquid-subcard flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-xs ${
                  isModified ? 'ring-1 ring-amber-400/80' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onFocusPoi(p);
                    onClose();
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{cat.emoji}</span>
                    <span className="truncate font-semibold text-slate-900">
                      {p.properties.nome}
                    </span>
                    {isModified && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-900">
                        Modificato
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] tabular-nums text-slate-500">
                    {p.properties.categoria} · {p.geometry.coordinates[1].toFixed(5)},{' '}
                    {p.geometry.coordinates[0].toFixed(5)}
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditPoi(p);
                    }}
                    className="liquid-interactive rounded-full bg-amber-500/15 p-2 text-amber-900 hover:bg-amber-500/25"
                    title={t(lang, 'fieldEditPoiBtn')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isConfirming) {
                        setConfirmDeleteId(p.properties.id);
                        return;
                      }
                      onDeletePoi(p.properties.id);
                      setConfirmDeleteId(null);
                    }}
                    className={`liquid-interactive rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${
                      isConfirming
                        ? 'liquid-tint-red text-white'
                        : 'bg-red-500/10 text-red-700 hover:bg-red-500/20'
                    }`}
                    title={t(lang, 'fieldDeletePoiBtn')}
                  >
                    {isConfirming ? (
                      `${t(lang, 'fieldDeletePoiBtn')}?`
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer utilities: Download GeoJSON & Revert unsaved */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900/10 pt-3">
          <button
            type="button"
            onClick={() => downloadJsonFile('pois.geojson', mergedPois)}
            className="liquid-glass liquid-interactive flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-white/80"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t(lang, 'fieldDownloadGeoJson')}</span>
          </button>

          {pendingChangesCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="liquid-glass liquid-interactive flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50/70"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t(lang, 'fieldClearDrafts')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
