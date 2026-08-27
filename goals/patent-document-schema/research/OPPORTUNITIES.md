# Opportunities

## 2026-08-27 — repair continued into full docgen after cheap-gate blockers

- **Work:** Running `bun run beep yeet repair` after implementing the typed
  patent-document vertical slice.
- **Evidence:** The cheap-gates tier reported goal-manifest and generated-alias
  drift, but repair continued into a full 130-package docgen rerun before those
  blocking inputs could be corrected.
- **Prevention:** Short-circuit expensive feedback work while cheap-gate
  blockers remain, or defer full docgen until the repaired cheap gates pass.
