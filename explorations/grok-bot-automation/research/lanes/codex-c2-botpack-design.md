# Codex lane C2 — bot-pack convention and runtime architecture

Date: 2026-09-03  
Status: design recommendation; no repo changes made  
Decision posture: this proposes an architecture for the operator to grill. A new top-level root and an unattended write-capable runner are architecture-shaping decisions, so implementation must wait for alignment.

## Recommendation in one page

1. Define harness-neutral, Grok-Bot-first packs under `bots/packs/<kebab-slug>/` and keep deployment configuration outside the pack under `bots/deployments/` or the user's XDG config directory.
2. Make `bots/packs/<slug>/BOT.md` the one committed operating file. The live hosted routine's short profile/prompt tells the Bot to fetch that exact repo path at the configured branch or commit and to fail closed if it cannot. Do not copy the operating body into the xAI UI, a cache, `.claude/`, `.agents/`, or `.codex/`.
3. Treat the repo pack as desired state, not as something Grok Bot currently auto-installs. xAI documents profiles, skills, routines, connectors, and UI-managed approvals, but does not document a Bot-as-code deployment API. `beep bots render-prompt` should therefore render the minimal loader/reconciliation text for a human to paste into the hosted profile/routine.
4. Put validation and execution plumbing in the existing `@beep/repo-cli` command family as `beep bots ...`; automation belongs to `tooling`, and a second package is not justified. The first implementation order is schema → `Context.Service` → internal implementations → CLI adapters.
5. General runtime rule: hosted Grok Bot searches and judges when the job needs always-on web/X access but not the operator's checkout; local timers or proxy lanes do work that needs `bun`, Yeet, `.repos/effect`, 1Password injection, or `beep qa`; GitHub Actions runs deterministic repo-only checks and event listeners. Use a hybrid when both kinds of capability are needed.
6. General action rule: a bot may prepare evidence, a report, an idempotent issue, or a PR proposal. It never merges, deploys, changes production, directly mutates goal/exploration intake, or treats an X DM as canonical state. A person admits the proposal by merging, firing a packet capture, or explicitly authorizing the next bounded phase.
7. Build `effect-v4-upstream-watch` first, report-only. It has a narrow evidence surface, already appears in the nightly watch workload, exercises hosted search plus local `.repos/effect` verification, and can prove the pack, handoff, dedupe, and fallback mechanics without granting code-write or merge authority.

This split follows the repository's distinction between an authored contract and executable tooling. `Schema` is the source of truth for wire/config payloads (`standards/ARCHITECTURE.md:114-131`), while repo operations and automation route to `tooling` (`standards/ARCHITECTURE.md:449-477`).

## Current facts that constrain the design

- The harness trees are configuration/discovery surfaces. `.claude/skills` is the skill-body source, `.agents/skills` is its mirror, and `.codex/config.toml` enumerates enabled skills (`explorations/beep-mode/CAPTURE.md:15-23`; `.codex/config.toml:1-16`). A recurring bot is not a chat skill, and registering every pack there would enlarge the always-loaded prompt prefix that `AGENTS.md` says to keep lean (`AGENTS.md:172-182`).
- `goals/` holds human-governed delivery packets. `explorations/` is the human fuzzy front end. `research/` is a specifically ratified machine-generated trust domain, not a generic automation dump (`standards/architecture/DECISIONS.md:1235-1269`).
- `main` is PR-only, Yeet is the canonical publication path, and a merge-ready PR includes hosted checks plus resolved review state (`AGENTS.md:61-96`; `.claude/skills/yeet/SKILL.md:305-348`).
- The current `beep research` CLI does not expose the SPEC's planned `nightly` subcommands. Its live help exposes `capture`, `cognify`, `daily`, `digest`, `history-sift`, `install-timers`, `notion-pull`, `repo-card`, and `status`; the nightly implementation remains unchecked in `goals/nightly-research-routine/PLAN.md:15-35`.
- The existing research timer renderer writes systemd user services/timers, uses an optional environment file, gives each run a timeout, and sets `Persistent=true` (`packages/tooling/tool/cli/src/commands/Research/internal/Timers.ts:1-8,39-65`). The nightly SPEC correctly notes that a powered-off workstation catches up at morning boot; it does not run overnight (`goals/nightly-research-routine/SPEC.md:57-64`).
- File memory and repo docs are the repository's memory layer. Hosted Bot conversation memory may improve convenience, but it is never authority for a manifest, prior delivery, admission, or dedupe decision. Do not reintroduce basic-memory/codegraph or an equivalent shared-memory control plane for bots without a new decision (`AGENTS.md:148-156`; `standards/memory-architecture/04-decision-log.md:359-384`).
- A pack declares logical tool capabilities; it does not mutate `.mcp.json` or install connectors during a run. Each deployment provisions and tests its tool surface before scheduling, because the repo requires MCP/tool configuration to remain stable within a session (`AGENTS.md:172-175`).
- Grok Bot is still an early product surface. Official docs describe a persistent cloud computer, scheduled or event-triggered routines, connectors/MCP, and approval gates. They also state that all of a user's Bots share the same cloud computer, recent routine history is limited, routines may be paused after prolonged absence, and custom MCP servers must be publicly reachable. Those facts make least privilege and durable repo/external receipts mandatory, not optional. See [Grok Bot overview](https://docs.x.ai/grok-bot/overview), [skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations), [approvals and security](https://docs.x.ai/grok-bot/approvals-security-and-privacy), and [connectors](https://docs.x.ai/grok/connectors).

## A. Bot-pack convention

### A1. Canonical location and naming

Proposed tree:

```text
bots/
  README.md
  packs/
    effect-v4-upstream-watch/
      manifest.json
      BOT.md
      README.md
      references/
      fixtures/
      PROVENANCE.md          # only when ported from an external pack
      LICENSE.upstream.md    # only when the upstream license requires it
  deployments/
    effect-v4-upstream-watch/
      hosted.example.jsonc
      local.example.jsonc
```

Rules:

- Pack slugs are lower-case kebab case, stable, and capability-oriented: `effect-v4-upstream-watch`, not a person name, provider name, or model version.
- `bots/packs/<slug>/` is source-managed. A refresh may update only this subtree.
- `bots/deployments/` is user/operator-owned desired deployment state. Pack update tooling must preserve it byte-for-byte. Only secret-free examples should be committed by default.
- The canonical path is not `.grok/`, `.cursor/`, `.claude/`, `.agents/`, or `.codex/`. Those names bind the definition to one harness or load it as chat context. The pack is executable policy shared by several runtimes.
- The canonical path is not `goals/`: a bot can outlive the goal that creates it, and a goal's status is human lifecycle state rather than a runtime registry.
- The canonical path is not `research/`: that root has a ratified, immutable, dated packet shape and a single writer. A research bot may deliver there only through that existing contract; unrelated bots must not reuse it (`research/README.md:10-45`).
- The canonical path is not a workspace package. The authored pack is markdown/JSON policy, whereas its decoder, runner, timers, and receipts are code in `packages/tooling/tool/cli`. The architecture explicitly places automation code under `tooling` (`standards/architecture/07-non-slice-families.md:329-355`).

Why a new top-level `bots/` root is justified: it is a small, non-auto-loaded registry of durable operating contracts, analogous in governance role—but not in trust semantics—to `goals/`, `explorations/`, and `research/`. Because a new root is difficult to unwind and affects public repo topology, it needs its own architecture decision before implementation. If the operator rejects a new root, the second-best location is `packages/tooling/tool/cli/resources/bots/<slug>/`; that obeys existing topology but makes hosted humans and GitHub connectors traverse implementation internals to find an operating contract.

