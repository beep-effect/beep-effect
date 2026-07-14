# P0 Research — probe transports, shadow-home contract, conventions (2026-07-11)

## 1. Probe-transport decisions (per provider)

### `claude` — DECIDED: parse `claude auth status --json`

Empirically verified on this machine (claude CLI installed at
`~/.local/bin/claude`): `claude auth status --json` is the **default** output
mode and returns, with exit code 0 when logged in:

```json
{
  "loggedIn": true,
  "authMethod": "claude.ai",
  "apiProvider": "firstParty",
  "email": "<email>",
  "orgId": "<uuid>",
  "orgName": "<name>",
  "subscriptionType": "max"
}
```

- t3code's Agent SDK init-account probe (`ClaudeProvider.ts:571-619`) is
  explicitly documented there as "a fallback when `claude auth status` does
  not include subscription type information" — our verified CLI **does**
  include `subscriptionType`, so the SDK spawn is unnecessary. No Agent SDK
  dependency in the driver.
- Snapshot fields decoded: `loggedIn`, `authMethod` (token-source analog),
  `email`, `subscriptionType`. **Drop `orgId`/`orgName`** (data
  minimization; not needed for login UX).
- Schema-decode the stdout JSON; malformed/other output degrades to the
  exit-code-only probe (status without account detail), never a raw-stdout
  leak.

### `codex` — DECIDED: exit code + single-line stdout classification

Empirically verified: `codex login status` has **no JSON flag** (checked
`--help`), prints exactly `Logged in using ChatGPT` (exit 0). Known variants
from codex CLI source/t3code docs: "Logged in using an API key", "Not logged
in" (non-zero exit).

- Classify: `ChatGPT` line → token source `chatgpt`; `API key` line →
  `api-key`; non-zero exit → `not-authenticated`.
- Email and plan label remain `Option.none()` for codex in v1. t3code gets
  them via the Codex app-server protocol (`CodexProvider.ts:350`
  `account/read`; plan-label map at `:69-101`) — that transport needs an
  in-repo app-server client and is DEFERRED as a named follow-up. The
  snapshot schema carries optional email/plan-label fields so the richer
  transport slots in without a contract change.

## 2. Codex shadow-home contract to port (from `CodexHomeLayout.ts`)

t3code's implementation is already Effect-based (effect FileSystem/Path,
Schema.TaggedErrorClass) — shapes port near-directly into beep idiom
(`TaggedErrorClass` + `$I.annote`, LiteralKit literals):

- Two modes: `direct` (no shadow) vs `authOverlay` (shadow home).
- `KNOWN_SHARED_DIRECTORIES = [sessions, archived_sessions, sqlite,
  shell_snapshots, worktrees, skills, plugins, cache, logs]` → symlinked from
  shadow home to shared home.
- `PRIVATE_ENTRY_NAMES = {auth.json, models_cache.json}` → must be REAL files
  in the shadow home; a symlinked private entry is an error
  (`CodexShadowHomePrivateEntrySymlinkError`); pre-existing private symlinks
  are removed (`removePrivateSymlink`).
- `SHADOW_LOCAL_ENTRY_NAMES = {log, memories, tmp}` → left local, not linked.
- Error taxonomy: FileSystemError (op ∈ readLink/makeDirectory/readDirectory/
  remove/symlink), PathConflictError (shadow == shared), EntryConflictError
  (existing non-symlink where a link belongs), PrivateEntrySymlinkError.
- `readLinkState` distinguishes Missing / NotSymlink (EINVAL) / Symlink;
  `ensureSymlink` repoints stale symlinks.
- Claude HOME (from `ClaudeHome.ts`): resolve configured home (tilde
  expansion, fall back `os.homedir()`), inject as `HOME` into child env.

## 3. Repo conventions inventory

- **Entity pattern**: `packages/agents/domain/src/entities/Agent/Agent.model.ts`
  — `BaseEntity.Class<X>($I\`X\`)(EntityIdFromSharedIdentity, { fields,
  persisted: EntitySchema.persist.* }, $I.annote(...))`.
- **Entity IDs**: agents slice registry at
  `packages/shared/domain/src/identity/Agents.ts` using
  `EntityId.factory("agents", $I)`; add `ProviderInstanceId` there (follows
  AgentId/SkillId precedent).
- **Tables scaffold reference**: `packages/workspace/tables` (entities/,
  Schema.ts, table roles); generator available via
  `bun run beep architecture add` (canonical parts) if it fits.
- **Driver extension surface**: `packages/drivers/ai-provider-cli` —
  LiteralKit `["claude","codex"]` vocabulary, `AiProviderCliRunner` injection
  seam, redaction discipline (never surface raw stdout/stderr in errors or
  snapshots).

## 4. Env-var persistence vs the no-tokens invariant (design ruling)

t3code lets instances carry arbitrary env vars and marks sensitive ones as
"server secrets". Persisting arbitrary env values could smuggle tokens into
Postgres and violate the SPEC invariant. Ruling for v1:

- `ProviderInstance.envVars` is persisted as plain `Record<name, value>` BUT
  the env-var **name** is a branded schema that REJECTS known token-bearing
  names (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `OPENAI_API_KEY`,
  `OPENAI_ACCESS_TOKEN`, `AI_*_API_KEY`, `*_TOKEN`, `*_SECRET`, `*_KEY`
  suffix patterns) at decode time.
- Rationale: mechanical enforcement beats documentation; users needing
  secret env injection (e.g. OpenRouter via `ANTHROPIC_AUTH_TOKEN`) are out
  of scope v1 (aligns with the packet's non-goals).

## 5. Blockers

None. All P0 exit criteria met; proceed to P1.
