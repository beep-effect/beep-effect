# Practice KG MCP Strict Telemetry Tier Spec

## Objective

Shape-only telemetry for practice-kg-mcp on the attorney workstation: serializer gate, on-PC HMAC salt, encrypted spool, fail-closed tier, canary proof.

## Non-Goals

- Any spend: SaaS backends, Vercel drains, Grafana Cloud above free, Tailscale paid tiers (exploration D9).
- Choosing the logs/traces store; that waits for the hub gate (D1).
- Mutating dankserver, the tailnet policy, `tom-pc-1` or any host directly; ship exact commands as proposals the operator applies.
- `tbk-ubuntu` and its security-sensitive VM (gated host; never instrumented).
- Developer-AI analytics (`@beep/repo-ai-metrics`), cache policy (`goals/turborepo-cache-trust-observability`) and CI step forensics (`goals/ci-step-watchdog`) — consume, never absorb.
- Dashboards hand-built in the Grafana UI or copied from the existing generated ones.

## Source Hierarchy

1. The graduating exploration: [`explorations/observability-palantiri`](../../explorations/observability-palantiri/) — `BRIEF.md`, `MAP.md`, `DECISIONS.md` (back-links, not copies).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `apps/practice-kg-mcp` (runtime layer, stderr pinning, packaging)
- `@beep/observability` kernel: shape-only gate + egress `HttpClient`
- `@beep/mcp-kit` `SanitizedSpan` (reuse)

## Constraints

- Gate = custom `OtlpSerialization` with `Otlp.layer` (never `layerJson`/`layerProtobuf`/NodeSdk in this build); synchronous; HMAC via `Bun.CryptoHasher`; pinned by a test (`explorations/observability-palantiri/research/strict-tier-exporter.md`).
- Shape-only spans allowed but scrubbed: names only from the tool enum, timestamps rounded to the export window, ids unlinkable across batches, events/links/status messages/log bodies always dropped; every drop counted in `telemetry_refused_total`.
- Resource rebuilt from constants; the PC sends no host identity (gateway vouches via `whois`).
- Fail closed: untagged or unresolvable tag → shape-only; env/flags can lower the tier, never raise it.
- Stderr pinned to a shape-only logger (Claude Desktop persists MCP stderr).
- Process CPU/RSS coarsened (10 s samples, 5 min windows, 5% / 32 MiB steps); no disk I/O counters.
- Spool after the gate, AES-GCM with a DPAPI-wrapped key (bun:ffi `crypt32`, PowerShell fallback); replay never under a looser tier.
- Nothing leaves `tom-pc-1` until the fleet goal's tier-aware gateway replaces the open ingest.
- Schema → `Context.Service` contract → implementation; Effect v4 only, validated against `~/YeeBois/references/effect/effect`; `effect/<Module>` imports; `HashMap`/`HashSet`; `Effect.fn`/`fnUntraced`.
- Names, metrics, events and attribute keys come from the instrumentation catalog (`goals/observability-kernel-catalog`); names are static literals, never interpolated.
- Public repo: no client data, tokens, `op://` resolutions, LAN IPs, tailnet suffixes or account identifiers in packet or code.
- Totals use `increase()` over the panel range; per-process identity never becomes a metric label; promoted labels come only from the registry's metric-safe set.

## Acceptance Criteria

- [ ] Canary tokens through every tool handler (incl. failing paths) never appear in any exported byte in any encoding.
- [ ] Golden per-tier allowlist snapshot test: exported key set equals the golden; refusal tags match.
- [ ] Mutation tests: disabling any gate rule turns a test red.
- [ ] A DPAPI smoke run on `tom-pc-1` (operator-run command) succeeds or the fallback is recorded.
- [ ] Weekly privacy receipt (counts + key names, no values) renders locally.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/practice-kg-mcp-strict-tier/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/practice-kg-mcp-strict-tier/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/practice-kg-mcp-strict-tier` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | Inherit exploration decisions D1–D9 and the align/agent-decided entries in `explorations/observability-palantiri/DECISIONS.md`. | Graduated from `explorations/observability-palantiri`. | Reopen the exploration at `decompose`. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
