# P2 grill decisions — ratified 2026-08-01

Outcome record of the P2 grill session over the open questions collected in
`research/p1-skill-upstream-resolution.md`, `research/p1-knowledge-finding-schema-design.md`,
`research/p1-manifest-capability-extension-design.md`, and SPEC.md's "Remaining decisions
to grill (P2)". Every decision below is ratified doctrine for this initiative: do not
relitigate in implementation PRs. Where a decision defers something, the deferral and its
reopening trigger are part of the decision.

## Workstream D — capability model

### D1. Capability slug grammar

`CapabilitySlug` is Option A from `research/p1-manifest-capability-extension-design.md`:
a strict two-segment `S.TemplateLiteral` of `namespace/name`.

- Segment grammar: `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/` — lowercase ASCII letters and
  digits, internal single hyphens only; no trailing or doubled hyphens; no Unicode.
- Segment length ≤ 32; total slug length ≤ 64.
- Enforced at decode time. Empty, whitespace, case-variant, and multi-slash identities
  never reach the projection.
- Hierarchy (3+ segments) is reachable later only through a deliberate compatibility
  plan; taxonomy growth is a governed decision, not an implementation drift.

All four live values (`knowledge/doctor`, `skills/warehouse`, `goals/graph`,
`goals/bootstrap`) conform.

### D2. Granularity — durable abilities only

A capability names a durable product/infra ability another packet can `requires` and
build on once the provider is `completed-retained`. Milestones and task states stay in
packet phases.

| Good | Bad (milestone/task prose) |
| --- | --- |
| `knowledge/doctor` | `p1/research-done` |
| `skills/warehouse` | `docs/pr-529` |
| `goals/graph` | `refactor/phase-3` |

This table ships beside the regex wherever the grammar is documented.

### D3. Lifecycle — no aliases in v1

Aliases and redirects are not modeled. A rename is a governed manifest edit across every
declaring packet in one PR — the strict grammar makes slugs exactly grep-able and the
catalog lists all declarers. Deprecation = the last provider goes terminal. Revisit only
if a real rename demonstrates pain.

### D4. Collisions — informational only

Multiple packets providing one capability is always informational catalog data, never a
warning or block. Multi-provider is legitimate OR (differential fixture 5). No exclusive
ownership namespaces in v1.

### D5. Duplicate declarations — doctor finding under the ratchet

Projection deduplicates (already decided). Doctor emits a normal blocking-class finding
governed by the baseline ratchet: NEW duplicates block the introducing PR; inherited
ones are non-fatal advisories.

### D6. Self-cycles — schema-level rejection

`GoalManifest` carries an `S.filter` check: `provides ∩ requires = ∅`. A packet
requiring its own capability is a guaranteed deadlock (never nominally ready before
completing; completing is what would satisfy it) and is always an authoring error.

### D7. `executionCapable: false` — frontier-only exclusion

The packet never enters the actionable frontier (fail-closed, already decided), but
shortest-unlock MAY route through it with the step explicitly annotated
not-execution-capable. Routing is a planning report: when the only path runs through a
human-gated packet, "no path" is a lie and "path exists, this step needs non-agent work"
is the honest answer.

### D8. Superseded and reference providers — strand + re-declare

- A superseded provider never satisfies nominal readiness (only `completed-retained`
  does). No modeled redirects in v1.
- The superseding packet must re-declare the capability slugs it carries forward.
- Doctor emits a "stranded capability" advisory when a superseded packet's capability
  has no active/completed declarer remaining.
- Reference packets never satisfy nominal readiness; `provides` on a reference packet is
  a doctor finding under the ratchet. Reference packets document — they do not build.
  An ability nobody buildable provides renders as honest `fog:<capability>`.

### D9. Evidence mint lanes — publish, strict closeout, reflect

Only externally-verifiable milestones mint receipts into `ops/evidence.json`:

- `publish` — full local proof bound to a PUSHED commit sha;
- strict `closeout` pass — bound to PR number, head sha, and review/check state;
- `reflect` — closeout reflection landing.

