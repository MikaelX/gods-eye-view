# Trafikverket Sweden — CCTV + street traffic (optional pack)

English first, Swedish second. This pack is **off** until you set a free
`TRAFIKVERKET_API_KEY`. Austin / Caltrans / TfL and TomTom (optional global
flow) keep working without it.

**One key, two jobs.** The same Trafikinfo key unlocks Stockholm (and more of
Sweden) **road cameras** plus **street traffic** overlays. TomTom stays optional
BYOK if you want global congestion tiles elsewhere.

Stockholm (`CountyNo = 1`) is the **default pack**, not an API hard limit —
national cameras, TravelTimeRoute segments, and Situation events exist for many
counties.

## English

### What you get

With a key, God's Eye View loads from the official Trafikverket Trafikinfo API:

1. **Cameras** — Active road cameras as stills (`feedType: image`) via each
   camera's `PhotoUrl`, proxied like the other CCTV packs.
2. **TravelTimeRoute** (schema 1.5) — street segments with `Geometry.WGS84`
   LINESTRING + `TrafficStatus` (freeflow / heavy / congested), colored on the
   globe. Primary Swedish street layer.
3. **Situation** (schema 1.6, **requires** `namespace="road.trafficinfo"`) —
   roadworks / messages / severity overlay (POINT or LINE).

- Default county: Stockholm (`CountyNo = 1`). Override with
  `TRAFIKVERKET_COUNTY_NOS=1,12,14` or `TRAFIKVERKET_COUNTY_NOS=*` (nationwide;
  caps still apply).
- Camera cap: nearest **200** (`CCTV_TRAFIKVERKET_MAX_SOURCES`).
- Route cap: **250** (`TRAFIKVERKET_TRAFFIC_MAX_ROUTES`).
- Situation cap: **400** (`TRAFIKVERKET_SITUATION_MAX_FEATURES`).
- Disable cameras without removing the key: `CCTV_TRAFIKVERKET_ENABLED=0`.
- Disable traffic overlays: `TRAFIKVERKET_TRAFFIC_ENABLED=0` /
  `TRAFIKVERKET_SITUATION_ENABLED=0`.
- Placement uses `Geometry.WGS84` only — never SWEREF99TM.
- Presence checks (no secrets): `GET /api/cctv/trafikverket-status`,
  `GET /api/trafikverket/status`.
- **TrafficFlow** point sensors (~density/heatmap) are **not** shipped in this
  pack yet (follow-up; `TRAFIKVERKET_TRAFFIC_FLOW_ENABLED` is reserved).

### Get a free API key

1. Open [https://api.trafikinfo.trafikverket.se/](https://api.trafikinfo.trafikverket.se/)
   and create a free account.
2. **Wait 30–60 minutes after registering** before creating an API key.
   New accounts often cannot create keys until the portal finishes user sync.
   If the portal shows errors like **"User id not found"** (or similar
   "unsynced user" messages), wait and retry **once** — do **not** spam-create
   keys or open duplicate accounts.
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

1. **Kameror** — aktiva trafikkameror som stillbilder (`feedType: image`) via
   varje kameras `PhotoUrl`, proxade som övriga CCTV-paket.
2. **TravelTimeRoute** (schema 1.5) — vägsegment med `Geometry.WGS84`
   LINESTRING + `TrafficStatus` (freeflow / heavy / congested), färgade på
   globen. Primärt svenskt gatulager.
3. **Situation** (schema 1.6, **kräver** `namespace="road.trafficinfo"`) —
   vägarbeten / meddelanden / allvarlighetsgrad (POINT eller LINE).

- Standardlän: Stockholm (`CountyNo = 1`). Ändra med
  `TRAFIKVERKET_COUNTY_NOS=1,12,14` eller `TRAFIKVERKET_COUNTY_NOS=*` (hela
  landet; tak gäller fortfarande).
- Kameratak: närmaste **200** (`CCTV_TRAFIKVERKET_MAX_SOURCES`).
- Rutt-tak: **250** (`TRAFIKVERKET_TRAFFIC_MAX_ROUTES`).
- Situation-tak: **400** (`TRAFIKVERKET_SITUATION_MAX_FEATURES`).
- Stäng av kameror utan att ta bort nyckeln: `CCTV_TRAFIKVERKET_ENABLED=0`.
- Stäng av trafiklager: `TRAFIKVERKET_TRAFFIC_ENABLED=0` /
  `TRAFIKVERKET_SITUATION_ENABLED=0`.
- Placering använder endast `Geometry.WGS84` — aldrig SWEREF99TM.
- Status utan hemligheter: `GET /api/cctv/trafikverket-status`,
  `GET /api/trafikverket/status`.
- **TrafficFlow**-punktsensorer (densitet/heatmap) levereras **inte** i detta
  paket ännu (uppföljning; `TRAFIKVERKET_TRAFFIC_FLOW_ENABLED` är reserverad).

### Skapa gratis API-nyckel

1. Gå till [https://api.trafikinfo.trafikverket.se/](https://api.trafikinfo.trafikverket.se/)
   och skapa ett gratis konto.
2. **Vänta 30–60 minuter efter registrering** innan du skapar en API-nyckel.
   Nya konton kan ofta inte skapa nycklar förrän portalen synkat användaren.
   Om portalen visar fel som **"User id not found"** (eller liknande om
   osynkad användare), vänta och försök **en gång till** — skapa **inte**
   många nycklar eller dubbla konton.
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
