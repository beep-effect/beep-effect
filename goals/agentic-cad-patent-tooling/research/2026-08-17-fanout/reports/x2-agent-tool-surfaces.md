# X2 — What an AI agent can actually drive in CAD (tool-surface inventory)

**Lane:** x2-agent-tool-surfaces
**As of:** 2026-08-17
**Question:** Can a coding agent *call* it? Not: is it a nice product?
**Method:** live GitHub API (`gh api repos/...` on 2026-08-17), raw READMEs, official product pages, and X posts. Stars / last-push / license are from GitHub API unless noted.

**Confidentiality note:** this inventory covers public tool surfaces only. No pre-publication patent text.

---

## Status

- Inventory complete for the 2026-08-17 snapshot. Every non-obvious claim is cited. `UNVERIFIED` marks items I could not confirm from primary source today.

---

## 1. Integration-rung legend

| Rung | Meaning for an agent |
| --- | --- |
| MCP | Named tools over Model Context Protocol (stdio or Streamable HTTP) |
| REST/gRPC | Documented HTTP/RPC API the agent can call with a key |
| CLI/headless | Spawn a process; exchange files / stdout JSON |
| Embeddable library | Import in-process (Python, TS/WASM, Rust, C++) |
| File-format-only | Agent writes a file; some other tool must open it |
| Agent-skill / prompt pack | Markdown skill the host agent follows; not a protocol |

Per-item fields: **rung**, **language**, **license**, **fully offline?**, **production-readiness (one sentence)**.

**License hygiene for a proprietary Linux desktop app:** calling a GPL binary as a *separate process* (OpenSCAD CLI, Blender) is generally aggregation, not linking. Shipping a GPL kernel *inside* your process, or statically linking LGPL without compliance, is the contamination path. OCCT / FreeCAD / pythonocc are LGPL family. CadQuery / build123d / Manifold / agentcad are Apache-2.0. Zoo / Onshape / Fusion / Rhino are proprietary clouds or GUI hosts.

---

## 2. MCP servers for CAD

### 2.1 FreeCAD MCP (competing implementations)

FreeCAD itself is the only full-featured LGPL mechanical CAD with a live Python API and a headless console (`freecadcmd`). The MCP layer is **not** unified — five competing bridges, all of which ultimately exec Python inside a running FreeCAD process.