`verify` never mints: an unpushed local pass is self-attestation, and letting any
workstation run write tracked evidence dilutes "tree-bound proof" into "someone claimed
it ran".

### D10. Evidence shape — `goal-evidence/v1` append-only ledger

```jsonc
{
  "schema": "goal-evidence/v1",
  "receipts": [
    {
      "kind": "publish",            // LiteralKit: publish | closeout | reflection
      "commit": "<40-char sha>",
      "prNumber": 529,              // optional
      "command": "<canonical command>",
      "toolVersion": "<repo-cli version>",
      "outcome": "pass",
      "artifacts": ["<verdict/artifact pointers>"],
      "at": "<ISO timestamp>"
    }
  ]
}
```

Append-only; the graph consumes the newest receipt per kind for evidence-backed
readiness. Only yeet/reflect tooling writes it; git history is the integrity layer
(forging a receipt is a visible commit). Ledger semantics deliberately feeds the
bitemporal-roadmap exploration.

## Workstream B — vendored-skill warehouse

### B1. Lock schema — full v2 shape adopted as-is

The complete shape from `research/p1-skill-upstream-resolution.md` ("Recommended
lock-schema fields") becomes `skills-lock/v2` via Effect Schema with LiteralKit
statuses: upstream (skill-root `treePath`; separate `sourceRevision`,
`observedHeadRevision`, `observedPathRevision`), snapshot (mode-aware ordered tree
manifest), license (bytes hashed at the pinned revision), provenance (epistemic
status/confidence/evidence), patches (hashed series with labels, owners, drop
conditions), and effective (reconstructed + installed hashes). Every field earned its
place in the P1 audit; none are trimmed.

Oracle's representation is fixed by this decision: `provenance.status: "inferred"`,
`confidence: "medium"`, `sourceRevision: d6e773a` as the strongest time-bounded base —
never laundered into an exact-match claim.

### B2. First wave — all 8 resolved entries; pilot = shadcn

Wave 1 is the eight audit-resolved entries: `grill-me`, `teach`, `ponytail`,
`ponytail-review`, `shadcn`, `oracle`, `portless`, `turborepo`. The other 18 local
skills stay local unless a later authorship audit flags one individually.

The read-only `beep skills provenance` pilot targets `shadcn`: it has real local drift
(`rules/composition.md`), binary assets, and an exact historical pin — exercising
snapshot, tree manifest, patch generation, and reconstruction in one skill.

### B3. Update trigger — Renovate confirmed

Renovate regex custom manager over `skills-lock.json`, exactly as SPEC'd (digest-pinned
revision-bump PRs, one PR per independently clearable skill, parent batch report, CI
reconstruction with per-hunk conflict report). Scheduled agent sessions are the fallback
only if the regex manager cannot express the lock format.

### B4. Patch→guide promotion — two-strike hunk rule

When the SAME patch hunk (by hunk-ledger identity) conflicts in two consecutive upstream
bumps, the update PR flags it as a graduation candidate for the semantic-guide form.
Graduation itself remains a deliberate HITL decision — never automatic.

## Workstream A — clone-agnostic references

### A1. `beep:ref` placement — same-line trailing + heading-scope

- Link-level refs trail on the SAME line as the display path:
  `[PLAN](../PLAN.md) <!-- beep:ref goal/knowledge-surface-automation -->`.
- Document/section-scope refs sit on their own line immediately after the heading they
  identify.
- At most one ref per line. `beep knowledge relink` pairs ref↔path by line adjacency and
  treats any ambiguity (two refs on a line, a ref with no resolvable neighbor) as a hard
  failure — the split-brain rule demands it.

### A2. Dual-write surface set v1 — portfolio surfaces only

Dual-write identities go on the rename-prone pipeline where split-brain risk pays:
`goals/*/README·GOAL·SPEC·PLAN` cross-links, `explorations/ATLAS.md`, and exploration
CAPTURE docs.

Explicitly excluded in v1:

