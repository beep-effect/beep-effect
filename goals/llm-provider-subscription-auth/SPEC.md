# LLM Provider Subscription Auth via CLI Delegation Spec

## Objective

Users of a local-first beep server authenticate to LLM providers with their
existing subscriptions (Claude Pro/Max, ChatGPT plans) through **vendor-CLI
delegation**, the t3code methodology: the vendor CLI (`claude`, `codex`) owns
login, token storage, and refresh entirely; beep configures per-**provider
instance** binary + HOME dir + env vars, isolates credentials via HOME/
shadow-home layouts, probes rich auth status (state, account email,
subscription/plan label, token source), and surfaces "run `<cli> login`"
guidance when unauthenticated. beep never implements provider OAuth and never
persists provider tokens.

Observable end state:

- A `ProviderInstance` can be created, updated, removed, listed, and probed
  through agents-slice commands/queries.
- Probing a logged-in Claude or Codex CLI returns a snapshot including auth
  state and subscription/plan label; probing a logged-out CLI returns
  `not-authenticated` plus actionable login guidance naming the exact command.
- Two instances of the same provider kind hold isolated credentials via
  distinct HOME dirs (Codex: shadow-home with private `auth.json`).
- Instance metadata and the latest probe snapshot are persisted; no token,
  OAuth code, or refresh token ever is.

## Non-Goals

- In-app OAuth/PKCE/device-code flows against provider endpoints (the opencode
  approach). Deliberately rejected: CLI delegation avoids the ToS gray zone of
  reusing first-party OAuth client IDs.
- Per-user encrypted credential vault or any server-side token storage
  (parked in `explorations/ingestion-security-secret-governance`).
- Hosted multi-user login relay (streaming a device-code URL from a shared
  server to a remote browser). Local-first only; each user runs their own beep
  server.
- The key-precedence resolver, provider registry, dispatch Layer, and
  cross-provider fallback (remain in
  `explorations/multi-provider-llm-dispatch-fallback`). This packet is the CLI
  leg that the future resolver consumes.
- Provider kinds beyond `claude` and `codex` (cursor, opencode, copilot,
  gemini are named follow-ups; the vocabulary must stay extensible).
