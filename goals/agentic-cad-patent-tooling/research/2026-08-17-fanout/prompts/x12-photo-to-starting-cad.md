You are a research lane. Your output is a CITED report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: /home/elpresidank/YeeBois/projects/beep-effect2/goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/x12-photo-to-starting-cad.md
  (expand ~ to the real home directory)
- CREATE the file within your FIRST 5 turns with a heading skeleton, then APPEND as you research. Never save writing for the end.
- Final chat message = pointer only. Inline citations (URL + date). Label `UNVERIFIED`.

REFRAMED QUESTION (this is NOT "can AI make perfect CAD from a photo" — that is already answered NO):
A solo patent attorney is a competent Fusion 360 user who does his own modeling. His stated bottleneck is **getting started** — the blank-sketch problem. He wants: photo(s) of a real physical part -> SOMETHING he can open in Fusion and keep modeling from himself. Rough is fine. He will fix it. It does NOT need to be dimensionally exact, and for patent FIGURES it does not need to be to scale at all (37 CFR 1.84(k) actually forbids scale callouts).

Answer: what is the best LOCAL, offline path from photos to a usable Fusion starting point in 2026? Rank the options by hit rate on real mechanical parts.

Cover concretely:

1. **Fusion's own on-ramps.** What does Fusion 360 actually accept as a modeling starting point? Cover the **Canvas** feature (insert image on a plane, Calibrate to set scale, sketch over it), Mesh workspace, **Convert Mesh** (prismatic / faceted / organic) and its real limits, inserting a McMaster part, and importing DXF as a sketch. Which of these does a competent user actually use to start? Cite Autodesk docs.

2. **Photogrammetry, local and AMD-friendly.** COLMAP, AliceVision/Meshroom, OpenMVS, RealityCapture, Polycam, Autodesk ReCap. For each: licence, whether it runs offline, and CRITICALLY **whether it hard-requires CUDA** — the user has 2x AMD Radeon AI PRO R9700 (RDNA4, ROCm), NO NVIDIA. Meshroom's depth-map step is widely believed to be CUDA-only; verify that precisely and report what the CPU/other fallbacks actually are in 2026. Include practical capture advice for a small part (turntable, scale reference, matte surfaces, feature-poor shiny metal being the classic failure).

3. **Single-image generative mesh as a "shape sketch."** TRELLIS / TRELLIS.2 / Hunyuan3D-2.1 / Stable Fast 3D specifically on AMD ROCm. What actually runs on RDNA4 today? What is the honest quality for a mechanical part with flat faces and holes vs an organic prop?

4. **Mesh -> editable solid.** Fusion Convert Mesh limits (face-count ceilings, prismatic vs organic), plus the open/commercial scan-to-CAD options. Is a generative mesh ever a good Convert Mesh input, or does it only work on real scans?

5. **The 2D shortcut nobody mentions.** For prismatic parts, photo -> rectify/deskew -> silhouette trace -> DXF -> Fusion sketch -> extrude is often faster and MORE accurate than any 3D reconstruction. What local tools do the tracing well (OpenCV contour + polygon simplification, potrace, autotrace, Inkscape trace CLI)? How do you recover real scale from a ruler or a known feature in frame? Take a position on when this beats 3D.

6. **The honest failure list.** Where does each path break on real patent-practice subject matter: shiny/machined metal, transparent parts, internal features you cannot photograph, thin sheet metal, assemblies, tiny parts, textureless surfaces.

END WITH: a ranked recommendation for "photos -> Fusion starting point, local only, AMD box", stating for each option the capture effort, wall-clock time, what Fusion actually receives, and the honest hit rate. Say plainly which ONE you would wire up first and what would change your mind.
