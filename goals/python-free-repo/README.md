# Remove Python from the repo, port photo-face to onnxruntime-node, and ban Python in tracked source

## Status

Lifecycle: `completed-retained`

**Paused by operator ruling (finish board, 2026-11-13).** Hygiene work with no execution yet and no urgency. No lane is working on it; resume with `bun run beep goals set-status python-free-repo active` when it is picked up. Decision: [`decisions/2026-11-13-finish-board-ruling-pause.md`](./decisions/2026-11-13-finish-board-ruling-pause.md).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Remove Python from the repo, port photo-face to onnxruntime-node, and ban Python in tracked source (graduated from explorations/pulumi-to-alchemy).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/python-free-repo/GOAL.md
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

P4 Close — all four lanes are done. #3283 (photo-face on onnxruntime-node), #3293 (skill scripts) and #3296 (probe deletions, workflow and r2-cache Python, small ports) merged on 2026-11-14. The final PR deletes the last two tracked `.py` files, lands the `no-tracked-python` law, the lefthook hook, the cheap-tier CI lane and the AGENTS.md line, and carries the closeout and the reflection.

## Latest Evidence

- 2026-11-06 grill session decisions D4, D8, D15 in [`explorations/pulumi-to-alchemy/DECISIONS.md`](../../explorations/pulumi-to-alchemy/DECISIONS.md).
- Inventory by location in `SPEC.md` Target Surfaces.
- Per-file triage of all 308 tracked Python files: [`research/triage.md`](./research/triage.md).
- photo-face parity against the retained Python: [`research/photo-face-parity.md`](./research/photo-face-parity.md).
- infra/r2-cache port: [`research/r2-cache-port.md`](./research/r2-cache-port.md).
- Friction receipts: [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md). Reflection: [`history/reflections/2026-11-13-claude.md`](./history/reflections/2026-11-13-claude.md).
- On the final head `git ls-files '*.py'` is empty, and `bun run beep laws no-tracked-python --check` reports tracked_python_files=0.

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
