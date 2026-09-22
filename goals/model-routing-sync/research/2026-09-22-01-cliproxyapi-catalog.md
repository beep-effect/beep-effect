# Model-ID Sync: CLIProxyAPI as source of truth

Explored read-only, 2026-09-22.
Upstream clone: `~/YeeBois/dev/CLIProxyAPI` @ `55566294` (tag `v7.3.12`).
Fork: `~/YeeBois/workstation-apps/CLIProxyAPI` @ `de592213` "dankstation: rebase on v7.3.12".

## Headline

**Do not parse Go.** The catalog is a plain JSON file, embedded in the binary *and*
published standalone from a dedicated upstream repo that the proxy itself polls every
3 hours: `github.com/router-for-me/models` → `models.json`.

---

## 1. Where the catalog lives

Single JSON file per concern, under `internal/registry/models/`:

| File | Lines | Content |
| --- | --- | --- |
| `internal/registry/models/models.json` | 4148 | main catalog, 13 provider sections, 134 entries |
| `internal/registry/models/codex_client_models.json` | 1071 | Codex CLI client-config template (per-slug runtime knobs) |
| `internal/registry/models/devin_models.json` | 876 | Devin catalog (separate updater) |

Embedded at build time: `internal/registry/model_updater.go:28` (`//go:embed models/models.json`),
`internal/registry/codex_client_models.go:15-16`.

Top-level shape is a map of *channel* → array of model entries. The Go mirror struct is
`staticModelsJSON`, `internal/registry/model_definitions.go:24-37`:

`claude`, `gemini`, `vertex`, `aistudio`, `codex-free`, `codex-team`, `codex-plus`,
`codex-pro`, `kimi`, `antigravity`, `xai`, `devin`, `meta`.

> **Pitfall:** `models.json` also carries a `gemini-cli` key (7 entries) that **no Go
> struct field reads** — `grep -rn "gemini-cli" internal/registry/*.go` returns nothing.
> A TS consumer reading raw JSON would see a channel the proxy silently ignores. Conversely
> the struct has a `devin` tag but `models.json` has no `devin` section (it lives in
> `devin_models.json`, built by `staticDevinModels` at `model_definitions.go:88+`).

### Entry fields

Canonical Go struct: `ModelInfo`, `internal/registry/model_registry.go:36-133`.
Fields actually present across `models.json`:

`id`, `object`, `created` (unix secs), `owned_by`, `type`, `display_name`, `name`,
`version`, `description`, `context_length`, `max_completion_tokens`,
`inputTokenLimit`, `outputTokenLimit`, `supportedGenerationMethods`,
`supportedInputModalities`, `supportedOutputModalities`, `supported_parameters`,
`native_capabilities`, `thinking`, `config`.

`thinking` is `ThinkingSupport`, `model_registry.go:135-147`:
```
min, max        int     token budget bounds
zero_allowed    bool    0 disables thinking
dynamic_allowed bool    -1 = dynamic
levels          []string  discrete efforts — this is the (xhigh) domain
```

**There is no `aliases` field on a model entry.** Aliasing is a *user config* concern only
(`config.example.yaml:837-852`, `oauth-model-alias:` with `name`/`alias`/`display-name`/
`fork`/`force-mapping`). Nothing in the catalog tells you that `gpt-daybreak-blue-latest`
maps anywhere — that is local config, not upstream truth.

**There is no pricing and no context-window-per-tier** beyond `context_length`.

### Current catalog census (embedded == remote, verified identical by id)

- `claude` 16 · `gemini` 14 · `vertex` 21 · `gemini-cli` 7 · `aistudio` 16
- `codex-free` 4 · `codex-team` 6 · `codex-plus` 6 · `codex-pro` 6
- `kimi` 10 · `antigravity` 12 · `xai` 11 · `meta` 5

Directly relevant ids + their `thinking.levels`:

