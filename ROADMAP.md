# Roadmap e Stato del Progetto — Bosco della Partecipanza 3D

Questo file raccoglie le decisioni architetturali, il lavoro svolto e i prossimi passi per poter riprendere lo sviluppo in qualsiasi momento.

## Decisioni di progetto
1. **Resa 3D**: focus sulla **differenza di altitudine del terreno** (rilievo evidente tramite DEM + hillshade + esagerazione verticale regolabile), **non** sulla chioma boschiva.
2. **Dati iniziali**: partenza da zero usando **solo dati pubblici** (OpenStreetMap via Overpass API; in seguito eventuale integrazione DTM Geoportale Piemonte / MASE).
3. **Foto POI**: caricate **solo quando c'è connessione** (non incluse nella cache offline per contenere il peso).
4. **Stack & Hosting**: Vite + React + TypeScript + Tailwind CSS v4 + MapLibre GL JS + `vite-plugin-pwa`, ospitato su **Cloudflare Pages** con deploy automatico da GitHub (`lukeonesto/bosco-partecipanza-3d` → `https://bosco-partecipanza-3d.pages.dev`).
5. **Lingua**: interfaccia e dati bilingue **Italiano / Inglese** (`IT | EN`).

---

## Fatto finora (Fase 0 + Fase 1 MVP)
- [x] Setup progetto Vite + React + TypeScript + Tailwind CSS v4 + PWA (`vite-plugin-pwa`).
- [x] Mappa 3D navigabile (`MapLibre GL JS`) centrata sul Bosco delle Sorti della Partecipanza (`45.2245° N, 8.2528° E`) con terreno 3D (AWS Terrarium), `hillshade` ad alto contrasto, toggle `3D / 2D` e slider esagerazione verticale (`1x`–`8x`).
- [x] Tassonomia iniziale a 12 categorie estendibili (`src/data/categories.ts`) e dizionario `IT / EN` (`src/i18n.ts`).
- [x] Filtri per categoria, toggle sentieri, barra di ricerca per POI e sentieri.
- [x] Scheda dettaglio mobile-first (`DetailSheet.tsx`) per POI (con foto online-only e link indicazioni) e sentieri (lunghezza, tempo di percorrenza stimato, fondo).
- [x] Tracciamento GPS con raggio di accuratezza + funzione **"Più vicino a me"** per categoria con linea guida sulla mappa.
- [x] Script `scripts/fetch_osm.py` (`npm run fetch-osm`) eseguito: popolati `public/data/pois.geojson`, `public/data/trails.geojson` e `public/data/boundary.geojson`.
- [x] Repository GitHub creato e collegato a Cloudflare Pages in produzione.

---

## Prossime cose da fare

### Fase 2 — Offline avanzato, Rilievo ad alta risoluzione e Navigazione
- [ ] **Download offline esplicito ("Modalità Bosco Offline")**: generare file `PMTiles` statici (basemap vettoriale OSM + terreno DEM) ritagliati sull'area del bosco e aggiungere un pulsante in app per scaricarli in Cache Storage / IndexedDB con barra di avanzamento e stato aggiornamento.
- [ ] **Valutazione DTM Regione Piemonte / MASE (1m / 5m)**: verificare se il micro-rilievo di terrazzi fluviali e canali migliora sensibilmente rispetto al DEM Terrarium attuale e, nel caso, generare un `terrain.pmtiles` ad alta risoluzione (licenza CC BY 4.0, con attribuzione).
- [ ] **Orientamento bussola (`DeviceOrientation`)**: ruotare la mappa in base all'orientamento dello smartphone.
- [ ] **Distanza e percorso lungo i sentieri**: calcolare il "punto più vicino" seguendo il grafo dei sentieri in `trails.geojson` invece della sola linea d'aria.

### Fase 3 — Gestione contenuti sul campo e Admin
- [ ] **Workflow aggiornamento POI/Sentieri**: interfaccia leggera (es. modale protetta o mini-backend Supabase / GitHub CMS) per aggiungere/modificare punti, segnalare chiusure sentieri e caricare foto direttamente dallo smartphone durante i sopralluoghi nel bosco.
- [ ] **Verifica e arricchimento dati sul campo**: censimento di panchine, cestini, fontanelle, bacheche e alberi monumentali non ancora presenti su OpenStreetMap.
