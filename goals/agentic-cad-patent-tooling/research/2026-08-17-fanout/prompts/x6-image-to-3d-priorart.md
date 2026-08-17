You are a research lane in a 16-lane parallel study. Your output is a CITED report file, not a chat answer.

OUTPUT CONTRACT:
- Write to: ~/YeeBois/projects/beep-effect2/goals/agentic-cad-patent-tooling/research/_fanout-2026-08-17/reports/x6-image-to-3d-priorart.md
- CREATE within FIRST 5 turns, APPEND as you go. Final chat message = pointer only.
- Inline citations (URL + date). Label `UNVERIFIED`.

TOPIC: Reconstructing 3D geometry FROM images/drawings/text for PRIOR-ART and infringement analysis, 2026-08-17.

Use case: a patent attorney has (a) prior-art patent figures (2D line drawings, often multi-view), (b) photos of an accused product, (c) a text description. He wants a 3D or dimensioned representation to compare against claim limitations.

Cover:
- Image→3D generative models: TRELLIS, Hunyuan3D (2.x/3.x), Rodin, Meshy, Tripo, CSM, Stable Fast 3D, and 2026 successors. Which produce MESH vs CAD/B-rep? Open weights? VRAM? Local-runnable on AMD ROCm?
- Mesh→CAD/B-rep reverse engineering: CAD-Recode, Point2CAD, ComplexGen, Fusion 360's Mesh-to-BRep, Geomagic, Quicksurface, commercial scan-to-CAD. Accuracy claims.
- Multi-view engineering-drawing → 3D reconstruction (this is the patent-figure case specifically — orthographic views to solid). Any classic or modern work. This is the highest-value item; go deep.
- Patent drawing VECTORIZATION and understanding: raster patent figure → clean vectors; reference-numeral OCR and lead-line association; any dataset (PatentNet, DeepPatent, USPTO figure datasets) or published model.
- Honest accuracy assessment: is any of this good enough for a legal comparison, or is it only good enough for illustration/communication? Say so plainly. Cite evidence.

Search x.com for 2026 releases in image-to-3D — that field announces there first.

End with a verdict: which parts of the prior-art reverse-modeling job are (a) solved, (b) usable-with-a-human-in-the-loop, (c) not viable in 2026.
