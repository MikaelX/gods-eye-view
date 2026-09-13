# Trafikverket Sweden — full national pack (optional)

English first, Swedish second. This pack is **off** until you set a free
`TRAFIKVERKET_API_KEY`. Austin / Caltrans / TfL and TomTom (optional global
flow) keep working without it.

**One key → full Swedish TRV stack.** The same Trafikinfo key unlocks nationwide
road cameras plus street traffic, situations, flow sensors, road conditions,
weather measurepoints, and ATK (speed-camera) POIs. TomTom stays optional BYOK
for non-Sweden / global flow tiles.

Default scope is **all of Sweden** (no `CountyNo` filter). Optionally narrow with
`TRAFIKVERKET_COUNTY_NOS` (e.g. `1` for Stockholm-only). Stockholm screenshots in
docs are examples of the national pack, not a product lock.

Nationwide catalogs are large — GEV does **not** fetch/render all of Sweden at
once. Traffic uses TomTom-style **viewport bbox** requests (clamp + pad +
server clip, ~120s cache / ~90s poll). Cameras / ATK use the CCTV pattern:
Sweden-wide cached catalog, **nearest-N** registered, `PhotoUrl` only on
activation. Caps are documented below.

## English

### What you get

With a key, God's Eye View loads from the official Trafikverket Trafikinfo API:

1. **Camera** — Active road cameras as stills (`feedType: image`) via each
   camera's official `PhotoUrl`, proxied like the other CCTV packs. Nationwide by default.
2. **TravelTimeRoute** (schema 1.5) — street/corridor segments with
   `Geometry.WGS84` LINESTRING + `TrafficStatus` (freeflow / heavy / congested).
   Primary Swedish traffic coloring.
3. **Situation** (schema 1.6, **requires** `namespace="road.trafficinfo"`) —
   roadworks / messages / severity overlay (POINT or LINE).
4. **TrafficFlow** (schema 1.4) — nationwide sensor points (speed / flow rate).
5. **RoadCondition** — road condition messages (when present).
6. **WeatherMeasurepoint** — weather stations (+ observation fields when present).
7. **TrafficSafetyCamera** — ATK speed-camera POIs (labeled clearly vs CCTV).

Skipped (non-existent / out of scope): WeatherStation, RoadConditionOverview,
RoadGeometry and other parking/infra types.

### Scope, caps, and toggles

- **Default:** nationwide Sweden. Optional narrow:
  `TRAFIKVERKET_COUNTY_NOS=1` or `1,12,14`. `*` / `all` / unset = nationwide.
- Camera cap: nearest **500** to Sweden metro anchors
  (`CCTV_TRAFIKVERKET_MAX_SOURCES`).
- Route cap: **500** (`TRAFIKVERKET_TRAFFIC_MAX_ROUTES`).
- Situation cap: **1500** (`TRAFIKVERKET_SITUATION_MAX_FEATURES`).
- TrafficFlow cap: **1500** (`TRAFIKVERKET_TRAFFIC_FLOW_MAX_FEATURES`).
- RoadCondition cap: **800** (`TRAFIKVERKET_ROAD_CONDITION_MAX_FEATURES`).
- WeatherMeasurepoint cap: **400** (`TRAFIKVERKET_WEATHER_MAX_FEATURES`).
- TrafficSafetyCamera (ATK) cap: **400**
  (`TRAFIKVERKET_SAFETY_CAMERA_MAX_FEATURES`).
- Placement uses `Geometry.WGS84` only — never SWEREF99TM.
- Presence checks (no secrets): `GET /api/cctv/trafikverket-status`,
  `GET /api/trafikverket/status`.
- Disable cameras: `CCTV_TRAFIKVERKET_ENABLED=0`.
- Disable layers: `TRAFIKVERKET_TRAFFIC_ENABLED=0`,
  `TRAFIKVERKET_SITUATION_ENABLED=0`, `TRAFIKVERKET_TRAFFIC_FLOW_ENABLED=0`,
  `TRAFIKVERKET_ROAD_CONDITION_ENABLED=0`, `TRAFIKVERKET_WEATHER_ENABLED=0`,
  `TRAFIKVERKET_SAFETY_CAMERA_ENABLED=0`.

### Performance (viewport + caps — not CountyNo=1)

Nationwide data is **available** by default; GEV never tries to render/fetch
all of Sweden at once. Patterns mirror existing packs:

**TomTom model — TravelTimeRoute / Situation / TrafficFlow** (also used for
RoadCondition / Weather clips):

