# MCP Host Retrofit Spec

## Objective

Retrofit `packages/drivers/nlp-mcp` and `packages/drivers/m365-mcp` onto
`@beep/mcp-kit`'s sanitized-span wrapper and four-hint annotation helper (plus
the tier-gate dispatch wrapper where a host's tool surface warrants it),
fixing a live `12-observability.md` §3 violation and a tool-hint asymmetry
between the two hosts, and updating `@beep/mcp-kit`'s package README consumer
list to name both as real importers.

Graduated 2026-07-01 from
[`explorations/mcp-auth-gated-registration`](../../explorations/mcp-auth-gated-registration/README.md)
(BRIEF + MAP + resolved DECISIONS are the design provenance; this SPEC is the
normative contract). Named as the `mcp-host-retrofit` candidate goal in
[`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md) and Q4b of
[`DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md).

## Non-Goals

<!-- Seeded from BRIEF.md No-Gos + DECISIONS Q4b/Q7. -->

- **`mcp-write-wall` is explicitly out of scope and deferred.** This goal
  wires the kit's tier-gate dispatch wrapper only where an existing host
  already has a real write-capable or gateable tool surface worth wrapping;
  proving the wall end-to-end against a genuinely write-capable host (with
  `UsageRecord.metadata` audit wiring) is the separate `mcp-write-wall`
  follow-on goal named in `MAP.md`.
- No `@beep/mcp-kit` API changes beyond what real consumption needs; if a kit
  gap blocks this goal, stop and report rather than growing the kit's surface
  unilaterally.
- No changes to `packages/drivers/uspto-mcp` (sibling goal
  [`uspto-mcp`](../uspto-mcp/SPEC.md)).
- No behavior changes to the tool surfaces themselves (`NlpToolkit`,
  `StreamingToolkit`, `M365Tools`) beyond span/annotation wrapping — this is a
  hygiene retrofit, not a feature change.
- No `Activity` table or persistence schema changes.
- No MCP `2025-11-25` reliance.

## Source Hierarchy

1. User objective: the graduated exploration's resolved decisions
   ([`DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md)
   Q4b, Q7) and
   [`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md) First
   Vertical Slice bullets 3–4.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`effect-first-development`,
   `schema-first-development`, `effect-services`).
3. Governing architecture standards: `standards/ARCHITECTURE.md`;
   `standards/architecture/{02-shared-kernel,03-driver-boundaries,07-non-slice-families,09-errors-across-boundaries,12-observability}.md`
   (`12-observability.md` §3 is the doctrine this retrofit satisfies).
4. `goals/mcp-kit/SPEC.md` — the kit contract this retrofit consumes (must not
   be reopened by this goal).
