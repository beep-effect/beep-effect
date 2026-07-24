# Effect-native OpenClaw Deployment Platform — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy. Purpose: let an
implementing agent trace every decision back to its origin — a mined source
(repo + file:line), an upstream repo + LICENSE, an external citation, or an
in-repo brick.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ treat as reference
  only. State the discipline per repo.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Cluster / origin:** P3 research dispatch for the exploration packet:
  Fable docs-index survey + in-repo inventory, codex OSS/web landscape sweep,
  Grok x.com field leg, codex source-dive of the local OpenClaw clone.
- **Provenance:** research legs land as `research/*.md` files in this
  directory; synthesis in [`../RESEARCH.md`](../RESEARCH.md).
- **Local-clone convention (decision 11):** repos valuable for implementation
  or style — especially Effect-involved ones — are cloned to `~/YeeBois/dev/`
  and cited here with a pinned commit SHA. Clones are reference material for
  the human and for research; vendoring into `.repos/` is a separately
  triggered decision.

## 1. Mined source corpus

<!-- Populated by research/openclaw-config-internals.md findings (file:line
citations into the openclaw clone) as they are verified. -->

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `config-internals` | Config load/write/state mechanics, writer inventory, HOLDS-WITH-CONDITIONS verdict | `openclaw/openclaw` @ `663c4fba` | ~90 `file:line` citations in [`openclaw-config-internals.md`](./openclaw-config-internals.md); 3 load-bearing ones independently re-verified (write-guard call in `src/config/io.write.ts:83`, strict Zod root in `src/config/zod-schema.root-shape.ts:35`, probe map in `src/gateway/server-http.ts:140`) | config ownership | reference (MIT upstream; facts, no vendored code) |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `github.com/openclaw/openclaw` — local clone `~/YeeBois/dev/openclaw` @ `663c4fba10536a7148749f2b35fb5af6d54d3cb7` (v2026.7.2; note: dankserver pins 2026.7.1-2) | MIT (verified in clone `LICENSE`) | port-with-attribution; primarily reference for config/schema/state semantics | Config loader + merge order facts, TypeBox schema surface, state/config separation evidence, `nix-mode-write-guard` immutable-config mechanism, CLI/service semantics |
| `github.com/openclaw/nix-openclaw` — local clone `~/YeeBois/dev/nix-openclaw` @ `5f849be411261d4b5d4e06ca0becc4d23526ffda` (cloned 2026-07-24, depth 1) | **AGPL-3.0** (verified) | **CLEAN-ROOM only** — study the declarative-ownership pattern (module options → rendered config, state handling under immutable config); never port or vendor code | The design questions it already answered: what a first-party external config owner renders, where runtime state goes when config is immutable |
| `github.com/openclaw/openclaw-ansible` — local clone `~/YeeBois/dev/openclaw-ansible` @ `6c3c20b7380c5c581407563547f7beae4b2792ec` | MIT (verified) | port-with-attribution | Upstream's own hardened install shape (UFW/Tailscale/unprivileged systemd) as the baseline dankserver's role parallels |
| `github.com/pavelzbornik/openclaw-vps-setup` — local clone `~/YeeBois/dev/openclaw-vps-setup` @ `765dda6d959092c44e7491b8c481113c58790632` (cloned 2026-07-24, depth 1) | MIT (verified) | port-with-attribution | Community Ansible+Terraform with **1Password secrets** — closest secrets posture to ours |
| `github.com/alchemy-run/alchemy` — local clone `~/YeeBois/dev/alchemy` @ `306d15eec042e130776025c3433202be1427a281` (cloned 2026-07-24, depth 1) | Apache-2.0 (declared in `package.json` + README badge; no LICENSE file at root of shallow clone — re-verify before any port) | reference/style — Effect-native IaC engine patterns (typed errors, resource modeling); we stay on Pulumi | How a pure-Effect IaC engine models resources, providers, and typed failures |
| `github.com/pandysp/openclaw-infra` — local clone `~/YeeBois/dev/openclaw-infra` @ `92704acefabf716cd43644bbf2f4a6e14606f2e8` (pre-existing clone) | MIT (per repo README license section, cited in `oss-landscape.md`) | port-with-attribution | Closest existing implementation: Pulumi (Hetzner) + Ansible handoff + `systemd --user` + Tailscale; deployment ordering + host verification scripts |
| `github.com/schemalabz/nix-openclaw` — local clone `~/YeeBois/dev/nix-openclaw-schemalabz` @ `8ecf2181da99779b1edae1ccdbff027bc7e4fdce` (cloned 2026-07-24, depth 1) | **NONE found** | **reference-only** (unlicensed) | Read-only Nix-managed workspace vs mutable state-dir separation pattern |
| `github.com/pulumi/pulumi-command` — local clone `~/YeeBois/dev/pulumi-command` @ `207f921866f2066fcef83a8aafbb558d30130928` (cloned 2026-07-24, depth 1) | Apache-2.0 (verified) | port-with-attribution (it is also a direct npm dependency of `infra/`) | local/remote Command + CopyToRemote semantics, triggers, secret-output handling |

