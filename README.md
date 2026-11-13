# Bosco della Partecipanza 3D

Web app PWA mobile-first con mappa 3D navigabile per il **Bosco delle Sorti della Partecipanza** di Trino Vercellese (VC, Piemonte).

## Funzionalità MVP implementate
- **Mappa 3D con rilievo del terreno** (`MapLibre GL JS` + `hillshade` + DEM Terrarium con esagerazione verticale regolabile da `1x` a `8x` per mettere in risalto terrazzi fluviali, canali e micro-rilievi).
- **Sentieri e percorsi** con lunghezza calcolata e stima del tempo di percorrenza.
- **Punti di interesse (POI)** filtrabili per categoria (panchine, aree sosta/picnic, cestini, fontanelle, strutture/cascine, bacheche, parcheggi, ingressi, alberi monumentali, punti panoramici, zone umide) e ricercabili per nome.
- **GPS & "Più vicino a me"**: traccia la posizione dell'utente e trova il punto più vicino della categoria scelta.
- **Bilingue IT / EN**: cambio lingua istantaneo per interfaccia e contenuti.
- **PWA Offline-ready**: Service Worker con cache di app, GeoJSON e tile mappa/terreno visitate; le foto vengono caricate solo quando c'è connessione.

## Comandi principali

```bash
# Avvia server di sviluppo
npm run dev

# Aggiorna i dati pubblici da OpenStreetMap (Overpass API)
npm run fetch-osm

# Build di produzione (pronta per Cloudflare Pages)
npm run build
```

## Deploy su Cloudflare Pages
1. Collega il repository Git a **Cloudflare Pages**.
2. Imposta:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`

## Aggiornare o aggiungere POI
I dati sono salvati in `public/data/pois.geojson` e `public/data/trails.geojson` (schema GeoJSON standard). Puoi modificarli direttamente o con editor visuali come QGIS / geojson.io.

## Licenze e attribuzioni dati
- Dati mappa e sentieri: © OpenStreetMap contributors (`ODbL`)
- Rilievo altimetrico: AWS Open Data / Mapzen Terrarium