### A2. Pack contents and ownership boundaries

| File | Owner | Contract |
| --- | --- | --- |
| `manifest.json` | pack maintainer | Schema-encoded machine contract: identity, trigger, capabilities, inputs/outputs, budgets, gates, evidence, owner, status. No secret values. |
| `BOT.md` | pack maintainer | The canonical operating instructions read at the start of every run. Contains sequence, invariants, approval boundary, failure behavior, and output shape. It references rather than duplicates repo laws. |
| `README.md` | humans | Purpose, setup, deployment names, safe test procedure, rollback/pause procedure, and links to the manifest/BOT. Never the runtime source of truth. |
| `references/` | pack maintainer | Stable pack-specific maps, rubrics, or protocols that change with the pack. Do not copy general repo doctrine here. |
| `fixtures/` | pack maintainer | Sanitized, deterministic safe-run inputs and expected structural outcomes. Earned, not mandatory boilerplate. |
| `PROVENANCE.md` / upstream license | pack maintainer | Required only for a port or substantial external derivation. Names origin, pinned revision, local modifications, and license. |
| `bots/deployments/...` | operator | Environment binding: runtime choice, schedule, repo/ref, logical connector names, output target, and fallback. Never overwritten by pack tooling. |
| `$XDG_CONFIG_HOME/beep/bots/...` | operator/machine | Private machine-local overrides and `op://`-backed env files. Not committed. |

The benny pack establishes the useful precedent: dormant direct operating files, a committed repo-relative path, user config outside the pack, immutable source coordinates, one coordinator with write authority, and fail-closed gates. Its intent explicitly rejects plugin-cache paths and copied excerpts and requires draft PRs only (`~/YeeBois/dev/cursor-plugins/pstack/automations/benny/FOR_AGENTS.md:26-36`). Its README requires preserving outside config during pack updates (`~/YeeBois/dev/cursor-plugins/pstack/automations/benny/README.md:3-23`).

### A3. The hosted loader contract

`BOT.md` is the committed operating file. The hosted Bot profile and each routine should contain only a generated loader such as:

```text
You operate the beep-effect bot pack "effect-v4-upstream-watch".
At the start of every run, fetch manifest.json and BOT.md from
bots/packs/effect-v4-upstream-watch/ in <owner/repo> at <approved-ref>.
Follow BOT.md exactly. Record the resolved commit and both file digests.
If either file cannot be fetched, decoded, or matched to this deployment,
stop with a failed receipt and perform no external write.
Deployment: hosted-production. Never merge, deploy, or broaden tool access.
```

This is a convention, not a claim that xAI already supports repo-native definitions. Current product docs expose UI-managed Bot descriptions, saved skills, routines, connectors, and approvals; they do not document a JSON/YAML deployment API or automatic loading of a GitHub path. Therefore:

- `beep bots render-prompt <slug> --deployment hosted-production` renders the loader for human installation.
- `beep bots validate` verifies that the referenced files and deployment agree.
- A safe test run records the commit and digests the hosted Bot actually used.
- Hosted configuration drift remains observable but manual until xAI publishes an API. Do not build an undocumented browser-scraping reconciler for its settings.
- If the GitHub connector cannot read the configured ref/path, the Bot stops; it must not use conversation memory or an old local copy as a substitute.

This preserves Context Economy: a routine reads the relevant pack on demand, while `AGENTS.md` and harness skill registries remain small (`AGENTS.md:172-182`).

### A4. Config outside the pack and secret handling

There are three configuration layers, with a strict precedence and security boundary:

1. **Pack manifest:** public, portable defaults and invariants only.
2. **Deployment document:** runtime binding. A shared, secret-free document may be committed at `bots/deployments/<slug>/<name>.jsonc`. A private binding lives at `${XDG_CONFIG_HOME:-~/.config}/beep/bots/<slug>/<name>.jsonc`.
3. **Secret-reference env file:** `${XDG_CONFIG_HOME:-~/.config}/beep/bots/<slug>/<name>.env`, mode `0600`, containing only assignments whose values are `op://vault/item/field` references. The local service invokes `op run --env-file=<path> -- ...`; it never renders, logs, copies, or persists the resolved value.

Hosted connectors are different. A cloud Bot cannot resolve the workstation's local `op` shim. Authenticate the provider's connector using its own approval flow and refer to the connector in deployment config by a logical capability name, never by a credential. Because all Bots share the user's Grok cloud computer, separate Bot identities are not a secret boundary; do not give that shared computer the local publisher credential or broad repo write token. xAI itself recommends least privilege, read-first/draft-first work, and approval for publishing or production changes ([approvals and security](https://docs.x.ai/grok-bot/approvals-security-and-privacy)).

At decode time, a local `BotSecretReference` schema should accept only the `op://` form. A bare token, `${TOKEN}`, inline OAuth value, `OP_SESSION_*`, or arbitrary environment interpolation is a validation error. This follows the repo's explicit prohibition on bridging 1Password sessions and its safe `op run` test path (`AGENTS.md:8-30`).

### A5. Manifest schema sketch in Effect Schema v4 style

This is a design sketch, not code. The implementation belongs in `packages/tooling/tool/cli/src/commands/Bots/Bots.schemas.ts` and should use the repo-local identity composer, annotations, and exact Effect v4 reference checkout.

Encoded namespaces:

- Manifest: `beep.bot-pack/manifest/v1`
- Deployment: `beep.bot-pack/deployment/v1`
- Run receipt: `beep.bot-run/receipt/v1`
- Handoff envelope: `beep.bot-handoff/envelope/v1`

Literal domains:

- `BotStatus = LiteralKit(["draft", "active", "paused", "retired"])`
- `BotTriggerKind = LiteralKit(["schedule", "repository-event", "message-event", "packet-event", "manual"])`
- `BotDeliveryKind = LiteralKit(["report-files", "pull-request", "github-issue", "x-dm", "handoff-artifact"])`
- `BotRuntimeKind = LiteralKit(["grok-bot", "grok-cli", "claudeg-proxy", "claudex-proxy", "github-actions"])`
- Additional finite domains should cover tool access (`read`, `write`, `publish`), evidence disposition, and receipt status (`success`, `partial`, `blocked`, `failed`, `skipped`). Do not duplicate the literal arrays elsewhere; derive guards/match helpers from the kits (`AGENTS.md:32-46`).

Named `S.Class` models:

- `BotOwner`: stable owner id, display name, escalation surface, and optional contact decoded with `S.OptionFromOptionalKey`.
- `BotToolRequirement`: logical capability, access level, required/optional flag, allowed resource scopes, and a test operation that does not mutate state.
- `BotInput`: a tagged union by source kind. Each case carries only its valid payload—for example a repo path/ref, GitHub event coordinates, packet path, URL source set, or manual request.
- `BotOutput`: a tagged union by `deliveryKind`. `PullRequestOutput` requires allowed path globs, branch prefix, Yeet policy, and `merge: false`; `ReportFilesOutput` requires an approved root and schema; `GitHubIssueOutput` requires repo/label/dedupe key; `XDirectMessageOutput` requires the operator's own account, notification-only content, and a canonical evidence URL; `HandoffArtifactOutput` requires transport, size limits, and digest algorithm.
- `BotBudgets`: positive bounded wall-clock seconds, model/tool-call ceilings, input/output byte ceilings, retry count, consecutive-failure threshold, and cooldown. Currency estimates may be recorded, but request/token/tool ceilings are the enforceable fields when a subscription pool has no published unit price.
- `BotGate`: a tagged union for `capability-available`, `source-fresh`, `clean-dedicated-checkout`, `no-open-delivery`, `human-admission`, `scheduler-admitted`, `command-succeeds`, and bot-specific evidence gates.
- `BotFailClosedCondition`: stable condition id, predicate/gate reference, allowed terminal receipt, notification surface, and the explicit statement that no delivery write is allowed.
- `BotEvidenceContract`: required source links, input/output digests, tool/action log, gate results, model/runtime identity, manifest/BOT/deployment fingerprints, redaction report, artifact retention, and minimum proof needed for each delivery kind.
- `BotManifest extends S.Class<BotManifest>`: `schema`, `name`, `purpose`, `status`, `owner`, `trigger`, `toolsRequired`, `inputs`, `outputs`, `budgets`, `gates`, `failClosedConditions`, `evidenceContract`, and `operatingFile`. Optional fallback/deprecation notes decode into `Option`; arrays that cannot be empty should use precise non-empty schemas.