- Client requests only the **current viewport** (`?bbox=west,south,east,north`).
- Viewport is recentered on the camera look-at, **clamped** (~0.1° span) and
  **padded** (~0.02°) — similar spirit to TomTom z8–16 tiles with ~0.05° fetch
  bounds (typically 1–4 tiles at z12).
- Server keeps a Sweden-wide catalog in memory (~**120s** TTL, like TomTom’s
  ~120s tile cache) and **clips** each response to the padded bbox (plus
  nearest-N to view center for dense point layers).
- Client poll ~**90s**. Country-scale / space views skip the fetch (empty
  overlay) instead of downloading the national set.

**CCTV model — Camera / ATK POIs:**

- Catalog may be Sweden-wide and **cached server-side**.
- Only **nearest-N** sources are registered toward metro / view anchors
  (`prioritizeSources` / `CCTV_TRAFIKVERKET_MAX_SOURCES` / ATK max).
- Camera `PhotoUrl` / frame bytes are fetched **on activation only**, never for
  every camera in the catalog.

Defaults stay Sweden-wide; performance comes from viewport + caps, not a hard
`CountyNo=1` lock. Optional `TRAFIKVERKET_COUNTY_NOS` only narrows when set.

### Get a free API key

1. Open [https://api.trafikinfo.trafikverket.se/](https://api.trafikinfo.trafikverket.se/)
   and create a free account.
2. **Wait 30–60 minutes after registering** before creating an API key.
   New accounts often cannot create keys until the portal finishes user sync.
   If the portal shows **"User id not found"** (or similar), wait and retry
   **once** — do **not** spam-create keys or open duplicate accounts.
3. Create an API key in the portal.
4. Put it in `.env` as `TRAFIKVERKET_API_KEY=...` **or** paste it in-app via
   **POWER UP → TRAFIKVERKET**.

Never commit `.env` or real keys.

### Curl tip

Trafikinfo auth can flake if you POST with `Content-Type: application/xml`.
Prefer `text/xml` or `text/plain`:

```bash
curl -sS -X POST 'https://api.trafikinfo.trafikverket.se/v2/data.json' \
  -H 'Content-Type: text/xml' \
  -H 'Accept: application/json' \
  --data-binary @request.xml
```

### Attribution

Contains data from Trafikverket.

### TomTom (optional)

Swedish street traffic does **not** require TomTom. Add a TomTom key only if you
want live flow tiles for cities outside Sweden.

---

## Svenska

### Vad du får

Med nyckel laddar God's Eye View från Trafikverkets officiella Trafikinfo-API:

1. **Camera** — aktiva trafikkameror som stillbilder (`feedType: image`) via
   varje kameras officiella `PhotoUrl`. Hela Sverige som standard.
2. **TravelTimeRoute** (schema 1.5) — väg-/korridorsegment med
   `Geometry.WGS84` LINESTRING + `TrafficStatus`. Primär svensk trafikfärgning.
3. **Situation** (schema 1.6, **kräver** `namespace="road.trafficinfo"`) —
   vägarbeten / meddelanden / allvarlighetsgrad.
4. **TrafficFlow** (schema 1.4) — nationella sensorpunkter (hastighet / flöde).
5. **RoadCondition** — vägförhållanden (när data finns).
6. **WeatherMeasurepoint** — väderstationer (+ observationer när de finns).
7. **TrafficSafetyCamera** — ATK-fartkameror (tydligt märkta vs CCTV).

Hoppas över: WeatherStation, RoadConditionOverview, RoadGeometry m.m.

Nationella kataloger är stora — GEV hämtar/ritar **inte** hela Sverige på
en gång. Trafik använder TomTom-liknande **viewport-bbox** (clamp + pad +
serverklipp, ~120 s cache / ~90 s poll). Kameror / ATK följer CCTV-mönstret:
Sverige-katalog i cache, **närmaste-N** registrerade, `PhotoUrl` bara vid
aktivering.

### Omfattning, tak och reglage

- **Standard:** hela Sverige. Valfri begräsning:
  `TRAFIKVERKET_COUNTY_NOS=1` eller `1,12,14`. `*` / `all` / osatt = nationellt.
- Kameratak: närmaste **500** till svenska metro-ankare
  (`CCTV_TRAFIKVERKET_MAX_SOURCES`).
- Rutt-tak: **500** (`TRAFIKVERKET_TRAFFIC_MAX_ROUTES`).
- Situation-tak: **1500** (`TRAFIKVERKET_SITUATION_MAX_FEATURES`).
- TrafficFlow-tak: **1500** (`TRAFIKVERKET_TRAFFIC_FLOW_MAX_FEATURES`).
- RoadCondition-tak: **800** (`TRAFIKVERKET_ROAD_CONDITION_MAX_FEATURES`).
- WeatherMeasurepoint-tak: **400** (`TRAFIKVERKET_WEATHER_MAX_FEATURES`).
- ATK-tak: **400** (`TRAFIKVERKET_SAFETY_CAMERA_MAX_FEATURES`).
- Placering använder endast `Geometry.WGS84` — aldrig SWEREF99TM.
- Status utan hemligheter: `GET /api/cctv/trafikverket-status`,
  `GET /api/trafikverket/status`.
- Stäng av kameror: `CCTV_TRAFIKVERKET_ENABLED=0`.
- Stäng av lager: `TRAFIKVERKET_TRAFFIC_ENABLED=0`,
  `TRAFIKVERKET_SITUATION_ENABLED=0`, `TRAFIKVERKET_TRAFFIC_FLOW_ENABLED=0`,
  `TRAFIKVERKET_ROAD_CONDITION_ENABLED=0`, `TRAFIKVERKET_WEATHER_ENABLED=0`,
  `TRAFIKVERKET_SAFETY_CAMERA_ENABLED=0`.

### Prestanda (viewport + tak — inte CountyNo=1)

Nationell data är **tillgänglig** som standard; GEV försöker aldrig hämta/rita
hela Sverige på en gång. Mönster speglar befintliga paket:

**TomTom-modell — TravelTimeRoute / Situation / TrafficFlow** (även klipp för
RoadCondition / Weather):

- Klienten begär bara **aktuell viewport** (`?bbox=west,south,east,north`).
- Viewport centreras på kamerans look-at, **begränsas** (~0,1° spännvidd) och
  **paddas** (~0,02°) — samma idé som TomTom z8–16-plattor med ~0,05°
  hämtfönster (typiskt 1–4 plattor vid z12).
- Servern håller en Sverige-katalog i minnet (~**120 s** TTL, som TomToms
  ~120 s plattcache) och **klipper** varje svar till paddad bbox (plus
  närmaste-N till vycentrum för täta punktlager).
- Klientpoll ~**90 s**. Lands-/rymdvy hoppar över hämtning (tom overlay) i stället
  för att ladda hela landet.

**CCTV-modell — Camera / ATK-POI:**

- Katalogen kan vara Sverige-vid och **cachas server-side**.
- Bara **närmaste-N** registreras mot metro-/vyankare
  (`prioritizeSources` / `CCTV_TRAFIKVERKET_MAX_SOURCES` / ATK-tak).
- Kamerans `PhotoUrl` / bildbytes hämtas **bara vid aktivering**, aldrig för
  alla kameror i katalogen.

Standard är hela Sverige; prestanda kommer från viewport + tak, inte låst
`CountyNo=1`. Valfri `TRAFIKVERKET_COUNTY_NOS` begränar bara när den sätts.

### Skapa gratis API-nyckel

1. Gå till [https://api.trafikinfo.trafikverket.se/](https://api.trafikinfo.trafikverket.se/)
   och skapa ett gratis konto.
2. **Vänta 30–60 minuter efter registrering** innan du skapar en API-nyckel.
   Nya konton kan ofta inte skapa nycklar förrän portalen synkat användaren.
   Om portalen visar **"User id not found"** (eller liknande), vänta och försök
   **en gång till** — skapa **inte** många nycklar eller dubbla konton.
3. Skapa en API-nyckel i portalen.
4. Lägg den i `.env` som `TRAFIKVERKET_API_KEY=...` **eller** klistra in den
   i appen via **POWER UP → TRAFIKVERKET**.

Committa aldrig `.env` eller riktiga nycklar.

### Curl-tips

Trafikinfo-auth kan strula med `Content-Type: application/xml`.
Använd `text/xml` eller `text/plain`:

```bash
curl -sS -X POST 'https://api.trafikinfo.trafikverket.se/v2/data.json' \
  -H 'Content-Type: text/xml' \
  -H 'Accept: application/json' \
  --data-binary @request.xml
```

### Attribution

Innehåller data från Trafikverket.

### TomTom (valfritt)

Svensk gatutrafik kräver **inte** TomTom. Lägg till TomTom-nyckel bara om du
vill ha live flödesplattor för städer utanför Sverige.
