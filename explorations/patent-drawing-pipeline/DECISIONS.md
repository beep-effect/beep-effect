# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-10-05 — relationship to goals/agentic-cad-patent-tooling

**Question:** The active goal `goals/agentic-cad-patent-tooling` already
owns the OCCT driver, the 37 CFR 1.84 compositor (its P5), and the
law-practice CAD domain, but scopes OUT model generation, filing-ready 1.84
certification, and 1.152 design shading. How does this packet relate to it?

**Answer:** Graduate into a **sibling goal** (working slug
`design-figure-generation`) that depends on agentic-cad's OCCT driver and
compositor packages. At graduation, amend agentic-cad's "Out (this packet)"
list to point at the sibling instead of silently overlapping.

**Rationale:** Keeps agentic-cad's ten locked decisions (esp. D7 ownership:
`drivers/*` engines, `law-practice` meaning, `documents` bytes) intact and
honours the reuse law. Rejected: amending agentic-cad in place (reopens a
2026-08-17 reframe for a different product question — design figures from a
generated solid vs. numeral graph over existing 2D art); building
standalone (duplicates P5, violates discovery-and-reuse).

## 2026-10-05 — data residency and disclosure hygiene

**Question:** The repo is public; agentic-cad D9 keeps client files on the
attorney's Windows box. Where may a real article's geometry, photos, and
renders live?

**Answer:** Real matter material (spec, photos, CAD code, renders, PDFs,
sign-off events, and the deep-research notes that use the article as an
example) lives under **`~/data-home/oppold-corpus`** (reached via the
existing `BEEP_OPPOLD_CORPUS_ROOT` config). The repo carries only a
**synthetic fixture article** plus golden outputs. Packet prose stays
generic about any live article.

**Rationale:** A provisional is not a publication; committing an unfiled
design's geometry to a public repo is a disclosure (and loses foreign design
rights). D9 is read as "no client bytes in git", not "no client bytes on the
developer workstation" — the corpus home already lives here and the operator
runs the CLI here (next decision). Rejected: strict D9 (blocks the live
request on the never-run desktop release lane); real geometry in-repo.

## 2026-10-05 — operating surface

**Question:** Who runs the pipeline, where, for the first year?

**Answer:** A **`bun run beep drawings …` CLI on the developer's Linux
workstation**, operated per matter by the developer; the attorney receives
PDFs and signs off. A desktop-app surface is deferred to agentic-cad P7.

**Rationale:** Agent-operable, no packaging milestone, consistent with the
corpus-root pattern. Rejected: desktop app on the attorney's Windows box
first (gates on the untested `release-desktop.yml` lane, forbids Linux-only
tooling); both from day one (over-constrains kernel choice for an unproven
pipeline). D10 (Windows x64) is therefore a *later* constraint; the kernel
choice below keeps the port mechanical anyway.

## 2026-10-05 — first milestone

**Question:** What is the first end-to-end proof?

**Answer:** The **live matter's eight-view hidden-line set, unshaded**:
measure the article, write the parametric model, emit eight compliant
Letter sheets, validator green, attorney review. Shading is slice 2.

**Rationale:** Fastest usable output for the attorney and a direct test of
the model-once-project-eight thesis. Rejected: reproducing a granted firm
design patent first (best calibration, slower — kept as a validator
calibration task using a public granted PDF); spike-only (answers one of
seven questions).

## 2026-10-05 — geometry and hidden-line kernel

**Question:** Which engine builds the solid and projects the views?

**Answer:** **replicad over opencascade.js (WASM) in-process in Bun** as the
`GeometryEngine`/`ProjectionEngine` implementation; **build123d** behind the
same service contract as a pixi-pinned subprocess fallback. A one-day spike
must prove true perspective HLR through replicad's public API before slice 1
commits; if it fails, the two perspective figures route to the fallback.

**Rationale:** Keeps model + projection in TypeScript behind the
schema→service contract, matches agentic-cad D6 (WASM worker now, Python
sidecar later) and keeps a future Windows port mechanical. Rejected:
build123d-first (Python toolchain in the repo, non-TypeScript model);
Claude-written per-matter scripts with no service contract (fails the
"reproducible feature" ask).

## 2026-10-05 — surface shading (37 CFR 1.152)

**Question:** How does slice 2 get design-patent surface shading onto views?

**Answer:** Build the **deterministic procedural generator** (per visible
planar face: exposure to an upper-left 45° light sets hatch pitch; seeded
dashes; hatching passes through the same HLR; thinner layer; never stipple
and line on one face; never on broken-line regions). **Vendor shading-only
pass** on the unshaded SVGs is the filing fallback if the attorney or an
illustrator rejects the look.

**Rationale:** The article class is all planar faces, the easy case; the
generator is untested, hence the fallback. Rejected: vendor-only (per-matter
cost + human step forever); manual Inkscape pass (slowest, no feature).

## 2026-10-05 — review loop

**Question:** How are figures judged before the attorney signs off?

**Answer:** **Deterministic validator gates first** (page size, PDF ≤ 1.6,
fonts embedded, ink-bbox margins at 300/600 dpi, pure black/white, no
filled-black area). Then **extend the existing `beep qa` judge**
(qa-inventory/v1, `JudgeContract`/`JudgeCheck`/`JudgeIngest`) with a
drawing rubric over a contact sheet + reference photos (view-count
agreement, feature presence/absence, fold direction, nothing the article
lacks). Attorney sign-off is a **recorded event keyed to the sheet-set
hash** (the 37 CFR 11.18(b) / 89 FR 25614 "reasonable inquiry"). Because
the developer operates the CLI, `--by` is descriptive metadata only; the
event is valid only when it references a **confirmation artifact the
attorney authored** (an email reply by Internet Message-ID, or an
initialed PDF under the corpus root) that contains, on its own line, the
verbatim approval statement the CLI prints for that sheet set (`I approve
design-figure sheet set <hash> for filing.`). A hash quoted in any other
sentence, a rejection included, is refused; `drawings sign` verifies the
whole line before writing the event.

**Rationale:** Reuses the judge machinery and its hallucinated-evidence
guard; the judge handles semantics only. Rejected: validator-only (misses
plausible-but-wrong CAD); a standalone drawings judge (duplicates three
modules).

## 2026-10-05 — intake

**Question:** How does a matter's drawing request enter the pipeline?

**Answer:** **Hand-authored measured `spec.json`** under the corpus root
(ModelSpec parameters from calipers, figure list with view names and
description sentences); Claude drafts the CAD code from it inside a
verify-and-repair loop.

**Rationale:** Dimensions must come from measurement, not photos. DEFERRED:
`beep drawings intake` via `@beep/m365` (the connector used today cannot
download binary attachments; driver attachment verbs unverified) and the
agentic-cad A2 photo→DXF on-ramp (seeds geometry, not dimensions).

## 2026-10-05 — package topology (resolved by doctrine, not asked)

**Question:** Which packages own what?

**Answer:** Per `standards/architecture/07-non-slice-families.md` and
agentic-cad D7: OCCT/replicad wrapper, rasterizer/PDF-tool wrappers →
`packages/drivers/*` (shape of `@beep/ffmpeg`); matter spec, figure
domain, validator findings → `packages/law-practice/domain` (+ use-cases /
server for the pipeline service composition); operator command →
`packages/tooling/tool/cli/src/commands/Drawings/`; synthetic fixture +
golden sheets → the owning package's `test/` fixtures. Exact package names
are settled at graduation via `bun run beep create-package` /
`bun run beep architecture`.