Trigger modeling must avoid one optional bag:

- `ScheduledTrigger` has `kind: S.tag("schedule")`, a required cadence, timezone, jitter, and missed-run policy.
- `RepositoryEventTrigger` has `kind: S.tag("repository-event")`, event names, a narrow match predicate, and an immutable event id.
- `MessageEventTrigger` has `kind: S.tag("message-event")`, source/thread rules, trusted identity, and a dedupe key.
- `PacketEventTrigger` has `kind: S.tag("packet-event")`, packet kind, admitted lifecycle transition, and packet path.
- `ManualTrigger` has `kind: S.tag("manual")`, requester and admission requirements.
- Build the union with `LiteralKit.mapMembers(...)` and `S.toTaggedUnion("kind")`, then use the derived `.match`, `.guards`, and `.cases` helpers. The same pattern applies to deliveries and gates. This follows both repo law and the live Effect v4 guide's tagged-union API (`standards/ARCHITECTURE.md:126-143`; `.repos/effect/packages/effect/SCHEMA.md:1984-2109`).

Construction/codec details:

- `S.Class` is the source of truth; do not pair it with exported data interfaces.
- Reusable schemas get `$I.annote(...)`; broad `S.String`/unbounded arrays must be narrowed where the protocol has real bounds.
- JSON is decoded with `S.fromJsonString(...)` plus `S.decodeUnknownEffect`; schema failures map into one typed `BotsCommandError` at the CLI boundary.
- External optional keys become `Option` with `S.OptionFromOptionalKey`. Defaults and normalization live in the schema.
- When a class field uses `S.tag(...)`, its `.make(...)` calls omit that discriminator because the tag supplies it.
- Generate the hosted JSON Schema from the encoded side of the same Effect schema; do not hand-maintain a second validator.

