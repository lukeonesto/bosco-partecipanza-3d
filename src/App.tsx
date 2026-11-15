import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CloudUpload,
  Compass,
  ListFilter,
  LocateFixed,
  Lock,
  MapPinPlus,
  Navigation2,
  X,
} from 'lucide-react';
import { CATEGORIES } from './data/categories';
import { t } from './i18n';
import {
  CategoryId,
  Language,
  PoiCollection,
  PoiFeature,
  SelectedItem,
  TrailCollection,
} from './types';
import { formatDistance } from './utils/geo';
import {
  buildTrailGraph,
  findNearestPoiAlongTrails,
  NearestRouteResult,
} from './utils/trailRouter';
import { getOfflineStatus } from './utils/offlineManager';
import {
  cleanupLegacyPublicDrafts,
  clearAdminDrafts,
  loadCustomPois,
  loadDeletedPoiIds,
  mergePoisWithAdminChanges,
  publishPoisToSharedStorage,
  saveCustomPois,
  saveDeletedPoiIds,
} from './utils/fieldStorage';
import { useCompass } from './hooks/useCompass';
import { MapView } from './components/MapView';
import { SearchBar } from './components/SearchBar';
import { CategoryFilterBar } from './components/CategoryFilterBar';
import { DetailSheet } from './components/DetailSheet';
import { OfflineModal } from './components/OfflineModal';
import { AddPoiModal, FieldDraftsModal } from './components/FieldSurveyModal';
import { AdminPinModal } from './components/AdminPinModal';
import { isAdminUnlocked, lockAdmin } from './utils/adminAuth';

