# LLM Provider Subscription Auth via CLI Delegation Plan

## Status

Status: `completed-retained` — P0–P4 complete; PR #392 carries the final implementation.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | completed | Confirm probe transports per provider and port-level facts from t3code sources. | Probe transport decision recorded per provider (see P0 tasks); blockers recorded. |
| P1 Implement | completed | Make the smallest changes that satisfy `SPEC.md`, in the sub-phase order below. | Acceptance criteria are met. |
| P2 Verify | completed | Run required checks and capture evidence. | Verification matrix is green or blockers are documented. |
| P3 Yeet | completed | Drive the PR to mergeable via `/yeet`. | PR open, checks green, mergeable. |
| P4 Close | completed | Write the closeout reflection and final packet updates. | Packet status and evidence are updated; a closeout reflection exists. |

## P0 Research Tasks

1. Read the t3code reference sources listed in `research/SOURCES.md` §1 and
   record, per provider kind, the **probe transport** decision:
   - `claude`: keep exit-code probe (`claude auth status`) vs enrich via Agent
     SDK-style init account read. Decide how to obtain email/plan label
     without capturing raw un-redacted output (t3code reads
     `init.account.{email,subscriptionType,tokenSource}`).
   - `codex`: keep `codex login status` exit-code probe vs the app-server
     `account/read` protocol t3code uses (`CodexProvider.ts:350`). Port the
     ChatGPT plan-label mapping (`codexAccountAuthLabel`, `CodexProvider.ts:69-101`).
2. Confirm the Codex shadow-home contract to port: symlink shared entries,
   keep `auth.json` + `models_cache.json` private real files, refuse symlinked
   `auth.json` (`CodexHomeLayout.ts`, `PRIVATE_ENTRY_NAMES` line 31,
   `ensureShadowAuthIsPrivate`).
3. Inventory `agents/domain` conventions (`BaseEntity.Class` usage in sibling
   entities, `$AgentsDomainId`-style identity composers) so ProviderInstance
   lands idiomatically. Read `packages/fixture-lab/specimen` for the strict
   package-shape proof if creating `agents/tables` raises questions.
4. Record findings in `history/outputs/p0-research.md`.

## P1 Implementation Order

Work inward-out so each layer compiles against the previous:

1. **Driver** (`packages/drivers/ai-provider-cli`):
   - Extend `AiProviderCli.models.ts`: rich probe snapshot schema (status +
     `O.Option` email/plan-label/token-source), HOME-layout inputs.
   - New `AiProviderCliHome.*` role modules: HOME resolution, child-env
     construction, shadow-home layout with private entries.
   - Extend `AiProviderCli.service.ts` probe; keep `AiProviderCliRunner`
     injection seam; add tests (logged-in/out/transport-failure fixtures).
2. **Domain** (`packages/agents/domain`):
   `entities/ProviderInstance/` — `.model.ts` (BaseEntity.Class), `.values.ts`
   (tagged-union auth status, snapshot value), `.errors.ts`, `.behavior.ts`
   (pure login-guidance), `index.ts`.
3. **Use-cases** (`packages/agents/use-cases`):
   `entities/ProviderInstance/` — `.commands.ts`, `.queries.ts`, `.ports.ts`
   (`ProviderInstanceRepository`, `ProviderProbe`), `.errors.ts`; export
   client-safe contracts from `/public`, ports from `/server`.
4. **Tables** (NET-NEW `packages/agents/tables`):
   package scaffold (`bun run beep architecture` with `--domain-kind entities`
   where applicable), `ProviderInstance.table.ts` via `pgTableFrom(entity)`,
   row-shape test proving the no-tokens invariant.
5. **Server** (`packages/agents/server`):
   `ProviderInstance.repo.ts`, `ProviderInstance.probe.ts` (port impl over the
   driver, translating `AiProviderCliError` -> port errors),
   `ProviderInstance.layer.ts`; integration test (injected runner + PGLite,
   `describe.sequential`).
6. **Client** (`packages/agents/client`):
   `ProviderInstance.atoms.ts` + `.service.ts` (list/add/probe with
   reactivity invalidation). UI composition is app-local follow-up; keep this
   sub-phase thin.

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` /
`complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed),
   the **implementation** (improvement opportunities), and the **goal/prompt**
   (would you revise it to be clearer/easier/more efficient?). Capture TODOs
   worth codifying. Its YAML frontmatter must validate against
   `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks
   closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive run outputs under `history/outputs/`.
- The dispatch/precedence layer is NOT this packet: when tempted to build a
  registry or resolver above the probe, stop — that ground belongs to
  `explorations/multi-provider-llm-dispatch-fallback`.

## Verification Commands

```sh
test "$(wc -m < goals/llm-provider-subscription-auth/GOAL.md)" -le 4000
jq . goals/llm-provider-subscription-auth/ops/manifest.json
rg -n "llm-provider-subscription-auth|GOAL.md|agentLaunchers|packetAnchorDocument" goals/llm-provider-subscription-auth
git diff --check -- goals/llm-provider-subscription-auth
```
