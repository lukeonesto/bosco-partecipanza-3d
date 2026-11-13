const OSM_CACHE_NAME = 'osm-basemap-tiles';
const DEM_CACHE_NAME = 'terrain-dem-tiles';
const DATA_CACHE_NAME = 'bosco-geojson-data';
const OFFLINE_TIMESTAMP_KEY = 'bosco_offline_updated_at';

// Bounding box covering Bosco delle Sorti della Partecipanza + buffer
const BOSCO_BOUNDS = {
  minLon: 8.215,
  maxLon: 8.31,
  minLat: 45.2,
  maxLat: 45.25,
};

const OSM_MIN_ZOOM = 12;
const OSM_MAX_ZOOM = 16;
const DEM_MIN_ZOOM = 12;
const DEM_MAX_ZOOM = 15;

interface TileTask {
  url: string;
  cacheName: string;
}

function deg2num(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

function buildTileTasks(): TileTask[] {
  const tasks: TileTask[] = [];

  for (let z = OSM_MIN_ZOOM; z <= OSM_MAX_ZOOM; z++) {
    const nw = deg2num(BOSCO_BOUNDS.maxLat, BOSCO_BOUNDS.minLon, z);
    const se = deg2num(BOSCO_BOUNDS.minLat, BOSCO_BOUNDS.maxLon, z);
    for (let x = nw.x; x <= se.x; x++) {
      for (let y = nw.y; y <= se.y; y++) {
        tasks.push({
          url: `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
          cacheName: OSM_CACHE_NAME,
        });
      }
    }
  }

  for (let z = DEM_MIN_ZOOM; z <= DEM_MAX_ZOOM; z++) {
    const nw = deg2num(BOSCO_BOUNDS.maxLat, BOSCO_BOUNDS.minLon, z);
    const se = deg2num(BOSCO_BOUNDS.minLat, BOSCO_BOUNDS.maxLon, z);
    for (let x = nw.x; x <= se.x; x++) {
      for (let y = nw.y; y <= se.y; y++) {
        tasks.push({
          url: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
          cacheName: DEM_CACHE_NAME,
        });
      }
    }
  }

  for (const dataUrl of [
    '/data/pois.geojson',
    '/data/trails.geojson',
    '/data/boundary.geojson',
  ]) {
    tasks.push({
      url: dataUrl,
      cacheName: DATA_CACHE_NAME,
    });
  }

  return tasks;
}

export const OFFLINE_TOTAL_TILES = buildTileTasks().length;

export interface OfflineStatus {
  cachedCount: number;
  totalCount: number;
  isComplete: boolean;
  updatedAt: string | null;
  supported: boolean;
}

export async function getOfflineStatus(): Promise<OfflineStatus> {
  const tasks = buildTileTasks();
  if (typeof caches === 'undefined') {
    return {
      cachedCount: 0,
      totalCount: tasks.length,
      isComplete: false,
      updatedAt: null,
      supported: false,
    };
  }

  const [osmCache, demCache, dataCache] = await Promise.all([
    caches.open(OSM_CACHE_NAME),
    caches.open(DEM_CACHE_NAME),
    caches.open(DATA_CACHE_NAME),
  ]);

  const cacheMap: Record<string, Cache> = {
    [OSM_CACHE_NAME]: osmCache,
    [DEM_CACHE_NAME]: demCache,
    [DATA_CACHE_NAME]: dataCache,
  };

  let cachedCount = 0;
  // Check in parallel batches
  const matches = await Promise.all(
    tasks.map((task) => cacheMap[task.cacheName].match(task.url))
  );
  for (const m of matches) {
    if (m) cachedCount++;
  }

  return {
    cachedCount,
    totalCount: tasks.length,
    isComplete: cachedCount >= tasks.length,
    updatedAt: localStorage.getItem(OFFLINE_TIMESTAMP_KEY),
    supported: true,
  };
}

export interface OfflineProgress {
  done: number;
  total: number;
  failed: number;
}

export async function downloadOfflinePack(
  onProgress: (progress: OfflineProgress) => void,
  signal?: AbortSignal
): Promise<OfflineProgress> {
  if (typeof caches === 'undefined') {
    throw new Error('Cache Storage not supported');
  }

  const tasks = buildTileTasks();
  const [osmCache, demCache, dataCache] = await Promise.all([
    caches.open(OSM_CACHE_NAME),
    caches.open(DEM_CACHE_NAME),
    caches.open(DATA_CACHE_NAME),
  ]);

  const cacheMap: Record<string, Cache> = {
    [OSM_CACHE_NAME]: osmCache,
    [DEM_CACHE_NAME]: demCache,
    [DATA_CACHE_NAME]: dataCache,
  };

  let done = 0;
  let failed = 0;
  const total = tasks.length;
  onProgress({ done, total, failed });

  const CONCURRENCY = 6;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      if (signal?.aborted) return;
      const idx = cursor++;
      const task = tasks[idx];
      const cache = cacheMap[task.cacheName];

      try {
        const existing = await cache.match(task.url);
        if (!existing) {
          const res = await fetch(task.url, {
            mode: task.url.startsWith('http') ? 'cors' : 'same-origin',
            signal,
          });
          if (res.ok || res.type === 'opaque') {
            await cache.put(task.url, res);
          } else {
            failed++;
          }
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        failed++;
      } finally {
        done++;
        onProgress({ done, total, failed });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  if (!signal?.aborted && failed < total * 0.1) {
    localStorage.setItem(OFFLINE_TIMESTAMP_KEY, new Date().toISOString());
  }

  return { done, total, failed };
}

export async function clearOfflinePack(): Promise<void> {
  if (typeof caches !== 'undefined') {
    await Promise.all([
      caches.delete(OSM_CACHE_NAME),
      caches.delete(DEM_CACHE_NAME),
      caches.delete(DATA_CACHE_NAME),
    ]);
  }
  localStorage.removeItem(OFFLINE_TIMESTAMP_KEY);
}
