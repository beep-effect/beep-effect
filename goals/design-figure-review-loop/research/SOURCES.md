# Design Figure Review Loop — Sources & Provenance

- **Source exploration:** `explorations/patent-drawing-pipeline` — primary ledger:
  `explorations/patent-drawing-pipeline/research/SOURCES.md` (re-graduated 2026-10-13).
- **Predecessor ledger:** `goals/design-figure-generation/research/SOURCES.md` (kernel, rules,
  upstream licenses); rows there are not repeated here.
- **Provenance:** the attorney's 2026-10-10 review and the operator's 2026-10-13 request (SPEC
  Source Hierarchy #1).

## 1. Mined source corpus

Matter material is held under `BEEP_OPPOLD_CORPUS_ROOT`; the repo records only what identifies a
source, never its content.

| Source | Title | Location | Theme | Disposition |
|--------|-------|----------|-------|-------------|
| `review-mail-2026-10-10` | The attorney's reply of 2026-10-10, subject "Re: [client] design application: draft drawing sheets for your review" (client name redacted) | Mailbox; attachments saved under `<corpus>/ops/patent-drawing-pipeline/matter/inputs/feedback-2026-10-10/` (eight annotated sheet PDFs, two reference images) | F1-F10 markup | Source Hierarchy #1; quoted only in the corpus |
| `guide-1993` | USPTO, Guide for the Preparation of Patent Drawings (1993), Appendix 4 Examples 32-38 (surface shading) at pp. A-4-77..A-4-89 | HathiTrust full-view id `osu.32437010555650` | F4 shading calibration | reference |
| `guide-2002-hathi` | USPTO, Guide for the Preparation of Patent Drawings (June 2002) | HathiTrust full-view id `mdp.39015051563529` | F4, F7 | reference |
| `guide-2002-gbooks` | Same 2002 edition, 149 pages; Examples 16 (spaced-line shading) and 17 (stippling) | Google Books id `iu5UAAAAMAAJ`; PDF saved under `<corpus>/ops/patent-drawing-pipeline/reference/` (sha256 `4e5ab386f190586bcf7ff3c6cff0871c12c53b0b96cbed4951d17f716936b882`) | F4 calibration | reference |
| `label-fonts-2.1.5` | Liberation Sans Regular and Liberation Serif Regular 2.1.5 (OFL-1.1; Arial / Times New Roman character widths) | Workstation package `ttf-liberation 2.1.5-2`; file hashes and the generator recipe in [`label-glyphs.md`](label-glyphs.md) | F2, F3 label outlines | vendored as an OFL subset (`src/internal/LabelGlyphs.ts`, `licenses/OFL-1.1.txt`) |
| `cfr-1.84-g` | 37 CFR 1.84(g) — sheet margins (cm and inch figures) | eCFR | F7 | normative |
| `cfr-1.84-m` | 37 CFR 1.84(m) — shading; light from the upper left at 45° | eCFR | F4, F8 | normative |
| `cfr-1.84-p` | 37 CFR 1.84(p) — numbers, letters, minimum 0.32 cm height | eCFR | F2, F3 | normative |
| `cfr-1.152` | 37 CFR 1.152 — design drawings; surface shading; broken lines for unclaimed matter | eCFR | F4, F5, F10 | normative |
| `mpep-1503.02` | MPEP 1503.02 — drawings in design applications (broken lines, shading, views) | MPEP | F1, F4, F10 | normative |

**How these inform implementation:** the 1993 examples set the graded and surface-class shading
rules (PR-E); 1.84(g) sets `cfr-strict`; 1.84(p) sets the label cap-height check; 1.152 and MPEP
1503.02 fix broken lines as unclaimed visible edges only (PR-D).

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Liberation Fonts 2.1.5 (Sans, Serif) | OFL-1.1 | vendored generated glyph subset with the license text; Reserved Font Name respected | label outlines metric-compatible with Arial / Times New Roman |
| Arial, Times New Roman (operator-supplied) | proprietary | never committed; read at render time, sha256 in the manifest | optional literal typefaces |

## 3. External research sources

The Guide editions above are public-domain US government works; the catalog sits behind a bot
wall (receipt in the predecessor's `research/OPPORTUNITIES.md`, 2026-10-13).

## 4. In-repo capability references

| Brick | Path | Use |
|-------|------|-----|
| `@beep/technical-drawing` | `packages/foundation/capability/technical-drawing` | extend (sheet, view, part, manifest, review schemas) |
| `@beep/occt` | `packages/drivers/occt` | extend (isometric camera, broken compounds, shading rules) |
| `@beep/pdf-tools` | `packages/drivers/pdf-tools` | extend (word boxes, ink coverage, annotations) |
| `@beep/m365` | `packages/drivers/m365` | reuse `listMessageAttachments` / `downloadMessageAttachment` (#1456); extend (app-only env loader, Outlook item refs) |
| `beep drawings` | `packages/tooling/tool/cli/src/commands/Drawings` | extend (`beep drawings intake`, review ingest, statement guard) |
| Drawing judge | `.claude/skills/browser-qa-loop/resources/drawing-judge-prompt.md` | extend (claim-scope rule) |

## 5. Cross-links & provenance

- Predecessor: `goals/design-figure-generation` (`relatedPackets` both ways; pointer row in its
  SPEC Decision Log).
- Sibling: `goals/agentic-cad-patent-tooling` (D9 exception widened 2026-10-13).
- Exploration: `explorations/patent-drawing-pipeline` (`links.goals`, DECISIONS 2026-10-13).
