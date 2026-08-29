# OpenClaw Workstation Agent — Sources & Provenance

<!--
The provenance ledger an implementing agent reads to trace every decision back to
its origin. Inherited 2026-07-25 from the source exploration at graduate; the
exploration's ledger remains the primary copy.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk (here or in the exploration's research/); otherwise cite the
  section that carries the claim.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ reference only.
- Registered in ops/manifest.json `researchReports[]` + `currentSourceOfTruth[]`;
  `provenance.exploration` ↔ source exploration `links.goals`.
-->

- **Source exploration:** `explorations/openclaw-deployment-platform` —
  primary ledger:
  [`explorations/openclaw-deployment-platform/research/SOURCES.md`](../../../explorations/openclaw-deployment-platform/research/SOURCES.md).
- **Provenance:** research legs live in the exploration's `research/`
  directory (oss-landscape, x-com field notes, config-internals dive,
  adversarial review); synthesis in its `RESEARCH.md`. GATE C (2026-07-25)
  struck the dankserver migration — migration-framed passages in those legs
  are historical context, not the plan of record.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `config-internals` | Config load/write/state mechanics, writer inventory, HOLDS-WITH-CONDITIONS verdict | `openclaw/openclaw` @ `663c4fba` | ~90 `file:line` citations in [`openclaw-config-internals.md`](../../../explorations/openclaw-deployment-platform/research/openclaw-config-internals.md); 3 load-bearing ones independently re-verified (write-guard call in `src/config/io.write.ts:83`, strict Zod root in `src/config/zod-schema.root-shape.ts:35`, probe map in `src/gateway/server-http.ts:140`) | config ownership | reference (MIT upstream; facts, no vendored code) |
| `adversarial-review` | 12 source-grounded findings (2 CRITICAL: in-process guard ≠ filesystem immutability; SQLite migration stamps strand rollbacks) that produced the OS-enforcement + generation design | `openclaw/openclaw` clone evidence | [`adversarial-review.md`](../../../explorations/openclaw-deployment-platform/research/adversarial-review.md) | design gating | binding via exploration DECISIONS |

**How these inform implementation:** the driver renders canonical JSON only
and validates with the pinned candidate binary; the generation engine
snapshots shared+agent SQLite (incl. WAL) before any switch because
`user_version` stamps make naive rollback impossible; every writer surface
(esp. Telegram writeback) must take a graceful skip path under
`configWrites: false` — the P0 gauntlet proves all of this before code that
depends on it is written.

## 2. Upstream repositories & licenses

Local clones under `~/YeeBois/dev/` (decision 11 convention), pinned SHAs
verified in the exploration ledger:

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `github.com/openclaw/openclaw` @ `663c4fba` (`~/YeeBois/dev/openclaw`) | MIT (verified) | port-with-attribution; primarily reference for config/schema/state semantics | Config loader + merge order, TypeBox schema surface, state/config separation, `nix-mode-write-guard`, CLI/service semantics |
| `github.com/openclaw/nix-openclaw` @ `5f849be4` (`~/YeeBois/dev/nix-openclaw`) | **AGPL-3.0** (verified) | **CLEAN-ROOM only** — patterns, never code | What a first-party declarative config owner renders; state placement under immutable config |
| `github.com/openclaw/openclaw-ansible` @ `6c3c20b7` | MIT (verified) | port-with-attribution | Upstream's hardened install shape (unprivileged systemd) |
| `github.com/pavelzbornik/openclaw-vps-setup` @ `765dda6d` | MIT (verified) | port-with-attribution | Community 1Password secrets posture |
| `github.com/alchemy-run/alchemy` @ `306d15ee` | Apache-2.0 (declared; no LICENSE file in shallow clone — re-verify before any port) | reference/style | Effect-native IaC resource/error modeling (we stay on Pulumi) |
| `github.com/pandysp/openclaw-infra` @ `92704ace` | MIT (per README) | port-with-attribution | Pulumi + `systemd --user` + Tailscale deployment ordering, host verification |
| `github.com/schemalabz/nix-openclaw` @ `8ecf2181` (`~/YeeBois/dev/nix-openclaw-schemalabz`) | **NONE found** | **reference-only** | Read-only workspace vs mutable state-dir separation |
| `github.com/pulumi/pulumi-command` @ `207f9218` | Apache-2.0 (verified) | port-with-attribution (direct npm dep of `infra/`) | local Command semantics, triggers, secret-output handling |

## 3. External research sources

The full cited list (OpenClaw docs index survey of ~28 pages, OSS sweep
URLs, ~30 X post citations) lives in the exploration's ledger and legs:

- [`research/SOURCES.md` §3](../../../explorations/openclaw-deployment-platform/research/SOURCES.md)
  — docs.openclaw.ai pages (1password, secrets/config CLI, health, doctor,
  install/nix, SOUL.md, skills, sandbox/tool policy, local models, otel).
- [`oss-landscape.md`](../../../explorations/openclaw-deployment-platform/research/oss-landscape.md)
  — codex OSS/web sweep with inline URLs.
- [`x-com-field-notes.md`](../../../explorations/openclaw-deployment-platform/research/x-com-field-notes.md)
  — Grok x_search leg (community config-pain evidence).

## 4. In-repo capability references

- reuse: `infra/` workspace + `infra/src/internal/PulumiConfigSchema.ts`
  (`S.Class`-decoded Pulumi config, `optionalPulumiConfigFields`,
  `withPulumiConfigDecodeEffect`); `infra/src/AIMetrics.ts`
  (tagged-union deploy target, preflight→apply→health command chains);
  `@beep/onepassword-cli` (CLI wrapper style); `OnePasswordReference`
  (`packages/shared/domain/src/values/OnePasswordReference`); `@beep/schema`
  kits; `@beep/identity` composers; driver-local concurrent
  stdout/stderr/exit collection over `effect/unstable/process`.
- NET-NEW: `packages/drivers/openclaw` (desired-intent schema, render
  adapter, CLI wrapper, probes); OpenClawGeneration engine; workstation
  applicator; drift audit.
- drift flag (do not repeat): `@beep/onepassword-cli` imports from
  `@beep/shared-domain` against the drivers/shared boundary rule — the new
  driver must not depend on `shared/*`.

## 5. Cross-links & provenance

- Goal packet: [`SPEC.md`](../SPEC.md) (decision log seeded from the
  exploration), [`PLAN.md`](../PLAN.md), [`GOAL.md`](../GOAL.md).
- Source exploration:
  [`README.md`](../../../explorations/openclaw-deployment-platform/README.md),
  [`BRIEF.md`](../../../explorations/openclaw-deployment-platform/BRIEF.md),
  [`MAP.md`](../../../explorations/openclaw-deployment-platform/MAP.md),
  [`DECISIONS.md`](../../../explorations/openclaw-deployment-platform/DECISIONS.md)
  (29 dated entries through GATE C).
- Related goal context:
  [`goals/agentic-professional-runtime/docs/sdk-context-packet-contract.md`](../../agentic-professional-runtime/docs/sdk-context-packet-contract.md)
  (OpenClaw as thin SDK adapter — the firewall this substrate respects),
  [`goals/ai-metrics-stack`](../../ai-metrics-stack/README.md)
  (infra style precedent; dankserver as backup destination precedent).
- dankserver repo (local, private): `~/YeeBois/projects/dankserver` —
  problem evidence only; never a migration target (GATE C).
