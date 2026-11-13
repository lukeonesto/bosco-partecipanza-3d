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
  isAdmin: boolean;
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
  isAdmin,
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
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {!isOnline && (
        <div className="liquid-tint-amber animate-liquid-pop pointer-events-auto mx-auto flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold text-white">
          <WifiOff className="h-3.5 w-3.5" />
          <span>{t(lang, 'offlineBanner')}</span>
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 180)}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t(lang, 'searchPlaceholder')}
            className="liquid-glass w-full rounded-full py-2.5 pl-10 pr-9 text-sm font-medium text-slate-900 placeholder:text-slate-500/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/35"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label={t(lang, 'close')}
              className="liquid-interactive absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-900/10 p-1 text-slate-600 hover:bg-slate-900/15 hover:text-slate-900"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {focused && q.length > 0 && (
            <div className="liquid-glass-elevated animate-liquid-pop absolute left-0 right-0 top-full mt-2 max-h-64 overflow-y-auto rounded-3xl p-1.5">
              {matchedPois.length === 0 && matchedTrails.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs font-medium text-slate-500">
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
                      className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition hover:bg-white/65"
                    >
                      <span className="font-semibold text-slate-800">
                        {getLocalizedText(lang, p.properties.nome, p.properties.nome_en)}
                      </span>
                      <span className="ml-2 rounded-full bg-slate-900/6 px-2 py-0.5 text-[11px] font-medium text-slate-500">
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
                        className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition hover:bg-amber-50/70"
                      >
                        <span className="font-semibold text-amber-950">
                          {getLocalizedText(lang, tr.properties.nome, tr.properties.nome_en)}
                        </span>
                        <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800">
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
            className={`liquid-interactive flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-semibold ${
              is3D
                ? 'liquid-tint-emerald text-white'
                : 'liquid-glass text-slate-800 hover:bg-white/80'
            }`}
          >
            <Mountain className="h-4 w-4" />
            <span>{is3D ? t(lang, 'view3D') : t(lang, 'view2D')}</span>
          </button>

          {showReliefMenu && (
            <div className="liquid-glass-elevated animate-liquid-pop absolute right-0 top-full mt-2 w-56 rounded-3xl p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-tight text-slate-800">
                  {t(lang, 'reliefLabel')}
                </span>
                <button
                  type="button"
                  onClick={onToggle3D}
                  className={`liquid-interactive rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    is3D
                      ? 'liquid-tint-emerald text-white'
                      : 'liquid-subcard text-slate-700'
                  }`}
                >
                  {is3D ? t(lang, 'view3D') : t(lang, 'view2D')}
                </button>
              </div>
              {is3D && (
                <div className="liquid-subcard rounded-2xl p-2.5">
                  <div className="mb-1.5 flex justify-between text-[11px] font-medium text-slate-500 tabular-nums">
                    <span>1x</span>
                    <span className="font-bold text-emerald-700">
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
                    className="liquid-slider w-full"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Field Survey Mode Button (Admin only) */}
        {isAdmin && (
          <button
            type="button"
            onClick={onToggleFieldMode}
            aria-label={t(lang, 'fieldModeTitle')}
            title={t(lang, 'fieldModeTitle')}
            className={`liquid-interactive relative flex items-center justify-center rounded-full p-2.5 ${
              fieldMode
                ? 'liquid-tint-amber text-white'
                : 'liquid-glass text-slate-800 hover:bg-white/80'
            }`}
          >
            <ClipboardEdit className="h-4 w-4" />
            {fieldDraftCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold tabular-nums text-white shadow-sm ring-2 ring-white/85">
                {fieldDraftCount}
              </span>
            )}
          </button>
        )}

        {/* Offline Mode Button */}
        <button
          type="button"
          onClick={onOpenOfflineModal}
          aria-label={t(lang, 'offlineModeTitle')}
          title={t(lang, 'offlineModeTitle')}
          className={`liquid-interactive flex items-center justify-center rounded-full p-2.5 ${
            offlineReady
              ? 'liquid-glass text-emerald-700 ring-1 ring-emerald-500/35'
              : 'liquid-glass text-slate-800 hover:bg-white/80'
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
          className="liquid-glass liquid-interactive flex items-center gap-1 rounded-full px-3 py-2.5 text-xs font-bold uppercase text-slate-800 hover:bg-white/80"
          aria-label="Switch language"
        >
          <Globe className="h-3.5 w-3.5 text-emerald-700" />
          <span>{lang}</span>
        </button>
      </div>
    </div>
  );
}