```
codex-pro/plus/team: gpt-6-astra      low medium high xhigh max   ("GPT 6.0 Astra")
                     gpt-5.6-sol      low medium high xhigh max
                     gpt-5.6-terra    low medium high xhigh max
                     gpt-5.6-luna     low medium high xhigh max
                     gpt-5.5          low medium high xhigh
                     codex-auto-review low medium high xhigh
codex-free:          gpt-5.5, gpt-5.6-terra, gpt-5.6-luna, codex-auto-review  (NO astra, NO sol)
xai:                 grok-4.7 / grok-4.6  low medium high xhigh
                     grok-4.5 low medium high; grok-4.3 none low medium high
claude:              claude-opus-5, claude-sonnet-5, claude-fable-5, claude-fable-5-1,
                     claude-opus-4-7, claude-opus-4-8  → low medium high xhigh max
                     claude-sonnet-4-6 / opus-4-6      → low medium high max (no xhigh)
```

Note `gpt-6-astra` display name is `GPT 6.0 Astra`, **not** `gpt-6-astra(xhigh)`. The
repo's CLAUDE.md claim that "the proxy catalog lists low..max" is accurate; the backend's
extra `ultra` effort is **not** in this catalog and would be rejected by validation (§2).

---

## 2. Effort suffix `model(effort)`

Parsing is generic string surgery, not per-model:

- `internal/thinking/suffix.go:23` `ParseSuffix` — last `(` + trailing `)`, split into
  `ModelName` / `RawSuffix`. No allowlist at this layer.
- `suffix.go:126` `ParseLevelSuffix` — hard-coded, case-insensitive level vocabulary:
  **`minimal, low, medium, high, xhigh, max`**. Anything else (e.g. `ultra`) → `ok=false`.
- `suffix.go:66` `ParseNumericSuffix` — `model(16384)` token budget.
- `suffix.go:92` `ParseSpecialSuffix` — `none`, `auto`, `-1`.

Per-model validation against the catalog happens in
`internal/thinking/validate.go:132-140,164`: when `support.Levels` is non-empty and mode is
`ModeLevel`, `isLevelSupported(config.Level, support.Levels)` gates it and the error lists
`normalizeLevels(support.Levels)`. Downgrade/clamp logic: `internal/thinking/apply.go:371-385`.

**So the allowed effort set per model = `thinking.levels` in `models.json`.** That is the
one field a sync tool needs to render `gpt-6-astra(xhigh)`-style ids.

---

## 3. HTTP surfaces on a running proxy

Route table `internal/api/server_routes.go`:

| Route | Line | Notes |
| --- | --- | --- |
| `GET /v1/models` | `server_routes.go:65` | `unifiedModelsHandler`, content-negotiated |
| `GET /v1beta/models` | `server_routes.go:124` | Gemini shape |
| `GET /v1beta/models/*action` | `server_routes.go:127` | per-model |
| `GET /v0/management/model-definitions/:channel` | `server_management.go:181` | **raw catalog passthrough** |
| `GET /v0/management/auth-files/models` | `server_management.go:180` | models per credential file |
| `GET /v0/management/oauth-model-alias` | `server_management.go:169` | configured aliases |

`unifiedModelsHandler` (`server_routes.go:587-620`) dispatches by request shape:
Grok-shell UA → grok shape; `?client_version=` → Codex client-config shape;
`Anthropic-Version` header or `claude-cli` UA → Anthropic shape; else OpenAI shape.

### Live results — 127.0.0.1:8317 (2026-09-22)

`GET /v1/models` (OpenAI shape) → `{"object": ..., "data": [...]}`, **34 entries**, each
only `{id, object, created, owned_by}`. **No display name, no levels, no context window.**

Returned ids: 16 `claude-*` (incl. `claude-opus-5`, `claude-sonnet-5`, `claude-fable-5`,
`claude-fable-5-1`, `claude-opus-4-7/4-8`), 17 `xai` (`grok-4.7`, `grok-4.6`, `grok-4.5`,
`grok-4.3`, `grok-build-0.1`, `grok-3-mini[-fast]`, `grok-4.20-*`, `grok-composer-2.5-fast`,
plus 6 `grok-imagine-*` builtins), and exactly **one** OpenAI id: `gpt-5.6-luna`.

> **This is the central pitfall.** `gpt-6-astra` and `gpt-5.6-sol` are in the catalog under
> `codex-plus`/`codex-pro` but are **absent from the live list** because the admitted Codex
> credential currently resolves to a tier/state that only exposes `gpt-5.6-luna` (consistent
> with the known "codex login invalidated / quota exhausted" state). A sync tool driven off
> `/v1/models` would have *deleted* `gpt-6-astra` from the routing docs today.

