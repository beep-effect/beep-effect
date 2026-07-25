# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `openclaw-workstation-agent` | Deploy a legal-focused OpenClaw agent on the workstation as immutable, generation-based, Pulumi+Effect-managed infrastructure — prototype gauntlet first, then driver, then live agent | none | reuse: `infra/` workspace + `infra/src/internal/PulumiConfigSchema.ts`, `infra/src/AIMetrics.ts` patterns, `@beep/onepassword-cli`, `OnePasswordReference` (`packages/shared/domain/src/values/OnePasswordReference`), `@beep/schema` kits, `@beep/identity`, `@beep/utils/Stream.collectProcessOutput`; NET-NEW: `@beep/openclaw` driver (desired-intent schema, render adapter, CLI wrapper, probes), OpenClawGeneration engine, workstation applicator, drift audit |
| `dankserver-openclaw-migration` | Retire the ~4790-line Ansible openclaw role by moving dankserver's gateway onto the generation platform via the remote-SSH applicator | `openclaw-workstation-agent` | reuse: everything candidate 1 ships + `@beep/tailscale` (remote transport facts), AIMetrics remote-command chain precedent; NET-NEW: remote-SSH applicator, split-ownership include bridge (if live writers can't all be retired at cutover), state-backend revisit |

Non-candidates (explicitly out of this packet): OpenClaw SDK-adapter work
(`goals/agentic-professional-runtime` owns it), voice stack, OS-level Ansible
replacement, bundle-patch porting.

## Sequencing

1. **`openclaw-workstation-agent` is the only first bet.** Its phase P0 is
   the four-prototype gauntlet (filesystem bypass/drift, non-interactive
   user-manager apply, same-ref rotation/reload, upgrade+failed-health
   rollback across SQLite stamps) — each maps to a GATE B decision in
   [`DECISIONS.md`](./DECISIONS.md); a failed prototype re-opens that
   decision in the goal's decision log before any implementation phase runs.
   Then: driver (schema + adapter + wrapper + probes) → generation engine +
   workstation applicator → live agent (Telegram + Control UI + proof
   skill).
2. **`dankserver-openclaw-migration` starts only after candidate 1's agent
   has run healthily long enough to trust the platform** (the goal's shaping
   sets the exact criterion). It inherits renderers and the generation
   engine wholesale and swaps the applicator; its own shaping decides the
   split-ownership bridge, bundle-patch remnant handling, and re-opens the
   remote-state-backend decision.
3. Post-migration options (not goals yet): OTel/diagnostics plugin tie-in to
   the ai-metrics stack; SDK-adapter enablement handoff to
   agentic-professional-runtime.

## First Vertical Slice

The smallest end-to-end proof for `openclaw-workstation-agent`, after the
gauntlet passes: **one minimal generation — pinned OpenClaw version, gateway
+ Control UI only (no channel, no skills), rendered from the desired-intent
schema into a root-owned config root, deployed by the workstation applicator
via `pulumi up` — reaching healthy liveness+readiness, surviving a drift
audit, and being replaced by a second generation (config change) through the
staged switch with a proven rollback path.** Verification: `pulumi up` twice
(create, then update), `openclaw config validate` against the candidate
binary, probe set green, deliberate manual config edit detected by the drift
canary, and a forced failed-health switch restoring the prior generation.
Telegram, providers, persona, and the proof skill land as subsequent
increments on the same machinery.

## Open Risks Inherited From The Brief

- Writer-surface completeness under the guard (Telegram skip paths included)
  — gauntlet + live soak own it.
- Auth bootstrap ceremony (SQLite credentials + declarative `auth.profiles`
  metadata) needs a worked runbook before the providers increment.
- Non-interactive `systemd --user` session contract — applicator preflight
  owns it.
- JSON5→canonical-JSON rendering discipline.
- Upgrade runbook vs blocked doctor migrations (`meta.lastTouchedVersion`,
  future-version guard).
- Preview fidelity limits of `command.*` resources; machine-identity binding
  is mandatory, drift audit lives outside Command.
- Render-adapter tracking of upstream release cadence; CI validates against
  the exact pinned binary.
- Node-not-Bun service runtime pin.
- Confidentiality is advisory-only in v1 — no real client data, period.
