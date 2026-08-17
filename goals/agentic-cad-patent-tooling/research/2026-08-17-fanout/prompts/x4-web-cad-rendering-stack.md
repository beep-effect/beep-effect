You are a research lane in a 16-lane parallel study. Your output is a CITED report file, not a chat answer.

OUTPUT CONTRACT:
- Write to: ~/YeeBois/projects/beep-effect2/goals/agentic-cad-patent-tooling/research/_fanout-2026-08-17/reports/x4-web-cad-rendering-stack.md
- CREATE within FIRST 5 turns, APPEND as you go. Final chat message = pointer only.
- Inline citations (URL + date). Label `UNVERIFIED`.

TOPIC: The embeddable CAD RENDERING + KERNEL stack for a TypeScript/React desktop app (Electron/Tauri-class), 2026-08-17.

Concrete requirement being evaluated: a professional desktop app (React + TypeScript, Effect-based runtime) must display CAD renderings inline — STEP/IGES/STL/3MF/GLTF — with pan/orbit/section, measurement, and export of 2D black-line projections. It must run offline.

Cover with real repos, versions, bundle sizes, licenses, and last-commit dates:
- WASM CAD kernels in the browser: OpenCascade.js (opencascade.js), occt-import-js, replicad, manifold-3d, CascadeStudio, Fornjot/truck WASM status, Chili3D, JSCAD.
- Viewers/loaders: three.js STEP/IGES support (what actually exists vs what people think exists), model-viewer, online3dviewer (O3DV), CAD Assistant, xeokit, Autodesk Platform Services viewer (cloud), Speckle.
- 2D technical-drawing output from 3D in JS/WASM: HLR (hidden line removal) availability in OpenCascade.js, SVG/DXF export paths, and what's missing vs Python build123d's `project_to_viewport`/`TechnicalDrawing`.
- Bundle-size and startup reality: how big is the OCCT wasm blob, cold-start time, worker/OPFS strategies, memory ceilings on large assemblies.
- LICENSE TRAP AUDIT: which of these are LGPL/GPL and what that means for a proprietary/closed desktop app that links or bundles them. Be precise about OCCT's LGPL-2.1-with-exception and how the JS bindings inherit it.

End with a recommended stack for "render CAD inside a React/TS desktop app, offline, without GPL contamination", plus a runner-up, plus the specific thing that will bite (be concrete).
