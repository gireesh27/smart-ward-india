# Real geography: Local Government Directory (LGD) data

Smart Ward India uses the official **Local Government Directory** (lgdirectory.gov.in, Ministry of Panchayati Raj) for every state, district, mandal, Gram Panchayat, urban local body, ward and village. Every record keeps its **LGD code**, so the data can be refreshed without breaking complaints, projects or user assignments.

## What is included

The repository ships converted Andhra Pradesh data in `data/lgd/andhra-pradesh/` (generated from the LGD exports dated 19 November 2026):

| Level | Count | File |
|---|---|---|
| State | 1 (Andhra Pradesh, LGD code 28) | — |
| Districts | 28 | `districts.csv` |
| Mandals (sub-districts) | 688 | `subdistricts.csv` |
| Gram Panchayats | 13,327 | `local-bodies.csv` (kind `GP`) |
| Urban local bodies | 124 (17 municipal corporations, 82 municipalities, 25 nagar panchayats) | `local-bodies.csv` (kind `ULB`) |
| Wards | **245,030** (241,107 Gram Panchayat wards + 3,923 urban wards) | `wards.csv` |
| Villages (mapped to their Gram Panchayat) | 17,957 | `villages.csv` |

`report.json` records the source files, counts per district and data-quality findings:

| Finding | Count | Meaning |
|---|---|---|
| Villages without a Gram Panchayat | 688 | Not mapped to a GP in LGD (639 inhabited, 47 uninhabited, 2 forest). They still appear in village search results only when mapped. |
| Ward numbers renumbered | 164 | LGD listed a duplicate or missing ward number inside a local body; the converter assigns the next free number and keeps the LGD ward code. |
| GPs placed by Zilla Parishad name | 0 | Fallback when a GP has no mapped villages (none needed). |
| Local bodies without wards | 0 | — |
| Duplicate ward codes | 0 | — |

Mandal Parishad (39,550 rows) and Zilla Parishad (679 rows) constituencies in the PRI export are **not** imported: residents report problems to their Gram Panchayat ward.

### Per district

| District | Gram Panchayats | Urban bodies | Wards | Villages |
|---|---|---|---|---|
| Alluri Sitharama Raju | 244 | 0 | 4,880 | 2,477 |
| Anakapalli | 646 | 2 | 12,393 | 740 |
| Ananthapuramu | 577 | 7 | 11,644 | 506 |
| Annamayya | 411 | 4 | 7,171 | 362 |
| Bapatla | 358 | 3 | 5,974 | 211 |
| Chittoor | 622 | 4 | 12,293 | 767 |
| Dr. B.R. Ambedkar Konaseema | 342 | 3 | 6,905 | 283 |
| East Godavari | 342 | 4 | 6,748 | 323 |
| Eluru | 547 | 4 | 9,001 | 668 |
| Guntur | 258 | 4 | 5,176 | 224 |
| Kakinada | 385 | 7 | 7,667 | 436 |
| Krishna | 491 | 5 | 4,947 | 507 |
| Kurnool | 484 | 4 | 9,200 | 472 |
| Markapuram | 406 | 3 | 8,026 | 510 |
| NTR | 288 | 5 | 3,254 | 327 |
| Nandyal | 489 | 6 | 9,502 | 457 |
| Palnadu | 527 | 8 | 10,086 | 364 |
| Parvathipuram Manyam | 451 | 3 | 8,515 | 967 |
| Polavaram | 186 | 0 | 3,684 | 834 |
| Prakasam | 519 | 6 | 10,458 | 520 |
| Sri Potti Sriramulu Nellore | 700 | 6 | 14,069 | 718 |
| Sri Sathya Sai | 467 | 6 | 9,148 | 461 |
| Srikakulam | 912 | 4 | 17,797 | 1,472 |
| Tirupati | 807 | 6 | 15,003 | 1,082 |
| Visakhapatnam | 79 | 1 | 1,668 | 165 |
| Vizianagaram | 777 | 4 | 15,222 | 983 |
| West Godavari | 393 | 6 | 8,032 | 319 |
| Y.S.R. Kadapa | 619 | 9 | 6,567 | 802 |

