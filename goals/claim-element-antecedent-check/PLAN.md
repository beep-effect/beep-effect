# Claim Element Antecedent Check Plan

## Status

Status: `pending`

## Binding Sequencing

Schema, then `Context.Service` contract, then implementation, then review items
and evaluation. A phase starts only when the previous phase meets its exit
criteria (`SPEC.md` Acceptance Criteria). Helpers are extracted after P0 and P1
are fixed, never before.

## Phases

| Phase | Status | Goal | Entry criteria | Exit criteria |
| --- | --- | --- | --- | --- |
| P0 Schema | pending | Define `values/ClaimElement/` in `@beep/law-practice-domain`: `ClaimElementTree` keyed by `claimNumber`, `ClaimElement`, `ClaimTerm`, the `ClaimElementEdge` tagged union, and the `AntecedentFinding` tagged union including `pattern-not-covered`. Every element and term carries a `TextAnchor`. | Packet read; `PatentClaim`, `PatentClaimDependencyIssue`, `TextAnchor` inspected. | Schemas compile with `$I` annotations and `LiteralKit` domains; round-trip tests pass; `PatentClaim` unchanged; no service code. |
| P1 Service contract | pending | Declare the `ClaimSelfCheck` `Context.Service` in `@beep/law-practice-use-cases` with typed errors; the decomposer (`ClaimElement.behavior.ts`) and antecedent (`Antecedent.policy.ts`) signatures in domain; the USPTO claims port. | P0 exit met. | Contracts type-check against P0 schemas; no implementation bodies; candidate mapping target (`CandidateClaim` + `Evidence`) named. |
| P2 Deterministic implementation + USPTO adapter + labelled set | pending | Implement the pure decomposer and checker, one rule and fixture per determiner edge case; the server-side USPTO adapter over `@beep/uspto`; the `ClaimSelfCheck` Layer; the first vertical slice; the labelled set (~60 families via the extractor/critic loop with ~10% attorney spot-check; ~200 allowed sets). | P1 exit met. | Vertical slice passes strict equality and emits the expected `missing-antecedent`; all rule fixtures pass; labelled fixtures committed (public USPTO only); `package-verify` green for domain, use-cases, server. |
| P3 Review items + evaluation | pending | Add the practice MCP read tool that returns findings as `claim-finding` `ReviewItem`s; run the evaluation and write the report. | P2 exit met **and** `review-verdict-envelope` P1 schema (`ReviewItem` / `VerdictRow`) merged. | `ReviewItem` fixture round-trips; the `VerdictRow` → `ClaimDisposition` projection test passes once `review-verdict-envelope` P2 (`VerdictProjector`) has merged, and is recorded as pending in Current Blockers until then; report in `history/` gives strict-equality floor, adjudicated FP rate with interval, IPRally smoke result; findings advisory. |
| P4 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | P3 exit met. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P5 Close | pending | Write the closeout reflection and flip packet state. | P4 exit met. | Packet status and evidence are updated; a closeout reflection exists. |

## Dependencies

- **Cross-goal:** P3 needs the `ReviewItem` / `VerdictRow` schema from
  [`goals/review-verdict-envelope`](../review-verdict-envelope/README.md) P1.
- **Cross-goal:** the `VerdictRow` → `ClaimDisposition` projection test needs
  `review-verdict-envelope` P2 (`VerdictProjector`).
  P0–P2 do not depend on it. If P2 finishes first, the goal may publish P0–P2
  and open P3 once that schema merges.
- **Attorney time:** the ~10% label spot-check (P2) and the first findings
  (P3), at most two hours in total. This is not a spend escalation.
- **Review surface:** findings render in the `practice-claude-mod` review queue,
  which the `attorney-review-workspace` amendment owns. This goal only produces
  `ReviewItem`s.
- **Downstream (gated in the exploration's `MAP.md`):** drafting support set,
  office-action element mapping, `Distinction.missing_limitation` element
  reference, LLM decomposition, IPRally interop, Markush.

## Current Blockers

None for P0–P2. P3 is blocked on `review-verdict-envelope` P1. P3's projection test stays pending until
`review-verdict-envelope` P2 merges.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- If the deterministic floor measures badly, stop at the measurement and report
  it (appetite rule); do not add LLM decomposition.
- Record every placement or scope call in `SPEC.md`'s Decision Log.

## Verification Commands

```sh
test "$(wc -m < goals/claim-element-antecedent-check/GOAL.md)" -le 4000
jq . goals/claim-element-antecedent-check/ops/manifest.json
rg -n "claim-element-antecedent-check|GOAL.md|agentLaunchers|packetAnchorDocument" goals/claim-element-antecedent-check
git diff --check -- goals/claim-element-antecedent-check
bun run beep goals doctor
bun run beep quality package-verify @beep/law-practice-domain
bun run beep quality package-verify @beep/law-practice-use-cases
bun run beep quality package-verify @beep/law-practice-server
bun run beep lint reflection-artifacts
```
