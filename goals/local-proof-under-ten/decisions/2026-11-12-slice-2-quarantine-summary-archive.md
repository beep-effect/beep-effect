---
title: "Slice 2 (PERIL-10): quarantine summary line and aged-entry archive"
date: 2026-11-12
kind: checkpoint
lane: "fix/peril-10-quarantine-summary"
reversal: "Revert the slice 2 PR; move archived entries back from <admission root>/quarantine-archive into quarantine/ if any is needed."
---

Slice 2 lands PERIL-10's code half. `quality scheduler status` prints the quarantine as one line (count, oldest age read from the `.<nowMillis>` suffix, archive directory); `--json` keeps every path. The scheduler's reap pass (`repairDeadAdmissionState`, run by admission attempts and `quality scheduler reap --apply`) moves quarantine entries older than 7 days into `<admission root>/quarantine-archive` under an exclusive claims lock, never overwriting and never deleting (ruling D17: archive first, retire nothing). The status snapshot stays read-only, and leases, tickets and claims are never touched. The beep-heavy retirement in the orchestrate skill stays open as slice 4.

Prerequisite drift recorded on 2026-11-12: COVE-02 landed in #3115, MEAS-01 with MEAS-04 in #3118; SCHE-09, MEAS-02 and MEAS-07 are still open. The PLAN's HOST-01 co-carry note is moot because HOST-01 part a landed alone in #3111. Open PR #3130 (goal yeet-async-merge-and-stacks) adds `Yeet/internal/PatchIdentity.ts` and a head-move classifier that carries the review window across GitHub-made unchanged rewrites (cascade, restack) and fails closed on merges, so PERIL-09 (keep the anchor across a diff-preserving merge of main) remains open and should build on that classifier once #3130 merges.
