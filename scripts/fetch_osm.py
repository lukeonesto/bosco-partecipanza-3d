#!/usr/bin/env python3
"""
Fetch public OpenStreetMap data for Bosco delle Sorti della Partecipanza (Trino, VC)
via Overpass API and convert it into the app's GeoJSON schema.
"""

import json
import math
import os
import urllib.parse
import urllib.request
from datetime import date

# Bounding box around Bosco della Partecipanza di Trino (45.2245° N, 8.2528° E)
BBOX = "45.210,8.225,45.245,8.280"

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

HEADERS = {
    "User-Agent": "BoscoPartecipanza3D/0.1 (open-source-mapping)",
    "Accept": "application/json",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
}

QUERY = f"""
[out:json][timeout:15];
(
  // Trails & paths
  way["highway"~"^(path|track|footway|cycleway|bridleway)$"]({BBOX});

  // Forest & protected area ways (avoid giant regional relations)
  way["boundary"="protected_area"]({BBOX});
  way["natural"="wood"]({BBOX});
  way["landuse"="forest"]({BBOX});

  // POIs
  node["amenity"~"^(bench|waste_basket|drinking_water|parking|shelter|toilets)$"]({BBOX});
  way["amenity"="parking"]({BBOX});
  node["tourism"~"^(information|picnic_site|viewpoint|artwork)$"]({BBOX});
  node["leisure"="picnic_table"]({BBOX});
  node["barrier"~"^(gate|entrance)$"]({BBOX});
  node["natural"~"^(tree|wetland|spring)$"]({BBOX});
  way["building"]["name"]({BBOX});
  node["historic"]({BBOX});
  way["historic"]({BBOX});
);
out body geom;
"""


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def line_length_m(coords: list[list[float]]) -> int:
    total = 0.0
    for i in range(len(coords) - 1):
        total += haversine_m(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
    return round(total)


def centroid(coords: list[list[float]]) -> list[float]:
    if not coords:
        return [0.0, 0.0]
    lon = sum(c[0] for c in coords) / len(coords)
    lat = sum(c[1] for c in coords) / len(coords)
    return [round(lon, 6), round(lat, 6)]


def fetch_overpass() -> dict:
    body = urllib.parse.urlencode({"data": QUERY}).encode("utf-8")
    last_err = None
    for url in OVERPASS_ENDPOINTS:
        try:
            print(f"Querying {url}...")
            req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
            with urllib.request.urlopen(req, timeout=35) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            print(f"  Failed ({url}): {exc}")
            last_err = exc
    raise RuntimeError(f"All Overpass endpoints failed: {last_err}")


def classify_poi(tags: dict) -> tuple[str, str | None, str, str]:
    """Return (categoria, sottocategoria, default_name_it, default_name_en)."""
    amenity = tags.get("amenity", "")
    tourism = tags.get("tourism", "")
    leisure = tags.get("leisure", "")
    barrier = tags.get("barrier", "")
    natural = tags.get("natural", "")

    if amenity == "bench":
        return "panchina", None, "Panchina", "Bench"
    if amenity == "waste_basket":
        return "cestino", None, "Cestino", "Waste Bin"
    if amenity == "drinking_water" or natural == "spring":
        return "fontanella", None, "Fontanella", "Drinking Water"
    if amenity == "parking":
        return "parcheggio", None, "Parcheggio", "Parking"
    if tourism == "picnic_site" or leisure == "picnic_table":
        return "area_sosta", "picnic", "Area Picnic", "Picnic Area"
    if tourism == "information":
        info_type = tags.get("information", "bacheca")
        return "bacheca", info_type, "Bacheca informativa", "Information Board"
    if tourism == "viewpoint":
        return "punto_panoramico", None, "Punto panoramico", "Viewpoint"
    if barrier in ("gate", "entrance"):
        return "ingresso", barrier, "Ingresso / Cancello", "Entrance / Gate"
    if natural == "tree":
        return "albero_monumentale", None, "Albero particolare", "Notable Tree"
    if natural == "wetland":
        return "zona_umida", None, "Zona umida", "Wetland"
    if tags.get("building") or tags.get("historic") or amenity in ("shelter", "toilets"):
        sub = tags.get("building") or amenity or tags.get("historic")
        return "struttura", sub, "Struttura", "Structure"
    return "altro", None, "Punto di interesse", "Point of Interest"


def build_description(tags: dict, lang: str) -> str:
    parts = []
    if lang == "it":
        if tags.get("description"):
            parts.append(tags["description"])
        if tags.get("species"):
            parts.append(f"Specie: {tags['species']}")
        if tags.get("surface"):
            parts.append(f"Fondo: {tags['surface']}")
        if tags.get("access"):
            parts.append(f"Accesso: {tags['access']}")
        if not parts:
            parts.append("Dato pubblico importato da OpenStreetMap. Da verificare sul campo.")
    else:
        if tags.get("description:en"):
            parts.append(tags["description:en"])
        elif tags.get("description"):
            parts.append(tags["description"])
        if tags.get("species"):
            parts.append(f"Species: {tags['species']}")
        if tags.get("surface"):
            parts.append(f"Surface: {tags['surface']}")
        if not parts:
            parts.append("Public data imported from OpenStreetMap. Field verification pending.")
    return " · ".join(parts)


def main() -> None:
    raw = fetch_overpass()
    elements = raw.get("elements", [])
    print(f"Fetched {len(elements)} OSM elements.")

    today = date.today().isoformat()
    pois = []
    trails = []
    boundaries = []
    seen_ids = set()

    for el in elements:
        el_type = el.get("type")
        el_id = el.get("id")
        tags = el.get("tags", {})
        if not tags:
            continue

        # 1. Boundaries (protected area or forest/wood polygons)
        if (
            tags.get("boundary") == "protected_area"
            or tags.get("natural") == "wood"
            or tags.get("landuse") == "forest"
        ) and el_type == "way":
            if el.get("geometry"):
                coords = [[round(p["lon"], 6), round(p["lat"], 6)] for p in el["geometry"]]
                if len(coords) >= 4 and coords[0] == coords[-1]:
                    boundaries.append(
                        {
                            "type": "Feature",
                            "geometry": {"type": "Polygon", "coordinates": [coords]},
                            "properties": {
                                "id": f"osm-{el_type}-{el_id}",
                                "nome": tags.get("name", "Bosco della Partecipanza"),
                            },
                        }
                    )
            continue

        # 2. Trails & paths
        if el_type == "way" and "highway" in tags and el.get("geometry"):
            coords = [[round(p["lon"], 6), round(p["lat"], 6)] for p in el["geometry"]]
            if len(coords) < 2:
                continue
            length_m = line_length_m(coords)
            if length_m < 25:
                continue
            hw = tags["highway"]
            name_it = tags.get("name") or f"Sentiero ({hw})"
            name_en = tags.get("name:en") or tags.get("name") or f"Trail ({hw})"
            time_min = max(1, round(length_m / (3800 / 60)))
            surface = tags.get("surface", "sterrato" if hw in ("path", "track") else "non specificato")
            trails.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": {
                        "id": f"trail-osm-{el_id}",
                        "nome": name_it,
                        "nome_en": name_en,
                        "tipo": hw,
                        "lunghezza_m": length_m,
                        "tempo_percorrenza_min": time_min,
                        "difficolta": "facile",
                        "fondo": surface,
                        "descrizione": build_description(tags, "it"),
                        "descrizione_en": build_description(tags, "en"),
                        "aggiornato_il": today,
                        "fonte": "osm",
                    },
                }
            )
            continue

        # 3. POIs (nodes or way centroids)
        lon_lat = None
        if el_type == "node" and "lon" in el and "lat" in el:
            lon_lat = [round(el["lon"], 6), round(el["lat"], 6)]
        elif el_type == "way" and el.get("geometry"):
            coords = [[p["lon"], p["lat"]] for p in el["geometry"]]
            lon_lat = centroid(coords)

        if not lon_lat:
            continue

        uid = f"poi-osm-{el_type}-{el_id}"
        if uid in seen_ids:
            continue
        seen_ids.add(uid)

        cat, subcat, def_it, def_en = classify_poi(tags)
        name_it = tags.get("name") or def_it
        name_en = tags.get("name:en") or tags.get("name") or def_en

        pois.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": lon_lat},
                "properties": {
                    "id": uid,
                    "nome": name_it,
                    "nome_en": name_en,
                    "categoria": cat,
                    "sottocategoria": subcat,
                    "descrizione": build_description(tags, "it"),
                    "descrizione_en": build_description(tags, "en"),
                    "foto": [],
                    "aggiornato_il": today,
                    "fonte": "osm",
                },
            }
        )

    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "data")
    os.makedirs(out_dir, exist_ok=True)

    for fname, features in [
        ("pois.geojson", pois),
        ("trails.geojson", trails),
        ("boundary.geojson", boundaries),
    ]:
        path = os.path.join(out_dir, fname)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False, indent=2)
        print(f"Wrote {len(features)} features to {path}")


if __name__ == "__main__":
    main()
