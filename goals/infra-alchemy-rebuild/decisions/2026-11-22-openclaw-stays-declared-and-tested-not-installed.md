---
title: "OpenClaw stays declared and tested, not installed (operator ruling)"
date: 2026-11-22
lane: "goals/infra-alchemy-rebuild-p4-rulings"
reversal: "run the attended OpenClaw bootstrap, deploy HostsOpenClaw, and restore the two criteria"
---

The operator ruled on 2026-11-22: OpenClaw is not installed on the workstation. `HostsOpenClaw`
(`packages/tooling/infra/infra-hosts/openclaw.alchemy.run.ts`) stays declared and tested, and is not deployed.

- **Why:** OpenClaw was never installed, and Pulumi never had a stack for it (decision `2026-11-13-hosts-no-pulumi-state`),
  so nothing live would be lost or left unmanaged. Installing it would add a root toolchain and a new 1Password
  service-account credential file for a service nobody runs.
- **Criteria amended:** the SPEC acceptance criterion and the P4 row named AI metrics and OpenClaw. They now ask that AI
  metrics deploys through `@beep/infra-hosts`, and that the OpenClaw stack is declared and tested there.
- **P6 unchanged:** the OpenClaw Pulumi program and its `infra/` files are still deleted with the other host program.

The same day the operator set the AI metrics session, which needs them present, for after P5, once the new runner fleet has
passed its proofs.

**Source.** The operator answered a structured prompt in the packet gate's T3 thread on 2026-11-22. The answers are quoted
as given, and each is the label of the option chosen:

- "Should it be installed?" (OpenClaw): "Don't install (Recommended)".
- "When should we do it?" (AI metrics): "After P5 (Recommended)".
