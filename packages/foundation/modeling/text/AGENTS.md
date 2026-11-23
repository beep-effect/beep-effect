# @beep/text

Text identity, anchors, selectors and occurrence identity.

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- Keep it domain-safe: no capability, driver, tooling, app, slice, server, table, UI, or live Layer dependencies, and no
  `@beep/rdf`. Source identity and anchoring live here; PROV-O stays in `@beep/rdf`.
- Keep it product-agnostic: no claim/evidence/IP-law semantics. Anchors point at source text; confidence and meaning
  belong to the consuming slice.
- Use schema-first models and `$TextId` identities.
- Before handing back a change, run `bun run beep quality package-verify @beep/text` from the repository root. Use `--quick` only for a justified lint+check subset; a failure arms the checkout's shared P0 inbox.