With `Anthropic-Version: 2023-06-01` → richer per-entry:
`{id, display_name, created_at (ISO), max_input_tokens, max_tokens, object, owned_by, type}`
— still **no effort levels**.

`GET /v1beta/models` → `{"models":[{name:"models/<id>", displayName, description,
supportedGenerationMethods, supportedInputModalities, supportedOutputModalities}]}`
— still no levels.

`GET /v0/management/model-definitions/{claude,xai,gemini,codex-pro}` with the client
token → **HTTP 404** on this instance (management routes are gated at
`server_management.go:14-27` and the local service does not expose them under that auth).
Handler is `internal/api/handlers/management/model_definitions.go:13-32`; it returns
`{"channel": <lowercased>, "models": [<full ModelInfo[]>]}`, i.e. the only HTTP surface
that would carry `thinking.levels`. Channel aliases at `model_definitions.go:467-510`:
`claude`, `gemini`, `gemini-interactions`, `vertex`, `aistudio`, `codex` (→ **Pro** tier),
`kimi`, `kimi-ai|kimi.ai|kimi.com`, `antigravity`, `xai|x-ai|grok`, `devin`, `meta|muse`.
Note `codex-free/team/plus` are **not** addressable by channel — only `codex` → Pro.

---

## 4. Change velocity

`git log --since=2026-06-01 -- internal/registry/models/models.json` → **55 commits**
(out of 1423 repo commits). Roughly a catalog touch every ~2 days.

Example model-adding/removing commits:

```
b9b50a83 2026-09-22 fix(models): set grok-4.7 max completion to the context window
94b7cc2e 2026-09-22 chore(models): drop gpt-5.3-codex-spark from the embedded catalog
130c8792 2026-09-22 feat(models): add grok-4.7 model definition
d48590a4 2026-09-14 feat(models): add gemini-3.5-flash-lite model definition
8bd67f33 2026-09-11 feat(kimi): add Kimi K2.8 model definitions, normalization, temperature guard
31ec4362 2026-09-06 chore(models): remove gpt-5.4 and gpt-5.4-mini models
c77b1369 2026-09-05 feat(models): add gpt-6-astra model and update codex client configurations
dacae582 2026-09-02 feat(registry): add claude fable 5.1 and gemini 3.8 flash models
35e3d97d 2026-09-01 fix(registry): remove defunct gemini-3-flash-agent from antigravity
85e7add6 2026-08-21 feat(models): add Gemini 3.7 Flash model registrations
dd214445 2026-08-15 feat(models): add GPT-5.6 Sol Work Mode model registrations
```

**Latency after public release:** `gpt-6-astra` landed `2026-09-05`, i.e. **3 days before**
the 2026-09-08 release the user's routing doctrine records — the catalog is often *ahead*
of the public announcement (maintainers track client templates). `grok-4.7` landed in the
upstream `models` repo `2026-09-21` and in CLIProxyAPI `2026-09-22` (1-day lag).

---

## 5. Consumable manifest (no Go parsing needed) — the answer

`internal/registry/model_updater.go:19-28`:

```go
modelsFetchTimeout    = 30 * time.Second
modelsRefreshInterval = 3 * time.Hour
var modelsURLs = []string{
  "https://raw.githubusercontent.com/router-for-me/models/refs/heads/main/models.json",
  "https://models.router-for.me/models.json",
}
```

Same pattern for the other two catalogs:
`internal/registry/devin_models_updater.go:16-17`,
`internal/registry/codex_client_models_updater.go:16-17`.

So there is a **standalone upstream repo `github.com/router-for-me/models`** containing:

```
README.md                            5,621 B   capability semantics, three-state web_search
models.json                        106,528 B   THE catalog
codex_client_models.json           400,692 B
devin_models.json                   18,410 B
gemini-native-search-declaration.json
native-capabilities-evidence.json
scripts/
```

Verified live: `curl https://models.router-for.me/models.json` → HTTP 200, 106,528 bytes,
same 13 sections, **identical model-id sets per section** to the embedded copy at
`v7.3.12`. Only differences are `native_capabilities` blocks on Gemini/Vertex entries
(remote is slightly ahead). Its commit log is model-shaped and fast:

