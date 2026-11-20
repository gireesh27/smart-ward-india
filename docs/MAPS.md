# Maps and boundaries

## What is installed

Boundary layers in `public/geo/` were generated from the files supplied for this project and are used by every map:

| File | Contents | How it was built |
|---|---|---|
| `andhra-pradesh-districts.geojson` | **28 districts** (current, incl. Markapuram and Polavaram), keyed by LGD code | The supplied district file predates the December 2025 reorganisation (26 districts), so districts are rebuilt by **dissolving the supplied mandal shapes by their current LGD district**. The mandal file is topologically clean (87 % of border segments shared exactly by two mandals), so neighbouring districts fit without gaps or overlaps. |
| `andhra-pradesh-mandals.geojson` | 696 mandal shapes; `lgdCodes`, `district`, `acNo` | 695 of 696 matched to LGD sub-district codes (565 exact name, 32 name + position, 76 transliteration variant, 11 city split into several LGD mandals, 6 abbreviation, 5 renamed). Unmatched: Bhadrachalam (East Godavari) (now in Telangana). LGD mandals without a shape (7): Adoni-2 (Kurnool), Gudluru (Prakasam), Gurthedu (Polavaram), Karvetinagar (Chittoor), K Gangavaram (Dr. B.R. Ambedkar Konaseema), Rayavaram (East Godavari), Yetapaka (Polavaram) — mostly created after the source file. Each mandal is placed in the assembly constituency containing it. |
| `andhra-pradesh-assembly-constituencies.geojson` | **175** assembly constituencies (2024): number, name, SC/ST reservation, Lok Sabha seat, current district | Supplied constituency shapes merged per constituency number, with the supplied metadata. No election results are included. |
| `andhra-pradesh.geojson` | State outline | The outline of the 28 current districts. |
| `andhra-pradesh-soi.geojson` | Survey of India reference outline (via DataMeet, CC BY 4.0) | From the supplied Survey of India shapefile. Kept as a reference only: it predates the 2014 transfer of the Khammam mandals (Chinturu, Kunavaram, Velerupadu area) to Andhra Pradesh. |

`data/geo/boundaries-report.json` records sources, counts and every unmatched name. District headquarters (`data/geo/district-hq.json`) were checked against news reports of the December 2025 notification: Polavaram → Rampachodavaram, Annamayya → Madanapalle, Markapuram → Markapuram.

## Where maps appear

| Page | Map |
|---|---|
| `/map` | Full-screen atlas: all layers, search, labels, details panel |
| `/dashboard` | Interactive atlas; tap a district for its dashboard |
| `/admin` → District Overview | Compact atlas in the reference's blue palette; the selected district is outlined and zoomed |
| `/` → Ward Development Dashboard | Static silhouette of the real state outline with the featured district highlighted and a pin; "Explore map" opens `/map` |
| Report form, complaint pages | OpenStreetMap with the resident's pin |

## Drill-down from districts to villages

The map starts in **Auto** mode and changes layer as you zoom in, so you can go from the whole state down to a village:

| Zoom | Layer shown | Filtered to |
|---|---|---|
| up to 7 | Districts (28) | all |
| 8 to 9 | Assembly constituencies (175) | the selected district |
| 10 to 11 | Mandals (696) | the selected constituency, or district |
| 12 and closer | Villages | the selected mandal (when village boundaries are installed) |

Clicking an area selects it and zooms in, which moves to the next layer. The path above the map
(*Andhra Pradesh › Krishna › Pedana › Bantumilli …*) goes back up a level. The layer tabs can pin one
layer instead of Auto. Constituencies and mandals do not nest perfectly (some mandals span two
constituencies); mandals are shown under the constituency that contains their centre.

### Village boundaries (optional, you download them)

LGD lists 17,957 villages but has no shapes. Without boundaries, selecting a mandal still lists its
villages and their Gram Panchayats from LGD. To draw villages on the map:
1. Download the Andhra Pradesh file from the **Indian Village Boundaries** project by DataMeet
   (github.com/datameet/indian_village_boundaries; GeoJSON, Census 2011 boundaries, licence ODbL).
2. Save it as `data/geo/source/villages-ap.geojson` and run
   `npm run geo:prepare -- --villages data/geo/source/villages-ap.geojson`.
3. The script links each shape to its LGD village through the Census 2011 code, writes one small file
   per mandal to `public/geo/villages/` plus `index.json`, and reports the match rate. The ODbL
   attribution is added to the map automatically.

These are 2011 boundaries: villages created or merged since then will not match, and the layer predates the 2014 and 2022 reorganisations, so it is joined by village code, never by district name.

## Map features (AtlasMap)

- **Layers**: Districts · Mandals · Constituencies, shaded by average development score of the latest scored month (legend shown). Constituency scores are **approximate**: they combine the mandals whose centre lies inside the constituency.
- **Zoom and pan**: + / − buttons, double-click/double-tap, keyboard (arrows, + / −). **Two-finger pinch** zooms and pans on phones and tablets. On embedded maps one finger scrolls the page (a hint says "use two fingers"), and the mouse wheel zooms with Ctrl/⌘ — so maps never trap page scrolling. On `/map` and in full screen, one finger pans and the wheel zooms.
- **Full screen** (Esc to exit), **reset view**, **my location**, **search** by name or constituency number, **labels** toggle.
- **Select** any area: a details panel shows score, wards, Panchayats/municipalities and this month's complaints, with **Zoom to** and **Open district dashboard**.
- Hover highlight and tooltips; works in light and dark mode.

Statistics come from `GET /api/geo/stats?layer=districts|mandals&month=YYYY-MM` (public, aggregated, cached five minutes).

## Regenerating the layers

Place the source files in `data/geo/source/` (they are git-ignored because of their size) and run:
```bash
npm run geo:prepare -- \
  --districts data/geo/source/AndhraPradesh_Districts.geojson \
  --mandals data/geo/source/MANDAL.geojson \
  --constituencies data/geo/source/Constituencies_AndhraPradesh_2024.geojson \
  --constituency-meta data/geo/source/Final_Andhra_Constituencies_2024.json \
  --state data/geo/source/India-States.shp
```
Every input is optional; each one updates its own layer. `.shp` shapefiles are read directly (polygons + `.dbf` attributes); GeoJSON must be WGS84 longitude/latitude — re-project other data first (`ogr2ogr -t_srs EPSG:4326`). If a path is wrong the script says so; in examples, replace any `path/to/…` with your real file path.

## Tiles

`NEXT_PUBLIC_MAP_TILE_URL` defaults to the OpenStreetMap community tile server — fine for development; production traffic needs your own tile server or a commercial provider, keeping attribution in `NEXT_PUBLIC_MAP_ATTRIBUTION`.

## Licences and attribution

The Survey of India reference data came via a DataMeet-based archive under CC BY 4.0 — keep the attribution shown on `/map`. Confirm the licence of the supplied district, mandal and constituency layers before public use. For official publications, use boundaries certified by Survey of India or the state government.