- always-loaded surfaces (`CLAUDE.md`/`AGENTS.md`, skill frontmatter) — context rent;
  plain repo-relative paths plus the Stage-1 gate protect them; revisit only after the
  SPEC-required token-cost measurement;
- generated files — `producer://` IDs own those;
- `docs/` prose — low churn; plain paths suffice.

## Workstream C — self-proving docs

### C1. No archival opt-ins before Stage 2

Stage 1 stays strictly live-guidance-only. Opt-in markers in archival docs would be
hand-maintained liveness claims with no commit binding — the laundering channel
prior-ritual-lessons warns about — and "fixing" archival docs to satisfy a gate rewrites
captured history. Historical-with-commit classification in Stage 2 is the designed home.

### C2. Fence markers — info-string tokens

Only fences whose info string carries an explicit token are anything but decoys:

- ` ```bash beep:exec ` — executable documentation (Stage 2);
- ` ```text beep:generated=<producer-id> ` — generated example, validated against its
  producer, never executed.

Info-string tokens are fence-scoped by construction: they move with the fence on copy
and cannot be orphaned the way a preceding HTML comment can. Unmarked fences remain
decoys.

### C3. Option-name validation — reserved class, Stage-2 introspection

Stage 1 stays paths-only as ratified. `unknown-beep-option` is reserved in the
`KnowledgeFinding` literal domain now (reserved, not emitted). Stage 2 implements it by
walking the same archive-local Command object's declared options — structural
introspection, never execution, no second registry.

### C4. `--base` and shallow-clone CI — flag + fail-closed with remediation

`--base <ref>` is user-configurable; the default stays the local tracking ref
`origin/main` with no fetch ever (hermeticity holds). An absent ref, unborn HEAD, or
absent merge-base remains a typed operational failure that fails CLOSED, with the error
naming the exact remediation (workflow `fetch-depth: 0` / `git fetch --unshallow`). CI
owns history adequacy; the command never fetches and never skips-with-warning — a silent
skip is fake green.

### C5. `index-drift` — whole-file digest until evidence

The single whole-file digest finding stands through Stage 1 and the Mermaid landing.
Paired archives regenerate expected bytes per side, so the digest is already
reflow/rename-proof. Row-level producer-semantic findings are built only on evidence
that digest failures are noisy or hard to act on — evidence, not anticipation.

### C6. Stage-2 durable document identity — measured hybrid, one resolution order

Identity resolution order for baseline keys, so no document ever has two competing
identities:

1. inline `beep:ref` where dual-write exists (the A2 portfolio surfaces);
2. rename-aware git lineage plus the tombstone aliases `beep knowledge rename` plans
   already emit;
3. a sidecar identity map ONLY for documents lineage provably loses (multi-hop moves
   before identity tracking matures).

### C7. False-positive ceiling — zero-FP observation window

An extraction form is promoted from report-only to blocking only after completing a
2-week default-branch PR-traffic observation window with ZERO confirmed false positives
AND every flagged finding review-confirmed as a true positive. Any FP resets the window.
Window evidence lands in the promotion PR. One FP-driven blocked PR costs more trust
than weeks of report-only patience.

### C8. Sealed-baseline mint mechanics — CI-generated baseline-only PR

A scheduled/manually-dispatched CI job checks out a main SHA, runs the sealed mint, and
opens a PR containing ONLY the baseline change — mirroring the existing quality
health-baseline ratchet pattern. Merging that PR is the "reviewed" in SPEC's
"minted ONLY by CI at a reviewed default-branch SHA". Feature branches remain
remove-only, enforced by the doctor: a feature-branch diff that adds, replaces, or
relabels baseline keys is itself a blocking finding. This reconciles the seal with
main being PR-only.

## Non-decision deliverable queued from the session

- **CLAUDE.md/AGENTS.md context-bloat pruning candidates** (SPEC C item): to be produced
  as a reviewable diff with token-weight estimates by a delegated agent session, then
  reviewed like any other diff. Not a grill decision; tracked as P3-adjacent work.
