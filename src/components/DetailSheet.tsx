import { useEffect, useState } from 'react';
import {
  X,
  Navigation,
  Clock,
  Ruler,
  Calendar,
  WifiOff,
  ExternalLink,
  AlertTriangle,
  Pencil,
} from 'lucide-react';
import { CATEGORY_MAP, getCategoryLabel } from '../data/categories';
import { getLocalizedText, t } from '../i18n';
import { Language, PoiFeature, SelectedItem, TrailReport, TrailStatus } from '../types';
import {
  formatDistance,
  formatDuration,
  haversineDistanceM,
} from '../utils/geo';

interface DetailSheetProps {
  item: SelectedItem | null;
  lang: Language;
  userLocation: [number, number] | null;
  isOnline: boolean;
  fieldMode: boolean;
  trailReport?: TrailReport;
  onSaveTrailReport: (report: TrailReport) => void;
  onEditPoi?: (poi: PoiFeature) => void;
  onClose: () => void;
}

export function DetailSheet({
  item,
  lang,
  userLocation,
  isOnline,
  fieldMode,
  trailReport,
  onSaveTrailReport,
  onEditPoi,
  onClose,
}: DetailSheetProps) {
  const [statusDraft, setStatusDraft] = useState<TrailStatus>(
    trailReport?.status ?? 'aperto'
  );
  const [noteDraft, setNoteDraft] = useState(trailReport?.note ?? '');

  useEffect(() => {
    setStatusDraft(trailReport?.status ?? 'aperto');
    setNoteDraft(trailReport?.note ?? '');
  }, [trailReport, item]);

  if (!item) return null;

  if (item.kind === 'poi') {
    const { properties, geometry } = item.feature;
    const cat = CATEGORY_MAP[properties.categoria] ?? CATEGORY_MAP.altro;
    const title = getLocalizedText(lang, properties.nome, properties.nome_en);
    const description = getLocalizedText(
      lang,
      properties.descrizione,
      properties.descrizione_en
    );
    const dist = userLocation
      ? haversineDistanceM(userLocation, geometry.coordinates)
      : null;
    const photos = properties.foto ?? [];
    const [lon, lat] = geometry.coordinates;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;

    return (
      <div className="liquid-glass-elevated animate-liquid-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto max-w-xl rounded-t-[32px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:bottom-3 sm:rounded-[32px]">
        <div className="mx-auto mb-3.5 h-1.5 w-10 rounded-full bg-slate-900/15" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm ring-1 ring-white/30"
              style={{ backgroundColor: cat.color }}
            >
              <span>{cat.emoji}</span>
              <span>{getCategoryLabel(properties.categoria, lang)}</span>
            </span>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-900">
              {title}
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

        {dist !== null && (
          <div className="liquid-subcard mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums text-blue-700">
            <Navigation className="h-3.5 w-3.5" />
            <span>
              {t(lang, 'distanceFromYou')}: {formatDistance(dist, lang)}
            </span>
          </div>
        )}

        <p className="mt-3 text-sm leading-relaxed text-slate-700">{description}</p>

        {/* Photos (online only as requested) */}
        {photos.length > 0 && (
          <div className="mt-3.5">
            {isOnline ? (
              <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
                {photos.map((photo, idx) => (
                  <img
                    key={idx}
                    src={photo.url}
                    alt={
                      getLocalizedText(
                        lang,
                        photo.didascalia || title,
                        photo.didascalia_en
                      )
                    }
                    loading="lazy"
                    className="h-32 w-48 shrink-0 rounded-2xl object-cover shadow-md ring-1 ring-white/60"
                  />
                ))}
              </div>
            ) : (
              <div className="liquid-subcard flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-slate-600">
                <WifiOff className="h-4 w-4 shrink-0" />
                <span>{t(lang, 'onlineOnlyPhotos')}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900/8 pt-3.5 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {t(lang, 'lastUpdated')}: {properties.aggiornato_il}
            </span>
            <span>
              {t(lang, 'source')}: {properties.fonte}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {fieldMode && onEditPoi && (
              <button
                type="button"
                onClick={() => onEditPoi(item.feature)}
                className="liquid-interactive inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{t(lang, 'fieldEditPoiBtn')}</span>
              </button>
            )}

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="liquid-tint-emerald liquid-interactive inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white"
            >
              <span>{t(lang, 'openInMaps')}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Trail detail
  const { properties } = item.feature;
  const title = getLocalizedText(lang, properties.nome, properties.nome_en);
  const description = getLocalizedText(
    lang,
    properties.descrizione,
    properties.descrizione_en
  );

  return (
    <div className="liquid-glass-elevated animate-liquid-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto max-w-xl rounded-t-[32px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:bottom-3 sm:rounded-[32px]">
      <div className="mx-auto mb-3.5 h-1.5 w-10 rounded-full bg-slate-900/15" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="liquid-tint-amber inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white">
            🥾 {t(lang, 'trailLabel')}
          </span>
          <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-900">
            {title}
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

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <div className="liquid-subcard rounded-2xl p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-amber-800">
            <Ruler className="h-3.5 w-3.5" />
            <span>{t(lang, 'length')}</span>
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-amber-950">
            {formatDistance(properties.lunghezza_m, lang)}
          </div>
        </div>

        <div className="liquid-subcard rounded-2xl p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-amber-800">
            <Clock className="h-3.5 w-3.5" />
            <span>{t(lang, 'duration')}</span>
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-amber-950">
            {formatDuration(properties.tempo_percorrenza_min, lang)}
          </div>
        </div>

        <div className="liquid-subcard rounded-2xl p-2.5 text-center">
          <div className="text-[11px] font-medium text-slate-500">
            {t(lang, 'surface')}
          </div>
          <div className="mt-0.5 truncate text-xs font-bold text-slate-900">
            {properties.fondo || '-'}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-700">{description}</p>

      {trailReport && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-medium ${
            trailReport.status === 'chiuso'
              ? 'border-red-200/80 bg-red-500/10 text-red-800'
              : trailReport.status === 'attenzione'
                ? 'border-amber-200/80 bg-amber-500/10 text-amber-800'
                : 'border-emerald-200/80 bg-emerald-500/10 text-emerald-800'
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-bold">
              {t(lang, 'trailStatusLabel')}:{' '}
              {trailReport.status === 'chiuso'
                ? t(lang, 'trailStatusClosed')
                : trailReport.status === 'attenzione'
                  ? t(lang, 'trailStatusCaution')
                  : t(lang, 'trailStatusOpen')}
            </div>
            {trailReport.note && <div className="mt-0.5">{trailReport.note}</div>}
          </div>
        </div>
      )}

      {fieldMode && (
        <div className="liquid-subcard mt-3.5 rounded-2xl p-3.5">
          <div className="text-xs font-semibold text-slate-800">
            {t(lang, 'trailStatusLabel')}
          </div>
          <div className="mt-2 flex gap-1.5">
            {(['aperto', 'attenzione', 'chiuso'] as TrailStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusDraft(st)}
                className={`liquid-interactive flex-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${
                  statusDraft === st
                    ? st === 'chiuso'
                      ? 'liquid-tint-red text-white'
                      : st === 'attenzione'
                        ? 'liquid-tint-amber text-white'
                        : 'liquid-tint-emerald text-white'
                    : 'liquid-glass text-slate-700'
                }`}
              >
                {st === 'chiuso'
                  ? t(lang, 'trailStatusClosed')
                  : st === 'attenzione'
                    ? t(lang, 'trailStatusCaution')
                    : t(lang, 'trailStatusOpen')}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex gap-2">
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder={t(lang, 'trailStatusNotePlaceholder')}
              className="liquid-input flex-1 rounded-full px-3.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() =>
                onSaveTrailReport({
                  trailId: properties.id,
                  trailName: title,
                  status: statusDraft,
                  note: noteDraft.trim(),
                  updatedAt: new Date().toISOString(),
                })
              }
              className="liquid-tint-emerald liquid-interactive rounded-full px-4 py-1.5 text-xs font-semibold text-white"
            >
              {t(lang, 'trailStatusSave')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-900/8 pt-3.5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {t(lang, 'lastUpdated')}: {properties.aggiornato_il}
        </span>
        <span>
          {t(lang, 'source')}: {properties.fonte}
        </span>
      </div>
    </div>
  );
}
