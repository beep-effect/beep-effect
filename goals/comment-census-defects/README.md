# Comment Census Defects

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Fix the defects the comment census found under comments, each as a small PR.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/comment-census-defects/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P4 Close — all ten defects fixed; this PR carries the reflection and closeout.

## Latest Evidence

All ten SPEC defects reproduced on `origin/main` 809947c and were fixed with failing-then-passing tests, one PR each: #3463 (node-sync cwd), #3464 (qa-capture EPERM), #3465 (git working-diff ref), #3469 (nlp-mcp SSRF), #3470 (wink spans), #3471 (onnx tensors), #3475 (YAML escaped comment), #3476 (runtime lint baseline), #3479 (coverage floors), and the final PR (oip-web dead anchors). Reflection: [`history/reflections/2026-11-22-claude.md`](./history/reflections/2026-11-22-claude.md).

## Notes

Evidence and the four-goal map: [`explorations/comment-law/MAP.md`](../../explorations/comment-law/MAP.md).
