import { useState } from 'react';
import { Search, X, Globe, Mountain, WifiOff, Download, CheckCircle2, ClipboardEdit } from 'lucide-react';
import { getLocalizedText, t } from '../i18n';
import { Language, PoiFeature, TrailFeature, SelectedItem } from '../types';

interface SearchBarProps {
  lang: Language;
  onToggleLang: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  pois: PoiFeature[];
  trails: TrailFeature[];
  onSelectResult: (item: SelectedItem, coords: [number, number]) => void;
  is3D: boolean;
  onToggle3D: () => void;
  exaggeration: number;
  onChangeExaggeration: (val: number) => void;
  isOnline: boolean;
  offlineReady: boolean;
  onOpenOfflineModal: () => void;
  fieldMode: boolean;
  onToggleFieldMode: () => void;
  fieldDraftCount: number;
}

export function SearchBar({
  lang,
  onToggleLang,
  searchQuery,
  onSearchChange,
  pois,
  trails,
  onSelectResult,
  is3D,
  onToggle3D,
  exaggeration,
  onChangeExaggeration,
  isOnline,
  offlineReady,
  onOpenOfflineModal,
  fieldMode,
  onToggleFieldMode,
  fieldDraftCount,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const [showReliefMenu, setShowReliefMenu] = useState(false);

  const q = searchQuery.trim().toLowerCase();
  const matchedPois = q
    ? pois
        .filter((p) => {
          const name = getLocalizedText(lang, p.properties.nome, p.properties.nome_en).toLowerCase();
          return name.includes(q);
        })
        .slice(0, 6)
    : [];

  const matchedTrails = q
    ? trails
        .filter((tr) => {
          const name = getLocalizedText(lang, tr.properties.nome, tr.properties.nome_en).toLowerCase();
          return name.includes(q);
        })
        .slice(0, 4)
    : [];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-1.5 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {!isOnline && (
        <div className="pointer-events-auto mx-auto flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white shadow-md">
          <WifiOff className="h-3.5 w-3.5" />
          <span>{t(lang, 'offlineBanner')}</span>
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 180)}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t(lang, 'searchPlaceholder')}
            className="w-full rounded-2xl border border-slate-200/80 bg-white/95 py-2.5 pl-9 pr-9 text-sm text-slate-900 shadow-lg backdrop-blur-md placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label={t(lang, 'close')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {focused && q.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-md">
              {matchedPois.length === 0 && matchedTrails.length === 0 ? (
                <div className="px-3 py-2.5 text-center text-xs text-slate-500">
                  {t(lang, 'noResults')}
                </div>
              ) : (
                <>
                  {matchedPois.map((p) => (
                    <button
                      key={p.properties.id}
                      type="button"
                      onMouseDown={() => {
                        onSelectResult(
                          { kind: 'poi', feature: p },
                          p.geometry.coordinates
                        );
                        setFocused(false);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-emerald-50"
                    >
                      <span className="font-medium text-slate-800">
                        {getLocalizedText(lang, p.properties.nome, p.properties.nome_en)}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        {p.properties.categoria}
                      </span>
                    </button>
                  ))}
                  {matchedTrails.map((tr) => {
                    const mid =
                      tr.geometry.coordinates[
                        Math.floor(tr.geometry.coordinates.length / 2)
                      ];
                    return (
                      <button
                        key={tr.properties.id}
                        type="button"
                        onMouseDown={() => {
                          onSelectResult({ kind: 'trail', feature: tr }, mid);
                          setFocused(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-amber-50"
                      >
                        <span className="font-medium text-amber-900">
                          {getLocalizedText(lang, tr.properties.nome, tr.properties.nome_en)}
                        </span>
                        <span className="ml-2 text-xs text-amber-600">
                          {tr.properties.lunghezza_m} m
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* 3D Relief Toggle & Exaggeration */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReliefMenu((v) => !v)}
            className={`flex items-center gap-1 rounded-2xl border px-3 py-2.5 text-xs font-semibold shadow-lg backdrop-blur-md transition ${
              is3D
                ? 'border-emerald-700 bg-emerald-800 text-white'
                : 'border-slate-200 bg-white/95 text-slate-700'
            }`}
          >
            <Mountain className="h-4 w-4" />
            <span>{is3D ? t(lang, 'view3D') : t(lang, 'view2D')}</span>
          </button>

          {showReliefMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  {t(lang, 'reliefLabel')}
                </span>
                <button
                  type="button"
                  onClick={onToggle3D}
                  className="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                >
                  {is3D ? t(lang, 'view3D') : t(lang, 'view2D')}
                </button>
              </div>
              {is3D && (
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>1x</span>
                    <span className="font-semibold text-emerald-700">
                      {exaggeration.toFixed(1)}x
                    </span>
                    <span>8x</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    step={0.5}
                    value={exaggeration}
                    onChange={(e) => onChangeExaggeration(parseFloat(e.target.value))}
                    className="mt-1 w-full accent-emerald-700"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Field Survey Mode Button */}
        <button
          type="button"
          onClick={onToggleFieldMode}
          aria-label={t(lang, 'fieldModeTitle')}
          title={t(lang, 'fieldModeTitle')}
          className={`relative flex items-center justify-center rounded-2xl border p-2.5 shadow-lg backdrop-blur-md transition ${
            fieldMode
              ? 'border-amber-600 bg-amber-600 text-white'
              : 'border-slate-200 bg-white/95 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ClipboardEdit className="h-4 w-4" />
          {fieldDraftCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {fieldDraftCount}
            </span>
          )}
        </button>

        {/* Offline Mode Button */}
        <button
          type="button"
          onClick={onOpenOfflineModal}
          aria-label={t(lang, 'offlineModeTitle')}
          title={t(lang, 'offlineModeTitle')}
          className={`flex items-center justify-center rounded-2xl border p-2.5 shadow-lg backdrop-blur-md transition ${
            offlineReady
              ? 'border-emerald-200 bg-emerald-50/95 text-emerald-700 hover:bg-emerald-100'
              : 'border-slate-200 bg-white/95 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {offlineReady ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </button>

        {/* Language Toggle */}
        <button
          type="button"
          onClick={onToggleLang}
          className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 px-2.5 py-2.5 text-xs font-bold uppercase text-slate-700 shadow-lg backdrop-blur-md hover:bg-slate-50"
          aria-label="Switch language"
        >
          <Globe className="h-3.5 w-3.5 text-emerald-700" />
          <span>{lang}</span>
        </button>
      </div>
    </div>
  );
}