- Replacing existing API-key auth in `@beep/anthropic` etc. — subscription
  instances are additive.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards (`standards/ARCHITECTURE.md`,
   `standards/architecture/03-driver-boundaries.md`,
   `standards/architecture/06-configuration-boundaries.md`,
   `standards/architecture/09-errors-across-boundaries.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/ai-provider-cli` — extend the existing probe driver.
- `packages/agents/domain` — new `entities/ProviderInstance/` concept.
- `packages/agents/use-cases` — ProviderInstance commands/queries/ports/errors.
- `packages/agents/server` — port implementations and layer composition.
- `packages/agents/tables` — NET-NEW package for ProviderInstance persistence.
- `packages/agents/client` — instance atoms/service (later phase within P1).
- This packet's own files and the two exploration pointer updates already
  landed at packet creation.

## Architecture Mapping (binding placement)

| t3code concept (reference file) | beep-effect home |
| --- | --- |
| Driver kinds `codex`/`claudeAgent`/... (`packages/contracts/src/model.ts`) | `AiProviderCliProvider` LiteralKit in `drivers/ai-provider-cli` (today `["claude", "codex"]`); extend vocabulary only here |
| HOME resolution + env injection (`apps/server/src/provider/Drivers/ClaudeHome.ts`); shadow-home with private `auth.json` (`.../CodexHomeLayout.ts`, `PRIVATE_ENTRY_NAMES`) | New product-neutral role modules in `drivers/ai-provider-cli` (e.g. `AiProviderCliHome.*`): HOME layout resolution, child-env construction, private-entry shadow symlink mechanics with the symlinked-`auth.json` refusal check |
| Auth/account probe (`.../Layers/CodexProvider.ts` `account/read` + ChatGPT plan-label map; `.../Layers/ClaudeProvider.ts` Agent SDK `init.account`) | Extend `AiProviderCli.service.ts` probe from boolean `AiProviderCliAuthProbe` to a rich snapshot: status, optional account email, optional subscription/plan label, optional token source. Redaction discipline preserved (no raw stdout/stderr/token leakage) |
| `ProviderInstance` (label, binary path, HOME path, env vars, snapshot) — `.../Services/ProviderInstanceRegistry.ts` | `agents/domain/entities/ProviderInstance/`: schema-first `ProviderInstance.model.ts`, tagged-union auth status + snapshot values in `.values.ts`, actionable `.errors.ts`, pure login-guidance messages in `.behavior.ts` |
| Instance lifecycle + probing API | `agents/use-cases` `entities/ProviderInstance/`: `.commands.ts` (add/update/remove/probe), `.queries.ts` (list/get), `.ports.ts` (`ProviderInstanceRepository`, `ProviderProbe`), actionable `.errors.ts`; client-safe contracts exported via `/public` |
| Live wiring | `agents/server`: `ProviderInstance.repo.ts` over tables, probe port implementation adapting the driver, `ProviderInstance.layer.ts` composition |
| Persistence (metadata + latest snapshot, never tokens) | NET-NEW `agents/tables`: `ProviderInstance.table.ts` projected via `pgTableFrom(entity)` from `@beep/drizzle` |
| Settings wizard + status banner (`apps/web/src/components/settings/AddProviderInstanceDialog.tsx`, `.../chat/ProviderStatusBanner.tsx`) | `agents/client` atoms/service; UI composition lands app-local (dockview app) or in a future agents `ui` package — thin final phase, may defer rendering polish |

## Constraints

- **No tokens at rest, ever.** Beep-owned storage (Postgres tables, config,
  logs, traces) must never contain provider access tokens, refresh tokens,
  OAuth codes, or raw CLI stdout/stderr that could embed them. This is an
  acceptance-level invariant with a test.
- **Driver stays product-neutral** (`03-driver-boundaries.md`): no
  `ProviderInstance` vocabulary, labels, or user-facing copy inside
  `drivers/ai-provider-cli`. HOME/env/shadow-home mechanics and probe
  transport are technical capability only. Driver imports no slice and no
  `shared/*`.
- **Slice dependency law** (`ARCHITECTURE.md`): `agents/domain` imports only
  shared-kernel + `foundation/{primitive,modeling}`; `agents/use-cases`
  imports no drivers and no server; `agents/tables` imports domain +
  `@beep/drizzle` metadata projection only; only `agents/server` imports the
  driver.
- **Error translation** (`09-errors-across-boundaries.md`): technical failures
  stay in `AiProviderCli.errors.ts`; use-cases own actionable errors (e.g.
  `ProviderInstanceNotFound`, `ProviderUnauthenticated`,
  `ProviderProbeUnavailable`); server translates driver errors into port
  errors. Public `/public` surface exposes only actionable application errors.
- **No slice `config` package for v1**: instance settings are user data (DB
  rows), not runtime configuration. Revisit only if real app-level config
  contracts emerge (e.g. default binary paths) — create-only-when-real rule.
- **Schema-first everywhere**: LiteralKit vocabularies, tagged unions for
  auth-status variants (no optional-field bags), `BaseEntity.Class` for the
  persisted entity, `S.is(...)` guards.
- **Repo code laws**: effect helper modules, typed errors, `$I` identity
  annotations, `@since`/`@example` docgen rules, `npx vitest run` for tests.
- t3code is MIT (Copyright 2026 T3 Tools Inc.): porting shapes WITH
  attribution is allowed; record attribution in `research/SOURCES.md`.

## Acceptance Criteria

- [ ] `drivers/ai-provider-cli` exposes HOME-layout/env-injection/shadow-home
      mechanics (private `auth.json` never a symlink) and a rich auth-probe
      snapshot (status, email, plan label, token source as Options), with unit
      tests covering logged-in, logged-out, and transport-failure paths using
      injected runners — no live CLI required.
- [ ] `agents/domain` `ProviderInstance` entity + values + errors + behavior
      compile and pass tests; auth status is a tagged union; login guidance is
      a pure function of provider kind + status.
- [ ] `agents/use-cases` commands/queries/ports/errors exist with client-safe
      contracts on `/public`; no driver imports (verified by dependency
      rules/lint).
- [ ] NET-NEW `agents/tables` projects the ProviderInstance table via
      `pgTableFrom(entity)`; a test proves the persisted row shape contains
      instance metadata + snapshot fields and no token-bearing field.
- [ ] `agents/server` implements both ports and composes layers; an
      integration test (injected runner, PGLite, `describe.sequential`) drives
      add -> probe -> persist snapshot -> list end-to-end.
- [ ] Probe of an unauthenticated instance yields `ProviderUnauthenticated`
      guidance naming the exact login command (`claude auth login` /
      `codex login`).
- [ ] `agents/client` exposes instance list/probe atoms + service.
- [ ] Quality gates green via yeet (P3 completion gate).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/llm-provider-subscription-auth/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/llm-provider-subscription-auth/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/llm-provider-subscription-auth` | Passes |
| Driver + slice tests | `npx vitest run` scoped to `packages/drivers/ai-provider-cli` and `packages/agents/*` | Green |
| No-tokens invariant | Row-shape test in `agents/tables` + grep for token-bearing fields in persisted schemas | No token fields |
| Boundary rules | `bun run beep yeet verify` (architecture/lint lanes) | Green |
| Reflection artifacts | `bun run beep lint reflection-artifacts` | Passes at P4 |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.
- Any design change would require persisting provider tokens in beep-owned
  storage — stop and re-grill instead of weakening the invariant.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
