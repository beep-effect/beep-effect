# tsgo 0.45 Effect idiom sweep — Plan

## Status

Status: `active`. P0 complete 2026-09-12. Worktree
`beep-effect-worktrees/tsgo-045-effect-idiom-sweep` on
`feat/tsgo-045-effect-idiom-sweep` off main `23f3919`.

## Phase gates

| Phase | Status | Work | Exit criterion |
| --- | --- | --- | --- |
| P0 Grill and packet | complete | grill-with-docs session; D1–D13 locked; packet materialized | `goals doctor` clean; DECISIONS complete |
| P1 Foundations PR (0.39.1) | in-progress | annoteError retirement + inverted lint + 60-seed proof; allowlist mechanism scanning scratchpad and root; key-set parity for keys 0.39.1 reads; Cursor lane smoke test; packet docs | PR A merge-ready; Benjamin merges; smoke test recorded in `history/` |
| P2 Rule cards and inventory | pending | 17 rule cards authored from the clones; worktree-local 0.45 install; per-shard diagnostic inventory JSON; Match census | Every card passes the card checklist; every shard has a count and an owner |
| P3 Remediation lanes | pending | Fixer shards per `ops/shards.json`; Match lane + `match-shapes` law; scratchpad directives; `vitest.shared.ts`; small-rule bundle; verifiers per shard | Each lane PR green on the 0.39.1 gate, package-verify green, merge-ready, merged |
| P4 Ratchet PR (0.45.0) | pending | Bump tsgo; 13 ids at error; remaining config keys; widen scanned roots; regenerate inventories | `tsgo-rules` green at 0.45.0; hosted checks green; merge-ready; merged |
| P5 Close | pending | Upstream tasks filed or deferred; reflection; state flip | Same-PR closeout; `lint reflection-artifacts` passes |

P1 note (2026-09-12): PR A ships the allowlist mechanism, the key parity
check, and the hook deletion, but keeps the directive gate's scanned roots at
`apps`, `packages`, `tooling`, `infra`. Widening to `scratchpad` and the repo
root lands in the S01 PR together with the fixes it needs: `vitest.shared.ts`
computes its include list with sync `node:fs` before vitest boots, so its two
`nodeBuiltinImport:off` lines are a design item (a generated file, like
`vitest.aliases.generated.json`), not a directive count. The root shim's six
directives are already normalized to the exact allowlisted lines. PR A also
deletes the effect-drizzle copy of the hook (`declaredFieldsEquivalence`, 16
files including two script directories) because the inverted lint reports it.

P1 and P2 may overlap once the annoteError change is in review. P3 lanes run
in parallel with disjoint ownership. P4 waits for every P3 PR to merge.

## PR train (D6)

| PR | Content | Gate it must pass |
| --- | --- | --- |
| A | Id.ts hook deletion, inverted `SFV4-tagged-error-equivalence`, doc-text proof, allowlist + widened roots + key parity in `Quality.command.ts`, packet | 0.39.1 gate, repo-cli ships alone rule satisfied by scoping A to repo-cli + identity + doc-text |
| L1..Ln | One PR per shard in `ops/shards.json` | 0.39.1 gate; package-verify per touched package |
| M | Match audit + `match-shapes` law + fixtures + empty baseline | 0.39.1 gate; `lint match-shapes` green |
| S | scratchpad directives (78) + `vitest.shared.ts` (2) | widened-root directive census returns only the allowlist |
| Z | tsgo 0.45.0 bump + 13 rules + keys + inventory regen | `tsgo-rules` green at 0.45.0; all hosted checks |

Ordering inside P3: M and S first (small, unblock the census), then L shards
largest-first so schema (714 sites) starts earliest.

## Lane roster

| Lane | Seat | Prompt |
| --- | --- | --- |
| Orchestrator, judge, git | Fable (this session) | `ops/prompts/00-orchestrator.md` |
| Rule-card discovery (17 cards, grouped 3–4 per lane) | `codex exec` gpt-6-astra medium (D12) | `ops/prompts/10-rule-card-discovery.agent.md` |
| Fixer shard (one per `ops/shards.json` entry) | `codex exec` gpt-6-astra medium, alternating with the Cursor lane once smoke-tested (D13) | `ops/prompts/20-fixer-shard.agent.md` |
| Match | `codex exec` gpt-6-astra medium | `ops/prompts/30-match.agent.md` |
| Verifier (one per shard, after its fixer) | `codex exec` gpt-6-astra medium, or Fable Workflow child when an Anthropic second opinion is wanted | `ops/prompts/40-verifier.agent.md` |
| Codex lane recipe | n/a | `ops/prompts/60-codex-lane.md` |
| Cursor lane recipe | n/a | `ops/prompts/50-cursor-lane.md` |

## Closeout checklist

1. Reflection via `/reflect` to `history/reflections/<date>-<agent>.md`.
2. `bun run beep lint reflection-artifacts`.
3. README status, `ops/manifest.json` phases and `initiative.status`, same PR
   as the final work.

## Verification commands

```sh
bun run beep goals doctor
bun run beep goals index --check
test "$(wc -m < goals/tsgo-045-effect-idiom-sweep/GOAL.md)" -le 4000
git diff --check -- goals/tsgo-045-effect-idiom-sweep
bun run beep quality tsgo-rules
```
