import { useEffect, useMemo, useState } from 'react';
import { Compass, LocateFixed, MapPinPlus, Navigation2, X } from 'lucide-react';
import { CATEGORIES } from './data/categories';
import { t } from './i18n';
import {
  CategoryId,
  Language,
  PoiCollection,
  PoiFeature,
  SelectedItem,
  TrailCollection,
  TrailReport,
} from './types';
import { formatDistance } from './utils/geo';
import {
  buildTrailGraph,
  findNearestPoiAlongTrails,
  NearestRouteResult,
} from './utils/trailRouter';
import { getOfflineStatus } from './utils/offlineManager';
import {
  clearFieldDrafts,
  loadCustomPois,
  loadTrailReports,
  mergePoisWithCustom,
  saveCustomPois,
  saveTrailReports,
} from './utils/fieldStorage';
import { useCompass } from './hooks/useCompass';
import { MapView } from './components/MapView';
import { SearchBar } from './components/SearchBar';
import { CategoryFilterBar } from './components/CategoryFilterBar';
import { DetailSheet } from './components/DetailSheet';
import { OfflineModal } from './components/OfflineModal';
import { AddPoiModal, FieldDraftsModal } from './components/FieldSurveyModal';

const EMPTY_POIS: PoiCollection = { type: 'FeatureCollection', features: [] };
const EMPTY_TRAILS: TrailCollection = { type: 'FeatureCollection', features: [] };
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function App() {
  const [lang, setLang] = useState<Language>('it');
  const [pois, setPois] = useState<PoiCollection>(EMPTY_POIS);
  const [trails, setTrails] = useState<TrailCollection>(EMPTY_TRAILS);
  const [boundary, setBoundary] = useState<GeoJSON.FeatureCollection>(EMPTY_FC);

  const [activeCategory, setActiveCategory] = useState<CategoryId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTrails, setShowTrails] = useState(true);
  const [is3D, setIs3D] = useState(true);
  const [exaggeration, setExaggeration] = useState(4.0);

  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [gpsWatching, setGpsWatching] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [showNearestPicker, setShowNearestPicker] = useState(false);
  const [nearestTarget, setNearestTarget] = useState<NearestRouteResult | null>(null);

  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  const [fieldMode, setFieldMode] = useState(false);
  const [customPois, setCustomPois] = useState<PoiFeature[]>(() => loadCustomPois());
  const [trailReports, setTrailReports] = useState<Record<string, TrailReport>>(() =>
    loadTrailReports()
  );
  const [draftPoiCoords, setDraftPoiCoords] = useState<[number, number] | null>(null);
  const [editingPoi, setEditingPoi] = useState<PoiFeature | null>(null);
  const [showFieldDrafts, setShowFieldDrafts] = useState(false);

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const {
    compassEnabled,
    heading: compassHeading,
    compassError,
    toggleCompass,
    disableCompass,
    clearCompassError,
  } = useCompass(t(lang, 'compassUnsupported'));

  // Load GeoJSON data
  useEffect(() => {
    Promise.all([
      fetch('/data/pois.geojson').then((r) => r.json()),
      fetch('/data/trails.geojson').then((r) => r.json()),
      fetch('/data/boundary.geojson').then((r) => r.json()),
    ])
      .then(([poisData, trailsData, boundaryData]) => {
        setPois(poisData);
        setTrails(trailsData);
        setBoundary(boundaryData);
      })
      .catch((err) => {
        console.error('Failed to load GeoJSON data:', err);
      });
  }, []);

  // Online / Offline listeners
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Check initial offline pack status
  useEffect(() => {
    getOfflineStatus()
      .then((s) => setOfflineReady(s.isComplete))
      .catch(() => {});
  }, []);

  // Build trail routing graph once trails load
  const trailGraph = useMemo(
    () => buildTrailGraph(trails.features),
    [trails]
  );

  const mergedPois = useMemo(
    () => mergePoisWithCustom(pois, customPois),
    [pois, customPois]
  );

  const closedTrailIds = useMemo(
    () =>
      Object.values(trailReports)
        .filter((r) => r.status === 'chiuso')
        .map((r) => r.trailId),
    [trailReports]
  );

  const fieldDraftCount = customPois.length + Object.keys(trailReports).length;

  // Category counts for chips
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of mergedPois.features) {
      counts[p.properties.categoria] = (counts[p.properties.categoria] || 0) + 1;
    }
    return counts;
  }, [mergedPois]);

  // GPS tracking
  const startGps = (centerOnFix = true) => {
    if (!('geolocation' in navigator)) {
      setGpsError(t(lang, 'gpsError'));
      return;
    }
    setGpsError(null);
    setGpsWatching(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [
          pos.coords.longitude,
          pos.coords.latitude,
        ];
        setUserLocation(coords);
        setUserAccuracy(Math.round(pos.coords.accuracy));
        if (centerOnFix) {
          setFlyToCoords([...coords]);
        }
      },
      () => {
        setGpsError(t(lang, 'gpsError'));
        setGpsWatching(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  useEffect(() => {
    if (!gpsWatching || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation([pos.coords.longitude, pos.coords.latitude]);
        setUserAccuracy(Math.round(pos.coords.accuracy));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsWatching]);

  const applyNearestResult = (coords: [number, number], category: CategoryId) => {
    const res = findNearestPoiAlongTrails(
      coords,
      mergedPois.features,
      trailGraph,
      category
    );
    if (res) {
      setNearestTarget(res);
      setSelectedItem({ kind: 'poi', feature: res.poi });
      setFlyToCoords([...res.poi.geometry.coordinates]);
    } else {
      setGpsError(t(lang, 'noPoiInCategory'));
    }
  };

  const handleFindNearest = (category: CategoryId) => {
    setShowNearestPicker(false);
    if (!userLocation) {
      startGps(false);
      // Fallback: if GPS isn't ready yet, notify user
      if (!('geolocation' in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [
            pos.coords.longitude,
            pos.coords.latitude,
          ];
          setUserLocation(coords);
          applyNearestResult(coords, category);
        },
        () => setGpsError(t(lang, 'gpsError')),
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return;
    }

    applyNearestResult(userLocation, category);
  };

  const handleSaveCustomPoi = (savedPoi: PoiFeature) => {
    const exists = customPois.some((p) => p.properties.id === savedPoi.properties.id);
    const updated = exists
      ? customPois.map((p) => (p.properties.id === savedPoi.properties.id ? savedPoi : p))
      : [...customPois, savedPoi];
    setCustomPois(updated);
    saveCustomPois(updated);
    setDraftPoiCoords(null);
    setEditingPoi(null);
    setSelectedItem({ kind: 'poi', feature: savedPoi });
  };

  const handleDeleteCustomPoi = (id: string) => {
    const updated = customPois.filter((p) => p.properties.id !== id);
    setCustomPois(updated);
    saveCustomPois(updated);
  };

  const handleSaveTrailReport = (report: TrailReport) => {
    const updated = { ...trailReports, [report.trailId]: report };
    setTrailReports(updated);
    saveTrailReports(updated);
  };

  const handleClearFieldDrafts = () => {
    clearFieldDrafts();
    setCustomPois([]);
    setTrailReports({});
  };

  const handleAddPoiAtGps = () => {
    if (userLocation) {
      setDraftPoiCoords([...userLocation]);
      return;
    }
    if (!('geolocation' in navigator)) {
      setGpsError(t(lang, 'gpsError'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [
          pos.coords.longitude,
          pos.coords.latitude,
        ];
        setUserLocation(coords);
        setDraftPoiCoords(coords);
      },
      () => setGpsError(t(lang, 'gpsError')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100">
      <MapView
        pois={mergedPois}
        trails={trails}
        boundary={boundary}
        activeCategory={activeCategory}
        searchQuery={searchQuery}
        showTrails={showTrails}
        is3D={is3D}
        exaggeration={exaggeration}
        lang={lang}
        userLocation={userLocation}
        userAccuracy={userAccuracy}
        nearestPath={nearestTarget?.pathCoordinates ?? null}
        compassEnabled={compassEnabled}
        compassHeading={compassHeading}
        onDisableCompass={disableCompass}
        fieldMode={fieldMode}
        closedTrailIds={closedTrailIds}
        onMapClickForPoi={(coords) => setDraftPoiCoords(coords)}
        selectedItem={selectedItem}
        onSelectItem={(item) => setSelectedItem(item)}
        flyToCoords={flyToCoords}
      />

      <SearchBar
        lang={lang}
        onToggleLang={() => setLang((l) => (l === 'it' ? 'en' : 'it'))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        pois={mergedPois.features}
        trails={trails.features}
        onSelectResult={(item, coords) => {
          setSelectedItem(item);
          setFlyToCoords([...coords]);
        }}
        is3D={is3D}
        onToggle3D={() => setIs3D((v) => !v)}
        exaggeration={exaggeration}
        onChangeExaggeration={setExaggeration}
        isOnline={isOnline}
        offlineReady={offlineReady}
        onOpenOfflineModal={() => setShowOfflineModal(true)}
        fieldMode={fieldMode}
        onToggleFieldMode={() => setFieldMode((v) => !v)}
        fieldDraftCount={fieldDraftCount}
      />

      <CategoryFilterBar
        lang={lang}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        showTrails={showTrails}
        onToggleTrails={() => setShowTrails((v) => !v)}
        counts={categoryCounts}
      />

      {/* Field Survey Mode Banner */}
      {fieldMode && !selectedItem && (
        <div className="liquid-glass-elevated animate-liquid-pop pointer-events-auto absolute inset-x-3 top-[7.5rem] z-20 mx-auto flex max-w-md flex-wrap items-center justify-between gap-2 rounded-3xl border border-amber-300/60 px-3.5 py-2.5 text-xs text-amber-950">
          <span className="font-semibold tracking-tight">{t(lang, 'fieldModeBanner')}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleAddPoiAtGps}
              className="liquid-tint-amber liquid-interactive flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold text-white"
            >
              <MapPinPlus className="h-3.5 w-3.5" />
              <span>{t(lang, 'fieldAddAtGps')}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFieldDrafts(true)}
              className="liquid-subcard liquid-interactive rounded-full px-3 py-1.5 font-semibold tabular-nums text-amber-950 hover:bg-white/80"
            >
              {t(lang, 'fieldExportBtn')} ({fieldDraftCount})
            </button>
          </div>
        </div>
      )}

      {/* GPS / Compass Error toast */}
      {(gpsError || compassError) && (
        <div className="liquid-tint-red animate-liquid-pop pointer-events-auto absolute inset-x-4 top-32 z-30 mx-auto flex max-w-md items-center justify-between rounded-full px-4 py-2.5 text-xs font-semibold text-white">
          <span>{gpsError || compassError}</span>
          <button
            type="button"
            onClick={() => {
              setGpsError(null);
              clearCompassError();
            }}
            className="liquid-interactive ml-2 rounded-full bg-white/15 p-1 hover:bg-white/25"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Nearest active banner */}
      {nearestTarget && (
        <div className="liquid-tint-blue animate-liquid-pop pointer-events-auto absolute bottom-32 left-3 z-20 flex flex-wrap items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-white">
          <Compass className="h-4 w-4 shrink-0" />
          <span className="tabular-nums">
            {t(lang, 'nearestFound')}: {formatDistance(nearestTarget.totalDistanceM, lang)} ·{' '}
            {nearestTarget.mode === 'trail'
              ? t(lang, 'nearestAlongTrails')
              : t(lang, 'nearestDirect')}{' '}
            ({t(lang, 'estWalkTime')} {nearestTarget.estimatedMinutes} min)
          </span>
          <button
            type="button"
            onClick={() => setNearestTarget(null)}
            className="liquid-interactive ml-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] hover:bg-white/30"
          >
            {t(lang, 'cancelNearest')}
          </button>
        </div>
      )}

      {/* Floating Action Buttons (GPS, Compass & Nearest) */}
      {!selectedItem && (
        <div className="pointer-events-auto absolute bottom-10 left-3 z-20 flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startGps(true)}
              className={`liquid-interactive flex items-center gap-2 rounded-full px-3.5 py-2.5 text-xs font-semibold tabular-nums ${
                userLocation
                  ? 'liquid-tint-blue text-white'
                  : 'liquid-glass text-slate-800 hover:bg-white/80'
              }`}
            >
              <LocateFixed className="h-4 w-4" />
              <span>
                {userLocation
                  ? `${t(lang, 'gpsActive')}${userAccuracy ? ` (±${userAccuracy} m)` : ''}`
                  : t(lang, 'gpsOff')}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleCompass}
              className={`liquid-interactive flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-semibold ${
                compassEnabled
                  ? 'liquid-tint-indigo text-white'
                  : 'liquid-glass text-slate-800 hover:bg-white/80'
              }`}
              title={compassEnabled ? t(lang, 'compassOn') : t(lang, 'compassOff')}
            >
              <Navigation2
                className="h-4 w-4 transition-transform"
                style={{
                  transform:
                    compassEnabled && compassHeading !== null
                      ? `rotate(${compassHeading}deg)`
                      : undefined,
                }}
              />
              <span>{compassEnabled ? t(lang, 'compassOn') : t(lang, 'compassOff')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowNearestPicker((v) => !v)}
            className="liquid-tint-emerald liquid-interactive flex w-fit items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-white"
          >
            <Compass className="h-4 w-4" />
            <span>{t(lang, 'nearestBtn')}</span>
          </button>
        </div>
      )}

      {/* Nearest Category Picker Modal */}
      {showNearestPicker && (
        <div className="liquid-glass-elevated animate-liquid-sheet pointer-events-auto absolute inset-x-3 bottom-24 z-30 mx-auto max-w-md rounded-[32px] p-4.5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold tracking-tight text-slate-900">
              {t(lang, 'nearestPrompt')}
            </span>
            <button
              type="button"
              onClick={() => setShowNearestPicker(false)}
              className="liquid-interactive rounded-full bg-slate-900/8 p-1.5 text-slate-600 hover:bg-slate-900/14"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.filter((c) => (categoryCounts[c.id] || 0) > 0).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleFindNearest(cat.id)}
                className="liquid-subcard liquid-interactive flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-slate-800 hover:bg-white/85"
              >
                <span className="text-sm">{cat.emoji}</span>
                <span className="truncate">
                  {lang === 'en' ? cat.label_en : cat.label_it}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attribution footer (compact) */}
      {!selectedItem && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 z-10 text-center text-[9px] font-medium text-slate-700/80 drop-shadow-[0_1px_2px_rgba(255,255,255,0.85)]">
          {t(lang, 'attribution')}
        </div>
      )}

      <DetailSheet
        item={selectedItem}
        lang={lang}
        userLocation={userLocation}
        isOnline={isOnline}
        fieldMode={fieldMode}
        trailReport={
          selectedItem?.kind === 'trail'
            ? trailReports[selectedItem.feature.properties.id]
            : undefined
        }
        onSaveTrailReport={handleSaveTrailReport}
        onEditPoi={(poi) => {
          setEditingPoi(poi);
          setDraftPoiCoords(null);
        }}
        onClose={() => setSelectedItem(null)}
      />

      <OfflineModal
        open={showOfflineModal}
        lang={lang}
        isOnline={isOnline}
        onClose={() => setShowOfflineModal(false)}
        onStatusChange={setOfflineReady}
      />

      <AddPoiModal
        coords={draftPoiCoords}
        editingPoi={editingPoi}
        lang={lang}
        onClose={() => {
          setDraftPoiCoords(null);
          setEditingPoi(null);
        }}
        onSave={handleSaveCustomPoi}
      />

      <FieldDraftsModal
        open={showFieldDrafts}
        lang={lang}
        mergedPois={mergedPois}
        customPois={customPois}
        trailReports={trailReports}
        onClose={() => setShowFieldDrafts(false)}
        onDeleteCustomPoi={handleDeleteCustomPoi}
        onClearAll={handleClearFieldDrafts}
      />
    </div>
  );
}

export default App;