5. This `SPEC.md`.
6. `PLAN.md`.
7. `GOAL.md`.
8. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/nlp-mcp` (existing package) — `src/Server.ts`,
  `src/StreamingTools.ts`, and any span-annotation call sites in the mounted
  `NlpToolkit`/`StreamingToolkit` layers.
- `packages/drivers/m365-mcp` (existing package) — `src/M365Tools.ts` and
  `src/Server.ts`.
- `packages/foundation/capability/mcp-kit/README.md` — consumer table update
  only (no source changes to the kit itself unless a genuine gap is found and
  explicitly reported).
- No other package is modified by this goal (the proving host is
  `uspto-mcp`).

## Deliverables

1. **Sanitized-span adoption in `nlp-mcp`** — replace/wrap the toolkit
   dispatch path so `Toolkit.ts:263-265`'s raw-`parameters` span annotation
   (confirmed 2026-07-01, `goals/mcp-kit/history/2026-07-01-p0-verification.md`
   claim (c)) is suppressed for `NlpToolkit`'s raw-`text` tools and
   `StreamingToolkit`'s file-content tools, using `@beep/mcp-kit`'s
   `SanitizedSpan` wrapper. Proof test: raw tool `parameters` do not appear in
   span attributes after the retrofit (mirrors the kit's own
   `test/SanitizedSpan.test.ts` proof shape).
2. **Sanitized-span adoption in `m365-mcp`** — same wrapper applied to
   `M365Tools.ts`'s dispatch path, with an equivalent proof test.
3. **Four-hint annotation parity for `nlp-mcp`** — `StreamingToolkit`
   (`packages/drivers/nlp-mcp/src/StreamingTools.ts`) currently annotates none
   of the four MCP tool hints (`Tool.Readonly`/`Destructive`/`Idempotent`/
   `OpenWorld`), unlike `m365-mcp/src/M365Tools.ts` which annotates all four
   on every tool (confirmed asymmetry, kit Q4b). Apply `@beep/mcp-kit`'s
   `ToolAnnotations` four-hint helper to every `StreamingToolkit` tool (and to
   `NlpToolkit`'s tools if they are also unannotated — confirm at P0) with
   hint values that accurately reflect each tool's actual read/write/idempotent/
   open-world behavior (do not blanket-copy `m365-mcp`'s values).
4. **Four-hint helper adoption for `m365-mcp`** — replace `M365Tools.ts`'s
   inline `.annotate(Tool.Readonly, ...).annotate(Tool.Destructive, ...)...`
   call chains (confirmed pattern at `M365Tools.ts:100-103` and repeated per
   tool) with `@beep/mcp-kit`'s `ToolAnnotations` helper, preserving the
   existing hint values exactly (this is a mechanical helper-adoption, not a
   hint-value change).
5. **Tier-gate wrapper adoption where applicable** — inspect both hosts' tool
   surfaces at P0 for any tool that is destructive/write-capable or otherwise
   warrants the kit's fail-closed dispatch wrapper (`TierGate`). If none
   exists (expected, since both hosts are largely read/local-compute today),
   record that finding and skip this deliverable rather than inventing a gate
   for a non-existent write path — that proof stays with `mcp-write-wall`.
6. **`@beep/mcp-kit` README consumer-list update** — replace the two
   "Candidate goal (not yet created)" rows for `uspto-mcp` and
   `mcp-host-retrofit` and the two "Existing host, retrofit target" rows with
   accurate landed-state entries once this goal and `uspto-mcp` are both
   implemented, discharging the kit's `≥2-consumer` (really 3, including
   `uspto-mcp`) exception ledger entry (`goals/mcp-kit/SPEC.md` Exception
   Ledger).

## Constraints

- **Effect pin:** `effect@4.0.0-beta.92`; re-verify at P0 that
  `@beep/mcp-kit`'s exported `SanitizedSpan`/`ToolAnnotations`/`TierGate`
  surfaces still match this retrofit's expected call shape.
- **Mechanical retrofit discipline:** deliverables #1, #2, #4 must not change
  observable tool behavior beyond span/annotation hygiene — existing
  `nlp-mcp`/`m365-mcp` tests must continue passing unchanged in behavior
  (only import/wiring changes).
- **Deliverable #3 requires judgment, not a mechanical copy** — hint values
  must be assessed per tool, not blanket-inherited from `m365-mcp`.
- **Schema-first, effect-first:** namespace-first helper imports; repo
  lint/docgen gates pass; no new `unknown` in error channels introduced by the
  retrofit.
- **`foundation/capability` gate discharge:** this goal is one of the two
  named consumers (alongside `uspto-mcp`) that discharge `@beep/mcp-kit`'s
  `≥2-consumer` gate (`07-non-slice-families.md:56`, kit Q4b). This goal owns
  the actual README update (deliverable #6); `uspto-mcp` only needs to exist
  as a real importer.

## Decision Log

Back-links, not copies — rationale lives in the exploration:

| Decision | Where |
| --- | --- |
| Q4b `≥2-consumer` gate satisfied via real retrofit work, not a waiver | [`explorations/mcp-auth-gated-registration/DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md) |
| Q7 sanitized-span wrapper is a mandatory kit deliverable (live §3 violation) | same |
| First Vertical Slice bullets 3–4 (span leak fixed; ≥2 real importers) | [`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md) |
| P0 verification claim (c): `Toolkit.ts:263-265` raw-`parameters` span annotation confirmed | [`goals/mcp-kit/history/2026-07-01-p0-verification.md`](../mcp-kit/history/2026-07-01-p0-verification.md) |
| `@beep/mcp-kit` deliverable contracts (`SanitizedSpan`, `ToolAnnotations`, `TierGate`) | [`goals/mcp-kit/SPEC.md`](../mcp-kit/SPEC.md) |

## Acceptance Criteria

- [x] `packages/drivers/nlp-mcp` adopts `@beep/mcp-kit`'s `SanitizedSpan`
      wrapper; proof test confirms raw tool `parameters` do not reach span
      attributes.
- [x] `packages/drivers/m365-mcp` adopts `@beep/mcp-kit`'s `SanitizedSpan`
      wrapper; equivalent proof test passes.
- [x] `StreamingToolkit` (and `NlpToolkit`, if found unannotated at P0) tools
      carry accurate four-hint annotations via `@beep/mcp-kit`'s
      `ToolAnnotations` helper. Note: P0 found `NlpToolkit` also unannotated,
      but it lives in `@beep/nlp-processing`, outside this goal's Target
      Surfaces — correctly deferred rather than silently annotated
      out-of-scope; that annotation work is now `goals/mcp-write-wall`
      deliverable #1.
- [x] `M365Tools.ts` uses `@beep/mcp-kit`'s `ToolAnnotations` helper in place
      of inline `.annotate(...)` chains, with identical hint values preserved.
- [x] Tier-gate wrapper adoption is either applied to a genuine write/gateable
      tool found at P0, or explicitly recorded as not-applicable with
      rationale (no invented gate). Recorded not-applicable per the P0
      finding in `PLAN.md` (neither in-scope toolkit has a write/destructive
      tool; `NlpToolkit`'s stateful tools are out of Target Surfaces).
- [x] `@beep/mcp-kit`'s package README consumer table names both this goal's
      packages and `uspto-mcp` as landed/real consumers (coordinated with the
      `uspto-mcp` goal's completion).
- [x] Existing `nlp-mcp` and `m365-mcp` test suites pass unchanged in
      observable behavior.
- [x] No unrelated refactors or formatting churn.

Verified 2026-07-02 at closeout: all criteria satisfied per `PLAN.md`'s P2
evidence, with the `NlpToolkit`/tier-gate scope boundaries noted above.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/mcp-host-retrofit/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/mcp-host-retrofit/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/mcp-host-retrofit` | Passes |
| Retrofit tests + quality gates | `bun run beep yeet verify` | Green |

## Stop Conditions

- Required source files are missing or materially contradictory.
- `@beep/mcp-kit`'s shipped surface does not match the deliverable contracts
  cited above (kit SPEC drift) — stop and report; do not patch the kit from
  inside this goal without explicit scope approval.
- The implementation would exceed named scope (a real write-capable tier-gate
  proof belongs to `mcp-write-wall`, not this goal).
- Retrofitting either host would require behavior changes beyond
  span/annotation hygiene — stop and report rather than silently expanding
  scope.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
