# Opportunity-wave synthesis — grill #3 agenda (2026-08-04)

Inputs: o1–o5 reports (this dir) + OPPORTUNITIES.md wave-2 items (9–16).
PR-A (in flight: gates diet → preflight wave → instruments) and PR-B (queued)
are the existing vehicles; each decision below picks a vehicle.

## Researched items (o-reports)

1. **Attempt journal** (o1-B): fold into PR-A instruments — otherwise new
   instrumentation overwrites its own history from day one. Schema-first
   NDJSON, two event types. → Recommend: PR-A. [small]
2. **Incremental jsdoc inventory** (o1-A): dedicated PR; shard cache +
   mandatory cold/full parity mode; modeled 230s → 8–25s with an explicit
   rejection criterion. → Recommend: PR-C after PR-A/B. [medium]
3. **Turbo cache reality** (o2): misses are 93.6% whole-sweep zero-hit groups
   (global busts / force / cold), NOT key churn. → Recommend: (a) hunt the
   force/global-bust triggers as part of PR-B's cache work (o2 lists them),
   (b) cross-clone LAN cache becomes the real fix — spike after PR-B.
   [PR-B + spike]
4. **`yeet ship` porcelain** (o3-B): state resolver over existing primitives,
   stacked on the PublishScope fix. → Recommend: PR-C (after the fix lands in
   PR-A and proves itself). [medium]
5. **Single-process battery** (o3-A): keep process boundaries for real tools,
   inline recursive repo-CLI launches only. → Recommend: separate PR after
   instrument timing quantifies the spawn tax. [medium, measure-first]
6. **Integration split** (o4-A): 3 serial / 22 parallel via two turbo task
   names, sequential passes. → Recommend: PR-A (it's a Tasks.ts + turbo.json
   + package-script change alongside the other lane work). [small-medium]
7. **Coverage lane** (o4-B): per its report — scope/architecture change +
   failure-mode fix with falsification tests. → Recommend: PR-C. [medium]
8. **Instantiation stages** (o5): stage-4 one-line import (honest partial,
   −3.06M on md) and the PROVED BlockRepair leaf-boundary (−86.8%) land as
   two small PRs anytime; agents/ontology protocol-boundary PR follows;
   stage 3 stays a spike with an ≤8M exit gate. → Recommend: two quick
   independent PRs (PR-D1/D2) — they're src-only, tiny, high-value. [small ×2]

## Wave-2 judgment calls (no dedicated research needed)

9. **Lane parallelization re-measure**: post-#548-merge census RSS re-run,
   then revisit — schedule as the packet's standing ritual trigger. [ritual]
10. **Runner right-sizing DOWN**: wait a week of post-merge hosted data (same
    watch as the Test Unit/Docgen bump question — one review). [watch]
11. **Docgen escalation narrowing**: real but design-sensitive; PR-C with the
    other docgen work. [medium]
12. → covered by 3.
13. **Failure excerpts in GITHUB_STEP_SUMMARY**: cheap, high agent-leverage;
    workflow-only change. → Recommend: PR-B (it's already touching check.yml).
    [small]
14. **Schema barrel stage 2**: memory-lever; fold into the instantiation PR
    series after D1/D2. [medium]
15. **Vitest transform consolidation**: measure-first spike (projects mode has
    correctness implications for per-package isolation). [spike]
16. **Fleet housekeeping**: operator chore, not a PR — offer a script. [chore]

## Proposed final shape

- PR-A (in flight): + attempt journal + integration split.
- PR-B: + force/global-bust fixes + step-summary failure excerpts.
- PR-D1: Md.safe subpath import (one line + probe evidence).
- PR-D2: BlockRepair leaf boundary (proved −86.8%).
- PR-C ("pipeline 2"): incremental jsdoc inventory + ship porcelain +
  coverage lane + docgen escalation narrowing.
- Spikes: grit collector; cross-clone cache; single-process battery; vitest
  projects; stage-3 html (≤8M exit gate).
- Rituals/watches: RSS re-measure post-merge; runner sizing review;
  opportunities ledger reviewed each grill.
