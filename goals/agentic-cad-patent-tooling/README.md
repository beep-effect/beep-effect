# Agentic CAD — Patent Tooling

Lifecycle: `active`

CAD capability for a solo patent practice inside
`apps/professional-desktop`: open the drawings a matter already has, and make
the **reference-numeral / figure graph** a first-class, agent-queryable part of
the knowledge graph.

## Mission

Not "generate patent figures." The illustrator market is already cheap
($28–39/sheet offshore, $100–125/sheet US, 2–5 days, unlimited revisions), so
replacing the illustrator can never repay a build. The unmet need is the
**graph** — `{disclosure, claims, parts, numerals, views, sheets}` with
provenance — which every commercial vendor keeps locked inside its own
workspace and none expose to an agent.

## Next action

**P1 — extract the numeral graph from artwork that already has a text layer.**
Start with schema: scaffold `CadFigure` and `ReferenceNumeral` via
`bun run beep architecture`, then the `1.84(p)(4)–(5)` bijection service. No
new engine, no licence risk, and it directly tests the packet's load-bearing
assumption.

## Launcher

```text
/goal follow the instructions in goals/agentic-cad-patent-tooling/GOAL.md
```

## Reading order

1. [`SPEC.md`](SPEC.md) — normative scope, the eight locked decisions, format
   tiers, acceptance, stop conditions.
2. [`PLAN.md`](PLAN.md) — phase sequencing and what is deliberately deferred.
3. [`GOAL.md`](GOAL.md) — compact execution launcher.
4. [`research/SOURCES.md`](research/SOURCES.md) — provenance ledger.

## Status

**Research complete (2026-08-17); execution not started.**

This packet was previously `reference` — a repo-agnostic buyer's guide with no
build plan. It is now execution-capable, and its central conclusion has
changed.

### What changed from the 2026-05-29 report

The prior report ([`research/agentic-cad-landscape.md`](research/agentic-cad-landscape.md))
recommended adopting the local OpenCASCADE Python stack (CadQuery +
build123d) first. It was repo-agnostic and optimised for **3D solids**. Two
evidence sources overturned that default:

- **The corpus is 2D-dominant.** 837 AutoCAD `.dwg` (13.8 GB) vs 201 STEP
  (6.3 GB) — 4:1 — plus 175 Illustrator `.ai` sheets edited as recently as
  2026-08. Sampling shows 37 of 40 DWGs are AC1032 (AutoCAD 2018+).
- **The figure artwork is already machine-readable.** Of 175 `.ai` files, 173
  are PDF-compatible, 117 embed fonts, and 86 of those contain `FIG. n`. The
  numeral graph can be extracted today with no new engine.

A correction worth carrying: the 552 `.svg` files in the corpus are **not**
figure artwork — they are UI/web icons from browser and app caches (386 of a
400 sample under a Windows user profile; 252 under 2 KB; no vector-editor
metadata). Do not plan against them.

The prior report's conclusions still standing: no turnkey disclosure→figure
pipeline exists, and cloud text-to-CAD is unusable for privileged work.

## Evidence

- [`research/2026-08-17-fanout/`](research/2026-08-17-fanout/) — 20 cited lane
  reports (market, agent tool surfaces, rendering stacks, DWG/DXF ingest,
  vector figure pipeline, 2D-vs-3D architecture, drawing standards and
  confidentiality law, plus six repo-archaeology lanes over cloned CAD
  projects and two over this repo).
- [`research/2026-08-17-fanout/ideation/`](research/2026-08-17-fanout/ideation/)
  — divergent ideation under five isolated cognitive frames, and the three
  deepened branches. Four of five frames independently converged on the same
  reframe, which is why it is in `SPEC.md` rather than in a maybe-list.
- [`research/agentic-cad-landscape.md`](research/agentic-cad-landscape.md) —
  the superseded-in-part 2026-05-29 buyer's guide.
- [`research/PROMPT.md`](research/PROMPT.md) — the re-runnable 2026-05-29
  research brief.

## The three things that shape every design choice

1. **Quality first; cloud is available.** Local-only is a deployment mode, not
   a requirement — attorneys already use cloud AI routinely, and frontier
   models are materially better at the two hardest parts here (reading
   numerals off outline-only artwork, and CAD codegen). What the software owes
   is a **provenance and consent record** per matter: which service saw which
   artefact, under whose authorisation, when. ABA Formal Op. 512 is explicit
   that boilerplate engagement language is not informed consent, which makes
   that record a product feature rather than a compliance checkbox.
2. **No GPL DWG reader, ever.** LibreDWG is GPL-3.0-or-later with no LGPL
   path; running it in a Web Worker is architectural isolation, not legal
   isolation. ODA's own FAQ restricts the File Converter to non-commercial use
   for non-members. The escape is the embedded preview bitmap (no entity
   parse) plus a user-installed converter discovered on `PATH`. This one is a
   licence constraint and does not relax.
3. **Numerals are the product.** `37 CFR 1.84(p)(4)–(5)` is a strict
   bijection — every numeral in the drawings must appear in the specification
   and vice versa, the same part carries the same numeral in every view, and a
   numeral is never reused for a different part. That is a graph invariant,
   and it is the one legally-operative thing software can enforce.
