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
| (pending) | config-internals source-dive citations | `openclaw/openclaw` | see `openclaw-config-internals.md` | config ownership | reference |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `github.com/openclaw/openclaw` — local clone `~/YeeBois/dev/openclaw` @ `663c4fba10536a7148749f2b35fb5af6d54d3cb7` (v2026.7.2; note: dankserver pins 2026.7.1-2) | MIT (verified in clone `LICENSE`) | port-with-attribution; primarily reference for config/schema/state semantics | Config loader + merge order facts, TypeBox schema surface, state/config separation evidence, CLI/service semantics |

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

Further external sources arrive with `research/oss-landscape.md` (codex sweep)
and `research/x-com-field-notes.md` (Grok leg) and are appended here.

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
