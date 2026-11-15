import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const DEFAULT_PIN_HASH =
  '71687d11c4e1638e67fd039748a0b2bc941632b0d56d3fd7a06acd14d10e26ae';

interface NodeReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: 'data', cb: (chunk: { toString(): string }) => void): void;
  on(event: 'end', cb: () => void): void;
}

interface NodeRes {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface FsPromisesLike {
  readFile(path: string, encoding: string): Promise<string>;
  writeFile(path: string, data: string, encoding: string): Promise<void>;
}

interface PathLike {
  resolve(...segments: string[]): string;
}

function localAdminPoisPlugin(): Plugin {
  return {
    name: 'local-admin-pois-api',
    configureServer(server) {
      server.middlewares.use('/api/pois', async (rawReq, rawRes, next) => {
        const req = rawReq as unknown as NodeReq;
        const res = rawRes as unknown as NodeRes;
        const fsModuleName = 'node:fs/promises';
        const pathModuleName = 'node:path';
        const fs = (await import(/* @vite-ignore */ fsModuleName)) as FsPromisesLike;
        const path = (await import(/* @vite-ignore */ pathModuleName)) as PathLike;
        const poisPath = path.resolve('public/data/pois.geojson');

        if (req.method === 'GET') {
          try {
            const raw = await fs.readFile(poisPath, 'utf-8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(raw);
          } catch {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Cannot read pois.geojson' }));
          }
          return;
        }

        if (req.method === 'PUT') {
          const pinHeader = String(
            req.headers['x-admin-pin-hash'] || ''
          ).toLowerCase();
          if (!pinHeader || pinHeader !== DEFAULT_PIN_HASH) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'PIN Admin non valido' }));
            return;
          }

          const chunks: string[] = [];
          req.on('data', (chunk) => chunks.push(chunk.toString()));
          req.on('end', async () => {
            try {
              const body = JSON.parse(chunks.join('')) as { pois?: unknown };
              if (
                !body.pois ||
                typeof body.pois !== 'object' ||
                (body.pois as { type?: string }).type !== 'FeatureCollection'
              ) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'GeoJSON non valido' }));
                return;
              }

              await fs.writeFile(
                poisPath,
                JSON.stringify(body.pois, null, 2) + '\n',
                'utf-8'
              );
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, mode: 'local-file' }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error:
                    err instanceof Error ? err.message : 'Errore scrittura file',
                })
              );
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localAdminPoisPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'data/*.geojson',
      ],
      manifest: {
        name: 'Bosco della Partecipanza 3D',
        short_name: 'Bosco 3D',
        description:
          'Mappa 3D interattiva e guida offline del Bosco delle Sorti della Partecipanza di Trino Vercellese',
        theme_color: '#1b4332',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,geojson,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Cache local 5m DTM PMTiles with HTTP Range support for offline 3D terrain
            urlPattern: /\/data\/terrain\.pmtiles$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'terrain-dem-tiles',
              rangeRequests: true,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache basemap tiles for offline use
            urlPattern: /^https:\/\/[a-c]?\.?tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-basemap-tiles',
              expiration: {
                maxEntries: 1500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