The live CLI already demonstrates the intended style: `LiteralKit`, `S.Class`, `S.tag`, and a derived tagged union in `Docs.command.ts` (`packages/tooling/tool/cli/src/commands/Docs/Docs.command.ts:18-80`), while the Goals schemas model manifest state with `LiteralKit` and `S.Class` (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:51-89,222-234,448-492`).

### A6. Output and delivery contract

Every pack chooses exactly one canonical proposal surface and may add notification surfaces. A notification never becomes truth.

| Delivery kind | Allowed behavior | Admission point | Hard boundary |
| --- | --- | --- | --- |
| `report-files` | Write only under the manifest's allowlisted output root through a deterministic publisher. Existing domain conventions win; nightly research uses `research/<date>/`. | Human reads and fires the referenced capture/action command. | No generic `bots/runs/` tracked dump; no writes to goals/explorations unless their owner explicitly admits them. |
| `pull-request` | A local/dedicated publisher uses branch `bot/<slug>/<run-id>` (or an already-ratified domain prefix), stages only allowlisted files, and runs `bun run beep yeet publish --pr --monitor --message ...`. | Human reviews and merges. | Bot never invokes `yeet merge`, GitHub auto-merge, deploy, or branch deletion. Hosted Grok Bot does not author this PR by default. |
| `github-issue` | Create or update one issue keyed by bot id + idempotency key; attach source-linked evidence and a proposed next action. | Human labels/assigns/captures/closes according to the owning workflow. | No duplicate floods; no issue closure or priority/assignee changes unless separately authorized. |
| `x-dm` | Notify Benjamin's own configured account with a short finding and link to canonical evidence. | Human follows the link and acts elsewhere. | Never canonical, never carries secrets/raw artifacts, never contacts third parties, and no fallback public post. |
| `handoff-artifact` | Produce a bounded, schema-validated, content-addressed envelope for another stage. | The receiver independently validates and decides whether to publish. | A partial/truncated bundle is a failed or partial receipt, never reconstructed optimistically. |

`x-dm` is a designed delivery adapter, not a presently proven Grok Bot capability. The current xAI X announcement documents search, timelines, mentions, trends, and bookmarks, but not direct-message sending. Keep this delivery disabled unless a live capability test establishes a narrowly scoped DM action; prefer the Bot app notification or a GitHub issue link in v1 ([Grok Bot now works with X](https://x.ai/news/grok-bot-and-x)).

`main` stays PR-only and Yeet remains the publication operator (`AGENTS.md:61-96`; `.claude/skills/yeet/SKILL.md:86-140`). For generated research specifically, the existing decision is stronger: only the publisher sees the clone, the output is a dedicated PR, and nothing auto-appends to `explorations/INBOX.md` or `goals/` (`standards/architecture/DECISIONS.md:1241-1258`).

#### Generalizing “machine proposes, human admits”

The rule applies to every bot as a capability boundary:

1. The machine may observe, classify, deduplicate, draft, and publish an explicitly allowed proposal surface.
2. The proposal carries evidence, manifest/run fingerprints, gate results, and the next human action.
3. Admission is an explicit domain action: merge a PR, fire a research capture, label/assign an issue, approve an outbound message, or start an aligned goal phase.
4. The bot cannot infer admission from silence, a schedule, a previous approval, a green check, or an unrelated human message.
5. Consequential actions—merge, deploy, delete, production mutation, spending, permission changes, external messaging, goal/exploration creation—remain outside v1.

This is compatible with xAI's own routine advice: automate preparation first, keep publishing and production changes behind approval, define no-data/stale-data behavior, and make retries idempotent ([skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations)).

### A7. Local fallback and parity

The same pack must run through one runner contract:

```text
trigger/input envelope
  -> decode manifest + deployment
  -> acquire scheduler/single-flight lease
  -> evaluate preflight gates
  -> resolve exact input snapshot
  -> invoke selected runtime with rendered BOT.md
  -> decode proposed result
  -> validate evidence and output allowlist
  -> deliver or write a fail-closed receipt
```

Local Grok path:

- `beep bots run <slug> --deployment local-grok` invokes installed Grok Build headlessly through `grok -p` / `--single` (or its file-backed `--prompt-file` form), with `--json-schema`, bounded `--max-turns`, an explicit `--cwd`, and narrow `--allow`/`--deny` rules. The inspected local version is `grok 1.0.13`; its current help exposes those options plus `grok agent headless`.
- Use a minimal dedicated agent profile. Do not inherit the operator's ambient MCP servers, hooks, memories, or broad permissions into an unattended routine.
- The runner, not the model, owns output decoding, allowlist enforcement, receipt writing, and external publication.

Proxy path:

- `claudeg`/`claudex` runs headless Claude against CLIProxyAPI at `127.0.0.1:8317`, with a deliberately scrubbed environment and only the variables required for the proxy and `op run` injection.
- `grok-4.6` is the search/fast-mechanical role; `gpt-5.6-sol(medium)` is the precisely specified implementation/verification role; unavailable routes inherit only where the pack allows a fallback. The beep-mode role decision is authoritative for role labels (`explorations/beep-mode/DECISIONS.md:205-220`).
- Native `x_search` is useful only in the xAI proxy lane and must be capability-tested. The nightly evidence shows parent-environment leakage produces a 401 and therefore requires `env -i` (`goals/nightly-research-routine/README.md:38-50`).

Systemd user timer:

- `beep bots install-timer <slug> --deployment <name>` renders `beep-bot-<slug>.service` and `.timer` under `~/.config/systemd/user/`, following the existing Research `Timers.ts` structure.
- The service runs in a dedicated full clone or declared read-only checkout, never the operator's dirty working tree and never a full clone under `/tmp` (`AGENTS.md:92-99`).
- It uses `Persistent=true`, `RandomizedDelaySec`, a wall-clock timeout, single-flight locking, a declared working directory, `UMask=0077`, and conservative service hardening. Heavy work first acquires the repo scheduler/admission lease; a live holder is backpressure, not permission to compete.
- A local fallback checks the last successful hosted receipt plus a grace window. It uses the same idempotency key, so a delayed hosted run and morning catch-up cannot both deliver.
- `Persistent=true` means “catch up when the machine returns,” not “works while powered off.” Time-critical overnight monitoring stays hosted or in GitHub Actions.
- The service's env file contains only `op://` references and is resolved at execution with `op run`; the generated unit must never contain a raw credential.

Runtime parity means identical manifest/input/result/receipt schemas and approval boundaries, not byte-identical model prose. A fallback may return `partial` when a capability such as X search is unavailable; it may not silently broaden permissions or substitute an unapproved delivery surface.

### A8. `beep bots` CLI surface

Recommended v1 commands:

| Command | Behavior |
| --- | --- |
| `beep bots list [--json]` | Decode the registry and show pack, status, owner, trigger, primary/fallback runtimes, and delivery kind without invoking a model. |
| `beep bots validate [slug] [--deployment name]` | Validate schemas, unique names, repo-relative paths, output allowlists, tool/gate coherence, secret-reference policy, referenced files, and schedule/dedupe consistency. Read-only. |
| `beep bots render-prompt <slug> --deployment name` | Render the minimal hosted loader or local prompt from current committed files, with hashes. It does not update the hosted Bot. |
| `beep bots dry-run <slug> --deployment name --input file` | Resolve inputs, budgets, tools, gates, output paths, and idempotency key; run no model and perform no external write. |
| `beep bots run <slug> --deployment name --input file` | Execute the common runner after validation and scheduler admission. The runtime adapter never owns publication policy. |
| `beep bots verify-handoff <path-or-issue>` | Decode the envelope, verify every part's count/size/hash, and refuse partial recovery. Read-only. |
| `beep bots status [slug]` | Show last receipt, consecutive failures, stale/paused state, next local timer, open delivery, and hosted reconciliation age without invoking a model. |
| `beep bots install-timer <slug> --deployment name [--check|--uninstall]` | Render/check or explicitly install/remove only the named user units. State-changing modes show exact targets. |

Implementation home and order:

```text
packages/tooling/tool/cli/src/commands/Bots/
  Bots.schemas.ts
  Bots.errors.ts
  Bots.service.ts
  Bots.command.ts
  internal/Registry.ts
  internal/Prompt.ts
  internal/Runner.ts
  internal/Handoff.ts
  internal/Timers.ts
  index.ts
```

This follows the canonical command-group roles in `standards/architecture/07-non-slice-families.md:329-355`. The Research service shows the intended `Context.Service` boundary and implementation injection (`packages/tooling/tool/cli/src/commands/Research/Research.service.ts:143-190`). The new group should return one typed `BotsCommandError`, not native errors, and should keep model/runtime adapters behind the service contract.

### A9. Validation, provenance, and receipts

Do not add bot packs to `skills-lock.json`. That lock manages the `.claude`/`.agents` skill mirror (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:30-35,688-721,809-849`), and a Bot pack is neither a registered slash skill nor a harness mirror.

For v1 repo-authored packs:

- Git commit identity plus manifest/BOT/reference tree hashes in every run receipt is sufficient provenance.
- `validate` recomputes a canonical tree manifest and reports dirty/uncommitted pack input.
- A hosted test receipt proves which commit/digests were actually read; a profile description is not proof.
- Receipts live outside the repo by default under `.beep/bots/receipts/<slug>/` in the dedicated execution clone or an operator-configured durable state directory. Only domain-approved report artifacts are proposed for commit.

For a future imported pack, add a separate `bots-lock.json` only after a real second source exists. Model it on the richer `skills-lock/v2` separation of upstream snapshot, license, provenance, patch series, and effective tree (`packages/tooling/tool/cli/src/commands/Skills/Skills.schemas.ts:769-843,941-972`). Do not overload the current v1 skills lock and do not invent lock machinery for one repo-local pack.

Every receipt records:

- schema/run/bot/deployment ids and idempotency key;
- trigger identity and resolved input snapshot;
- repo/base/head revisions where applicable;
- manifest, `BOT.md`, deployment, result, and artifact digests;
- runtime/model identity and capability tests;
- start/end/wall time, budget ceilings and actual usage where observable;
- every gate result and every external write attempted/completed;
- status, structured failures, retry/resume cursor, redaction result, and delivery URL;
- a `supersedes`/`duplicateOf` relation when dedupe prevents another delivery.

The repository's research convention makes the same truth/derived distinction: structured claims and the single-writer ledger are truth; indexes are rebuildable (`research/README.md:23-44`). Bot receipts should follow that pattern without claiming the research ledger as their home.

### A10. Required fail-closed conditions

At minimum, no external write occurs when:

- manifest, deployment, `BOT.md`, or referenced schema fails to decode or its digest does not match the run's resolved commit;
- a required connector/tool is unavailable, unauthenticated, or broader/narrower than the declared scope;
- a local env file contains anything other than allowed non-secret config or `op://` references;
- a trigger lacks stable coordinates, is stale, is duplicated, or fails its narrow match predicate;
- a required input is missing, oversized, stale, or outside the allowed repo/path/source set;
- the dedicated checkout is dirty, on the wrong base, held by another run, or has an open prior delivery;
- scheduler admission is unavailable for heavy local work;
- the output decoder fails, a proposed path leaves its allowlist, the evidence minimum is not met, or redaction/gitleaks fails;
- payload part count, byte length, record count, or digest disagrees;
- a person owns the issue/fix, a plausible existing PR/commit exists, or the requested action crosses the human-admission boundary;
- budget, retry, consecutive-failure, or stale-source thresholds are reached.

The benny repro workflow is the right precedent: missing config/adapter/feature map stops the run, the symptom must reproduce twice through the real UI, existing fixes switch to verification, and no confirmed repro means no authored fix (`~/YeeBois/dev/cursor-plugins/pstack/automations/benny/skills/reproduce-and-fix-issues/SKILL.md:7-32,80-103,218-297`).

## B. beep-mode / pstack mapping

### B1. Classification rule

“Bot-shaped” below means the execution phase can run unattended from a stable trigger, has a bounded input/output contract, and stops at a proposal. “Session-shaped” means the operator must negotiate the question, shape the design, supply live judgment, or own a consequential action. “Bot-shaped after gate” means the session establishes an immutable experiment/predicate/baseline first; only then is unattended execution safe.

### B2. Every pstack playbook and both benny automations

| # | pstack playbook / automation | Primary shape | beep-effect trigger, inputs, output when bot-shaped | Port judgment |
| ---: | --- | --- | --- | --- |
| 1 | Authoring or modifying a skill | Session-shaped | — | Requires authorial judgment, reuse search, examples, and human approval. A later reflection bot may propose candidates, not silently edit skills. |
| 2 | Autonomous run (including the overnight guide) | **Bot-shaped after gate** | Trigger: operator-admitted goal phase/manual run. Inputs: aligned packet, measurable exit predicate, dedicated branch/clone, budgets, allowed commands. Output: receipt trail plus report or Yeet PR; never merge. | Retain the predicate/iteration contract; replace Cursor `/loop` with runner/timer/Yeet watchers. |
| 3 | Autopilot-full | Session-shaped / rejected | — | It delegates merge authority. That violates “propose-only” and beep-mode's explicit merge line. Retain only exact-head independent verification. |
| 4 | Autopilot-stack | **Bot-shaped in form, rejected in topology** | If ever redesigned: trigger an admitted multi-PR packet; inputs unit graph/exact heads; output ordered independent Yeet PRs plus dependency ledger, no merge. | Do not port Graphite, force-restacks, or one root topology writer now. |
| 5 | Babysit | **Bot-shaped** | Trigger: PR check/review/thread event, with bounded timer fallback. Inputs: PR number, exact head SHA, Yeet state, review threads, flake fingerprints, reply policy. Output: status/reply drafts or a bounded fix PR update; terminal `merge-ready` report; never merge. | Thin routing over `yeet monitor/status/closeout/reply`, not a second PR watcher. |
| 6 | Bug fix | Session-shaped | — | Root-cause scope and design are negotiated. The benny automation below is the bounded unattended specialization. |
| 7 | Eval | **Bot-shaped after gate** | Trigger: operator-admitted eval run. Inputs: frozen private rubric, byte-identical organic prompt, isolated variants, model budget. Output: blinded artifacts/judge report under the owning goal's `history/`; promote only after human review. | Execution automates well; experiment design and promotion do not. |
| 8 | Feature | Session-shaped | — | Schema/service/architecture choices cross the align gate. Implementation may later be delegated within an approved phase, not scheduled as a generic bot. |
| 9 | Hillclimb | **Bot-shaped after gate** | Trigger: admitted performance target/manual start. Inputs: frozen harness, baseline, metric/direction/target, minimum attempts, wall-clock budget. Output: decision TSV, measurements, accepted branch/PR proposal; no metric relaxation and no merge. | Strong unattended loop once the operator freezes the scientific contract. |
| 10 | Investigation | Session-shaped | — | Usually begins with a contested or open question and returns judgment to the operator. Narrow recurring investigations become distinct packs, such as upstream watch. |
| 11 | Multi-phase or multi-PR plan | Session-shaped | — | This is packet/design work. The operator must close architecture and sequencing branches before execution. |
| 12 | Opening a PR | Session-shaped utility | — | It is a publication protocol invoked by an admitted authoring run, not its own recurring bot. Use Yeet. |
| 13 | Orchestrate | **Bot-shaped after gate** | Trigger: admitted program/goal with durable unit ledger. Inputs: aligned SPEC/PLAN, typed dependency graph, unit/pool budgets, scheduler policy. Output: unit receipts and independent Yeet PR proposals keyed to exact heads; no merge. | Portable single-writer ledger is useful; Cursor/Graphite lifecycle is not. Separate future goal if ever needed. |
| 14 | Pause safely | Session-shaped utility | — | A control/resume protocol, not a trigger-driven product. No WIP commits to shared branches. |
| 15 | Perf issue | Session-shaped | — | Requires choosing/validating live measurements and mechanism. A predeclared regression detector could become a separate bot pack. |
| 16 | Prototype | Session-shaped | — | Exists to answer an open design question; operator must choose the winning decision. |
| 17 | Refactoring | Session-shaped | — | Boundary/model changes require judgment and often the align gate. A law enhancer can report candidates, not freely refactor. |
| 18 | Runtime forensics | **Bot-shaped after gate** | Trigger: admitted incident/perf regression or QA artifact event. Inputs: exact process/build, capture recipe, symptom, limits. Output: diagnosis report with source/symbol/evidence only. | Automate capture/reduction only when the matching surface and safety policy are predefined. Route fixes separately. |
| 19 | Session pickup | Session-shaped utility | — | Reconstructs a human/agent session from durable state; it is not a recurring outcome. |
| 20 | Shipping | Session-shaped / rejected | — | It arms merge behavior. Yeet closeout is reusable; merge stays an explicit operator action. |
| 21 | Trace forensics | **Bot-shaped** | Trigger: trace/profile artifact uploaded or linked. Inputs: artifact format/digest, symbols/source maps, comparison artifact if any. Output: read-only diagnosis with attribution limits and evidence pointers. | Excellent low-blast report bot; no source edits. |
| 22 | Visual parity | **Bot-shaped after gate** | Trigger: labeled PR/approved QA milestone. Inputs: immutable baselines, route/state inventory, exact head, lane config. Output: `beep qa` evidence inventory, pixel/motion diff report, optional bounded fix PR; never alter baselines. | Local-only until the unattended QA lane is productionized. |
| 23 | Worktree and simulator cleanup | Session-shaped / rejected | — | The upstream workflow includes destructive cleanup and macOS/Cursor assumptions. A read-only disk/ownership report could be a different bot; deletion needs explicit review. |
| S1 | Show me your work (support skill) | **Bot-supporting utility, not a standalone bot** | Invoked inside an admitted unattended run. Inputs: phase, decision, reason, evidence pointer, result. Output: append-only local/packet decision trail included in the run receipt and independently reviewed. | Put its fields in `BotEvidenceContract`; do not schedule an “evidence logger” as a separate Bot. |
| B1 | Benny: triage issue reports | **Bot-shaped** | Trigger: new top-level configured issue report/GitHub issue. Inputs: immutable source coordinates, full thread/media, repo/history, routing map, tracker adapter. Output: exactly one thread verdict plus confident deduped issue update/create; in beep-effect prefer one GitHub issue/report, not Slack-specific behavior. | Port the immutable coordinates, coordinator-only writer, dedupe, compensation, and fail-closed rules. |
| B2 | Benny: reproduce and fix confirmed bugs | **Bot-shaped after gate** | Trigger: trusted triage marker. Inputs: exact issue, ownership/fix-artifact checks, feature map, control adapter, safe environment, budgets. Output: repro pack; verify existing fix or, only after twice-reproduced before/after proof, a Yeet PR proposal; never merge/deploy. | Local proxy/timer only for professional-desktop because the proof path is local `beep qa`. |

The underlying playbook inventory and repo adaptations are documented in `explorations/beep-mode/research/pstack-distillation/01-poteto-mode-and-playbooks.md:166-587`. The upstream overnight operating model requires a fixed predicate, isolated workspace, budget, and decision trail (`explorations/beep-mode/research/pstack-distillation/04-guide-and-packaging.md:3-19`).

### B3. beep-mode decisions bot packs must respect

1. **Autonomy: “gate design, free the rest; never merge.”** Schema-, service-, architecture-, and packet-shaping decisions remain behind align. After alignment, reversible work may proceed and Yeet may publish a PR, but no overnight or autonomous instruction crosses merge authority (`explorations/beep-mode/DECISIONS.md:237-252`). A bot manifest is exactly where the approved reversible area and the irreversible boundary become machine-checkable.
2. **Model roles.** Preserve the role table rather than hard-code a favorite model into each `BOT.md`. Current roles include `grok-4.6` for xAI/search, `gpt-5.6-sol(medium)` for specified implementation, Codex/Grok CLI/Cursor columns, and inherit-parent fallback when a harness cannot route (`explorations/beep-mode/DECISIONS.md:205-220`). Deployment config chooses an available runtime without changing the pack's semantics.
3. **Agents.** `beep-agent` is the mode-reading heavy-work delegate and `comment-sicko` is a read-only reviewer subordinate to JSDoc law (`explorations/beep-mode/DECISIONS.md:222-235`). Packs may name those roles only when the selected runtime actually exposes them and the run's delegation policy allows them; a hosted Bot does not get to pretend those agents exist.
4. **Stickiness.** The mode remains sticky across a human multi-step session through one AGENTS routing row and Cursor frontmatter, with no marker/hook machinery in wave 1 (`explorations/beep-mode/DECISIONS.md:254-266`). A bot run is different: `BOT.md` is loaded afresh every run and does not add itself to the global prompt prefix.
5. **Curated fork boundary.** beep-mode intentionally dropped `automations/benny` as Cursor-only, while preserving its lessons in the distillation (`explorations/beep-mode/DECISIONS.md:10-28`). Bot packs should depend on beep-mode doctrine where useful, not silently reverse that scope decision by adding benny files to P1/P2/P3.
6. **Three-PR graduation is already closed.** P1 is mode core/agents/model roles, P2 is situational skills, and P3 is eval/promotion/closeout (`explorations/beep-mode/DECISIONS.md:312-325`). Adding a new root, manifest protocol, CLI group, timers, receipts, and a first production automation would turn all three PRs into a second product.

**Recommendation: make bot packs a sibling exploration/goal, not a fourth beep-mode phase.** The sibling should require beep-mode's completed role/autonomy vocabulary where appropriate, while beep-mode remains usable without any scheduled automation. This preserves the existing 18 decisions and gives the new architecture its own grill, root decision, threat model, schemas, runtime adapters, and acceptance evidence.

## C. Architecture decision matrix

### C1. Four runtime classes

Scores: `++` strong fit, `+` workable, `±` conditional/high setup, `−` poor fit, `--` unavailable or contrary to the contract.

| Criterion | Hosted Grok Bot | Local Grok CLI + systemd user timer | `claudeg` / `claudex` proxy lane | GitHub Actions scheduled/event workflow |
| --- | --- | --- | --- | --- |
| Always-on schedule | `++` cloud routine runs with laptop closed, though beta routines may pause after prolonged absence | `−` workstation is off overnight; `Persistent=true` catches up at boot | `−` same workstation dependency; proxy must also be up | `++` hosted schedule/events independent of workstation |
| Full repo checkout | `±` cloud VM/connector can clone/read, but its state and toolchain are not the canonical local environment | `++` dedicated clone with installed toolchain | `++` dedicated clone and same local services | `+` fresh ephemeral checkout; install cost each run |
| `bun` / `beep` / Yeet | `±` only if explicitly provisioned and maintained in the Bot VM; not assumed | `++` native intended path | `++` native intended path | `±` can install/run, but token permissions, caches, review loop, and local assumptions need explicit design |
| `.repos/effect` live reference | `−` machine-local symlink absent unless separately provisioned and kept current | `++` canonical local reference | `++` canonical local reference | `±` can clone an explicit pinned upstream checkout, not the machine-local provisioned link by default |
| Local `op` shim / service account | `--` local-only; provider connectors use separate auth | `++` `op run` at execution without revealing values | `++` same, with env scrub | `−` no workstation `op`; would require separate Actions secrets/OIDC trust domain |
| Native X search | `++` X connector/integration, subject to enrollment/auth and beta behavior | `+` local `grok -p` proven to use hosted XSearch in the nightly experiments | `++` xAI route with injected native `x_search`; capability-test every run | `−` no native X surface without a separate paid/API integration |
| Web/GitHub/arXiv search and judgment | `++` strongest use case; always-on browser/connectors | `+` available but tied to workstation and subscription CLI | `++` multiple model families and cross-provider verify | `±` deterministic APIs are good; open-ended LLM judgment needs a separately funded API |
| PR authoring through Yeet | `−` default design forbids write credential and canonical local proof | `++` dedicated clone/branch; full Yeet loop | `++` same | `±` possible in an ephemeral checkout but not the default; prefer issue/artifact or deterministic checks |
| `beep qa` browser/motion evidence | `−` cloud browser is not the repo's local recorded QA harness | `+` local lanes; some capture surfaces still need operator/installed environment | `++` best local model+QA composition | `−` current QA/browser/portal machinery is not a stock Actions runner surface |
| Cost pool | Separate Grok Bot weekly usage; numeric quota is unpublished | SuperGrok/Grok CLI subscription pool | xAI/OpenAI/Anthropic pools according to route; easiest cross-provider verification, easiest accidental multi-pool spend | Actions minutes plus any separately configured model/API charges |
| Observability | `±` conversation + recent routine history; export durable receipts because product retention is bounded | `++` journald, CLI receipts, OTEL, files, Yeet artifacts | `++` same plus model transcripts/structured output | `++` workflow logs/artifacts/check annotations, with retention policy |
| Isolation / blast radius | `−` all of one user's Bots share a cloud computer, sessions, and credentials; Bot names are not security boundaries | `+` dedicated clone/profile/service user boundaries possible; still on operator host | `+` same, but proxy/model credentials raise scope | `++` ephemeral runner and scoped token when configured narrowly; outbound secrets are a separate trust domain |
| Failover role | Primary for hosted search/judge | Catch-up/fallback for local-capability work | Primary for local model work or cross-provider verification | Primary for deterministic/event-driven sensing; wake-up/queue producer for local work |

Hosted facts in this table come from xAI's current docs: background routines, event triggers, test-run side effects, bounded run history, and routine pause behavior ([skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations)); shared cloud-computer and least-privilege boundaries ([approvals and security](https://docs.x.ai/grok-bot/approvals-security-and-privacy)); GitHub/custom MCP connector availability and public reachability ([connectors](https://docs.x.ai/grok/connectors)). Cost should remain a budgeted unknown: xAI says Bot usage is separate from the ordinary plan pool but publishes no numeric weekly allowance on the pages reviewed ([Grok Bot product page](https://x.ai/bot)).

### C2. General placement rule

- **Hosted Grok Bot:** search-and-judge, monitor public/external sources, produce a bounded public-safe proposal. Give it read-only connectors and one narrow delivery mailbox.
- **Local timer / Grok CLI:** jobs whose core proof is the actual checkout/toolchain or that need the local `op` route, but whose judgment can stay in one xAI model. Expect morning catch-up, not true overnight service.
- **Local proxy lane:** code/doc changes, cross-provider verification, Effect v4 source checks, Yeet publication, and local QA. Run with a minimal, env-scrubbed profile and a dedicated clone.
- **GitHub Actions:** deterministic repository checks, GitHub-native events, and wake-up/queue production. Avoid giving a scheduled LLM broad write authority simply because Actions is always on.
- **Hybrid:** hosted Bot discovers/judges; a durable schema-validated handoff queues bounded records; a local deterministic or proxy-backed stage verifies against the checkout and alone publishes through Yeet.

### C3. Hybrid handoff that fixes the nightly routine

The 2026-08-31 run recorded four concrete gaps: X search returned `client-not-enrolled`, no Sol/Luna verification seat existed, GitHub MCP needed authentication, and the publisher payload was truncated during inline transport (`research/2026-08-31/RUN.json:18-29,45-80`). The fix is not a larger prompt. It is a durable, content-addressed handoff with separate auth domains.

Recommended research flow:

```text
Hosted Grok Bot (always-on web/GitHub/arXiv/X search + first judgment)
  -> bounded sanitized FindingRecord objects
  -> durable handoff mailbox (one run index + independently hashed parts)
  -> local `beep bots verify-handoff`
  -> local Sol/Luna refutation and repo/.repos/effect verification
  -> one local writer from structured surviving records
  -> deterministic dedicated-clone publisher
  -> `bun run beep yeet publish --pr --monitor`
  -> human merge/admission
```

The hosted phase must not send a gzip/base64 archive inside the next model prompt. For a public-safe first implementation, use one dedicated GitHub issue as a mailbox: one small envelope in the issue body, one canonical JSON object or bounded JSONL chunk per numbered comment, and a final completion comment. The local receiver reads it with `gh`, verifies all hashes/counts, and refuses the bundle until the completion marker and every part exist. If the GitHub connector is unauthenticated, the hosted run reports failure in its conversation and produces no downstream publish claim. For non-public material, use a private content-addressed object store; do not leak it into a public issue.

`BotHandoffEnvelope` fields:

- `schema`, `botId`, `runId`, `idempotencyKey`, `status`, `producedAt`, and source-window bounds;
- repository, base ref/SHA, pack manifest/BOT digests, and deployment fingerprint;
- sanitization policy/result and public-safety classification;
- ordered `parts[]`, each with index, media type, canonicalization, URI/comment id, byte length, record count, and SHA-256;
- total part/record/byte counts and an aggregate digest;
- budgets/usage, capability tests, gates, structured failures, and resume cursor;
- declared receiver, allowed next stage, and expiration.

Each `FindingRecord` carries a stable record id, claim/finding, source URLs and observation dates, short sanitized evidence, confidence, contradiction/dedupe links, repo-impact hints, and no raw secret or opaque attachment bytes. Set strict per-record and per-run byte ceilings. A missing/duplicate/out-of-order part, size mismatch, decode error, digest mismatch, absent completion marker, or source outside the allowlist yields `partial`/`failed`; the receiver never “recovers what it can” and calls the run complete.

This restores the nightly SPEC's intended separation: search/synthesis has no checkout, the writer consumes structured records, and only the deterministic publisher touches the clone (`goals/nightly-research-routine/SPEC.md:19-43`).

### C4. Recommendation per candidate bot

#### C4a. Per-bot four-runtime comparison

| Candidate | Hosted Grok Bot | Local Grok CLI timer | `claudeg` / `claudex` proxy | GitHub Actions | Recommended placement |
| --- | --- | --- | --- | --- | --- |
| Documentation enhancement | `+` useful external examples/discovery; `−` for canonical repo proof and direct writes | `+` has checkout; one-family judgment and boot-only schedule | `++` live checkout, Sol implementation, local docgen/Yeet | `+` supplies deterministic broken-link/docgen facts; weak authorial judge alone | Local proxy authors only after a report is admitted; local Grok is fallback. |
| Documentation / knowledge staleness detection | `++` external source drift and semantic contradiction | `+` local symbol/doc comparison, but misses overnight timing | `+` strongest deep confirmation on disputed findings | `++` always-on links, anchors, generated-state, and age checks | Actions deterministic scan + hosted semantic judge → one issue/report; local proxy confirms hard cases. |
| “Beep style & law enhancer” | `−` hosted environment cannot prove the current local law/toolchain surface | `+` bounded local scout | `++` live laws, source reuse, schema/effect guidance, focused proof | `+` only for already-encoded deterministic laws | Local Sol proxy, report-first; convert repeated findings into deterministic rules. |
| Portfolio doctor for goals/explorations | `±` can summarize but adds little to deterministic state | `±` can run locally but wastes the hosted-time advantage | `±` only for disputed judgment | `++` always-on, GitHub-native, existing doctor/index commands | GitHub Actions check/rolling issue; do not make this an LLM bot unless a real judgment gap appears. |
| CI flake / timeout triage | `±` can interpret logs, but shared write credentials and event fidelity are risks | `−` misses events while workstation is off; useful only for an active branch | `+` can diagnose/fix an admitted unknown red locally | `++` native `workflow_run`/job events, logs, scoped rerun | Actions classifies/does one known-flake rerun; local Yeet/proxy handles code fixes. |
| Effect v4 RC upstream watch | `++` always-on GitHub/web/X discovery and judgment | `+` subscription fallback and local checkout, delayed until boot | `++` best local `.repos/effect` impact verification | `+` reliable release/tag polling; limited semantic impact judgment | Hosted discovery → local proxy/deterministic verifier; Actions can seed release events. |
| Research-packet actioning nudges | `+` good weekly evidence-linked digest | `−` no reason to depend on a powered-on workstation | `±` unnecessary unless a human asks for synthesis | `++` derives age/action/tombstone state from committed truth | GitHub Actions rolling issue or operator notification; hosted digest is optional. |
| Reflection harvesting into skills | `−` shared cloud state and always-loaded instruction edits are too broad | `+` local read-only candidate mining | `++` local histories, cross-family judgment, blinded eval support | `±` can enforce provenance/eval artifacts, not judge the prose | Local proxy proposes candidates; human approves and evaluates before any skill PR. |
| PR babysitter | `+` always-on, but broad GitHub/comment authority on shared Bot computer is a concern | `+` exact Yeet surface while workstation/branch owner is active | `++` exact Yeet surface plus bounded code/reply fixes | `++` GitHub events and checks stay live overnight | Actions notifies/queues; local Yeet watcher owns exact-head closeout and any replies/fixes. Never merge. |
| Issue reproduce-and-fix | `+` intake/triage; `−` for the repo's canonical local QA evidence | `+` can use checkout/QA, but one-family and machine availability constrain it | `++` checkout, feature map, `op`, `beep qa`, implementation/review roles | `−` stock runner cannot reproduce the professional-desktop local surface | Local proxy after trusted triage/ownership gates; hosted Bot may only prepare intake. |
| Test-gap finder | `−` cannot cheaply prove non-vacuous tests against the full local package surface | `+` local scan/test fallback | `++` schema/source-aware judgment and package-scoped proof | `+` supplies coverage/mutation facts and verifies admitted PRs | Local Sol proxy, ranked report first; Actions provides measurements. |

#### C4b. Canonical output and decisive gate

| Candidate | Primary runtime | Supporting/fallback runtime | Canonical output | Why / decisive gate |
| --- | --- | --- | --- | --- |
| Documentation enhancement | **Local `claudex` proxy (Sol)** | Hosted Grok discovery report; local Grok CLI fallback | Yeet PR proposal after a report is admitted | Correct docs require live symbol/barrel search, docgen/package checks, exact repo laws, and focused diffs. Hosted discovery may find weak areas but should not directly rewrite the tree. Fail if referenced symbols/examples are not executable or source-backed. |
| Documentation / knowledge staleness detection | **Hybrid: GitHub Actions deterministic scan + hosted Grok judge** | Local proxy for deep confirmation | Deduped GitHub issue/report; no PR in v1 | Actions catches links, anchors, generated drift, and age metadata reliably; hosted Grok compares external sources and judges semantic contradiction. Human admits any rewrite. |
| “Beep style & law enhancer” | **Local `claudex` proxy (Sol)** | Local Grok CLI for narrow mechanical scans | Findings report first; later bounded Yeet PR | It needs current `AGENTS.md`, architecture, schema/effect skills, source reuse search, and local checks. Repeated high-confidence findings should become deterministic lint/architecture rules; the LLM remains a scout, not a permanent subjective gate. |
| Portfolio doctor for goals/explorations | **GitHub Actions** | Hosted Grok summary only if judgment adds value | One rolling issue/check report | Most drift is deterministic and the live `beep goals doctor/index` surface already exists. Do not spend a model or create a bot if a CLI check can express it. Never auto-create or flip packets. |
| CI flake / timeout triage | **GitHub Actions event workflow** | Local Yeet babysitter when a branch owner is active | Check annotation/PR comment or rerun receipt | It is GitHub-event native and always on. Yeet already recognizes known timeout/TS2589 fingerprints and permits exactly one job-level rerun per head (`.claude/skills/yeet/SKILL.md:376-395`). Unknown reds remain “needs code fix”; no broad rerun loop. |
| Effect v4 RC upstream watch | **Hybrid: hosted Grok Bot → local verifier** | Actions for deterministic release polling; local Grok CLI if hosted unavailable | Deduped watch issue/report; optional later migration PR after admission | Hosted is ideal for GitHub/web/X change detection; local verification needs `.repos/effect` and repo usages. Narrow, source-grounded, low blast, and the best first pack. |
| Research-packet actioning nudges | **GitHub Actions** | Hosted Grok for a weekly evidence-linked digest | One rolling issue or operator-only notification | Packet age, tombstones, captures, and action status should be derived deterministically from committed truth. The bot may nudge; it must never append to `explorations/INBOX.md` or `goals/` (`research/README.md:39-45`). |
| Reflection harvesting into skills | **Local `claudex` proxy (Sol/Fable judgment)** | Manual session for approval/eval | Candidate report/diff under owning goal history; later skill PR after human approval | Reflections and skill bodies are repo/local-history sensitive. Proposed edits require reuse search, provenance, blinded eval, and human promotion. Never scan unrelated private histories or auto-edit always-loaded instructions. |
| PR babysitter | **Local Yeet watcher when checkout-backed work is active** | GitHub Actions event notifier while workstation is off | Reply drafts, exact-head status, merge-ready report | Yeet already owns checks, threads, Greptile, reply drafts, known-flake reruns, and exact-head readiness. A pack should orchestrate that surface, not replace it. Never merge. |
| Issue reproduce-and-fix | **Local `claudeg`/`claudex` proxy** | Hosted Bot only for triage/repro-intake, not final proof | `beep qa` repro pack; existing-fix verdict or bounded Yeet PR proposal | Needs repo/toolchain, feature map, safe app environment, browser/motion evidence, and sometimes `op`. The current QA protocol is recorded local evidence and some native-input paths remain unproductionized (`.claude/skills/browser-qa-loop/SKILL.md:44-121`). |
| Test-gap finder | **Local `claudex` proxy (Sol)** | Actions supplies coverage/mutation data; Grok CLI fallback | Ranked report first; bounded test-only Yeet PR after admission | It must inspect production schemas and existing tests, run package-scoped proof, and reject vacuous/mock-only tests. Actions is good at producing coverage facts; local Sol is better at judgment and focused implementation. |
| Trace/performance diagnosis | **Local Grok CLI or proxy, artifact-triggered** | Actions queues CI artifacts | Read-only diagnosis report | Large artifact reduction and source-map resolution benefit from local tools and bounded structured output. It should diagnose only, with attribution limits; fixes are a separately admitted flow. |

### C5. First bot and staged rollout

Build `effect-v4-upstream-watch` first, in four progressively earned modes:

1. **Pack/CLI proof:** manifest, `BOT.md`, one sanitized fixture, `list`, `validate`, `render-prompt`, `dry-run`, and receipt hashing. No model and no external writes.
2. **Hosted report-only supervised run:** official Effect GitHub/release sources first; optional X context; deliver one deduped GitHub issue/mailbox. Verify exact pack commit/digests and pause after one run.
3. **Local verification:** resolve the current upstream change against `.repos/effect`, locate impacted `packages/**/src`/barrels, and attach a structured impact appendix. No source edits.
4. **Fallback and schedule:** install one user timer that catches stale hosted receipts at boot, prove idempotency/race handling, then enable the hosted schedule. Only after several useful, non-duplicate reports should the operator consider an admitted migration-PR phase.

Acceptance criteria for the first pack:

- two safe fixtures: no-change and one real upstream change;
- same manifest/input yields the same idempotency key in hosted and local lanes;
- an unavailable X/GitHub capability yields an explicit partial/failed receipt, not invented evidence;
- hosted and local discovery cannot create duplicate issues;
- a deliberately truncated handoff is rejected before local judgment;
- no runtime has merge/deploy permission;
- output names the exact upstream evidence, repo symbols searched, pack commit/digests, budgets, and human next step.

## Open design risks for the grill

- Whether the new public top-level `bots/` root is worth the topology change or whether v1 should live under CLI resources until a second pack exists.
- Whether any v1 bot may author a PR, or whether the first release is report/issue-only with publication added after operational evidence.
- Who owns hosted-profile reconciliation while no public Bot-as-code API exists.
- Whether a public GitHub issue is an acceptable durable handoff mailbox for sanitized records, and what private transport is approved if it is not.
- Which identity/token is allowed to create/update the handoff issue, given the current `github-mcp-needsAuth` failure.
- Numeric Grok Bot, Grok CLI, proxy, and Actions budgets. xAI's published pages describe separate weekly Bot usage but not a numeric allowance.
- How many consecutive partial/failed runs pause a bot and who receives the wake-up notification.
- Whether the workstation's morning catch-up semantics are acceptable for each local fallback.

## Source index

Primary repo doctrine and current implementation:

- `AGENTS.md:32-59,61-113,122-182`
- `standards/ARCHITECTURE.md:114-131,157-187,449-539,621-638`
- `standards/architecture/07-non-slice-families.md:329-355`
- `standards/architecture/DECISIONS.md:1235-1274`
- `standards/memory-architecture/04-decision-log.md:359-384`
- `explorations/beep-mode/DECISIONS.md:10-28,205-266,297-325`
- `explorations/beep-mode/research/pstack-distillation/01-poteto-mode-and-playbooks.md:150-587`
- `explorations/beep-mode/research/pstack-distillation/04-guide-and-packaging.md:3-19,45-76`
- `goals/nightly-research-routine/SPEC.md:9-78,99-128`
- `research/README.md:10-45`
- `research/2026-08-31/RUN.json:18-80`
- `packages/tooling/tool/cli/src/commands/Research/internal/Timers.ts:1-8,39-65,88-164`
- `packages/tooling/tool/cli/src/commands/Research/Research.service.ts:143-190`
- `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:30-35,688-721,809-849`
- `packages/tooling/tool/cli/src/commands/Skills/Skills.schemas.ts:769-843,941-972`

Upstream pstack/benny evidence:

- `~/YeeBois/dev/cursor-plugins/pstack/automations/benny/FOR_AGENTS.md:7-36,38-53,55-89`
- `~/YeeBois/dev/cursor-plugins/pstack/automations/benny/README.md:1-23`
- `~/YeeBois/dev/cursor-plugins/pstack/automations/benny/skills/triage-issue-reports/SKILL.md:7-28,30-42,127-183,200-240`
- `~/YeeBois/dev/cursor-plugins/pstack/automations/benny/skills/reproduce-and-fix-issues/SKILL.md:7-32,56-103,126-142,200-310`
- `~/YeeBois/dev/cursor-plugins/pstack/automations/benny/skills/reproduce-and-fix-issues/references/control-adapter.md:1-10,11-68,127-169`

Current official xAI product sources, accessed 2026-09-03:

- [Grok Bot product page](https://x.ai/bot)
- [Grok Bot overview](https://docs.x.ai/grok-bot/overview)
- [Create and manage Bots](https://docs.x.ai/grok-bot/bots)
- [Skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations)
- [Approvals, security, and privacy](https://docs.x.ai/grok-bot/approvals-security-and-privacy)
- [Grok connectors](https://docs.x.ai/grok/connectors)
- [Grok Bot now works with X](https://x.ai/news/grok-bot-and-x)
