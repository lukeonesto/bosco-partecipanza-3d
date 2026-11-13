#!/usr/bin/env python3
"""
Scarica il DTM 5m della Regione Piemonte (RIPRESA AEREA ICE 2009-2011 - DTM,
licenza CC BY 4.0) tramite WCS sull'area del Bosco delle Sorti della Partecipanza
e genera public/data/terrain.pmtiles codificato in formato Terrarium RGB (z11-z16).
"""

import json
import math
import os
import struct
import urllib.request
import zlib
import numpy as np
from osgeo import gdal

gdal.UseExceptions()

# Bounding box Bosco della Partecipanza + buffer
MIN_LON, MIN_LAT = 8.215, 45.200
MAX_LON, MAX_LAT = 8.310, 45.250
WCS_BBOX = (8.205, 45.190, 8.320, 45.260)

MIN_ZOOM = 11
MAX_ZOOM = 15

WCS_URL = (
    "https://geomap.reteunitaria.piemonte.it/ws/taims/rp-01/taimsdtmwcs/"
    "wcs_ice_2009_2011_dtm?service=WCS&version=1.0.0&request=GetCoverage"
    "&coverage=DTM&crs=EPSG:4326"
    f"&bbox={WCS_BBOX[0]},{WCS_BBOX[1]},{WCS_BBOX[2]},{WCS_BBOX[3]}"
    "&width=1900&height=1600&format=GEOTIFF_16"
)

TMP_TIF = "/tmp/piemonte_dtm5m_bosco.tif"
OUT_PMTILES = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public",
    "data",
    "terrain.pmtiles",
)

EARTH_HALF_CIRC = 20037508.342789244


def lonlat_to_mercator(lon: float, lat: float) -> tuple[float, float]:
    x = lon * EARTH_HALF_CIRC / 180.0
    y = math.log(math.tan((90.0 + lat) * math.pi / 360.0)) / (math.pi / 180.0)
    y = y * EARTH_HALF_CIRC / 180.0
    return x, y


def deg2num(lat: float, lon: float, z: int) -> tuple[int, int]:
    lat_r = math.radians(lat)
    n = 2.0**z
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n)
    return x, y


def tile_bounds_mercator(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    n = 2.0**z
    tile_span = (2.0 * EARTH_HALF_CIRC) / n
    minx = -EARTH_HALF_CIRC + x * tile_span
    maxx = minx + tile_span
    maxy = EARTH_HALF_CIRC - y * tile_span
    miny = maxy - tile_span
    return minx, miny, maxx, maxy


def encode_png_rgb(rgb: np.ndarray) -> bytes:
    """Encode an (H, W, 3) uint8 numpy array as a PNG."""
    h, w, _ = rgb.shape
    raw_rows = b"".join(b"\x00" + rgb[y].tobytes() for y in range(h))
    compressed = zlib.compress(raw_rows, level=6)

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", compressed)
        + chunk(b"IEND", b"")
    )


def elev_to_terrarium_png(elev: np.ndarray) -> bytes:
    # Quantize to 0.1m (well within 5m DTM vertical accuracy) for much smaller PNGs
    quantized = np.round(elev * 10.0) / 10.0
    v = np.clip(quantized + 32768.0, 0.0, 65535.996)
    v_floor = np.floor(v)
    r = np.floor(v_floor / 256.0).astype(np.uint8)
    g = (v_floor % 256.0).astype(np.uint8)
    b = np.floor((v - v_floor) * 256.0).astype(np.uint8)
    rgb = np.stack([r, g, b], axis=-1)
    return encode_png_rgb(rgb)


# --- PMTiles v3 minimal writer ---
def _rot(n: int, x: int, y: int, rx: int, ry: int) -> tuple[int, int]:
    if ry == 0:
        if rx == 1:
            x = n - 1 - x
            y = n - 1 - y
        x, y = y, x
    return x, y


def zxy_to_tileid(z: int, x: int, y: int) -> int:
    acc = ((1 << (2 * z)) - 1) // 3
    n = 1 << z
    tx, ty = x, y
    d = 0
    s = n >> 1
    while s > 0:
        rx = 1 if (tx & s) > 0 else 0
        ry = 1 if (ty & s) > 0 else 0
        d += s * s * ((3 * rx) ^ ry)
        tx, ty = _rot(s, tx, ty, rx, ry)
        s >>= 1
    return acc + d


def write_varint(val: int) -> bytes:
    out = bytearray()
    while val >= 0x80:
        out.append((val & 0x7F) | 0x80)
        val >>= 7
    out.append(val)
    return bytes(out)


def encode_directory(entries: list[tuple[int, int, int, int]]) -> bytes:
    """entries: sorted list of (tile_id, offset, length, run_length)"""
    n = len(entries)
    buf = bytearray(write_varint(n))
    last_id = 0
    for tid, _, _, _ in entries:
        buf.extend(write_varint(tid - last_id))
        last_id = tid
    for _, _, _, rl in entries:
        buf.extend(write_varint(rl))
    for _, _, length, _ in entries:
        buf.extend(write_varint(length))
    for i, (_, offset, length, _) in enumerate(entries):
        if i > 0 and offset == entries[i - 1][1] + entries[i - 1][2]:
            buf.extend(write_varint(0))
        else:
            buf.extend(write_varint(offset + 1))
    return zlib.compress(bytes(buf), level=6, wbits=31)


