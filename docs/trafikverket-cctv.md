# Trafikverket Stockholm CCTV (optional pack)

English first, Swedish second. This pack is **off** until you set a free
`TRAFIKVERKET_API_KEY`. Austin / Caltrans / TfL keep working without it.

## English

### What you get

With a key, God's Eye View loads **Stockholm county** road cameras
(`CountyNo = 1`) from the official Trafikverket Trafikinfo **Camera** API and
shows them as stills (`feedType: image`) via each camera's `PhotoUrl`, proxied
like the other CCTV packs.

- Default cap: nearest **200** of ~350+ county cameras
  (`CCTV_TRAFIKVERKET_MAX_SOURCES`, default `200`).
- Disable without removing the key: `CCTV_TRAFIKVERKET_ENABLED=0`.
- Placement uses `Geometry.WGS84` WKT `POINT (lon lat)` only — never SWEREF99TM.
- Presence check (no secrets): `GET /api/cctv/trafikverket-status`.

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

---

## Svenska

### Vad du får

Med nyckel laddar God's Eye View **Stockholms läns** trafikkameror
(`CountyNo = 1`) från Trafikverkets officiella Trafikinfo-**Camera**-API och
visar dem som stillbilder (`feedType: image`) via varje kameras `PhotoUrl`,
proxade som övriga CCTV-paket.

- Standardtak: närmaste **200** av ~350+ kameror i länet
  (`CCTV_TRAFIKVERKET_MAX_SOURCES`, standard `200`).
- Stäng av utan att ta bort nyckeln: `CCTV_TRAFIKVERKET_ENABLED=0`.
- Placering använder endast `Geometry.WGS84` WKT `POINT (lon lat)` — aldrig
  SWEREF99TM.
- Status utan hemligheter: `GET /api/cctv/trafikverket-status`.

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