```
0173cfad 2026-09-21 fix(xai): set grok-4.7 max completion to the context window
227a55ae 2026-09-21 feat(xai): add grok-4.7 model definition and native search capability
1f7571c9 2026-09-16 feat(devin): add swe-1-6-slow model variant
cd534c29 2026-09-16 Remove GPT-5.3 Codex Spark model entries from models.json
2a7dec26 2026-09-15 Add Muse Spark 1.1, 1.2, and 1.3 model entries to models.json.
```

**Versioning:** there is **no version/date/schema field inside `models.json`** (top-level keys
are provider names only). Versioning is external: CLIProxyAPI git tags (`v7.3.12`, `v7.3.11`,
…) pin an embedded snapshot; the `models` repo has commit SHAs, no tags. So pin by
`models` repo commit SHA + content hash, not by an in-file version.

## 6. Deprecation / removal signals

**None.** `grep -rni "deprecat|retired|sunset" internal/registry/` (non-test) returns nothing,
and no model entry carries a status/lifecycle field. Models are hard-deleted:
`chore(models): remove gpt-5.4 and gpt-5.4-mini models` (31ec4362, 2026-09-06),
`chore(models): drop gpt-5.3-codex-spark from the embedded catalog` (94b7cc2e, 2026-09-22),
`fix(registry): remove defunct gemini-3-flash-agent` (35e3d97d).

A sync tool must therefore compute removals itself by diffing successive snapshots, and
must keep its own "retired" ledger if docs should say "was X, now Y" rather than silently
dropping the id.

## 7. Recommendation

**Primary source: `https://models.router-for.me/models.json`** (fallback
`https://raw.githubusercontent.com/router-for-me/models/refs/heads/main/models.json`).

Why, ranked against the alternatives:

| Option | Verdict |
| --- | --- |
| Parse Go source | No. `models.json` *is* the data; Go only holds the ~24 builtin image/video slugs (`model_definitions.go:11-21`) and `staticDevinModels`. Go parsing buys those and costs fragility. |
| `GET /v1/models` on the running proxy | No, as the sole source. Shape is `{id, object, created, owned_by}` only — **no `thinking.levels`, no display name, no context window** — and it is filtered to *admitted auth*, which today omits `gpt-6-astra`. |
| `GET /v0/management/model-definitions/:channel` | Best HTTP shape (full `ModelInfo`), but 404 on this instance, needs management auth, and `codex` maps only to the Pro tier. |
| Fetch the JSON manifest | Yes. One HTTP GET, stable schema, upstream-authoritative, no auth, includes `thinking.levels`. |

Suggested design for the TS tool (Effect):

1. Fetch the manifest, `S.decodeUnknown` it against a schema mirroring
   `ModelInfo` + `ThinkingSupport` (§1). Keep unknown keys permissive — the maintainers
   add fields (`native_capabilities`, `supports_web_search`) without notice.
2. Store the snapshot with its content hash; diff against the previous snapshot to derive
   `added` / `removed` / `levels-changed`, since the catalog has no deprecation marker (§6).
3. Derive the effort domain per model from `thinking.levels`, and render suffixed ids
   (`gpt-6-astra(medium)`) only from that list — `ultra` is **not** proxy-valid.
4. **Cross-check, do not gate on, the live proxy.** Use `/v1/models` at 127.0.0.1:8317 as an
   *availability* overlay ("catalog says astra exists; this box cannot currently route it")
   rather than as the catalog. Present the two as separate columns.
5. Do not expect the manifest to know about local aliases. `gpt-daybreak-blue-latest` is a
   *fork/vendor* builtin and a local `oauth-model-alias` concern (`config.example.yaml:837-852`),
   invisible to upstream. Keep a small hand-maintained alias overlay.
6. The `gemini-cli` section is present in JSON but unread by the proxy (§1) — either drop it
   or label it "not routable".

Fork note: `~/YeeBois/workstation-apps/CLIProxyAPI` @ `de592213` (rebased on v7.3.12) has a
**model-id-identical** `models.json` to upstream (diffed per section, zero fork-only or
upstream-only ids). No fork-specific catalog handling is needed.
