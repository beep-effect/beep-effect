---
name: explore
description: >
  Drive an exploration packet through the fuzzy front end: capture -> research
  -> align -> shape -> decompose -> graduate into goals/ packets. Trigger on:
  `/explore`, a new fuzzy idea or brainstorm to capture, "crystallize this",
  "help me break down this vision", decomposing a vision into goal packets,
  triaging explorations/INBOX.md, or resuming any packet under explorations/.
version: 0.2.0
status: active
---

# Explore

Operate the `explorations/` pipeline defined in
[`explorations/README.md`](../../../explorations/README.md). Read that file
once per session before acting; it is the convention authority (stages,
statuses, manifest schema, graduation contract). This skill is the operating
procedure, not a copy of the convention.

## Invocation Forms

- `/explore` — orient: triage `explorations/INBOX.md` if non-empty, then list
  active packets with stage + next open question, and recommend what to pick
  up.
- `/explore new <topic>` — scaffold `explorations/<slug>/` from
  `explorations/_template/` (kebab-case slug; real dates; title from topic),
  sync its manifest and generated projections, then drop into capture intake.
- `/explore <slug> [stage]` — read `explorations/<slug>/ops/manifest.json`
  and resume at its `stage`, or at the explicitly given stage override.

## Session Protocol

1. Read the packet manifest, then the packet `README.md`, then only the
   artifacts the current stage needs (smallest relevant set).
2. Work the stage per the behavior table below.
3. **Always close the loop before ending**: update manifest (`stage`,
   `openQuestions`, `updated`), rewrite the packet README's "Next Open
   Question" and append a dated Trail line, then run
   `bun run beep explore atlas --write`. Never hand-edit the marked README
   Stage/Status region or the ignored Atlas. Cold-session resume depends on
   this.

## Stage Behavior

**capture** — Frictionless intake. File whatever the user dumps into
`CAPTURE.md` under a dated heading (media into `assets/`, referenced
relatively). Never interrogate, never reorganize, never summarize back at
them. Advance to research only when the user signals the dump is done.

**research** — Ground the idea two ways, then write `RESEARCH.md` with dated
sections: (a) external landscape via web search/fetch, every claim cited;
(b) in-repo capability inventory via targeted source/barrel searches and local
package/docs inspection, citing package + path, marking gaps NOT FOUND. Surface
constraints discovered. Fan out subagents for breadth when the topic is wide.
Maintain `research/SOURCES.md` as the **provenance ledger**: every external
citation (with its on-disk URL), each upstream repo + its **license** (copyleft
⇒ clean-room only; permissive ⇒ port-with-attribution; missing/unverified ⇒
reference only), each mined source (id, repo, `file:line`, disposition), and
each in-repo brick the packet composes. Never fabricate a URL — cite the
RESEARCH.md section when none exists on disk. Register it in manifest
`exploration.sources`.

**align** — Run the `/grilling` discipline over the decision tree: work the
frontier in rounds (every currently-unblocked question per round, via
AskUserQuestion, recommended answer first with reasoning); explore the
codebase instead of asking when the repo can answer. After each settled
round, append dated entries to `DECISIONS.md` (Question / Answer /
Rationale, including rejected options) and sync manifest `openQuestions` to
the remaining frontier. Deferred questions are logged DEFERRED with reason,
not silently dropped.

**shape** — Draft `BRIEF.md` (problem, appetite, solution sketch, rabbit
holes, no-gos) from capture + research + decisions, at fat-marker fidelity —
concrete enough to decompose, rough enough to leave design latitude. Iterate
in review loops with the user. Exit only when they confirm it matches the
picture in their head.

**decompose** — Build `MAP.md`: candidate goal packets (slug, mission,
dependencies), sequencing with rationale, the first vertical slice, inherited
risks. Run the capability check: every major component cites an existing repo
capability or is explicitly NET-NEW — challenge any NET-NEW that smells like
an existing brick.

**graduate** — Check the four-point definition-of-ready from
`explorations/README.md`; if any point fails, name it and drop back to the
owning stage. Then, per approved candidate: scaffold `goals/<slug>/` from
`goals/_template/` (per `goals/README.md` rules, GOAL.md launcher included);
seed `SPEC.md` from the brief (no-gos -> non-goals, rabbit holes ->
constraints, DECISIONS -> decision log) with back-links to the exploration,
not copies; cross-link both manifests; carry the exploration's
`research/SOURCES.md` into
the goal (`goals/<slug>/research/SOURCES.md`), reproducing the source corpus for
implementation and linking the exploration's ledger as primary, and register it
in the goal manifest `researchReports[]` + `currentSourceOfTruth[]` with
`provenance.exploration` wired to the exploration's `links.goals`; flip
exploration status to `graduated` once every promised-now goal exists —
gated/queued candidates do NOT hold the packet open; they stay in `MAP.md`
as re-entry points, and a fired gate reopens the packet at `decompose`
(ratified 2026-08-13; see `explorations/README.md` Graduation Contract). Run
the Atlas writer after the manifest and authored README changes.

## Guardrails

- Parking and killing are first-class outcomes. Park with a dated reason in
  `DECISIONS.md`; kill with a one-line epitaph in tracked `DECISIONS.md` or the
  README Trail. Offer
  them when momentum or conviction dies — never let a packet rot as fake
  "active".
- Align asks in frontier rounds per `/grilling`: batch every
  currently-unblocked question, never a question whose prerequisite is still
  open this round.
- `CAPTURE.md` is append-only; never tidy it.
- Provenance is load-bearing: keep `research/SOURCES.md` current from research
  on, and never fabricate a source/URL/license — cite the on-disk RESEARCH
  section when no URL exists, and treat missing/unverified upstream licenses as
  reference-only (clean-room, never vendor).
- ATLAS is ignored, generated navigation, never doctrine or tracked GitHub
  truth; load-bearing prose goes to `docs/product/`, the exploration packet,
  or the goal packet.
- Stage loops are normal (align exposes a research gap -> do the research ->
  return). Record the loop in the README Trail.