## How it gets into the database

`npm run db:seed` (development) imports the hierarchy automatically, then adds synthetic demo activity for a pilot area (see below). For a production database use the non-destructive importer:

```bash
npm run lgd:import          # reads data/lgd/andhra-pradesh (or LGD_DATA_DIR)
```
It upserts districts, mandals, local bodies, wards and villages **by LGD code** with `INSERT … ON CONFLICT` in batches of 1,000 (about 30–60 s for 245,000 wards), keeps any coordinates already in the database, and **deactivates** (never deletes) local bodies or wards that LGD no longer lists. It never touches users, complaints or projects.

## Refreshing from new LGD downloads

1. On lgdirectory.gov.in, open the download/report section and download these reports for **Andhra Pradesh** in Excel format. The converter recognises them by file-name prefix (LGD's default names):

   | Required | File name starts with | Contents |
   |---|---|---|
   | ✓ | `districtofSpecificState` | districts |
   | ✓ | `subDistrictofSpecificState` | sub-districts (mandals) |
   | ✓ | `villageofSpecificState` | villages |
   | ✓ | `villageGramPanchayatMapping` | village → Gram Panchayat |
   | ✓ | `priWards` | PRI local bodies and wards (~270 MB) |
   | ✓ | `ulbSpecificState` | urban local bodies |
   | ✓ | `uLBWardforState` | urban wards |
   | recommended | `uLBWardforStateWithCov` | urban ward → district/mandal coverage (places each ULB in its district) |
   | optional | `blockofspecificState`, `allBlockStateWithCoveredVillage` | blocks (mandal parishads) and their villages |

2. Put the files in `data/lgd/raw/` (git-ignored; duplicate downloads such as `…_1.xls` are ignored automatically).
3. Convert, check the report, then import:
   ```bash
   npm run lgd:convert
   cat data/lgd/andhra-pradesh/report.json
   npm run lgd:import
   ```

The converter (`scripts/lgd/convert.mjs`) is dependency-free Node.js. LGD's ".xls" files are Excel 2003 XML spreadsheets; it streams them, so the 270 MB PRI export converts in seconds. It validates the expected columns and stops with a clear message if LGD changes its format. Other states: `node scripts/lgd/convert.mjs --in <folder> --out data/lgd/<state> --state-code <code> --state-name "<name>"`, then `npm run lgd:import -- --dir data/lgd/<state>`.

## How district and mandal are decided

- **Gram Panchayat → district and mandal**: the district/sub-district that most of its villages belong to (village → GP mapping). The PRI export's district-level parent is the Zilla Parishad, which still follows the pre-2022 districts, so it is used only as a fallback.
- **Urban local body → district and mandal**: the district/sub-district most of its wards cover (`uLBWardforStateWithCov`).
- **District names**: LGD's English names, except short acronyms that LGD title-cases (`Ntr` → `NTR`).

## Coordinates

LGD publishes **no coordinates or boundaries**. District, mandal and constituency shapes come from separate boundary files (`docs/MAPS.md`); mandal shapes are linked to LGD sub-district codes. District headquarters (`data/geo/district-hq.json`, used to centre maps) follow the December 2025 notification: Polavaram → Rampachodavaram, Annamayya → Madanapalle, Markapuram → Markapuram.

## Demo activity (development seed only)

Synthetic complaints, indicator readings, projects and meetings are generated **only** for a pilot area, matching roadmap Phase 3: all 10 urban local bodies of Krishna and NTR districts (331 wards) and the Gram Panchayats of Movva (Kuchipudi), Ghantasala and Mopidevi mandals (56 GPs, 542 wards) — 873 real wards in total. Every other ward exists with its real name and code but shows "insufficient data" until real readings are recorded.