| Repo | Stars | License | Lang | Last push | Transport | Offline? |
| --- | ---: | --- | --- | --- | --- | --- |
| [neka-nat/freecad-mcp](https://github.com/neka-nat/freecad-mcp) | 1825 | MIT | Python | 2026-08-07 | stdio MCP → XML-RPC addon in GUI | Yes if FreeCAD is local |
| [spkane/freecad-addon-robust-mcp-server](https://github.com/spkane/freecad-addon-robust-mcp-server) | 186 | MIT | Python | 2026-05-11 | stdio MCP → XML-RPC :9875 / JSON-RPC :9876 / embedded (Linux only) | Yes; Docker + PyPI `freecad-robust-mcp` |
| [bonninr/freecad_mcp](https://github.com/bonninr/freecad_mcp) | 218 | MIT | Python | 2025-03-20 | stdio → socket | Yes |
| [contextform/freecad-mcp](https://github.com/contextform/freecad-mcp) | 111 | *none listed* | Python + npm installer | 2025-08-15 | installer + MCP bridge | Yes |
| [sandraschi/freecad-mcp](https://github.com/sandraschi/freecad-mcp) | 20 | *none listed* | Python | 2026-07-28 | FastMCP HTTP :10944 + dashboard :10945 | Yes; CFD extras |

GitHub API snapshot 2026-08-17.

**neka-nat/freecad-mcp** is the default people actually wire. Tools (README, live 2026-08-17): `create_document`, `create_object`, `edit_object`, `delete_object`, `execute_code`, `insert_part_from_library`, `get_view`, `get_objects`, `get_object`, `get_parts_list`, `run_fem_analysis`. Screenshots can be suppressed per call (`include_screenshot`, `view_name`). Architecture is a FreeCAD workbench RPC server plus `uvx freecad-mcp` stdio client. Remote bind is optional (`0.0.0.0` + allow-list). ([neka-nat/freecad-mcp README](https://github.com/neka-nat/freecad-mcp), fetched 2026-08-17)

**spkane robust** is the only one that treats headless as a first-class mode and publishes 150+ typed tools instead of “just exec Python.” Categories: execution (5), documents (7), primitives (8), object mgmt (12), PartDesign sketching (14), patterns/edges (5), view (11, GUI-only screenshots), undo (3), import/export (7), macros (6), parts library (2). Modes: `xmlrpc` (recommended), `socket`, `embedded` (Linux only; crashes on macOS because of `libpython` rpath). PyPI + Docker Hub. Last push May 2026 — still the most production-shaped FreeCAD MCP, but slower-moving than neka-nat. ([spkane README](https://github.com/spkane/freecad-addon-robust-mcp-server), 2026-08-17; [FreeCAD forum announcement](https://forum.freecad.org/viewtopic.php?t=102290), 2026-01-06)

**bonninr** is a 2-tool socket (`get_scene_info`, `run_script`). Last push 2025-03-20. Demo quality.

**contextform** is an npm installer around an “AI Copilot workbench.” Last push 2025-08-15, no SPDX license on the repo. Treat as unmaintained installer, not a bind target.

**sandraschi** is a FastMCP HTTP server (port 10944) with 46 tools spanning STEP/STL conversion plus FluidX3D/OpenFOAM CFD. Niche; not a general CAD bind.

**Comparison (what an agent should actually pick):**

| Criterion | Winner |
| --- | --- |
| Adoption / “does the example work” | neka-nat (1.8k, still committing Aug 2026) |
| Typed CAD verbs / headless / Docker | spkane robust |
| Avoid `execute_code` as the only verb | spkane |
| Production Linux daemon | spkane (embedded or xmlrpc + `freecadcmd`) |
| Do not pick | contextform (stale, no license), bonninr (stale 2-tool), sandraschi (CFD sidecar) |

Practitioners on X are driving FreeCAD through MCP today, and they still hit reliability gaps: “I’ve been using freecad through mcp with sol… brute forcing my way through” ([@bslizzle8552, 2026-08-17](https://x.com/bslizzle8552/status/2089168278824370603)); “At some point I will put in a PR to fix the FreeCAD MCP so it works just as good” ([@10_X_eng, 2026-08-17](https://x.com/10_X_eng/status/2089169232151867845)); OpenCode users point at neka-nat ([@Gazeria, 2026-08-16](https://x.com/Gazeria/status/2088960510142173196)).

- **Rung:** MCP (stdio) over a local RPC addon; FreeCAD itself is CLI/headless + embeddable Python.
- **Language:** Python (MCP) + C++/Python (FreeCAD).
- **License:** MCP servers MIT; FreeCAD LGPL-2.1 ([FreeCAD/FreeCAD](https://github.com/FreeCAD/FreeCAD), 32895★, pushed 2026-08-17).
- **Fully offline:** yes.
- **Production-readiness:** usable as an agent sidecar if you accept a live FreeCAD process and `execute_code` as the escape hatch; not a clean typed geometry kernel.

### 2.2 Blender MCP

Two surfaces, not one.

**Community (the one people mean):** [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) — **25930★**, MIT, Python, pushed **2026-08-16**. Transport: stdio MCP (`uvx blender-mcp`) ↔ socket addon inside a running Blender GUI. Tools (from `src/blender_mcp/server.py` on 2026-08-17): `get_addon_status`, `disable_telemetry`, `get_scene_info`, `get_object_info`, `get_viewport_screenshot`, `execute_blender_code`, Poly Haven search/download/texture, Sketchfab search/download, Hyper3D Rodin generate/poll/import, Hunyuan3D generate/poll/import, `record_trajectory_feedback`. ([blender-mcp README](https://github.com/ahujasid/blender-mcp); source tool list via GitHub API, 2026-08-17)

This is a **mesh DCC driver**, not B-rep CAD. The productive verb is `execute_blender_code`. Cloud add-ons (Poly Haven, Sketchfab, Hyper3D, Hunyuan) are optional and *not* offline. Telemetry exists and can be disabled. Security model is “run arbitrary Python in Blender.”

X evidence that this is the default 3D-agent toy, and that it is *not* a CAD verifier: people use it for vibe-modeling and then bounce to Three.js or Meshy when they need iteration speed ([@RobCodesALot, 2026-08-17](https://x.com/RobCodesALot/status/2089155601016209813); [@SyntheticBeef, 2026-08-16](https://x.com/SyntheticBeef/status/2089066120154427726); [@techotakulab, 2026-08-17](https://x.com/techotakulab/status/2089186505075966203) — two-step “write a spec, then drive Blender”).

**Official Blender Lab:** [blender.org/lab/mcp-server](https://www.blender.org/lab/mcp-server/) + source at [projects.blender.org/lab/blender_mcp](https://projects.blender.org/lab/blender_mcp). Requires **Blender 5.1+**. Explicit security warning: “The MCP server will execute LLM generated code in Blender without any guards.” Demo use-cases are scene analysis, datablock rename, Geometry Nodes documentation — **not** mechanical CAD. Marked Released on the Lab index. ([Blender Lab MCP page](https://www.blender.org/lab/mcp-server/), fetched 2026-08-17; [Q1 2026 Lab report](https://www.blender.org/development/blender-lab-activity-report-q1-2026/))

- **Rung:** MCP (stdio) over a GUI process.
- **Language:** Python.
- **License:** community MIT; Blender itself GPL-3.0 (process-spawn is OK; embedding is not).
- **Fully offline:** community server yes (core tools); Poly Haven / Sketchfab / Hyper3D / Hunyuan no. Official Lab designed to work with local llama.cpp.
- **Production-readiness:** extremely popular for mesh/scene agents; the wrong kernel if you need STEP, mates, or manufacturing drawings.

### 2.3 Onshape MCP

Onshape is cloud B-rep + REST. An agent can drive it without a local kernel. Three layers exist.

**Official (Aug 2026):** Onshape Labs **FeatureScript MCP Server**. HTTP transport at `https://fs-mcp.labs.onshape.app/mcp`. Requires an Onshape account + App Store subscribe to the Labs app. Purpose is **text → FeatureScript → reusable custom feature**, not one-shot solids. Auth is Onshape login. Announced 2026-08-11/13. ([Onshape Labs blog](https://www.onshape.com/en/blog/featurescript-mcp-server-enables-text-code-cad), 2026-08-11; [@Onshape, 2026-08-13](https://x.com/Onshape/status/2087919684075016540); Reddit setup notes: HTTP URL + subscribe, 2026-08-11)

Official tool list is **not published as a schema on the marketing page**. `UNVERIFIED` exact tool names. Capability claim: generate, insert, run, evaluate, and revise FeatureScript.

**Community REST wrappers (stdio, API keys):**

| Repo | Stars | License | Lang | Last push | Notes |
| --- | ---: | --- | --- | --- | --- |
| [hedless/onshape-mcp](https://github.com/hedless/onshape-mcp) | 126 | *none* | Python | 2026-03-04 | **45 named tools**: docs, sketches, extrude/revolve/thicken/fillet/chamfer/boolean/pattern, assemblies + mates, variables, `eval_featurescript`, STL/STEP/Parasolid/GLTF/OBJ export |
| [clarsbyte/onshape-mcp](https://github.com/clarsbyte/onshape-mcp) | 173 | *none* | Python | 2026-01-30 | fork / extra features on hedless |
| [ReshefElisha/jarvis-onshape-mcp](https://github.com/ReshefElisha/jarvis-onshape-mcp) | 157 | NOASSERTION | Python | 2026-04-22 | ~60 tools + render views + `compare_to_reference`; Claude Code plugin |
| [altendky/onshape-mcp](https://github.com/altendky/onshape-mcp) | 15 | Apache-2.0 OR MIT | **Rust** | **2026-08-17** | `npx onshape-mcp` / native Linux binary; OAuth; stdio (HTTP experimental). Dynamically discovers Onshape REST. Most actively maintained *engineering* of the set |
| [BLamy/onshape-mcp](https://github.com/BLamy/onshape-mcp) | 14 | *none* | TypeScript | 2025-04-21 | stale stub |

hedless tool table is the most explicit agent contract on Onshape today (45 tools, documented in README). jarvis adds vision (`render_part_studio_views`, `compare_to_reference`). altendky is the one still committing on inventory day and ships a Linux binary + npx, but it is explicitly “early development” and discovers endpoints rather than pinning a closed tool list. ([hedless README](https://github.com/hedless/onshape-mcp); [altendky README](https://github.com/altendky/onshape-mcp); GitHub API 2026-08-17)

- **Rung:** official = MCP over HTTPS; community = MCP stdio over Onshape REST.
- **Language:** FeatureScript + REST; wrappers in Python / Rust / TS.
- **License:** official proprietary; community mixed / often unlicensed.
- **Fully offline:** **no**. Every path is PTC cloud.
- **Production-readiness:** REST is real and documented; official MCP is Labs/early-access (days old). Fine as a cloud backend, disqualified if the product must keep unpublished geometry on-box.

### 2.4 Zoo / KittyCAD MCP

[KittyCAD/mcp](https://github.com/KittyCAD/mcp) (listed in some indexes as zoo-mcp): **9★**, MIT, Python, pushed **2026-08-16**. Run: `uvx zoo-mcp` or platform PyInstaller binaries. **Requires `ZOO_API_TOKEN`.** One engine connection per tool call (stateless). Zoo embeds the same functions inside Zookeeper agents so they do not spawn one MCP process per agent. ([KittyCAD/mcp README](https://github.com/KittyCAD/mcp), 2026-08-17)

Tools from live `src/zoo_mcp/server.py` (2026-08-17):

`calculate_center_of_mass`, `calculate_mass`, `calculate_surface_area`, `calculate_volume`, `calculate_cad_physical_properties`, `calculate_kcl_physical_properties`, `calculate_bounding_box_kcl`, `calculate_bounding_box_cad`, `convert_cad_file`, `execute_kcl`, `exec_kcl_project`, `start_modeling_session`, `stop_modeling_session`, `export_kcl`, `format_kcl`, `get_sketch_constraint_status`, `get_face_info`, `entity_distance`, `set_selection_filter`, `select_entities`, `center_camera_on_selection`, `highlight_set_entities`, `curve_get_end_points`, `engine_util_evaluate_path`, `curve_get_type`, `edge_get_length`, `entity_get_all_child_uuids`, `entity_get_index`, `entity_get_parent_id`, `entity_get_sketch_paths`, `snapshot`, `lint_and_fix_kcl`, `mock_execute_kcl`, `save_image`, `list_org_datasets`, `list_org_skills`, `search_org_dataset_semantic`.

This is the most *geometry-engine-shaped* official MCP in the survey: execute KCL, snapshot, mass props, bounding box, export, lint. It is **not** a local kernel — it is a cloud engine client. Adjacent TS bind: [KittyCAD/kittycad.ts](https://github.com/KittyCAD/kittycad.ts) (16★, MIT, pushed 2026-08-16) and [KittyCAD/cli](https://github.com/KittyCAD/cli) (28★, MIT, pushed 2026-08-16). Design Studio app: [KittyCAD/modeling-app](https://github.com/KittyCAD/modeling-app) (1275★, MIT UI, pushed 2026-08-17) — the product (Zookeeper) sits on top of the same engine.

- **Rung:** MCP + REST + TS/Python SDKs + CLI. Engine is cloud.
- **Language:** Python MCP, TypeScript SDK, Rust CLI/engine.
- **License:** MCP/SDK MIT; engine proprietary.
- **Fully offline:** **no** (token-gated).
- **Production-readiness:** small star count, but this is first-party, tested (`pytest -n auto`), released as binaries, and wired into Zoo’s own agent. Best commercial TS-shaped CAD API if cloud is acceptable.

### 2.5 OpenSCAD MCP

OpenSCAD itself is a **GPL** CSG compiler with a first-class headless CLI (`openscad -o out.stl in.scad`, `openscad --export-format=png`, `$OPENSCADPATH`, etc.). Agents do **not** need MCP to drive it. The MCP wrappers are thin.

| Repo | Stars | License | Lang | Last push | Tools / notes |
| --- | ---: | --- | --- | --- | --- |
| [jhacksman/OpenSCAD-MCP-Server](https://github.com/jhacksman/OpenSCAD-MCP-Server) | 178 | *none* | Python | 2025-03-21 | Gemini/Venice image gen + CUDA MVS reconstruction + OpenSCAD. Cloud + GPU. Stale. |
| [jabberjabberjabber/openscad-mcp](https://github.com/jabberjabberjabber/openscad-mcp) | 2 | MIT | Python | 2025-09-22 | 5 tools: `show_openscad_script`, `create_openscad_script`, `view_render`, `export_model_to_stl`, `save_openscad_script`. PNG feedback. |
| [rahulgarg123/openscad-mcp](https://github.com/rahulgarg123/openscad-mcp) | 9 | *none* | JS | 2025-08-13 | single tool `render_openscad` |

GitHub API 2026-08-17. HN users report “some success” with jhacksman ([news.ycombinator.com/item?id=44183720](https://news.ycombinator.com/item?id=44183720)). Practitioners also just spawn OpenSCAD next to FreeCAD MCP ([@MinionTripper, 2026-08-16](https://x.com/MinionTripper/status/2089007274555506806)).

- **Rung:** MCP is optional sugar; the real rung is **CLI/headless**.
- **Language:** OpenSCAD DSL + C++; wrappers Python/JS.
- **License:** OpenSCAD GPL-2.0-or-later (project COPYING / about pages; GitHub SPDX `NOASSERTION`). Wrappers MIT or unlicensed.
- **Fully offline:** CLI yes. jhacksman no (Gemini/Venice).
- **Production-readiness:** the *engine* is production; the *MCP servers* are weekend projects. Bind the CLI, not the MCP.

### 2.6 Fusion 360 MCP

Fusion has no official MCP. Every server is a community add-in that hops onto Fusion’s main thread. **Windows / macOS only** — Fusion does not run on Linux. Disqualified as a Linux bind except via a remote Windows box.

| Repo | Stars | License | Last push | Transport | Tools |
| --- | ---: | --- | --- | --- | --- |
| [faust-machines/fusion360-mcp-server](https://github.com/faust-machines/fusion360-mcp-server) | 72 | MIT | 2026-08-03 | stdio → TCP :9876 add-in | **89 tools**: sketches, constraints, extrude/revolve/sweep/loft, fillet/chamfer/shell, patterns, threads, `ping`. PyPI `fusion360-mcp-server`. Best typed Fusion surface |
| [AuraFriday/Fusion-360-MCP-Server](https://github.com/AuraFriday/Fusion-360-MCP-Server) | 118 | NOASSERTION | 2026-01-28 | add-in + MCP-Link | generic API + `execute_python` + 10 “built-in” tools. Largest marketing page, weakest license |
| [JustusBraitinger/FusionMCP](https://github.com/JustusBraitinger/FusionMCP) | 54 | MIT | 2026-07-01 | MCP ↔ Fusion | conversational CAD |
| [frankhommers/autodesk-fusion-mcp](https://github.com/frankhommers/autodesk-fusion-mcp) | 8 | MIT | 2026-07-28 | **Streamable HTTP** `127.0.0.1:8765/mcp` inside Fusion | 11 tools: `call_autodesk_api`, `execute_python`, `capture_viewport`, selection, docs |
| [ndoo/fusion360-mcp-bridge](https://github.com/ndoo/fusion360-mcp-bridge) | 22 | MIT | 2026-03-27 | stdio → HTTP add-in | **2 tools only**: `fusion_execute`, `fusion_screenshot`. Intentionally thin |
| [Joelalbon/Fusion-MCP-Server](https://github.com/Joelalbon/Fusion-MCP-Server) | 38 | MIT | 2025-06-12 | older “Master Control Program” naming | stale |

GitHub API 2026-08-17. TCP sockets in faust-machines have **no auth** (README security note). Autodesk forum thread points at AuraFriday ([forums.autodesk.com, 2025-11-12](https://forums.autodesk.com/t5/fusion-api-and-scripts-forum/autodesk-fusion-mcp/td-p/13895548)).

- **Rung:** MCP over a proprietary GUI. Not Linux-native.
- **Fully offline:** geometry yes (local Fusion); license/login is Autodesk’s.
- **Production-readiness:** faust-machines is the only one I would call “an agent can sketch-extrude-fillet without dumping Python.” Still beta, still Windows/mac.

### 2.7 Rhino / Grasshopper MCP

Rhino 8 is Windows/mac (compute can be headless on Windows servers). Not a Linux desktop kernel.

| Repo | Stars | License | Lang | Last push | Notes |
| --- | ---: | --- | --- | --- | --- |
| [mcneel/RhinoMCP](https://github.com/mcneel/RhinoMCP) | 246 | MIT | C# | 2026-07-16 | **First-party McNeel**. Docs at [mcneel.github.io/RhinoMCP](https://mcneel.github.io/RhinoMCP/docs/). Claude Desktop `.mcpb` connector installs the plugin. Mentions headless render farms + bulk `.3dm` in Advanced docs. Exact tool schema not on the landing README — see docs. `UNVERIFIED` full tool list |
| [brookstalley/cordyceps](https://github.com/brookstalley/cordyceps) | 90 | MIT | C# | 2026-07-02 | 7 mega-tools / 100+ actions: `gh_canvas`, `gh_wire`, `gh_document`, `gh_script`, `gh_inspect`, `rhino_scene`, `rhino_render`. Rhino 8.21+ / .NET 8. Best Grasshopper agent contract |
| [alfredatnycu/grasshopper-mcp](https://github.com/alfredatnycu/grasshopper-mcp) | 94 | MIT | C# | 2025-03-22 | GH ↔ Claude Desktop bridge (`.gha`) |
| [veoery/GH_mcp_server](https://github.com/veoery/GH_mcp_server) | 31 | MIT | Python | 2025-10-05 | analyse `.3dm`, GHPython generation |
| [GenEnv/rhino-gh-mcp](https://github.com/xunliuDesign/rhino-gh-mcp) (API name `GenEnv/rhino-gh-mcp`) | 3 | MIT | HTML/mixed | 2026-07-17 | live Rhino 8 session |

GitHub API 2026-08-17. McNeel forum: “I’ve just released a pretty full-featured MCP server for Grasshopper” (2025-06-27) — community, predates official RhinoMCP.

- **Rung:** MCP over Rhino.compute / live GUI.
- **Fully offline:** yes if Rhino is licensed locally.
- **Production-readiness:** official McNeel MCP is the right Rhino bind *if* you already own Rhino. Irrelevant to a Linux-native stack.

### 2.8 KiCad / EDA MCP

Not mechanical CAD. Included because the prompt asked, and because `kicad-cli` is a real agent-callable verifier (ERC/DRC).

| Repo | Stars | License | Last push | Notes |
| --- | ---: | --- | --- | --- |
| [mixelpixx/KiCAD-MCP-Server](https://github.com/mixelpixx/KiCAD-MCP-Server) | **1895** | MIT | 2026-08-14 | largest EDA MCP; Python/TS; claims schematic + routing tool inventory in `docs/` |
| [lamaalrajih/kicad-mcp](https://github.com/lamaalrajih/kicad-mcp) | 494 | MIT | 2025-10-17 | Mac/Win/Linux; project-path oriented |
| [Seeed-Studio/kicad-mcp-server](https://github.com/Seeed-Studio/kicad-mcp-server) | 79 | MIT | 2026-08-14 | KiCad 9+/10; **named tools**: schematic list/search, PCB stats, `run_erc`, `run_drc`, `detect_pin_conflicts`, experimental S-expr schematic edit, `export_gerber`. Seeed themselves say: use GUI to design, MCP to analyze |
| [Huaqiu-Electronics/kicad-mcp-server](https://github.com/Huaqiu-Electronics/kicad-mcp-server) | 3 | MIT | 2026-04-10 | **archived** |

GitHub API 2026-08-17. Forum report that an early mixelpixx drop “is not working correctly” (2025-04) — treat star count as marketing, verify against current HEAD.

- **Rung:** MCP + `kicad-cli`.
- **Fully offline:** yes.
- **Production-readiness:** analysis/ERC/DRC is real; schematic *editing* via S-expr is experimental. Bind only if the product grows an electronics figure/PCB lane.

### 2.9 Other CAD-adjacent MCP (CadQuery, build123d, agentcad)

These are the MCP servers that sit on **scriptable B-rep kernels** — the ones that matter for an agentic CAD system.

#### build123d-mcp (best CAD MCP in the survey)

[pzfreo/build123d-mcp](https://github.com/pzfreo/build123d-mcp) — **50★**, **Apache-2.0**, Python, pushed **2026-08-12**. PyPI `build123d-mcp`. stdio by default (`uv tool run --python 3.12 build123d-mcp@latest`); optional HTTP. Sandboxed `execute()` (import allowlist, no `open`/`eval`/`os`/`subprocess`). Persistent session.

Tools (from [llms.md](https://raw.githubusercontent.com/pzfreo/build123d-mcp/main/llms.md), 2026-08-17): `version`, `execute`, `session_state`, `health_check`, `render_view`, `measure`, `validate`, `design_audit`, `suggest_spec` (experimental), `verify_spec` (experimental), `clearance`, `cross_sections`, `export`, `interference`, `shape_compare`, `import_cad_file`, `search_library`, `load_part`, `last_error`, `repair_hints`, `workflow_hints`, `save_snapshot`, `restore_snapshot`, `diff_snapshot`, `reset`. Resources: `build123d://quickref`, `://selectors`, `://drafting`, `://session`, `://bd_warehouse`.

`validate()` runs BRepCheck + watertight/manifold + mesh check and is explicitly tuned as a CADGenBench-style gate. README claims the same model rose from 0.360 → 0.457 on CADGenBench (June 2026) and CAD validity 88% → 100% when this MCP was in the loop. ([pzfreo README](https://github.com/pzfreo/build123d-mcp), 2026-08-17)

This is the only MCP whose tool surface is *designed for an agent’s verification loop* rather than “dump Python into a GUI.”

#### CadQuery MCP

| Repo | Stars | License | Last push | Tools |
| --- | ---: | --- | --- | --- |
| [CadQuery/cadquery-contrib `mcp-server/`](https://github.com/CadQuery/cadquery-contrib/tree/master/mcp-server) | 67 (parent) | Apache-2.0 (server README) / MIT (parent SPDX) | 2026-01-16 | `render`, `inspect`, `get_parameters`, `export` (STEP/STL/SVG/DXF/AMF/3MF/VRML/BREP). Official-adjacent |
| [rishigundakaram/cadquery-mcp-server](https://github.com/rishigundakaram/cadquery-mcp-server) | 18 | *none* | 2025-06-29 | `verify_cad_query`, `generate_cad_query` (**stub**) |
| [bertvanbrakel/mcp-cadquery](https://github.com/bertvanbrakel/mcp-cadquery) | 17 | *none* | 2025-04-07 | `execute_cadquery_script`, `export_shape_to_svg`, `export_shape`, `scan_part_library`, `search_parts`. HTTP SSE **or** stdio |

GitHub API 2026-08-17. cadquery-contrib server is the one to bind if you want CadQuery-flavored MCP; it is thinner than build123d-mcp (no validate/clearance/snapshots).

#### agentcad (CLI-first, MCP optional)

[jdilla1277/agentcad](https://github.com/jdilla1277/agentcad) — **89★**, Apache-2.0, Python, pushed **2026-08-16**. Default runtime **build123d**; CadQuery is compatibility mode. Commands emit **structured JSON on stdout** (progress on stderr). MCP extra: `pip install agentcad[mcp]` → `python -m agentcad.mcp`. Verbs: `run`, `--preview` four-view PNG, `--render`, `--export`, `measure`, `check-spec`, `inspect`, `parts *`, `diff`, `view`. Claims local, no signup. Python 3.10–3.12 only (OCP bindings). ([agentcad README](https://github.com/jdilla1277/agentcad), 2026-08-16)

This is the cleanest *non-MCP* agent contract in the survey: a coding agent already knows how to spawn a CLI and parse JSON.

- **Rung:** MCP and/or CLI/headless on an embeddable B-rep library.
- **Fully offline:** yes.
- **Production-readiness:** build123d-mcp + agentcad are the only CAD MCPs I would put in front of a real agent in 2026 without embarrassment. CadQuery official-adjacent MCP is a thinner fallback.

---

## 3. Headless / scriptable CAD engines (no GUI required)

### 3.1 CadQuery

[CadQuery/cadquery](https://github.com/CadQuery/cadquery) — **5610★**, **Apache-2.0** (LICENSE file; GitHub SPDX `NOASSERTION`), Python, pushed 2026-08-14. Fluent Workplane API over OCP/OCCT. Exports STEP/STL/DXF/SVG/AMF/3MF. Headless by design. Conda-forge is the reliable install path; pip + OCP wheels work on Linux when the Python version matches (agentcad: not 3.13+). ([CadQuery README / LICENSE](https://github.com/CadQuery/cadquery), 2026-08-17)

- **Rung:** embeddable library + CLI wrappers + MCP (contrib).
- **Fully offline:** yes.
- **Production-readiness:** the most battle-tested open Python B-rep API. Bind it. Prefer it when the LLM’s training data is CadQuery-heavy (most 2024–2025 papers).

### 3.2 build123d

[gumyr/build123d](https://github.com/gumyr/build123d) — **2866★**, Apache-2.0, Python, pushed 2026-08-14. Context-manager B-rep (`BuildPart` / `BuildSketch` / `BuildLine`) on the same OCP kernel. Selectors, joints, drafting, `bd_warehouse` fasteners. This is what build123d-mcp, agentcad (default), and MAC generate. ([gumyr/build123d](https://github.com/gumyr/build123d), 2026-08-17)

- **Rung:** embeddable library.
- **Fully offline:** yes.
- **Production-readiness:** production for scripted parts; younger than CadQuery but better agent ergonomics (explicit builder, joints, drafting). **Preferred codegen target for a 2026 agent** if you control the prompt.

### 3.3 OpenSCAD

[openscad/openscad](https://github.com/openscad/openscad) — **9954★**, GPL-2.0-or-later, C++, pushed 2026-08-13. Headless: `openscad -o out.stl in.scad`, PNG preview, customizer vars via `-D`. CSG + (optionally) Manifold backend for mesh booleans. No native STEP B-rep.

- **Rung:** CLI/headless.
- **Fully offline:** yes.
- **Production-readiness:** the most LLM-fluent CAD *language* on earth, and the wrong exchange format if you need manufacturing CAD. Use as a sketching sandbox or 3D-print lane, not as the system of record.

### 3.4 FreeCAD headless (`freecadcmd`)

[FreeCAD/FreeCAD](https://github.com/FreeCAD/FreeCAD) — **32895★**, LGPL-2.1, C++/Python, pushed 2026-08-17. `freecadcmd script.py` runs the full Python API without Qt. Part, PartDesign, FEM, TechDraw, import/export STEP/IGES/STL/3MF. Headless screenshots need a virtual framebuffer or you skip them (spkane documents this).

- **Rung:** CLI/headless + embeddable Python (`import FreeCAD` / embedded mode on Linux).
- **Fully offline:** yes.
- **Production-readiness:** the only open *document/workbench* CAD you can automate end-to-end (drawings, FEM, assemblies). Heavier and more stateful than CadQuery/build123d. Correct bind when you need TechDraw patent-style 2D + 3D from one kernel.

### 3.5 OCCT / pythonocc / OCP

| Project | Stars | License | Last push | Role |
| --- | ---: | --- | --- | --- |
| [Open-Cascade-SAS/OCCT](https://github.com/Open-Cascade-SAS/OCCT) | 2767 | LGPL-2.1 | 2026-08-15 | The kernel. `BRepCheck_Analyzer`, `ShapeFix`, `BRepAlgoAPI_*`, STEP CAF |
| [CadQuery/OCP](https://github.com/CadQuery/OCP) | 191 | Apache-2.0 (bindings) | 2026-08-15 | pybind11 bindings CadQuery/build123d actually import |
| [tpaviot/pythonocc-core](https://github.com/tpaviot/pythonocc-core) | 1949 | LGPL-3.0 | 2026-06-25 | older/broader SWIG bindings; still alive |

`BRepCheck_Analyzer` is the concrete “is this solid OK?” call every serious Python stack eventually wraps. build123d-mcp’s `validate()` names it explicitly. Shape healing is `ShapeFix_Shape` / `ShapeFix_Solid`.

- **Rung:** embeddable C++ library; Python via OCP or pythonocc.
- **Fully offline:** yes.
- **Production-readiness:** this *is* production CAD. Do not write a new kernel. Do write a thin Effect wrapper around `BRepCheck` + STEP I/O if you go in-process, or call it through build123d/CadQuery.

### 3.6 Manifold

[elalish/manifold](https://github.com/elalish/manifold) — **2228★**, Apache-2.0, C++ (WASM + Python `manifold3d`), pushed 2026-08-16. Guarantees: **manifold input → manifold output** for booleans; primary goal “guaranteed manifold output without caveats.” ε-valid geometry is a best-effort (“any counterexample is a serious bug”), not a theorem. Used as OpenSCAD’s fast boolean backend. ([Manifold docs](https://manifoldcad.org/docs/html/); [wiki](https://github.com/elalish/manifold/wiki/Manifold-Library), fetched 2026-08-17)

- **Rung:** embeddable library (C++, WASM, Python).
- **Fully offline:** yes.
- **Production-readiness:** the correct *mesh* kernel and the correct mesh validator. Not a B-rep kernel — no fillets-as-features, no STEP topology.

### 3.7 replicad

[sgenoud/replicad](https://github.com/sgenoud/replicad) — **671★**, **MIT**, TypeScript, pushed 2026-08-14. CadQuery-inspired API over **OCCT compiled to WASM**. Browser and Node. STEP/STL export. This is the only mature **TypeScript B-rep** library. ([replicad.xyz](https://replicad.xyz/); [sgenoud/replicad](https://github.com/sgenoud/replicad), 2026-08-17)

OCCT-in-WASM inherits **LGPL-2.1** obligations on the wasm blob even though the JS API is MIT. Dynamic loading of the official wasm is the usual compliance path.

Related: [nimbalyst/nimbalyst-replicad](https://github.com/nimbalyst/nimbalyst-replicad) (1★, MIT, 2026-07-20) — Claude Code/Codex extension that treats `*.replicad.ts` as the source of truth.

- **Rung:** embeddable TS/JS library (WASM kernel).
- **Fully offline:** yes (once wasm is cached).
- **Production-readiness:** best in-process TS geometry API. Kernel is OCCT 7.x-via-wasm, not as complete as desktop OCP. Correct bind for a Beep desktop that wants CAD *inside* the JS/Effect process.

### 3.8 JSCAD

[jscad/OpenJSCAD.org](https://github.com/jscad/OpenJSCAD.org) — **3227★**, MIT, JavaScript, pushed 2026-08-05. CSG in JS. No B-rep, no STEP-as-topology (mesh/geom3). Excellent for browser toys; wrong for manufacturing CAD.

- **Rung:** embeddable JS library.
- **Fully offline:** yes.
- **Production-readiness:** production for JS CSG; not a CAD system of record.

### 3.9 Fornjot

[hannobraun/fornjot](https://github.com/hannobraun/fornjot) — **2556★**, NOASSERTION, Rust, **archived** (pushed 2026-06-19, `archived: true`).

- **Rung:** embeddable Rust (historical).
- **Production-readiness:** **TRAP — archived.** Do not bind.

### 3.10 truck (Rust)

[ricosjp/truck](https://github.com/ricosjp/truck) — **1531★**, Apache-2.0, Rust, pushed 2026-08-10. B-rep kernel: `truck-modeling`, `truck-topology`, `truck-stepio`, `truck-meshalgo`. Active. No first-party TS bindings. You would FFI or wrap as a CLI.

- **Rung:** embeddable Rust library / CLI-if-you-wrap-it.
- **Fully offline:** yes.
- **Production-readiness:** serious open B-rep alternative to OCCT if you want a Rust-only stack. For TypeScript/Effect, it is a sidecar, not an import.

### 3.11 OpenCascade.js

[donalffons/opencascade.js](https://github.com/donalffons/opencascade.js) — **916★**, LGPL-2.1, last push **2023-08-15**. Emscripten port of OCCT.

- **Rung:** embeddable WASM.
- **Fully offline:** yes.
- **Production-readiness:** **TRAP — abandoned (last commit 2023).** replicad is the living TS/OCCT path.

### 3.12 Zoo / KittyCAD engine (CLI + API)

[zoo.dev](https://zoo.dev/) engine + [KittyCAD/cli](https://github.com/KittyCAD/cli) + [kittycad.ts](https://github.com/KittyCAD/kittycad.ts) + Text-to-CAD REST. KCL is the source language. Snapshots and mass props exist as first-class API (see MCP tool list). Design Studio / Zookeeper is the product UI.

- **Rung:** REST + CLI + MCP. Not a redistributable local kernel.
- **Fully offline:** no.
- **Production-readiness:** the most complete *commercial API-first* CAD an agent can call. Disqualified for an air-gapped / unpublished-IP desktop unless Zoo later ships a local engine license.

### 3.13 Other notable engines

| Engine | Notes | Bind? |
| --- | --- | --- |
| CascadeStudio | Browser OCCT playground; ancestor of replicad | file-format / reference only |
| Solvespace | Constraint 2D/3D, GPL, CLI exists but tiny | niche |
| Implicit CAD / GLSL SDF | earthtojake `implicit-cad` skill; not B-rep | experimental viewer |
| [lypwig/cadquery-server](https://github.com/lypwig/cadquery-server) (was roipoussiere) | 70★, MIT, **archived 2023-07-21** | TRAP |
| `kicad-cli` | ERC/DRC/gerber/netlist | yes, for EDA lane |

---

## 4. Agent frameworks purpose-built for CAD

### 4.1 Papers with released code

| System | Paper | Code | What an agent can actually run |
| --- | --- | --- | --- |
| **CADCodeVerify** | Alrashedy et al., ICLR 2025, [arXiv:2410.05340](https://arxiv.org/abs/2410.05340) | [Kamel773/CAD_Code_Generation](https://github.com/Kamel773/CAD_Code_Generation) (63★, last 2025-02-28) | CadQuery generate → render → VLM writes/answers binary visual questions → refine. +5.5% compile, −7.3% point-cloud distance vs prior on GPT-4 |
| **CAD-Coder (Doris / MIT)** | Doris et al., [arXiv:2505.14646](https://arxiv.org/abs/2505.14646) | [anniedoris/CAD-Coder](https://github.com/anniedoris/CAD-Coder) (197★, Apache-2.0, last 2025-07-17) | Open VLM fine-tuned to emit **CadQuery**. Weights on Hugging Face. Inference scripts in repo. Not an MCP |
| **CAD-Coder (Guan et al.)** | Guan et al., [arXiv:2505.19713](https://arxiv.org/abs/2505.19713) | `UNVERIFIED` first-party repo (listed on surveys; not confirmed live today) | CoT + geometric reward. Name collision with Doris |
| **MEDA** | IDETC 2025 | [AnK-Accelerated-Komputing/MEDA](https://github.com/AnK-Accelerated-Komputing/MEDA) (17★, Apache-2.0, last 2025-10-31) | Multi-agent plan/code/execute/review vs CADCodeVerify metrics |
| **MAC (Multi-Agent CAD)** | Tsinghua IEI, repo README 2026 | [Pan-Chera/Multi-Agent-CAD](https://github.com/Pan-Chera/Multi-Agent-CAD) (**834★**, MIT, pushed 2026-08-13) | 4-agent LangGraph + Aider + **build123d**. Claims 116× fewer tokens vs earthtojake CAD Skills, 99.3% feature pass (140/141). Runnable locally; OpenAI-compatible endpoints |
| **ArtiCAD** | [arXiv:2604.10992](https://arxiv.org/html/2604.10992v1) (2026-04-13) | project [articad.github.io](https://articad.github.io/) | Multi-agent articulated assemblies from text/image. Confirm code drop before depending. `UNVERIFIED` repo health today |
| **CAD-Factory** | ACM Papers ’26 ([DOI 10.1145/3799902.3811067](https://dl.acm.org/doi/pdf/10.1145/3799902.3811067)) | `UNVERIFIED` public code | Language-driven CAD generation |
| **Programmatic geometric validation MAS** | [arXiv:2603.26512](https://arxiv.org/pdf/2603.26512) (2026) | `UNVERIFIED` | Dual loop: compile errors + OCCT metrics (bbox, volume, counts, solid validity) + VLM judge on 3-view renders |

### 4.2 Named “CAD-Coder / CAD-Agent” systems

- **CAD-Coder-NextGen** (Harvard AC215): [palapav/AC215_cad_coder_nextgen](https://github.com/palapav/AC215_cad_coder_nextgen) — 2★, MIT, last 2025-12-11. Course project, not a product.
- **CAD-GPT / CAP**: [BlueAsuka/CAD-GPT](https://github.com/BlueAsuka/CAD-GPT) — 42★, LGPL-2.1, Jupyter, pushed 2026-08-04. Paper reproduction, not an MCP.
- **ScadLM**: [KrishKrosh/ScadLM](https://github.com/KrishKrosh/ScadLM) — 22★, MIT, last 2024-06-05. OpenSCAD agent. Stale.
- There is **no** widely adopted project literally named `CAD-Agent` with released, maintained code as of today. `UNVERIFIED` any commercial product using that exact name as a callable API.

### 4.3 Multi-agent / skill pipelines you can actually install

| Surface | Stars | License | Last push | How an agent drives it |
| --- | ---: | --- | --- | --- |
| [earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad) | **13522** | MIT | **2026-08-17** | **Agent skills**, not MCP. `npx skills install earthtojake/text-to-cad`. Skills: CAD (STEP/STL/3MF/GLB), CAD Viewer, step.parts, DXF, URDF/SRDF/SDF, SendCutSend, G-code, Bambu, implicit-cad. This is the dominant “give the coding agent a CAD skill” surface in 2026 |
| [Pan-Chera/Multi-Agent-CAD](https://github.com/Pan-Chera/Multi-Agent-CAD) | 834 | MIT | 2026-08-13 | Runnable 4-stage graph on build123d |
| [jdilla1277/agentcad](https://github.com/jdilla1277/agentcad) | 89 | Apache-2.0 | 2026-08-16 | CLI + optional MCP |
| Zoo Zookeeper | product | proprietary | live | Conversational agent *inside* Design Studio; not a third-party bind |

earthtojake is the important surprise: more stars than every CAD MCP combined except Blender. It is a **skill pack** that tells Claude/Codex to write Python CAD and preview locally. MAC exists specifically to beat its token cost.

---

## 5. The verification problem

### 5.1 Why generated CAD is usually wrong

Generated CAD fails in layers that unit tests on strings cannot see:

1. **Doesn’t compile** (wrong API, missing `.part`, CadQuery vs build123d mix).
2. **Compiles but is empty / open shell / non-solid** (boolean silently no-op).
3. **Solid but non-manifold / self-intersecting / sliver faces** (STEP rejected downstream).
4. **Valid solid, wrong intent** (hole on the wrong face, 9.8 mm instead of 10, extra body).
5. **Valid now, uneditable** (magic numbers, brittle selectors — “design” vs “shape”).

CADCodeVerify’s own motivation: “Testing the correctness of CAD generated code is challenging due to the complexity and structure of 3D objects… not feasible in code.” ([arXiv:2410.05340](https://arxiv.org/abs/2410.05340), 2024/2025)

### 5.2 Concrete validators (name the function)

| Validator | What it proves | Where it lives |
| --- | --- | --- |
| **OCCT `BRepCheck_Analyzer`** | B-rep well-formedness (faces, wires, shells, solids) | OCCT; wrapped by build123d-mcp `validate()` as `brep_valid` |
| **OCCT `ShapeFix_*`** | Repair ladder (same kernel) | OCCT; build123d-mcp documents a ShapeFix → re-boolean → defeature path |
| **Manifold boolean + `Status`** | Mesh is an oriented 2-manifold solid; booleans preserve that | [elalish/manifold](https://github.com/elalish/manifold) |
| **Edge→face map watertight / nonmanifold edge count** | Open edges, nonmanifold edges. build123d-mcp warns that `is_manifold` false-negatives on imports | build123d-mcp `validate()` |
| **Tessellation / mesh check** | Self-touching / coincident faces that a valid B-rep still fails in scorers | build123d-mcp (in-process small, subprocess large); CADGenBench-style gates |
| **Topology counters** | Face/edge/vertex counts after a boolean — “failed cut leaves counts unchanged” | CadQuery `inspect`, build123d `measure`, agentcad metrics, Zoo mass-props |
| **Mass properties** | Volume, area, CoM, inertia | OCCT GProp; Zoo `calculate_*`; build123d `measure` |
| **Clearance / interference** | `apart` / `touching` / `containing` / `interpenetrating` + intersection volume | build123d-mcp `clearance`, `interference`; Onshape `check_assembly_interference` (bbox-level in hedless) |
| **Feature recognition** | Holes, bolt circles, bosses, countersinks | build123d-mcp `find_holes` / `verify_spec` (experimental) |
| **Spec / checklist** | Requested-vs-built with PASS/FAIL/UNVERIFIED + evidence tier | build123d-mcp `verify_spec`; agentcad `check-spec` |
| **Design-parameter audit** | Nudge named parameters ±ε and re-validate (brittle vs robust) | build123d-mcp `design_audit` |
| **STEP round-trip** | Export + reimport; `export()` is “final authority” in build123d-mcp | any OCCT stack |
| **OpenSCAD compile + CGAL/Manifold** | CSG program is executable; mesh may still be garbage | `openscad` CLI exit code |
| **KiCad `run_erc` / `run_drc`** | Electrical / design rules — the EDA analogue of BRepCheck | Seeed / mixelpixx MCPs + `kicad-cli` |
| **Slicer CLI** | Mesh is printable (earthtojake G-code skill) | PrusaSlicer/Cura/Orca headless |

### 5.3 Screenshot / VLM loops

| Loop | Mechanism | Evidence |
| --- | --- | --- |
| **CADCodeVerify** | VLM generates binary questions from the prompt, answers them on rendered views, writes repair feedback. No geometric solver | [arXiv:2410.05340](https://arxiv.org/abs/2410.05340); [Kamel773/CAD_Code_Generation](https://github.com/Kamel773/CAD_Code_Generation) |
| **build123d-mcp `render_view`** | PNG/SVG/DXF, clip planes, labeled faces/edges, 2D drawing raster | llms.md 2026-08-17 |
| **FreeCAD / Blender / Fusion / Onshape MCP** | `get_view` / `get_viewport_screenshot` / `capture_viewport` / `render_part_studio_views` | respective READMEs |
| **Zoo `snapshot`** | Cloud renderer, first-class MCP tool | KittyCAD/mcp server.py |
| **agentcad `--preview`** | Four-view PNG + browser A/B viewer | agentcad README |
| **MAC / MEDA** | Multi-agent review stage after execute | repo READMEs |
| **arXiv:2603.26512 Validator-Judge** | OCCT metrics **and** a 3-view VLM judge; refiner gets both | [arXiv:2603.26512](https://arxiv.org/pdf/2603.26512) |

Practitioners already treat “write a spec, then drive the GUI” as the only way Blender MCP works ([@techotakulab, 2026-08-17](https://x.com/techotakulab/status/2089186505075966203)). That is the same loop CADCodeVerify formalized for CadQuery.

### 5.4 What is still missing

- **No standard “CAD test result” schema** shared across MCP servers. Each invents JSON.
- **Intent checking is still VLM or hand-written specs.** Kernel checks prove validity, not “this is a NEMA-23 bracket.”
- **Assemblies / mates** are first-class only in Onshape/Fusion/Rhino. Open stacks have joints (build123d) but no industrial constraint solver MCP.
- **Drawings (TechDraw / 2D views with GD&T)** are almost unbound. build123d drafting + DXF is the open path; FreeCAD TechDraw is scriptable but not exposed as a clean MCP.
- **Deterministic visual regression** (pixel or image-hash) is unused; everyone jumps to a VLM.
- **ε-valid geometry** is not guaranteed by OCCT; Manifold guarantees topology, not CAD tolerances.

---

## 6. Ranked bind list for TypeScript / Effect on Linux (2026)

Assumption: you are building an agentic CAD system in **TypeScript / Effect on Linux**, possibly shipping a proprietary desktop. Prefer offline. Prefer B-rep + STEP. Prefer a surface a coding agent can call without a human clicking “Start RPC Server.”

### 6.1 Surfaces worth binding, in order

| Rank | Surface | Why this rank |
| ---: | --- | --- |
| 1 | **build123d library + [pzfreo/build123d-mcp](https://github.com/pzfreo/build123d-mcp)** (Apache-2.0, stdio, offline) | Best agent tool surface in the entire survey. `execute` + `measure` + `validate` (BRepCheck) + `clearance` + snapshots + STEP export. Spawn as a supervised Effect child process. |
| 2 | **[jdilla1277/agentcad](https://github.com/jdilla1277/agentcad)** CLI (Apache-2.0) | JSON-on-stdout contract an Effect `Command` can parse without MCP. Same kernel as #1. Use as the “dumb reliable” path. |
| 3 | **CadQuery + [cadquery-contrib mcp-server](https://github.com/CadQuery/cadquery-contrib/tree/master/mcp-server)** (Apache-2.0) | Fallback codegen target: more papers and more LLM pretraining emit CadQuery than build123d. `render`/`inspect`/`export` are enough to close a loop. |
| 4 | **OCCT validators via OCP** (`BRepCheck_Analyzer`, `ShapeFix`, GProp, STEP CAF) | Your independent judge. Do not trust the generator’s process to grade itself. A small Python sidecar or future rust/wasm bind. |
| 5 | **Manifold** (Apache-2.0, C++/WASM/Python) | Mesh boolean + manifold guarantee. STL/3MF print lane and a second opinion when B-rep tessellation looks cursed. |
| 6 | **OpenSCAD CLI** (GPL, out-of-process) | Fastest LLM-to-geometry loop. PNG + STL. Keep it in a sandbox process; do not link. |
| 7 | **[sgenoud/replicad](https://github.com/sgenoud/replicad)** (MIT API, OCCT wasm LGPL) | Only in-process TypeScript B-rep. Use when you want CAD inside the Effect app without a Python child. Accept wasm size + LGPL load path. |
| 8 | **FreeCAD `freecadcmd` ± [spkane robust MCP](https://github.com/spkane/freecad-addon-robust-mcp-server)** (LGPL + MIT) | When you need TechDraw / FEM / a real document. Prefer `freecadcmd` scripts over neka-nat’s GUI RPC for automation. |
| 9 | **[earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad)** skills (MIT, 13.5k★) | Not a library — a prompt/skill pack. Steal the skill structure; do not make it the kernel. |
| 10 | **[KittyCAD/mcp](https://github.com/KittyCAD/mcp) + kittycad.ts** | Best commercial typed CAD API. Bind only behind an explicit cloud flag. Snapshots + KCL + mass props are real. |
| 11 | **Onshape REST** via [altendky/onshape-mcp](https://github.com/altendky/onshape-mcp) (Rust, Apache/MIT, Linux binary) or hedless’s 45-tool Python | If a customer already lives in Onshape. Official FeatureScript MCP is Labs and feature-oriented, not part-oriented. |
| 12 | **truck** (Apache-2.0 Rust) | Long-term alternative kernel if OCCT licensing or ABI becomes painful. Wrap as CLI. Not TS-native. |
| 13 | **JSCAD** (MIT) | Browser CSG preview only. |
| 14 | **KiCad MCP + `kicad-cli`** | Only if figures/PCB join the product. Seeed’s `run_erc`/`run_drc` are the verification lesson for EDA. |

### 6.2 Traps (do not bind first)

| Trap | Why |
| --- | --- |
| **[donalffons/opencascade.js](https://github.com/donalffons/opencascade.js)** | Abandoned Aug 2023. Use replicad. |
| **[hannobraun/fornjot](https://github.com/hannobraun/fornjot)** | Archived. |
| **[lypwig/cadquery-server](https://github.com/lypwig/cadquery-server)** | Archived 2023. |
| **Embedding OpenSCAD or Blender** | GPL-3/2 contamination. Spawn as a process or don’t ship them. |
| **[ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) as a CAD backend** | 26k★ of the wrong kernel. Mesh DCC + cloud asset APIs + `execute_blender_code`. Fine as an optional visualizer. |
| **Official Blender Lab MCP** | Same RCE warning, artist-scene focus, Blender 5.1-only. |
| **Fusion 360 any MCP** | No Linux Fusion. TCP often unauthenticated. Proprietary GUI host. |
| **Rhino / Grasshopper MCP** | No Linux desktop Rhino. Buy-in is McNeel, not your stack. |
| **Zoo / Onshape as the *only* kernel** | Cloud-only. Unpublished client geometry cannot go there (Oppold rule). Zoo MCP is 9★ first-party but token-gated. Official Onshape FeatureScript MCP is Labs + App Store subscribe + HTTPS. |
| **neka-nat as the only FreeCAD path** | Works, but `execute_code` + GUI RPC is a demo architecture. contextform (no license, stale), bonninr (stale 2-tool) are worse. |
| **jhacksman OpenSCAD-MCP** | Stale, unlicensed, pulls Gemini/Venice + CUDA MVS. Not “OpenSCAD.” |
| **rishigundakaram `generate_cad_query`** | Documented stub. |
| **AuraFriday Fusion MCP** | `NOASSERTION` license, marketing-heavy. |
| **Huaqiu kicad-mcp** | Archived. |
| **`execute_*` tools without a sandbox** | FreeCAD / Blender / Fusion official-community servers will run arbitrary Python against the user’s home directory. Blender Lab says this out loud. |
| **Assuming CADCodeVerify / MAC numbers transfer** | Paper loops use their own renders and their own judges. Re-implement the *validators*, not the leaderboard claim. |
| **Name collision: two “CAD-Coder” papers** | Doris 2505.14646 (released VLM + CadQuery) vs Guan 2505.19713 (CoT + geometric reward). Cite the arXiv id. |

---

## Sources

### GitHub API (2026-08-17)

Queried `gh api repos/<owner>/<name>` for 60+ repositories. Compact dump: `research/_fanout-2026-08-17/.scratch/github-repos.compact.json`. Star / license / `pushed_at` figures in this report are from that snapshot.

### Primary READMEs / tool schemas (fetched 2026-08-17)

- https://github.com/neka-nat/freecad-mcp
- https://github.com/spkane/freecad-addon-robust-mcp-server
- https://github.com/ahujasid/blender-mcp (+ `src/blender_mcp/server.py` tool defs)
- https://www.blender.org/lab/mcp-server/
- https://github.com/hedless/onshape-mcp
- https://github.com/altendky/onshape-mcp
- https://github.com/ReshefElisha/jarvis-onshape-mcp
- https://www.onshape.com/en/blog/featurescript-mcp-server-enables-text-code-cad
- https://github.com/KittyCAD/mcp (+ `src/zoo_mcp/server.py`)
- https://github.com/pzfreo/build123d-mcp + https://raw.githubusercontent.com/pzfreo/build123d-mcp/main/llms.md
- https://raw.githubusercontent.com/CadQuery/cadquery-contrib/master/mcp-server/README.md
- https://github.com/jdilla1277/agentcad
- https://github.com/faust-machines/fusion360-mcp-server
- https://github.com/frankhommers/autodesk-fusion-mcp
- https://github.com/ndoo/fusion360-mcp-bridge
- https://github.com/brookstalley/cordyceps
- https://github.com/mcneel/RhinoMCP + https://mcneel.github.io/RhinoMCP/docs/
- https://github.com/Seeed-Studio/kicad-mcp-server
- https://github.com/mixelpixx/KiCAD-MCP-Server
- https://github.com/Pan-Chera/Multi-Agent-CAD
- https://github.com/earthtojake/text-to-cad
- https://github.com/jabberjabberjabber/openscad-mcp
- https://manifoldcad.org/docs/html/ and https://github.com/elalish/manifold/wiki/Manifold-Library

### Papers

- CADCodeVerify: https://arxiv.org/abs/2410.05340 (ICLR 2025)
- CAD-Coder (Doris): https://arxiv.org/abs/2505.14646
- CAD-Coder (Guan): https://arxiv.org/abs/2505.19713
- ArtiCAD: https://arxiv.org/html/2604.10992v1
- Dual-loop OCCT + VLM judge: https://arxiv.org/pdf/2603.26512
- CAD-Factory: https://dl.acm.org/doi/pdf/10.1145/3799902.3811067

### X (first-class, 2026-08)

- https://x.com/Onshape/status/2087919684075016540 (2026-08-13) — official FeatureScript MCP launch
- https://x.com/bslizzle8552/status/2089168278824370603 (2026-08-17) — FreeCAD MCP in daily use, still brute-force
- https://x.com/10_X_eng/status/2089169232151867845 (2026-08-17) — FreeCAD MCP needs a reliability PR
- https://x.com/Gazeria/status/2088960510142173196 (2026-08-16) — OpenCode + neka-nat
- https://x.com/MinionTripper/status/2089007274555506806 (2026-08-16) — OpenSCAD + FreeCAD MCP together
- https://x.com/techotakulab/status/2089186505075966203 (2026-08-17) — Blender MCP only works with a written spec
- https://x.com/SyntheticBeef/status/2089066120154427726 (2026-08-16) — skip Blender MCP, use image-to-3D
- https://x.com/RobCodesALot/status/2089155601016209813 (2026-08-17) — Blender MCP optional vs Three.js

### Forum / news

- https://forum.freecad.org/viewtopic.php?t=102290 (2026-01-06) — Robust MCP release
- https://www.blender.org/development/blender-lab-activity-report-q1-2026/
- https://www.reddit.com/r/Onshape/comments/1vlrsmx/official_onshape_featurescript_mcp_released/ (2026-08-11)

---
