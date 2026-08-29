# X9 — Ingesting, converting, and rendering AutoCAD DWG/DXF in a TypeScript / Tauri desktop app (offline, 2026)

**Lane:** `x9-dwg-dxf-ingest`
**As of:** 2026-08-17
**Scope:** Local-only, proprietary/closed Tauri + TypeScript desktop app. No cloud CAD APIs. Corpus reality: 837 `.dwg` files (13.8 GB, edited through 2026-05) vs 201 STEP files — AutoCAD DWG is the dominant working format, not STEP.
**Method:** Live GitHub API, npm registry, official product/FAQ/license pages, and GNU docs fetched on this date. Claims without a live page are labeled `UNVERIFIED`. This is not legal advice.

---

## Verdict

There is **no free, high-fidelity, redistributable DWG reader** that a closed Tauri app can legally bundle.

| Need | What actually satisfies it | What people think satisfies it |
| --- | --- | --- |
| Browse 837 DWGs as a grid | Embedded preview bitmap (BMP / WMF / PNG) extracted without a full parse | “Just convert everything to STEP / glTF” |
| Open a 2D drawing in-app | MIT `@mlightcad/data-model` + `cad-simple-viewer` on **DXF**; DWG only after a licensed converter | `@mlightcad/libredwg-web` “is MIT because the viewer is MIT” — the WASM is **GPL-3.0** |
| Faithful paper-space / dims / SHX | QCAD Professional CLI (`dwg2pdf` / `dwg2svg`) or ODA Drawings / inWEB | `dxf-viewer` / `three-dxf` — they skip paper space, lineweights, SHX |
| 3D solids inside DWG | ODA Drawings SDK or Autodesk RealDWG | LibreDWG / ezdxf — they can *see the SAT/SAB blob*, not tessellate it |
| Batch DWG → DXF on Linux | User-installed ODA File Converter (non-commercial FAQ) **or** purchased QCAD Pro `dwg2dwg` **or** LibreDWG `dwg2dxf` as a **separate process** | “Ship ODA File Converter inside the installer” — **ODA forbids this for non-members** |

**Hard nos for a proprietary offline desktop app:** linking LibreDWG (or `@mlightcad/libredwg-web`) into the product; redistributing ODA File Converter; RealDWG on Linux/Tauri; assuming 3D DWG is an open format.

**Winner / runner-up / the bite** are in §8.

---

## 1. DWG readers

### 1.1 LibreDWG (GNU)

