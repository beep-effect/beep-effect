# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `design-figure-generation` | Spec-as-code → one solid → eight hidden-line design figures → compliant sheets → validator → judge → attorney sign-off, as a `beep drawings` CLI for the live matter. | `agentic-cad-patent-tooling` (OCCT WASM driver, 1.84 compositor P5, `law-practice` CAD domain) — consume when landed, else land the shared brick here and hand it back | `@beep/ffmpeg` subprocess shape (`packages/drivers/ffmpeg/src/FFmpeg.service.ts`); `pdf-lib`/`pdfjs-dist`/`sharp` catalog deps; QA judge (`packages/tooling/tool/cli/src/commands/Qa/JudgeContract.ts`, `Inventory.schemas.ts`, `JudgeCheck.ts`); corpus root (`Corpus.command.ts:60`); `packages/law-practice/domain`; `bun run beep create-package`. NET-NEW: replicad geometry/projection driver, shading generator, sheet composer, drawing validator, `commands/Drawings/`. |
| `design-figure-intake` (gated) | Seed a matter spec from an Outlook request + attachments via `@beep/m365`; agentic-cad A2 photo→DXF on-ramp. | `design-figure-generation`; attachment-download verbs verified in `@beep/m365` | `@beep/m365`, `@beep/m365-mcp`; agentic-cad P6. Gate: a second live matter arrives or the m365 driver gains attachment reads. |
| `design-figure-desktop` (gated) | Surface the pipeline in `apps/professional-desktop` on the attorney's Windows box. | `design-figure-generation`; agentic-cad P7 (`release-desktop.yml` has run at least once) | agentic-cad D9/D10. Gate: desktop release lane proven. |

## Sequencing

1. **`design-figure-generation`** is the only promised-now goal. Its P1 is
   the perspective-HLR spike; a failed spike routes the two perspective
   figures to the build123d fallback rather than reopening the kernel
   decision. Slice 1 (unshaded sheets for the live matter) ships before
   slice 2 (shading + judge + sign-off) starts.
2. Shared bricks: if agentic-cad's OCCT driver or compositor package does
   not exist when slice 1 needs it, this goal lands the package under
   `packages/drivers/*` per D7 and agentic-cad consumes it — the brick is
   owned by whichever lands first, never duplicated.
3. `design-figure-intake` and `design-figure-desktop` stay here as
   re-entry points; a fired gate reopens this exploration at `decompose`.

## First Vertical Slice

A developer runs `bun run beep drawings render --spec <corpus>/<matter>/spec.json --out <corpus>/<matter>/out/` on this workstation and gets eight Letter PDF sheets (top/bottom perspective, top/bottom plan, front/rear/left/right elevations), unshaded, one figure per sheet, "FIG. n" and "n/N" outlined, with `manifest.json` hashes, and `bun run beep drawings validate <out>/sheets.pdf` exits 0. Verified by: the validator's own raster tier on the output, a golden-sheet snapshot test on the synthetic fixture article in the owning package's `test/`, and the attorney's review of the real sheets (recorded out-of-repo).

## Open Risks Inherited From The Brief

- Perspective HLR via replicad public API unverified → P1 spike; fallback build123d.
- No fold feature in any code-first kernel → tabs as rotated solids, score lines as grooves; no fold feature built.
- Procedural shading may read as mechanical → vendor shading-only fallback, bounded appetite.
- Byte-identical reruns → outlined text, rounded/sorted coordinates, stripped PDF dates, seeded jitter, pinned WASM hash + pixi lock.
- MuPDF.js AGPL → external `pdftoppm`/`mutool` or pdfjs-dist only.
- Patent Center blank-page conversion → raster tier mandatory.
- Description vs. sketch disagreement on base geometry → measure the article first.
- Collapsed/tabs-up figures → restriction risk; attorney's claim-strategy call.
