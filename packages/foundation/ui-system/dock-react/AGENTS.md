# @beep/dock-react

React adapter for the `@beep/dock` workspace kernel.

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package.
- The kernel edge is one-way: this package imports `@beep/dock`; the kernel
  never imports React or this package.
- `@beep/pretext/browser` is allowed here only as an overridable default layer
  (the authorized narrow ui-system → drivers edge; see
  `standards/architecture/DECISIONS.md` 2026-07-14).