| Field | Live value 2026-08-17 | Source |
| --- | --- | --- |
| License | **GPL-3.0-or-later** | [GNU LibreDWG](https://www.gnu.org/software/libredwg/); [README](https://raw.githubusercontent.com/LibreDWG/libredwg/master/README); GitHub `license.spdx_id` = `GPL-3.0` |
| LGPL path? | **None.** The project is a GNU package under ordinary GPL v3+, not LGPL. FSF copyright assignment applies. | GNU page “Licensing” section; 2012 LibreCAD incompatibility is still live in 2026 (LibreCAD is GPLv2-only) |
| Maturity | Officially **beta**. Decoder “done”; some advanced R2010+ objects skipped. Writer good for R1.1–R2000; R2007 weak; R2010–R2018 write still CRC-errors. | [README](https://raw.githubusercontent.com/LibreDWG/libredwg/master/README); [gnu.org/software/libredwg](https://www.gnu.org/software/libredwg/) |
| Latest release | **0.14**, published 2026-06-27 | [GitHub releases](https://github.com/LibreDWG/libredwg/releases) |
| Last commit | 2026-08-12 (`2d8f277345` “dwgadd: accept CRLF…”) | GitHub API |
| Stars | 1,535 | GitHub API |
| Maintainer | Reini Urban | GNU page |

What it actually ships (all GPL-3):

- `dwgread` — DWG → JSON / DXF / DXFB / GeoJSON
- `dwg2dxf` — “About 90% coverage” (project’s own claim)
- `dxf2dwg` — DXF → DWG, r2000 only, “about 80%”
- `dwg2SVG` / `dwg2ps` — 2D only, “handles only some entities”
- `dwgbmp` — extract embedded thumbnail (BMP / WMF / PNG)
- `dwggrep`, `dwglayers`, `dwgfilter`, `dwgadd`

**What GPL-3 contaminates.** FSF FAQ `#IfLibraryIsGPL`: if a library is released under the GPL (not the LGPL), “any software which uses it has to be under the GPL or a GPL-compatible license.” FAQ `#LinkingWithGPL` treats static **and** dynamic linking as making a combined work. FAQ `#GPLWrapper` rejects a “wrapper module under a lax license” as a way around this. FAQ `#MereAggregation` is the only safe pattern: two **independent programs** that communicate at arm’s length (files, pipes), shipped on the same disk. ([GNU GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html), fetched 2026-08-17)

Consequences for this app:

| Integration | Effect on a closed Tauri app |
| --- | --- |
| Link `libredwg.so` / compile into the Rust sidecar | Combined work → **entire app must be GPL-3** |
| Embed `@mlightcad/libredwg-web` WASM in the WebView | Combined work. WASM is just another link form. |
| Put LibreDWG in a Web Worker “for license isolation” | **Architectural, not legal.** mlightcad itself labels this “not legal advice.” |
| Ship `dwg2dxf` / `dwgbmp` as a **separate CLI**, invoke via `std::process`, exchange files | Classic mere-aggregation. You must still ship LibreDWG’s GPL-3 source offer for *that* binary. Your app stays closed. |
| Tell the user to `apt install libredwg-tools` and call it if present | Safest. You never convey LibreDWG. |

LibreCAD still cannot link LibreDWG in 2026 because LibreCAD is **GPLv2-only** and GPLv2 is incompatible with GPLv3. That is the historical proof there is no “just relicense it LGPL” path. ([LibreCAD LICENSE](https://raw.githubusercontent.com/LibreCAD/LibreCAD/master/LICENSE); [forum, 2024-07-17](https://forum.librecad.org/DWG-DXF-format-td5725080.html); [LibreCAD issue #351](https://github.com/LibreCAD/LibreCAD/issues/351))

**3D / ACIS.** LibreDWG’s own docs: the `AcDS` section “used mostly for binary ACIS blobs.” The FSF wiki still says LibreDWG can decode 3D solids only **partially**; solids are SAT/SAB for the Spatial ACIS kernel. A 2024 discussion (#1160) still treats SAT parsing as a missing library. LibreDWG can *carry the blob*. It is not an ACIS kernel. ([LibreDWG.texi §AcDS](https://raw.githubusercontent.com/LibreDWG/libredwg/master/doc/LibreDWG.texi); [LibrePlanet LibreDWG/SummerOfCode](https://libreplanet.org/wiki/Group:LibreDWG/SummerOfCode); [discussion #1160](https://github.com/LibreDWG/libredwg/discussions/1160))

### 1.2 `@mlightcad/libredwg-web` and the mlightcad stack

This is the only serious 2025–2026 in-browser DWG effort. It is **not** one package.

| Package | License | npm latest | Unpacked | Role |
| --- | --- | --- | --- | --- |
| `@mlightcad/libredwg-web` | **GPL-3.0** | 0.7.9 (2026-07-21) | 11.18 MB | Emscripten build of LibreDWG |
| `@mlightcad/libredwg-converter` | **GPL-3.0** | 3.13.0 (2026-08-15) | 10.42 MB | Worker wrapper → `AcDbDatabase` |
| `@mlightcad/data-model` | **MIT** | 1.13.0 | 6.75 MB | ObjectARX-shaped drawing DB + **built-in MIT DXF converter** |
| `@mlightcad/cad-simple-viewer` | **MIT** | 1.6.0 | 9.10 MB | Three.js viewport |
| `@mlightcad/cad-viewer` | **MIT** | 1.6.0 | — | Vue shell |
| `@mlightcad/three-renderer` | MIT | 1.6.0 | — | WebGL renderer |
| `@mlightcad/svg-renderer` | MIT | 0.0.1 (2025-08-06) | — | “isn’t fully implemented yet” |
| `@mlight-cad/dwg-converter` | **proprietary** | private GitHub Packages | ~437 KB (author claim) | Drop-in DWG converter |

Repos (live 2026-08-17):

- [`mlightcad/libredwg-web`](https://github.com/mlightcad/libredwg-web) — 71★, last commit 2026-07-21 (`feat: add property thumbnailImage in interface DwgDatabase`). Demos include JSON dump, raw WASM, **DWG→SVG**, **extract thumbnail**.
- [`mlightcad/realdwg-web`](https://github.com/mlightcad/realdwg-web) — 33★, last commit 2026-08-15. Name is marketing: it is **not** Autodesk RealDWG. It is an ObjectARX-like TypeScript SDK.
- [`mlightcad/cad-viewer`](https://github.com/mlightcad/cad-viewer) — 940★, last commit 2026-08-16. The product.

Author-stated GPL posture ([realdwg-web README](https://raw.githubusercontent.com/mlightcad/realdwg-web/master/README.md), 2026-08-17):

> `@mlightcad/libredwg-converter` runs its LibreDWG parser in a Web Worker. That is a deliberate licensing choice: the upstream parser is copyleft (GPL), so keeping it in a separate worker bundle helps isolate that code from the main application.
>
> **This is an architectural description, not legal advice.**

cad-viewer’s own known-issues table is more honest than the worker story ([cad-viewer README](https://raw.githubusercontent.com/mlightcad/cad-viewer/master/README.md)):

| Item | LibreDWG-based parser | Proprietary DWG parser |
| --- | --- | --- |
| Supported entities | Limited coverage | Broader coverage |
| Bundle size | ~13 MB | ~437 KB |
| Load speed | Slower startup | Much faster |
| Memory | Higher | Lower |
| Large DWG | May OOM | “No such issue” |
| License | **GPL propagation risk** | No GPL propagation |

**Proprietary parser terms** ([PROPRIETARY-PARSER.md](https://raw.githubusercontent.com/mlightcad/cad-viewer/master/PROPRIETARY-PARSER.md), fetched 2026-08-17):

- $3,000 one-time “donation” = perpetual use of the delivered version
- Year-1 upgrades included; $1,500/year after that for new packages
- Embed and redistribute **inside your app** (desktop / SaaS / white-label); **do not** resell as a standalone parser SDK
- Company-only trial via private `@mlight-cad/dwg-converter`
- 3D: “Partially. The parser can extract 3DSOLID entities and decode a portion of the embedded ACIS SAB payload. Full B-rep tessellation is not yet available” — best-effort wireframe or bounding box
- Maintainer is a **full-time individual**, not a company. No SLA.

X activity in 2026 is almost entirely `@mlightcad` shipping versions (v1.5.10 on 2026-08-10 claims in-browser open is faster than cloud-conversion viewers). A Dec 2025 GitHubDaily post (58k views) is how this stack entered the Chinese mainstream. There is **no second independent DWG-WASM project** of similar maturity on X or GitHub as of this date. ([@mlightcad 2026-08-10](https://x.com/mlightcad/status/2086780705066098939); [GitHubDaily 2025-12-26](https://x.com/GitHub_Daily/status/2004492417165357196))

**ODA Drawings inWEB** (Oct 2024) is the commercial WASM counterpart: JS API, React/Angular/Svelte, create/edit/visualize/save DWG in the browser. **Members only.** ([ODA blog 2024-10-08](https://www.opendesign.com/blog/2024/october/drawings-inweb-sdk-oda); [Wikipedia inWEB](https://en.wikipedia.org/wiki/Open_Design_Alliance))

### 1.3 ODA File Converter / Drawings SDK

**Teigha** is the retired 2010–2018 brand. Current names: Drawings SDK (native) and Drawings inWEB (browser).

#### File Converter — quote the terms

ODA FAQ, fetched 2026-08-17 ([What are ODA Viewer and ODA File Converter?](https://www.opendesign.com/faq/question/what-are-oda-viewer-and-oda-file-converter)):

> ODA Viewer and ODA File Converter are example projects that illustrate the possibilities of the ODA framework. They are free downloads that you can use to get an overview of ODA SDKs. **If you are not an ODA member, you can use them for non-commercial applications only.**
>
> We do not distribute ODA File Converter; we distribute our SDKs…

That is the answer. **You may not redistribute the File Converter inside a commercial desktop app** unless you are an ODA member licensed to do so. Wikipedia notes ODA removed free *trial* downloads of ODAFileConverter in September 2024 (citation needed on the wiki); the guestfiles page is nonetheless live today and serves **v27.1** Linux RPM/DEB/AppImage, macOS arm64/x64, Windows x64 MSI, Qt 6 bundled, CLI + GUI, directory-in / directory-out. ([guestfiles page](https://www.opendesign.com/guestfiles/oda_file_converter), 2026-08-17; [Wikipedia](https://en.wikipedia.org/wiki/Open_Design_Alliance))

CLI shape (directory batch, not single-file): source dir, target dir, filter (`*.dwg;*.dxf`), output version, recursive, audit.

#### Drawings SDK — membership and money

Published list prices on [opendesign.com/pricing](https://www.opendesign.com/pricing) (snippets fetched 2026-08-17; the JS page itself did not render as markdown):

| Tier | First year | Recurring | What you get |
| --- | --- | --- | --- |
| Non-commercial | (listed separately; 2-year cap) | — | In-house R&D only. **No commercial distribution.** |
| Commercial | **$3,000** | **$2,250 / yr** | Sell up to **100 copies**. **Web/SaaS not allowed.** |
| Sustaining | **$7,500** | **$4,500 / yr** | Unlimited commercial + **web/SaaS**. This is the Tauri-relevant paid tier if you embed the SDK. |
| Founding / Corporate | contact | contact | Source, multi-BU |

Membership rules PDF is dated Oct 27 2025; pricing PDF is filed under `/agreements/2026/`. Annual subscription: **if the subscription ends you lose the right to distribute the ODA-based product**, even if it was developed while licensed. ([pricing/individual FAQ snippet](https://www.opendesign.com/pricing/individual); [Wikipedia membership](https://en.wikipedia.org/wiki/Open_Design_Alliance))

Drawings SDK claims “access 100% of the data in DWG,” C++ / .NET / Python / Java, Linux/Windows/macOS. 60-day member trial. Bricsys, Autodesk, Microsoft, Dassault, Bentley are members — this is the industry’s real DWG kernel besides Autodesk’s own. ([Drawings SDK](https://www.opendesign.com/products/drawings))

### 1.4 Autodesk RealDWG

Sold through Tech Soft 3D, not Autodesk.com retail.

| Field | Live value | Source |
| --- | --- | --- |
| Price | **$8,000 USD / €7,500 per year**, up to 10,000 end users. Above that, contact. | [techsoft3d.com/oem/realdwg](https://www.techsoft3d.com/oem/realdwg/) |
| Term | **12 months only. Not perpetual.** Starts on contract date. | same FAQ |
| Trial | **None.** Evaluate via ObjectARX + AutoCAD 30-day trial. | same |
| Platform | **Windows desktop only.** “Not permissible to host a RealDWG application on a server.” | same |
| What it is | ObjectDBX subset of ObjectARX. Read/write DWG/DXF. **No UI, no draw, no plot, no PDF.** | same |
| Current train | RealDWG **2027**: Windows 11, VS 2026 / .NET 10 | [APS RealDWG overview](https://aps.autodesk.com/developer/overview/realdwg-api) |

**Unusable as a Tauri/Linux ingest core.** It does not run on Linux, does not render, and is a yearly Autodesk contract. Royalty-free distribution of *your* Windows app is the product; it is not a sidecar you drop next to a WebView.

### 1.5 `dwg2dxf`, `libdxfrw`, Teigha legacy, `dwgread`

| Tool | License | Last activity | Fidelity | Notes |
| --- | --- | --- | --- | --- |
| LibreDWG `dwg2dxf` / `dwgread` | GPL-3.0-or-later | 2026-08-12 | Author: ~90% DXF out | Best open CLI. See §1.1. |
| LibreCAD `libdxfrw` | **GPL-2.0-or-later** | last code 2025-09-25; repo pushed 2025-11-06 | README: “**rudimentary** capabilities to read DWG”; DXF r/w is the real product | [LibreCAD/libdxfrw](https://github.com/LibreCAD/libdxfrw) 290★. Cannot absorb LibreDWG (v2 vs v3). LibreCAD 2026 forum: DWG work is still “placeholders,” expected to merge “in the coming days” — treat as incomplete. |
| QCAD Community | GPLv3 + plugin exceptions | 2026-08-16 | **DXF only** | DWG is a **proprietary plugin**. |
| QCAD Professional `dwg2dwg` | commercial + Teigha/ODA | current | Same class as ODA Converter (same libraries) | See §5.2. **QCAD Professional may not be redistributed.** |
| “Teigha File Converter” | retired name | — | — | Today’s ODA File Converter. Same non-commercial guest terms. |
| ACadSharp (C#) | **MIT** | 2026-08-11, 821★ | Reads **and writes** DWG/DXF | Serious non-JS open reader. Not WASM. Viable as a **.NET sidecar**, not as an in-WebView library. 3D/ACIS status not documented on the README. ([DomCR/ACadSharp](https://github.com/DomCR/ACadSharp)) |
| IxMilia.Dxf | MIT | 2026-07-28, 270★ | DXF only | .NET. |

### 1.6 Other / 2025–2026 WASM and JS work

- **mlightcad** is the open WASM story. See §1.2.
- **ODA Drawings inWEB** is the paid WASM story. See §1.3.
- Autodesk compiled AutoCAD itself to WASM for I/O 2018. That is AutoCAD Web, cloud-tied, not a redistributable SDK. ([@AutoCAD 2018-05-08](https://x.com/AutoCAD/status/993963826914648064))
- No other independent “DWG WASM” project of production weight showed up in GitHub API or X Latest search on 2026-08-17.

---

## 2. DXF readers in JS/TS

DXF is the documented Autodesk interchange. A 2026 DWG from this corpus will often be R2018/R2021/R2024; the matching DXF is huge, ASCII or binary, and still loses some proxy/custom objects. For 2D patent figures it is usually enough **if** the converter is faithful.

### 2.1 `dxf-parser` (`gdsestimating/dxf-parser`)

| Field | Value |
| --- | --- |
| License | MIT |
| npm | **1.1.2** (last publish **2022-06-16**) |
| Last commit | 2023-03-15 |
| Stars | 554 |
| API | `new DxfParser().parse(text)` → one big JS object |

Supports: header, most 2D entities, layers, LTYPE, BLOCK + INSERT, VPORT, TEXT and some MTEXT, some XDATA. Does **not** support 3DSOLID, all LEADER types, “other less common objects.” ([README](https://raw.githubusercontent.com/gdsestimating/dxf-parser/master/README.md))

Stale. Fine as a diagnostic dump. Not a 2026 production parser.

### 2.2 `dxf-viewer` (`vagran/dxf-viewer`)

| Field | Value |
| --- | --- |
| License | **MPL-2.0** (file-level copyleft — safer than GPL for a closed app if you don’t modify the MPL files, or you publish your patches to those files) |
| npm | **1.0.48** (2026-06-08) |
| Last commit | 2026-06-08 |
| Stars | 573 |
| Unpacked | 791 KB |
| API | Worker-friendly parse → Three.js WebGL batches |

**Honest about what it cannot do** ([README](https://raw.githubusercontent.com/vagran/dxf-viewer/master/README.md), 2026-08-17):

- No paper space / layouts / viewports
- No line patterns (everything continuous); no wide / variable-width lines
- Text: TTF list only; **DXF style and font attributes ignored**; no advanced MTEXT (fonts, color, stacking)
- Hatch: missing outer style, solid/gradient, MPolygon, double lines, external-entity boundaries
- Dimensions: linear-ish only; no leaders; no arrowhead catalog
- No non-UTF-8 / `$DWGCODEPAGE`
- OCS only +Z/−Z
- Depends on `dxf-parser` internally and therefore buffers the whole file (gigabyte DXF dies)

This is the best *small* MIT-adjacent WebGL DXF viewer. It will look “CAD-ish,” not AutoCAD.

### 2.3 `three-dxf` (`gdsestimating/three-dxf`)

| Field | Value |
| --- | --- |
| License | MIT |
| npm | **1.3.1** (2022-06-27) |
| Last commit | 2021-10-22 |
| Stars | 642 |

`ThreeDxf.Viewer(dxf, el, w, h)` over `dxf-parser`. Supports most LW entities, layers, simple TEXT, splines, ellipses, basic MTEXT. No ATTRIB, no 3DSOLID, no leaders. **Abandoned.** Do not start a new product on it.

### 2.4 `@mlightcad/*` DXF path

`@mlightcad/data-model` registers `AcDbNativeDxfConverter` by default. MIT, main-thread, no worker, no extra WASM. This is the DXF half of realdwg-web. Entity coverage is whatever `cad-simple-viewer` can draw (see §3): layers, blocks/inserts, hatches, lineweights, layouts/paper space, custom shaders for linetypes. Roadmap still has TEXT/MTEXT and dimension *creation* unchecked; **viewing** those entities is further along than the editor checkboxes imply, but treat advanced MTEXT and non-linear dims as incomplete until you run the 837-file corpus through it.

Deprecated GPL DXF converters (`@mlightcad/dxf-json-converter`, `@mlightcad/libdxfrw-converter`) were moved to `mlightcad/dwg-dxf-converter`. Do not pick those up.

`@mlightcad/dxf-json` is GPL-3.0 (fork of dotoritos-kim/dxf-json). Avoid.

### 2.5 `ezdxf` (Python, MIT)

| Field | Value |
| --- | --- |
| License | **MIT** |
| PyPI | **1.4.4** |
| Last commit | 2026-07-21 (`#fix 1399 apply HATCH pattern rotation…`) |
| Stars | 1,404 |

This is the reference open DXF implementation. CLI: `ezdxf view`, `ezdxf draw -o out.svg|pdf|png`, `ezdxf audit`, `ezdxf browse`. Headless Linux works.

Entity coverage is the reason everyone else cites it (`dxf-viewer` README does). LWPOLYLINE, SPLINE, HATCH (including the 2026 hatch-rotation fix), DIMENSION family, MTEXT internals, BLOCK/INSERT, XREF as resolved attachments, layouts / paper space — all first-class. Rendering backends use Matplotlib (and optional PyMuPDF). **SHX is not implemented**; TTF substitution only. Mozman, 2022: “The SHX font format is not documented or supported… only SHX fonts which have corresponding TTF-fonts can be rendered.” ([discussion #710](https://github.com/mozman/ezdxf/discussions/710); [ACIS tools](https://ezdxf.readthedocs.io/en/stable/acis.html))

ACIS: `ezdxf.acis.api.load_dxf` / `mesh_from_body`. **Not a kernel.** Flat polygonal faces only; curved faces are lost. “Don’t even try” to load-and-reexport arbitrary ACIS.

Safe to bundle as a **Python sidecar** in a closed app (MIT). Heavier than a JS parser; higher fidelity than any JS DXF library except mlightcad’s native converter.

### 2.6 Entity-coverage matrix

| Entity / feature | dxf-parser | three-dxf | dxf-viewer | mlightcad data-model + viewer | ezdxf |
| --- | --- | --- | --- | --- | --- |
| LINE / CIRCLE / ARC / ELLIPSE | Y | Y | Y | Y | Y |
| LWPOLYLINE | Y | Y | Y (no curve-fit) | Y | Y |
| SPLINE | partial | Y | Y | Y | Y |
| HATCH | unknown | N | partial (no solid/gradient/islands) | Y (shader) | Y |
| DIMENSION | some | N | linear only | linear view Y; create incomplete | Y |
| MTEXT | some | basic (v1.3) | no advanced fmt | viewing; create unchecked | Y (best open docs) |
| TEXT + SHX | no SHX | no SHX | TTF list, style ignored | font pack + substitution | TTF only |
| BLOCK / INSERT | Y | Y | instanced | Y | Y |
| XREF | N | N | N | partial / planned | resolve-on-load |
| Layouts / paper space | N | N | **N (explicit)** | **Y** | Y |
| 3DSOLID / ACIS | N | N | N | proprietary: partial SAB wireframe | polyhedron faces only |
| Maintained in 2026 | N | N | Y | Y | Y |
| Closed-app license | MIT | MIT | MPL-2.0 | MIT (DXF); GPL if you add LibreDWG | MIT |

---

## 3. Rendering faithfully on canvas / WebGL

A DWG is not a mesh. Faithful 2D drawing is a display pipeline:

1. Resolve layer (on/off/freeze/lock), color (ByLayer / ByBlock / ACI / truecolor), linetype, lineweight.
2. Explode BLOCK/INSERT (and nested inserts, attributes, dynamic-block visibility — the last is where open viewers die).
3. Stroke SHX or outline TTF at the style height, with bigfont for CJK.
4. Pattern-hatch or solid-fill HATCH, clipped to islands.
5. Build DIMENSION from dimstyle + dimblk arrowheads + generated dimension block (many files store an empty dim block and expect the viewer to recompute — QCAD’s `-recompute-dim` exists for this reason).
6. Choose **model space** or a **paper-space layout**, then each **viewport** (scale, twist, frozen layers per VP).
7. Resolve XREFs from disk.

Skip any step and a patent figure looks “almost right,” which is worse than a clean failure.

### 3.1 Layers, linetypes, lineweights

- `dxf-viewer`: layers yes; **all lines continuous and hairline**. Author plans a 1-D texture + shader. Not shipped as of 1.0.48.
- mlightcad: custom shader materials for linetypes and hatch; lineweight display checked; **linetype scaling unchecked**.
- QCAD `dwg2svg` / `dwg2pdf`: full 2D stack, including `-ltscale`, `-min-lineweight`, `-layer=`, color correction. This is what “looks like the drawing” means.

### 3.2 Hatches

Patent figures live on HATCH (section lining, solid fills). `dxf-viewer` is explicit about missing solid/gradient and external boundaries. ezdxf still ships hatch-rotation fixes in 2026 — that is how unfinished this problem is. mlightcad advertises GPU hatch fills; treat as “best JS attempt,” verify on the corpus.

### 3.3 Text: SHX vs TTF substitution

**SHX is the classic failure.**

SHX is Autodesk’s compiled *shape* font: stroke vectors, 255-character pages, optional **Bigfont** pair for CJK. It is not OpenType. Autodesk does not document it well enough for a clean open reimplementation. AutoCAD itself substitutes “proxy” TrueType when an SHX is missing ([AutoCAD 2026 Help — About Substitute Fonts](https://help.autodesk.com/view/ACD/2026/ENU/?caas=caas/documentation/ACDLT/2014/ENU/files/GUID-928DF015-1E04-4CC2-AF1B-0037548DFBAE-htm.html)). IntelliCAD ships `ic-*.shx` plus a FONTMAP (`icad.fmp`) for the same reason ([Carlson KB, updated 2026-04-29](https://web.carlsonsw.com/knowledgebase/kbase05.php?action=display_topic&topic_id=602)).

What each stack does:

| Stack | SHX |
| --- | --- |
| dxf-viewer / three-dxf / dxf-parser | Ignore style; draw with a TTF list. Metrics wrong → dimensions collide. |
| ezdxf | No SHX. Map `isocp` → `isocp___.ttf` if that TTF is installed. |
| mlightcad | Fonts loaded from `baseUrl` (default jsDelivr). Self-host `fonts.json` + TTF/OTF for offline. A 2026 Medium post describes mixed TTF+SHX inside one MTEXT — they know the problem. Whether they decode real `.shx` files or only substitute is **UNVERIFIED** without running their font pack. Offline AUR `cad-viewer-bin` “bundles fonts/templates.” |
| QCAD Pro | `-fs FONT1 FONT2` / `-t FONT1:FONT2`. Has a working SHX path (it is a desktop CAD). |
| AutoCAD / ODA / BricsCAD | Native SHX. |

**Shipping a closed viewer without a FONTMAP + a legal SHX/TTF pack means every drawing that uses `romans.shx` / `txt.shx` / `simplex.shx` will mis-measure.** Those are the default AutoCAD styles. They will be in this corpus.

Autodesk SHX files are **not redistributable** with a third-party app. You need either licensed equivalents (IntelliCAD-style `ic-*`), QCAD’s fonts, or a documented TTF mapping and the user’s own AutoCAD fonts directory.

### 3.4 Dimensions

Dimensions are blocks generated from DIMSTYLE. Empty dim blocks are common. QCAD CLI exposes `-recompute-dim` on every export tool because “best compatibility” requires rebuilding them. `dxf-viewer` skips most dim features. mlightcad has linear dim viewing checked, angular unchecked. For patent figures (lots of DIMLINEAR / DIMALIGNED / DIMRADIUS) this is the difference between “opens” and “usable.”

### 3.5 Paper space vs model space, layouts, XREFs

Patent attorney DWGs are often **sheet drawings**: title block in paper space, viewports onto model space. `dxf-viewer` does not implement this. mlightcad does (“Layout / paper space rendering” checked; viewport *entity* still open). QCAD CLI: `-block=BLOCK_NAME` / layout name, default `*Model_Space`; `dwg2pdf -block=` accepts a list and can emit multi-page PDFs.

XREFs: a file that looks empty until you resolve a relative path. LibreDWG’s `FileDepList` records them. No JS viewer resolves XREFs well. A desktop sidecar that walks the directory is required.

### 3.6 Closest library to AutoCAD look

| Rank | Stack | Why |
| --- | --- | --- |
| 1 | **QCAD Professional CLI** (`dwg2pdf` / `dwg2svg`) | Real 2D CAD display, SHX, dims, layouts, offscreen Linux. Not embeddable; not redistributable. |
| 2 | **ODA Drawings SDK / inWEB** | 100% data + their Visualize pipeline. Membership. |
| 3 | **mlightcad cad-simple-viewer + proprietary DWG converter** | Best embeddable WebGL. MIT chrome. Paid parser. SHX/dim gaps remain. |
| 4 | mlightcad + LibreDWG worker | Same chrome, worse parse, GPL. |
| 5 | `dxf-viewer` | Honest, small, no paper space. |
| 6 | `three-dxf` / `dxf-parser` | Historical. |

There is no Three.js plugin that “just draws DWG.”

---

## 4. 3D solids in DWG (ACIS / SAT)

**Decisive: open readers cannot extract usable 3D from DWG.**

AutoCAD 3DSOLID / BODY / REGION / SURFACE do not store OCCT B-rep. They store **Spatial ACIS**:

- DXF/DWG ≤ R2010: **SAT** (Standard ACIS Text), typically version 700 for AutoCAD compatibility
- DXF/DWG ≥ R2013: **SAB** (Standard ACIS Binary)
- One DWG entity ↔ one SAT/SAB body (a standalone `.sat` file may hold many bodies)

ODA/Teigha documents this directly: “Teigha uses .sat and .sab files to define 3D geometry of 3D entities (OdDbRegion, OdDbBody, OdDb3dSolid, OdDbSurface, …).” ([ODA blog 2017-10](https://www.opendesign.com/blog/2017/october/working-sat-and-sab-files-teigha))

| Reader | What you actually get |
| --- | --- |
| LibreDWG | Blob in `AcDS` / entity payload. Partial decode. No tessellator. |
| libdxfrw | 2D library. No. |
| ezdxf | Parses SAT/SAB topology; `mesh_from_body` returns **flat polygonal faces only**. Curved faces vanish. Cannot round-trip unknown entities. |
| mlightcad proprietary | Partial SAB decode → wireframe or AABB. **No B-rep tessellation.** |
| ACadSharp | Can store the entity. Kernel? **UNVERIFIED.** |
| ODA Drawings SDK | Full. Can `acisIn` / export SAT, and (since 2019.2) even extrude/revolve. |
| RealDWG | Full (Autodesk’s own). Windows only. |
| FreeCAD | **CADExchanger (paid)** is the documented path for *3D* DWG. ODA/LibreDWG/QCAD paths go DWG→DXF→Draft, i.e. **2D**. ([FreeCAD and DWG Import](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/FreeCAD_and_DWG_Import.md)) |

ACIS itself is Spatial (Dassault) proprietary. There is no open ACIS kernel. OCCT’s SAT/SAB support exists in some builds but is incomplete and legally grey; do not plan a product on it without counsel (`UNVERIFIED` as a shippable path).

**For this corpus:** if any of the 837 files are 3D mechanical DWGs rather than 2D figure sheets, an open ingest will show edges or a box. The solid is opaque without ODA or Autodesk.

---

## 5. Conversion pipelines (Linux, headless)

FreeCAD is the existence proof. `src/Mod/Draft/importDWG.py` (LGPL-2.1-or-later) is **only a subprocess wrapper**. It never parses DWG. Order in “Automatic”:

1. LibreDWG `dwg2dxf` / `dxf2dwg`
2. `ODAFileConverter`
3. QCAD Pro `dwg2dwg` (bash script; `cwd` must be the QCAD dir on Windows)

Then `importDXF` does the real work. ([importDWG.py](https://raw.githubusercontent.com/FreeCAD/FreeCAD/main/src/Mod/Draft/importDWG.py); [Import Export Preferences](https://wiki.freecad.org/Import_Export_Preferences) — wiki was Anubis-blocked, content corroborated via GitHub mirror)

### 5.1 LibreCAD

- License: **GPLv2-only** ([LICENSE](https://raw.githubusercontent.com/LibreCAD/LibreCAD/master/LICENSE))
- 6,248★, last push 2026-08-16
- DXF / PDF / SVG write. DWG read is **libdxfrw-rudimentary**, and they still cannot link LibreDWG.
- **Do not bundle** in a closed app (GPLv2 contaminates). As a user-installed tool it is a weak DWG converter.

### 5.2 QCAD / `dwg2*`

Community Edition: GPLv3 **with exceptions** that allow proprietary plugins. **DWG is not in the Community Edition.**

Professional: commercial. License page, fetched 2026-08-17 ([qcad.org/en/documentation/license](https://www.qcad.org/en/documentation/license)):

> QCAD Professional comes with a plugin for DWG and extended DXF import/export functionality. This plugin uses the **Teigha libraries from the Open Design Alliance**.
>
> **QCAD Professional may not be distributed.**
>
> If your end product contains portions of QCAD Professional and you wish to distribute it, you have to purchase licenses from us for resale.

Server license exists: run QCAD Pro on a web server to process data; **do not** let end users download QCAD itself.

CLI (every Pro install; Linux scripts; `-platform offscreen` for headless X11-less servers) ([command-line tools](https://www.qcad.org/en/qcad-command-line-tools)):

| Tool | Output |
| --- | --- |
| `dwg2dwg` / `dwg2dxf` | Version-to-version DWG/DXF; also PDF→DWG |
| `dwg2svg` | SVG, geometry-preserving (`-g`) or look-preserving |
| `dwg2pdf` | PDF 1.4 / 1.6 / **PDF/A-1B**, layouts, scale, mono |
| `dwg2bmp` / `dwg2png` | Raster, max ~23k×23k, layer filter, font substitution |
| `dwginfo` | layers / blocks / entity count |
| `dwgexplode`, `dwghatch`, `bbox`, `merge` | prep for figure pipelines |

This is the **best headless 2D DWG→SVG/PDF toolchain on Linux** if you will pay for Pro and **not** redistribute it. FreeCAD documents it as giving “the same good results as the ODA File Converter” because it *is* Teigha.

### 5.3 Bricsys / BricsCAD

Native DWG CAD (IntelliCAD / ODA lineage). Linux build exists. Communicator is a **3D** import/export plug-in (STEP, etc.), not the 2D DWG converter. Using BricsCAD as a batch converter means licensing BricsCAD Pro+ and driving it via script — a heavy, commercial sidecar. Member of ODA. Not a library you embed.

### 5.4 FreeCAD `importDWG`

See intro to §5. LGPL-2.1 app; converters are external. 3D DWG → CADExchanger only.

### 5.5 ODA File Converter CLI

Works. Directory-oriented. **Non-commercial for non-members.** Do not put the AppImage in your installer.

### 5.6 Other batch DWG → DXF → SVG/PDF

| Tool | License | Notes |
| --- | --- | --- |
| LibreDWG `dwg2dxf` then `ezdxf draw` | GPL-3 CLI + MIT Python | Fully scriptable. Fidelity capped by LibreDWG’s ~90% and ezdxf’s SHX gap. |
| LibreDWG `dwg2SVG` | GPL-3 | “Handles only some entities.” Not a figure pipeline. |
| mlightcad `cad-simple-viewer-cli` | MIT chrome + whichever converter you registered | Headless HTML / (partial) SVG / PDF plugins. SVG renderer still 0.0.1. |
| VeryDOC / reaConverter | commercial | Linux CLI exists (vendor marketing). Not evaluated here. |
| CADExchanger | commercial | FreeCAD’s 3D-DWG path. |

---

## 6. Thumbnails — embedded DWG preview bitmaps

**This is the 90% document-browser feature.** Most DWGs already contain a preview. You do not need to parse entities to fill a grid.

### Format

LibreDWG manual, `@node Preview` ([LibreDWG.texi](https://raw.githubusercontent.com/LibreDWG/libredwg/master/doc/LibreDWG.texi)):

> The optional Preview section contains the thumbnail stream of **BMP, WMF or PNG** data of the drawing. Note that blocks or proxy objects can also contain its own preview fields. The program **dwgbmp** can extract the preview image from this section.

`dwgbmp.c` type tags: `1=header, 2=bmp, 3=wmf, 6=png`. For type 2 it prefixes a BITMAPFILEHEADER (`BM` + 14-byte header) onto the DIB payload. WMF/PNG are written raw. Comment in the source: “get the bmp thumbnail… **not the WMF**” is stale — the help text and type table include WMF and PNG. ([dwgbmp.c](https://raw.githubusercontent.com/LibreDWG/libredwg/master/programs/dwgbmp.c))

ODA Open Design Specification (members + guest PDF historically) documents BMP/WMF thumbnail storage around p.93; ACadSharp #558 cites that page and notes **format changes in later releases**. ([ACadSharp #558, 2025-02-12](https://github.com/DomCR/ACadSharp/issues/558))

AutoCAD 2013+ stores higher-quality **PNG** previews. `THUMBSAVE` (0/1) controls whether a preview is written; `THUMBSIZE` (0–8 since 2013) controls resolution. ([JTB World, 2020-09-08](https://blog.jtbworld.com/2020/09/autocad-thumbsizedwg-thumbnail-preview.html); [Autodesk: previews missing](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/DWG-thumbnail-preview-images-don-t-display-in-Windows-Explorer.html))

### How to extract cheaply

1. **Preferred for a closed app:** a small Rust/C walker that finds the preview section from the published ODA spec / LibreDWG’s documented layout and copies the BMP/PNG bytes. No entity parse. No GPL. ACadSharp (MIT) already does this in C# if you want a known implementation to port.
2. **LibreDWG `dwgbmp`** as a user-installed or mere-aggregation CLI.
3. **`@mlightcad/libredwg-web`** exposes `DwgDatabase.thumbnailImage` (added 2026-07-21) and ships demo `4_extract_dwg_thumbnail.html` — but that pulls GPL WASM into the WebView. Do not.
4. Some files have **no** preview (`THUMBSAVE=0`, or produced by tools that skip it). Fall back to a one-time QCAD `dwg2png -x 256 -y 256` cache, or a grey “no preview” tile.

Expect mixed BMP (old), WMF (vector-ish, annoying to blit), PNG (2013+). WMF is the sharp edge: either skip it or shell to a one-shot converter.

---

## 7. License trap table (proprietary Tauri desktop app)

Not legal advice. FSF FAQ citations are the FSF’s position.

| Option | Bundle inside closed app | Separate subprocess you ship | User-installed, you only exec | Notes |
| --- | --- | --- | --- | --- |
| LibreDWG library / `@mlightcad/libredwg-web` WASM | **UNUSABLE** (GPL-3 combined work) | **Unsafe** if the “process” is a Worker in the same WebView | OK | No LGPL. Worker isolation ≠ license. |
| LibreDWG `dwg2dxf` / `dwgbmp` CLI | n/a | **Allowed as mere aggregation** if it is a standalone binary, file-in/file-out, GPL source offered for *that* binary | **Safest GPL use** | FSF `#MereAggregation`, `#GPLInProprietarySystem` |
| `libdxfrw` | **UNUSABLE** (GPL-2+) | same as LibreDWG | OK | Weaker DWG anyway |
| LibreCAD app | **UNUSABLE** (GPLv2) | Don’t ship | OK as a user tool | |
| QCAD Community | **UNUSABLE** without publishing your modifications under GPLv3+exceptions | Don’t ship as the product | OK | No DWG |
| QCAD Professional + `dwg2*` | **UNUSABLE** (“may not be distributed”) | **UNUSABLE** unless you become a RibbonSoft reseller and buy a license per seat | **OK** — best 2D fidelity | Server license if *you* host conversion, not the customer |
| ODA File Converter (guest) | **UNUSABLE** (non-commercial only) | **UNUSABLE** for a commercial product | **Grey** for a commercial law-office tool used in-house — FAQ says non-members = non-commercial. A law firm using it internally to process client files is the fact pattern to run past counsel. **Do not ship it.** | Still downloadable v27.1 |
| ODA Drawings SDK / inWEB | **OK after membership** (Sustaining if you embed in a distributed app; Commercial if ≤100 copies and no web) | OK | n/a | Lose distribution rights if you stop paying |
| Autodesk RealDWG | **OK on Windows only**, $8k/yr | n/a | n/a | No Linux, no render |
| mlightcad MIT packages (`data-model`, `cad-simple-viewer`, plugins) | **OK** | OK | OK | DXF only until you add a DWG converter |
| `@mlightcad/libredwg-converter` | **UNUSABLE** (GPL-3) | Worker ≠ safe | n/a | |
| `@mlight-cad/dwg-converter` proprietary | **OK** under $3k terms (embed, don’t resell as SDK) | OK | n/a | Single-maintainer risk |
| `dxf-parser` / `three-dxf` | **OK** (MIT) | — | — | Stale |
| `dxf-viewer` | **OK with MPL-2.0 hygiene** (publish modifications to MPL files) | — | — | No paper space |
| `ezdxf` | **OK** (MIT) as a Python sidecar | OK | OK | Best open DXF |
| ACadSharp | **OK** (MIT) as a .NET sidecar | OK | OK | DWG r/w in C# |
| BricsCAD | Don’t bundle | Don’t | **OK** as an installed CAD | Overkill |
| CADExchanger | Per their EULA | Per EULA | Per EULA | FreeCAD’s 3D-DWG path |

GPL vs LGPL one-liner: **LGPL lets you dynamically link a closed app if users can relink.** LibreDWG is **not** LGPL. There is no “compile with `-shared` and we’re fine” escape.

---

## 8. Recommended ingest architecture

### 8.1 Recommended — three-layer, local-only

```
┌─────────────────────────────────────────────────────────────┐
│  Tauri + TypeScript (closed)                                 │
│                                                              │
│  A. Grid (instant)                                           │
│     Rust preview-section extractor → PNG/BMP tiles           │
│     (port ODA spec / ACadSharp; no GPL)                      │
│     Cache by (path, mtime, size).                            │
│                                                              │
│  B. Open / measure / layer toggle                            │
│     @mlightcad/data-model + cad-simple-viewer  [MIT]         │
│        ├─ .dxf  → AcDbNativeDxfConverter        [MIT]        │
│        └─ .dwg  → @mlight-cad/dwg-converter     [$3k prop.]  │
│     Self-host TTF + FONTMAP. Never load libredwg-web.        │
│                                                              │
│  C. Faithful figure export (the patent pipeline)             │
│     Optional user-configured binary:                         │
│        QCAD Pro dwg2pdf / dwg2svg   [best]                   │
│        else ezdxf draw on a DXF produced in B                │
│     Paper-space layout picker → PDF/A.                       │
└─────────────────────────────────────────────────────────────┘
         3D 3DSOLID → do not claim. Badge “2D only”.
         If a file is a 3D part, point at the STEP sibling
         or a future ODA-member milestone.
```

Why this and not ODA-first: a patent-tooling desktop for one firm does not need Drawings-SDK-in-process on day one. $3k perpetual + MIT viewer gets DWG into the same data model the open stack already renders. QCAD Pro (one site license, not redistributed) is the high-fidelity export hammer. Thumbnails do not wait on either.

If the firm later needs 3D-in-DWG or AutoCAD-identical display, **buy ODA Sustaining ($7,500 / $4,500)** and replace layer B’s parser with Drawings SDK or inWEB. Do not start there.

### 8.2 Runner-up — zero paid parsers

Same grid (A). Layer B is **DXF-only** in-process (MIT). Layer C is:

- User installs LibreDWG tools **or** QCAD Pro **or** (counsel-approved) ODA File Converter.
- App discovers `dwg2dxf` / `dwg2dwg` / `ODAFileConverter` on `PATH` (copy FreeCAD’s detector).
- Convert to a temp DXF, then MIT-parse.

You will lose files (LibreDWG skip-over, SHX, paper space). You will not lose the company to a GPL claim, and you will not ship ODA’s binary.

ACadSharp as a MIT .NET sidecar is a credible runner-up-to-the-runner-up for DWG→DXF without GPL, if you accept a second runtime. **UNVERIFIED** on 2024–2026 DWG versions and SAT.

### 8.3 The one thing that will bite

**There is no free DWG reader you can put inside the binary.**

The study’s 3D-solid bias hid this. The trap is not ACIS (that is merely opaque). The trap is:

1. ODA File Converter — the converter every FOSS CAD shells out to — is **non-commercial for non-members**. Shipping it is a contract violation, not a technical choice.
2. LibreDWG / `libredwg-web` — the only maintained open reader — is **GPL-3.0-or-later**, full stop. A WASM Worker is still a combined work. mlightcad’s README says so in the same breath as it sells the $3k escape hatch.
3. Even after you pay for a parser, **SHX + paper-space dimensions** will make the first real patent drawing look wrong. That is a font-and-display problem, not a “we picked the wrong npm package” problem.

Pay for a DWG parser (mlightcad $3k or ODA membership). Extract thumbnails yourself. Treat SHX as a work item with a FONTMAP, not a library feature you get for free. Do not promise 3D from `.dwg`.

---

## Sources

Primary pages fetched 2026-08-17 unless dated otherwise.

- GNU LibreDWG: <https://www.gnu.org/software/libredwg/>
- LibreDWG README / texi / dwgbmp.c: <https://github.com/LibreDWG/libredwg>
- GNU GPL FAQ: <https://www.gnu.org/licenses/gpl-faq.html>
- mlightcad cad-viewer + PROPRIETARY-PARSER + realdwg-web READMEs
- npm registry metadata for `@mlightcad/*`, `dxf-parser`, `dxf-viewer`, `three-dxf`
- GitHub API: LibreDWG, mlightcad/*, vagran/dxf-viewer, gdsestimating/*, mozman/ezdxf, LibreCAD/*, qcad/qcad, DomCR/ACadSharp
- ODA FAQ (File Converter terms): <https://www.opendesign.com/faq/question/what-are-oda-viewer-and-oda-file-converter>
- ODA File Converter downloads: <https://www.opendesign.com/guestfiles/oda_file_converter>
- ODA pricing snippets: <https://www.opendesign.com/pricing>
- ODA inWEB announcement: <https://www.opendesign.com/blog/2024/october/drawings-inweb-sdk-oda>
- Wikipedia, Open Design Alliance (membership, Teigha rename, Sept 2024 converter note)
- Tech Soft 3D RealDWG: <https://www.techsoft3d.com/oem/realdwg/>
- APS RealDWG 2027: <https://aps.autodesk.com/developer/overview/realdwg-api>
- QCAD license + CLI: <https://www.qcad.org/en/documentation/license>, <https://www.qcad.org/en/qcad-command-line-tools>
- FreeCAD importDWG.py + DWG Import wiki mirror
- ezdxf ACIS: <https://ezdxf.readthedocs.io/en/stable/acis.html>
- dxf-viewer / dxf-parser / three-dxf READMEs
- AutoCAD substitute fonts; JTB World THUMBSIZE; Carlson FONTMAP
- ODA SAT/SAB blog (2017)
- X: @mlightcad 2026-08-10, 2026-05-17; GitHubDaily 2025-12-26
