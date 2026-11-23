# @beep/jsonc

JSONC parsing, editing and formatting as Effect schemas and pure functions

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- Before handing back a change, run `bun run beep quality package-verify @beep/jsonc` from the repository root. Use `--quick` only for a justified lint+check subset; a failure arms the checkout's shared P0 inbox.
- `Mint` is the one minting function for content-addressed ids. A new id domain
  declares its preimage with `definePreimage` and a committed golden vector; a
  changed preimage takes a new domain-tag version instead of re-hashing the old
  one (law `L0-2`, `test/ContentHash.laws.test.ts`).
