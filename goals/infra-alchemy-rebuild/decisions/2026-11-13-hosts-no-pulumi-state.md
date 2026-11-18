---
title: "No Pulumi state exists for AI metrics or OpenClaw; the host stacks adopt what is on the host"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p4-hosts"
reversal: "None needed: nothing is imported or destroyed in Pulumi. If a stack is later found in the backend, export it outside the repo and record it in a new decision before any pulumi destroy."
---

Checked 2026-11-13 by the launching session: the Pulumi backend `s3://oip-law-pulumi-state` holds no stack for the AI metrics project and none for OpenClaw, so P4's cutover rule (export, then `pulumi destroy`) has nothing to act on for either; the programs describe deployments that exist on the hosts outside Pulumi state. Adoption therefore happens on the host, not in a state store. AI metrics: the data volume is looked up by name, the Compose container and unit are retired by the RetireCompose step, and the Tailscale Serve port state file is reused in place. OpenClaw: generations are content-addressed under the config root, so the first Alchemy apply writes a new generation directory beside any earlier ones and flips the `current` pointer through the same apply script; the snapshot and rollback paths are unchanged. The generation id changes once at this move, because the proof skill's recorded source path changed from `infra/src/OpenClawArtifacts.ts` to the new package. The Pulumi programs leave with `infra/` in P6; no `pulumi stack rm` is owed.