## 3. External research sources

Cited in [`../RESEARCH.md`](../RESEARCH.md) §External Landscape (docs index
fetched 2026-07-24 from https://docs.openclaw.ai/llms.txt):

- https://docs.openclaw.ai/llms.txt — docs index (survey basis)
- https://docs.openclaw.ai/gateway/1password — native 1Password secret resolution
- https://docs.openclaw.ai/cli/secrets — `openclaw secrets` CLI
- https://docs.openclaw.ai/cli/config — config get/set/patch/schema/validate
- https://docs.openclaw.ai/gateway/configuration-reference — config reference
- https://docs.openclaw.ai/gateway/configuration-examples — schema-accurate examples
- https://docs.openclaw.ai/concepts/typebox — TypeBox as gateway-protocol source of truth
- https://docs.openclaw.ai/gateway — gateway runbook
- https://docs.openclaw.ai/cli/health, https://docs.openclaw.ai/gateway/health — health surfaces
- https://docs.openclaw.ai/gateway/doctor — doctor: checks + config migrations
- https://docs.openclaw.ai/gateway/gateway-lock — singleton guard
- https://docs.openclaw.ai/gateway/multiple-gateways — profiles/isolation
- https://docs.openclaw.ai/install — install hub
- https://docs.openclaw.ai/install/nix — declarative Nix install
- https://docs.openclaw.ai/install/ansible — upstream Ansible install
- https://docs.openclaw.ai/install/development-channels — release channels/pinning
- https://docs.openclaw.ai/cli/update — update + restart
- https://docs.openclaw.ai/concepts/soul — SOUL.md persona surface
- https://docs.openclaw.ai/concepts/agent-workspace — workspace contract
- https://docs.openclaw.ai/cli/skills — skills install/verify
- https://docs.openclaw.ai/clawhub/cli — ClawHub CLI + lockfile
- https://docs.openclaw.ai/gateway/sandbox-vs-tool-policy-vs-elevated — guardrail layers
- https://docs.openclaw.ai/gateway/security/audit-checks — security audit catalog
- https://docs.openclaw.ai/concepts/model-failover — auth-profile rotation
- https://docs.openclaw.ai/gateway/local-models — custom OpenAI-compat endpoints
- https://docs.openclaw.ai/gateway/local-model-services — on-demand local model services
- https://docs.openclaw.ai/gateway/opentelemetry — diagnostics-otel plugin

Additional external sources live on disk in:

- [`oss-landscape.md`](./oss-landscape.md) — codex OSS/web sweep: upstream
  install/deploy docs, `pandysp/openclaw-infra`, `pulumi-command` API docs,
  dynamic-provider limitations, Automation API docs, Alchemy site,
  Nexxiot case study, `clawfleet/ClawFleet`, `docker/compose-for-agents`,
  `loginctl` manual (each with inline URLs).
- [`x-com-field-notes.md`](./x-com-field-notes.md) — Grok x_search leg:
  ~30 X post citations (deploy anecdotes, config-pain posts, Effect-IaC
  prior art) plus web repos surfaced alongside.

## 4. In-repo capability references

Full table with per-brick usage lives in [`../RESEARCH.md`](../RESEARCH.md)
§In-Repo Capability Inventory. Summary:

- reuse: `infra/` workspace + `infra/src/internal/PulumiConfigSchema.ts`;
  `infra/src/AIMetrics.ts` target/command patterns; `@beep/onepassword-cli`;
  `@beep/shared-domain` `OnePasswordReference` value; `@beep/schema` kits;
  `@beep/identity` composers; `@beep/utils/Stream.collectProcessOutput`.
- reuse later (migration phase): `@beep/tailscale`.
- NET-NEW: `packages/drivers/openclaw` (schema + CLI wrapper + health probe);
  target-agnostic renderer layer; local-vs-remote executor abstraction over
  `@pulumi/command`.
- drift flag: `@beep/onepassword-cli` → `@beep/shared-domain` import vs the
  drivers/shared boundary rule (align-stage item).

## 5. Cross-links & provenance

- Packet: [`../README.md`](../README.md), [`../CAPTURE.md`](../CAPTURE.md),
  [`../DECISIONS.md`](../DECISIONS.md), [`../RESEARCH.md`](../RESEARCH.md)
- Related goal context:
  [`goals/agentic-professional-runtime/docs/sdk-context-packet-contract.md`](../../../goals/agentic-professional-runtime/docs/sdk-context-packet-contract.md)
  (OpenClaw as thin SDK adapter),
  [`goals/ai-metrics-stack`](../../../goals/ai-metrics-stack/README.md)
  (infra style precedent, dankserver deploy target)
- dankserver repo (local, private): `~/YeeBois/projects/dankserver` — Ansible
  openclaw role + group_vars, Terraform bootstrap (facts summarized in
  [`../CAPTURE.md`](../CAPTURE.md))