const EMPTY_POIS: PoiCollection = { type: 'FeatureCollection', features: [] };
const EMPTY_TRAILS: TrailCollection = { type: 'FeatureCollection', features: [] };
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const DEFAULT_MAP_CENTER: [number, number] = [8.2528, 45.2245];

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

  const [isAdmin, setIsAdmin] = useState<boolean>(() => isAdminUnlocked());
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminToast, setAdminToast] = useState<string | null>(null);
  const adminTapRef = useRef<{ count: number; lastTap: number }>({
    count: 0,
    lastTap: 0,
  });

  const [customPois, setCustomPois] = useState<PoiFeature[]>(() => loadCustomPois());
  const [deletedPoiIds, setDeletedPoiIds] = useState<string[]>(() =>
    loadDeletedPoiIds()
  );
  const [draftPoiCoords, setDraftPoiCoords] = useState<[number, number] | null>(null);
  const [editingPoi, setEditingPoi] = useState<PoiFeature | null>(null);
  const [showAdminManager, setShowAdminManager] = useState(false);

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

  // Load GeoJSON data (prefer /api/pois when available for fresh shared updates, fallback to /data/pois.geojson)
  useEffect(() => {
    cleanupLegacyPublicDrafts();

    const loadPoisData = async (): Promise<PoiCollection> => {
      try {
        const apiRes = await fetch('/api/pois', { cache: 'no-store' });
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data && data.type === 'FeatureCollection') {
            return data as PoiCollection;
          }
        }
      } catch {
        // Fallback to static GeoJSON
      }
      const staticRes = await fetch('/data/pois.geojson');
      return staticRes.json();
    };

    Promise.all([
      loadPoisData(),
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

  // Check initial offline pack status & optional ?admin=1 / #admin trigger
  useEffect(() => {
    getOfflineStatus()
      .then((s) => setOfflineReady(s.isComplete))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1' || window.location.hash === '#admin') {
      if (!isAdminUnlocked()) {
        setShowAdminModal(true);
      }
    }
  }, []);

  // Build trail routing graph once trails load
  const trailGraph = useMemo(
    () => buildTrailGraph(trails.features),
    [trails]
  );

  // Public users only see official published POIs; Admin sees live merged changes
  const mergedAdminPois = useMemo(
    () => mergePoisWithAdminChanges(pois, customPois, deletedPoiIds),
    [pois, customPois, deletedPoiIds]
  );

  const displayedPois = isAdmin ? mergedAdminPois : pois;
  const pendingAdminChangesCount = customPois.length + deletedPoiIds.length;

  // Category counts for chips
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of displayedPois.features) {
      counts[p.properties.categoria] = (counts[p.properties.categoria] || 0) + 1;
    }
    return counts;
  }, [displayedPois]);

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
      displayedPois.features,
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

  const syncCollectionToServer = async (nextCollection: PoiCollection) => {
    const res = await publishPoisToSharedStorage(nextCollection);
    if (res.ok) {
      setPois(nextCollection);
      clearAdminDrafts();
      setCustomPois([]);
      setDeletedPoiIds([]);
      setAdminToast(
        res.mode === 'github'
          ? t(lang, 'adminPublishedGithub')
          : t(lang, 'adminPublishedLocal')
      );
      setTimeout(() => setAdminToast(null), 3500);
    }
  };

  const handleSaveCustomPoi = (savedPoi: PoiFeature) => {
    if (!isAdmin) return;
    const exists = customPois.some((p) => p.properties.id === savedPoi.properties.id);
    const updatedCustom = exists
      ? customPois.map((p) =>
          p.properties.id === savedPoi.properties.id ? savedPoi : p
        )
      : [...customPois, savedPoi];
    const updatedDeleted = deletedPoiIds.filter(
      (id) => id !== savedPoi.properties.id
    );

    setCustomPois(updatedCustom);
    saveCustomPois(updatedCustom);
    setDeletedPoiIds(updatedDeleted);
    saveDeletedPoiIds(updatedDeleted);

    setDraftPoiCoords(null);
    setEditingPoi(null);
    setSelectedItem({ kind: 'poi', feature: savedPoi });

    const nextCollection = mergePoisWithAdminChanges(
      pois,
      updatedCustom,
      updatedDeleted
    );
    void syncCollectionToServer(nextCollection);
  };

  const handleDeletePoi = (id: string) => {
    if (!isAdmin) return;
    const updatedCustom = customPois.filter((p) => p.properties.id !== id);
    const updatedDeleted = deletedPoiIds.includes(id)
      ? deletedPoiIds
      : [...deletedPoiIds, id];

    setCustomPois(updatedCustom);
    saveCustomPois(updatedCustom);
    setDeletedPoiIds(updatedDeleted);
    saveDeletedPoiIds(updatedDeleted);

    setEditingPoi(null);
    setDraftPoiCoords(null);
    if (
      selectedItem?.kind === 'poi' &&
      selectedItem.feature.properties.id === id
    ) {
      setSelectedItem(null);
    }

    const nextCollection = mergePoisWithAdminChanges(
      pois,
      updatedCustom,
      updatedDeleted
    );
    void syncCollectionToServer(nextCollection);
  };

  const handleClearAdminDrafts = () => {
    clearAdminDrafts();
    setCustomPois([]);
    setDeletedPoiIds([]);
  };

  const handleLockAdmin = () => {
    lockAdmin();
    setIsAdmin(false);
    setShowAdminManager(false);
    setEditingPoi(null);
    setDraftPoiCoords(null);
  };

  const handleAddPoiAtGps = () => {
    if (!isAdmin) return;
    if (userLocation) {
      setDraftPoiCoords([...userLocation]);
      return;
    }
    if (!('geolocation' in navigator)) {
      setDraftPoiCoords([...DEFAULT_MAP_CENTER]);
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
      () => setDraftPoiCoords([...DEFAULT_MAP_CENTER]),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100">
      <MapView
        pois={displayedPois}
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
        fieldMode={isAdmin}
        closedTrailIds={[]}
        onMapClickForPoi={(coords) => {
          if (isAdmin) {
            setEditingPoi(null);
            setDraftPoiCoords(coords);
          }
        }}
        selectedItem={selectedItem}
        onSelectItem={(item) => setSelectedItem(item)}
        flyToCoords={flyToCoords}
      />

      {/* Top HUD stack (Search, Filters, Admin Banner, Error Toast) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <SearchBar
          lang={lang}
          onToggleLang={() => setLang((l) => (l === 'it' ? 'en' : 'it'))}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          pois={displayedPois.features}
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
          isAdmin={isAdmin}
          onAdminButtonClick={() => {
            if (isAdmin) {
              setShowAdminManager(true);
            } else {
              setShowAdminModal(true);
            }
          }}
          pendingAdminChangesCount={pendingAdminChangesCount}
        />

        <CategoryFilterBar
          lang={lang}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          showTrails={showTrails}
          onToggleTrails={() => setShowTrails((v) => !v)}
          counts={categoryCounts}
        />

        {/* Admin Mode Banner (Visible ONLY when Admin is unlocked) */}
        {isAdmin && !selectedItem && (
          <div className="liquid-glass-elevated animate-liquid-pop pointer-events-auto relative z-10 mx-auto flex w-full max-w-lg flex-wrap items-center justify-between gap-2 rounded-3xl border border-amber-300/60 px-3.5 py-2.5 text-xs text-amber-950">
            <span className="font-semibold tracking-tight">
              {t(lang, 'adminBannerHint')}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
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
                onClick={() => setShowAdminManager(true)}
                className="liquid-subcard liquid-interactive flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold tabular-nums text-amber-950 hover:bg-white/80"
              >
                <ListFilter className="h-3.5 w-3.5" />
                <span>
                  {t(lang, 'adminManagePoisBtn')} ({displayedPois.features.length})
                </span>
              </button>
              {pendingAdminChangesCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAdminManager(true)}
                  className="liquid-tint-emerald liquid-interactive flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold text-white"
                >
                  <CloudUpload className="h-3.5 w-3.5" />
                  <span>
                    {t(lang, 'adminPublishBtn')} ({pendingAdminChangesCount})
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={handleLockAdmin}
                className="liquid-subcard liquid-interactive flex items-center gap-1 rounded-full px-2.5 py-1.5 font-semibold text-slate-600 hover:text-red-700"
                title={t(lang, 'adminLockBtn')}
              >
                <Lock className="h-3 w-3" />
                <span>{t(lang, 'adminLockBtn')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Admin Saved Toast */}
        {adminToast && (
          <div className="liquid-tint-emerald animate-liquid-pop pointer-events-auto relative z-30 mx-auto flex w-full max-w-md items-center justify-between rounded-full px-4 py-2 text-xs font-semibold text-white">
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 shrink-0" />
              {adminToast}
            </span>
            <button
              type="button"
              onClick={() => setAdminToast(null)}
              className="liquid-interactive ml-2 rounded-full bg-white/15 p-1 hover:bg-white/25"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* GPS / Compass Error toast */}
        {(gpsError || compassError) && (
          <div className="liquid-tint-red animate-liquid-pop pointer-events-auto relative z-30 mx-auto flex w-full max-w-md items-center justify-between rounded-full px-4 py-2.5 text-xs font-semibold text-white">
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
      </div>

      {/* Bottom-left stack (Nearest active banner + GPS, Compass & Nearest buttons) */}
      {(nearestTarget || !selectedItem) && (
        <div className="pointer-events-none absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] left-3 right-3 z-20 flex flex-col items-start gap-2">
          {nearestTarget && (
            <div className="liquid-tint-blue animate-liquid-pop pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-white">
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

          {!selectedItem && (
            <div className="pointer-events-auto flex flex-col items-start gap-2">
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

      {/* Attribution footer (compact, 5-tap also unlocks Admin PIN prompt) */}
      {!selectedItem && (
        <div
          onClick={() => {
            if (isAdmin) return;
            const now = Date.now();
            if (now - adminTapRef.current.lastTap > 2000) {
              adminTapRef.current.count = 1;
            } else {
              adminTapRef.current.count += 1;
            }
            adminTapRef.current.lastTap = now;
            if (adminTapRef.current.count >= 5) {
              adminTapRef.current.count = 0;
              setShowAdminModal(true);
            }
          }}
          className="pointer-events-auto absolute inset-x-0 bottom-[max(0.375rem,env(safe-area-inset-bottom))] z-10 mx-auto max-w-full w-fit cursor-default select-none truncate px-3 text-center text-[9px] font-medium text-slate-700/80 drop-shadow-[0_1px_2px_rgba(255,255,255,0.85)]"
        >
          {t(lang, 'attribution')}
        </div>
      )}

      <DetailSheet
        item={selectedItem}
        lang={lang}
        userLocation={userLocation}
        isOnline={isOnline}
        isAdmin={isAdmin}
        onEditPoi={(poi) => {
          if (!isAdmin) return;
          setEditingPoi(poi);
          setDraftPoiCoords(null);
        }}
        onDeletePoi={handleDeletePoi}
        onClose={() => setSelectedItem(null)}
      />

      <OfflineModal
        open={showOfflineModal}
        lang={lang}
        isOnline={isOnline}
        onClose={() => setShowOfflineModal(false)}
        onStatusChange={setOfflineReady}
      />

      {isAdmin && (
        <>
          <AddPoiModal
            coords={draftPoiCoords}
            editingPoi={editingPoi}
            lang={lang}
            onClose={() => {
              setDraftPoiCoords(null);
              setEditingPoi(null);
            }}
            onSave={handleSaveCustomPoi}
            onDelete={handleDeletePoi}
          />

          <FieldDraftsModal
            open={showAdminManager}
            lang={lang}
            mergedPois={mergedAdminPois}
            customPois={customPois}
            deletedPoiIds={deletedPoiIds}
            onClose={() => setShowAdminManager(false)}
            onAddNewPoi={handleAddPoiAtGps}
            onEditPoi={(poi) => {
              setEditingPoi(poi);
              setDraftPoiCoords(null);
            }}
            onDeletePoi={handleDeletePoi}
            onFocusPoi={(poi) => {
              setSelectedItem({ kind: 'poi', feature: poi });
              setFlyToCoords([...poi.geometry.coordinates]);
            }}
            onPublishedSuccess={(publishedPois) => {
              setPois(publishedPois);
              clearAdminDrafts();
              setCustomPois([]);
              setDeletedPoiIds([]);
            }}
            onClearAll={handleClearAdminDrafts}
            onLockAdmin={handleLockAdmin}
          />
        </>
      )}

      <AdminPinModal
        open={showAdminModal}
        lang={lang}
        onClose={() => setShowAdminModal(false)}
        onUnlocked={() => {
          setIsAdmin(true);
          setShowAdminModal(false);
        }}
      />
    </div>
  );
}

export default App;
