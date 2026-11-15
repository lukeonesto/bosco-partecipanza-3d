interface Env {
  GITHUB_TOKEN?: string;
  VITE_ADMIN_PIN_HASH?: string;
  GITHUB_REPO?: string;
}

const DEFAULT_PIN_HASH =
  '71687d11c4e1638e67fd039748a0b2bc941632b0d56d3fd7a06acd14d10e26ae';
const DEFAULT_REPO = 'lukeonesto/bosco-partecipanza-3d';
const FILE_PATH = 'public/data/pois.geojson';

function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const onRequestGet = async (context: { env: Env }) => {
  const repo = context.env.GITHUB_REPO || DEFAULT_REPO;
  const rawUrl = `https://raw.githubusercontent.com/${repo}/main/${FILE_PATH}?t=${Date.now()}`;

  try {
    const res = await fetch(rawUrl, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const text = await res.text();
      return new Response(text, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }
  } catch {
    // ignore
  }

  return new Response(JSON.stringify({ error: 'Upstream unavailable' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestPut = async (context: {
  request: Request;
  env: Env;
}) => {
  const expectedHash = (
    context.env.VITE_ADMIN_PIN_HASH || DEFAULT_PIN_HASH
  ).toLowerCase();
  const providedHash = (
    context.request.headers.get('X-Admin-Pin-Hash') || ''
  ).toLowerCase();

  if (!providedHash || providedHash !== expectedHash) {
    return new Response(JSON.stringify({ error: 'PIN Admin non valido' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { pois?: unknown; githubToken?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON non valido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (
    !body.pois ||
    typeof body.pois !== 'object' ||
    (body.pois as { type?: string }).type !== 'FeatureCollection'
  ) {
    return new Response(
      JSON.stringify({ error: 'Formato GeoJSON FeatureCollection non valido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = (context.env.GITHUB_TOKEN || body.githubToken || '').trim();
  if (!token) {
    return new Response(
      JSON.stringify({
        error:
          'GITHUB_TOKEN non configurato su Cloudflare Pages. Inserisci un token nel pannello Admin.',
      }),
      { status: 428, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const repo = context.env.GITHUB_REPO || DEFAULT_REPO;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${FILE_PATH}`;
  const ghHeaders = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'bosco-partecipanza-3d-admin',
  };

  const getRes = await fetch(apiUrl, { headers: ghHeaders });
  if (!getRes.ok) {
    return new Response(
      JSON.stringify({
        error: `Impossibile leggere ${FILE_PATH} da GitHub (${getRes.status})`,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const fileMeta = (await getRes.json()) as { sha: string };
  const contentStr = JSON.stringify(body.pois, null, 2) + '\n';
  const count =
    (body.pois as { features?: unknown[] }).features?.length ?? 0;

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      ...ghHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `chore(pois): aggiorna punti di interesse da Admin (${count} POI)`,
      content: encodeBase64Utf8(contentStr),
      sha: fileMeta.sha,
      branch: 'main',
    }),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    return new Response(
      JSON.stringify({
        error: `Errore commit GitHub (${putRes.status}): ${errText.slice(0, 120)}`,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ ok: true, mode: 'github' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