def write_pmtiles(
    out_path: str,
    tiles: list[tuple[int, bytes]],
    metadata: dict,
    min_zoom: int,
    max_zoom: int,
) -> None:
    tiles_sorted = sorted(tiles, key=lambda t: t[0])

    # Build tile data blob + directory entries
    tile_blobs = bytearray()
    entries: list[tuple[int, int, int, int]] = []
    for tid, data in tiles_sorted:
        offset = len(tile_blobs)
        tile_blobs.extend(data)
        entries.append((tid, offset, len(data), 1))

    root_dir = encode_directory(entries)
    meta_bytes = zlib.compress(json.dumps(metadata).encode("utf-8"), level=6, wbits=31)

    HEADER_LEN = 127
    root_dir_offset = HEADER_LEN
    root_dir_len = len(root_dir)
    meta_offset = root_dir_offset + root_dir_len
    meta_len = len(meta_bytes)
    leaf_dirs_offset = meta_offset + meta_len
    leaf_dirs_len = 0
    tile_data_offset = leaf_dirs_offset + leaf_dirs_len
    tile_data_len = len(tile_blobs)

    min_lon_e7 = int(round(MIN_LON * 1e7))
    min_lat_e7 = int(round(MIN_LAT * 1e7))
    max_lon_e7 = int(round(MAX_LON * 1e7))
    max_lat_e7 = int(round(MAX_LAT * 1e7))
    center_lon_e7 = int(round(((MIN_LON + MAX_LON) / 2.0) * 1e7))
    center_lat_e7 = int(round(((MIN_LAT + MAX_LAT) / 2.0) * 1e7))

    header = struct.pack(
        "<7sB11Q6B4iB2i",
        b"PMTiles",
        3,  # spec version
        root_dir_offset,
        root_dir_len,
        meta_offset,
        meta_len,
        leaf_dirs_offset,
        leaf_dirs_len,
        tile_data_offset,
        tile_data_len,
        len(entries),  # addressed_tiles_count
        len(entries),  # tile_entries_count
        len(entries),  # tile_contents_count
        0,  # clustered (false)
        2,  # internal_compression: gzip
        1,  # tile_compression: none (PNG already compressed)
        2,  # tile_type: png
        min_zoom,
        max_zoom,
        min_lon_e7,
        min_lat_e7,
        max_lon_e7,
        max_lat_e7,
        14,  # center_zoom
        center_lon_e7,
        center_lat_e7,
    )
    assert len(header) == HEADER_LEN, f"Header len {len(header)} != {HEADER_LEN}"

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(header)
        f.write(root_dir)
        f.write(meta_bytes)
        f.write(tile_blobs)


def main() -> None:
    print("1/3 Downloading 5m DTM from Geoportale Piemonte WCS...")
    urllib.request.urlretrieve(WCS_URL, TMP_TIF)
    src_ds = gdal.Open(TMP_TIF)
    if src_ds is None:
        raise RuntimeError("Failed to open downloaded DTM GeoTIFF")

    tiles: list[tuple[int, bytes]] = []
    mem_driver = gdal.GetDriverByName("MEM")

    print("2/3 Rendering Terrarium RGB tiles (z11-z16)...")
    for z in range(MIN_ZOOM, MAX_ZOOM + 1):
        nw = deg2num(MAX_LAT, MIN_LON, z)
        se = deg2num(MIN_LAT, MAX_LON, z)
        count_z = 0
        for x in range(nw[0], se[0] + 1):
            for y in range(nw[1], se[1] + 1):
                minx, miny, maxx, maxy = tile_bounds_mercator(z, x, y)
                warped = gdal.Warp(
                    "",
                    src_ds,
                    format="MEM",
                    dstSRS="EPSG:3857",
                    outputBounds=(minx, miny, maxx, maxy),
                    width=256,
                    height=256,
                    resampleAlg="bilinear",
                )
                arr = warped.GetRasterBand(1).ReadAsArray().astype(np.float32)
                # Replace any nodata (-99) with local mean
                nodata_mask = arr <= -50
                if np.any(nodata_mask):
                    valid = arr[~nodata_mask]
                    fill = float(np.mean(valid)) if valid.size > 0 else 145.0
                    arr[nodata_mask] = fill

                png_bytes = elev_to_terrarium_png(arr)
                tid = zxy_to_tileid(z, x, y)
                tiles.append((tid, png_bytes))
                count_z += 1
        print(f"   z{z}: {count_z} tiles")

    print(f"3/3 Writing {OUT_PMTILES} ({len(tiles)} tiles)...")
    metadata = {
        "name": "Bosco della Partecipanza DTM 5m",
        "format": "png",
        "encoding": "terrarium",
        "attribution": "DTM 5m © Regione Piemonte (CC BY 4.0)",
    }
    write_pmtiles(OUT_PMTILES, tiles, metadata, MIN_ZOOM, MAX_ZOOM)
    size_mb = os.path.getsize(OUT_PMTILES) / (1024 * 1024)
    print(f"Done! {OUT_PMTILES} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
