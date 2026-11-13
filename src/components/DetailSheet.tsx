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
} from 'lucide-react';
import { CATEGORY_MAP, getCategoryLabel } from '../data/categories';
import { getLocalizedText, t } from '../i18n';
import { Language, SelectedItem, TrailReport, TrailStatus } from '../types';
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
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto max-w-xl rounded-t-3xl border-t border-slate-200 bg-white/98 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-md">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: cat.color }}
            >
              <span>{cat.emoji}</span>
              <span>{getCategoryLabel(properties.categoria, lang)}</span>
            </span>
            <h2 className="mt-1.5 text-lg font-bold text-slate-900">{title}</h2>
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

        {dist !== null && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            <Navigation className="h-3.5 w-3.5" />
            <span>
              {t(lang, 'distanceFromYou')}: {formatDistance(dist, lang)}
            </span>
          </div>
        )}

        <p className="mt-3 text-sm leading-relaxed text-slate-700">{description}</p>

        {/* Photos (online only as requested) */}
        {photos.length > 0 && (
          <div className="mt-3">
            {isOnline ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
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
                    className="h-32 w-48 shrink-0 rounded-xl object-cover"
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500">
                <WifiOff className="h-4 w-4 shrink-0" />
                <span>{t(lang, 'onlineOnlyPhotos')}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {t(lang, 'lastUpdated')}: {properties.aggiornato_il}
            </span>
            <span>
              {t(lang, 'source')}: {properties.fonte}
            </span>
          </div>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-3 py-1.5 font-semibold text-white hover:bg-emerald-900"
          >
            <span>{t(lang, 'openInMaps')}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
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
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto max-w-xl rounded-t-3xl border-t border-slate-200 bg-white/98 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-md">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-700 px-2.5 py-0.5 text-xs font-semibold text-white">
            🥾 {t(lang, 'trailLabel')}
          </span>
          <h2 className="mt-1.5 text-lg font-bold text-slate-900">{title}</h2>
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

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-amber-50 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[11px] text-amber-800">
            <Ruler className="h-3.5 w-3.5" />
            <span>{t(lang, 'length')}</span>
          </div>
          <div className="mt-0.5 text-sm font-bold text-amber-950">
            {formatDistance(properties.lunghezza_m, lang)}
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[11px] text-amber-800">
            <Clock className="h-3.5 w-3.5" />
            <span>{t(lang, 'duration')}</span>
          </div>
          <div className="mt-0.5 text-sm font-bold text-amber-950">
            {formatDuration(properties.tempo_percorrenza_min, lang)}
          </div>
        </div>

        <div className="rounded-xl bg-slate-100 p-2.5 text-center">
          <div className="text-[11px] text-slate-600">{t(lang, 'surface')}</div>
          <div className="mt-0.5 truncate text-xs font-semibold text-slate-900">
            {properties.fondo || '-'}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-700">{description}</p>

      {trailReport && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
            trailReport.status === 'chiuso'
              ? 'bg-red-50 text-red-800'
              : trailReport.status === 'attenzione'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-emerald-50 text-emerald-800'
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
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-700">
            {t(lang, 'trailStatusLabel')}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {(['aperto', 'attenzione', 'chiuso'] as TrailStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusDraft(st)}
                className={`flex-1 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition ${
                  statusDraft === st
                    ? st === 'chiuso'
                      ? 'border-red-600 bg-red-600 text-white'
                      : st === 'attenzione'
                        ? 'border-amber-500 bg-amber-500 text-white'
                        : 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
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
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder={t(lang, 'trailStatusNotePlaceholder')}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
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
              className="rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
            >
              {t(lang, 'trailStatusSave')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
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
