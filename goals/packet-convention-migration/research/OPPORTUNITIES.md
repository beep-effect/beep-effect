# Opportunities — friction receipts

## 2026-08-26 — Semantic delta rejects an uncommitted command addition without naming the dirty-tree cause

- **What happened:** full `bun run beep yeet verify` reached
  `knowledge semantic-delta` after the migration added two Goals subcommands.
  The lane failed with `Static command surface provenance does not match the
  current-checkout command tree.` A direct comparison of the statically
  derived working-tree command graph with the live graph found no difference.
  The mismatch was between the committed HEAD archive, which did not yet
  contain the new commands, and the dirty live checkout.
- **Evidence:** `bun run beep knowledge semantic-delta` reported the mismatch;
  the source-only `KnowledgeCommandSurface.buildStaticCommandTree` projection
  and the live `rootCommand` projection compared equal in the same checkout.
- **What would have prevented it:** when the CLI surface is dirty, either
  derive the semantic-delta HEAD-side static tree from the working tree or
  report that exact-head proof must follow a commit. Include the first command
  path that differs so a real parser drift remains distinguishable.
- **Disposition:** tooling fix — keep the fail-closed parity check, but make
  dirty-worktree attribution explicit.
- **Owner:** knowledge semantic-delta maintainers.
