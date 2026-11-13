---
title: "Migration keeps the proposals' finals; archived tombstones are verified by receipt only"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Switch the finals to #2865 and #2874; write tombstone closeouts with --adopt-merged and regenerate their stubs."
---

Agent decision (`research/design-pr-a.md` DN-22, DN-23). DN-23 is amended by orchestrator ruling 2026-11-12.

- DN-22: hold-ledger keeps #2755 as final and records #2865 as `supporting`. goal-packet-conflict-free-appends keeps #2869 and records #2874 as `supporting`. Under DN-1 and DN-2, #2755 verifies, and these are the finals the proposals name.
- DN-23 (ruling): the archived tombstones beep-effect-web-alchemy (#2583) and literal-kit-subset-algebra (#2080) get receipt-only verification. Refresh writes a workstation receipt, and nothing writes their manifest, README, `decisions/` or SPEC.md. A tombstone that could verify only with an attribution file stays unverified and is listed in `history/migration-<date>.md`; literal-kit-subset-algebra is expected to be one. The reason is that writing into a tombstone breaks the archive contract and leaves the generated stub out of date.

Migration rules: refresh each packet last, after every manifest write for it, because the digest covers `completionGate` and the closeout slot. Attribution files count once the orchestrator commits them (DN-6). The census and the launcher rewrite run again after the last `origin/main` merge. While PR A is open, the orchestrator holds any old-route adoption PR for the 11 migration packets.

Reverse: switch the finals to #2865 and #2874. For the tombstones, write closeout records with `set-status --final-pr N --adopt-merged`, regenerate the stub with `renderTombstoneReadme`, and add `decisions/**` to `TombstoneKeep.goals`.
