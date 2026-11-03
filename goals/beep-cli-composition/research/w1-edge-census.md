# W1: full-edge census

The W1 and W7 exit gates in `SPEC.md` need a census of every import edge in
`@beep/repo-cli`, not a sample. `ops/edge-census.ts` is that census:

```sh
bun goals/beep-cli-composition/ops/edge-census.ts            # summary
bun goals/beep-cli-composition/ops/edge-census.ts --json     # every forbidden edge
bun goals/beep-cli-composition/ops/edge-census.ts --gate w1  # exit 1 on any library-to-tool edge
```

## Method

- Every `import`, `export ... from`, `import type` and dynamic `import()` in
  `packages/tooling/tool/cli/src` is read and resolved relative to its file.
  Type-only edges count, because a split package needs the dependency either
  way. Specifiers that leave `src` or that name no tracked module (source held
  in a template string) are not edges.
- Each file gets a future home. Command groups map to the tools in the
  design record (`research/design-record.md`, "Verified package map");
  `src/internal/**` maps to the libraries; `bin.ts`, `bin-main.ts`,
  `commands/Root.ts` and `internal/dispatch/` map to the composition app;
  the D4 groups map to their apps; `src/test/*.test-kit.ts` facades only
  re-export and are not counted.
- A library-to-tool edge is a library file importing a tool or app file (W1
  gate). A cross-tool edge is a tool file importing another tool or an app
  (W7 gate).
- Library content that still sits under a command group is listed in the
  census `carveOuts` table. Each wave adds the files it carves out before it
  moves them, so the W1 gate holds for every later wave too (SPEC D25).

## W1a result

Base `origin/main` at 5200ca9f35.

| Measure | Before | After W1a |
| --- | --- | --- |
| Files | 955 | 958 |
| Edges | 4,648 | 4,661 |
| Library-to-tool edges | 7 (13 counting the verifier's issue files) | 0 |
| Cross-tool edges | 127 | 124 |

The seven library-to-tool edges and their fixes:

| Edge | Fix |
| --- | --- |
| The tmpfs janitor (then in `internal/repo-run/`) to `Worktree/Worktree.constants.ts` | The tmpfs and residue janitors (`TmpfsReap`, `ResidueReap`, their schemas, `ResidueTerminalLane` and its live probe) move to `commands/Worktree/internal/`; the `tmpfs-reap` and `residue-reap` commands move to `commands/Worktree/Janitor.command.ts`. Both stay registered under `beep quality`. |
| The residue janitor (then in `internal/repo-run/`) to `Yeet/internal/Reply.schemas.ts` | Same move: the janitor is worktree tooling, so it reads the Yeet reply drafts from inside the yeet tool. |
| The registration-geometry probes (then in `internal/cli/`) to three `DeletePackage/internal/` files (3 edges) | `RegistrationGeometry` has one consumer, `delete-package`, so it moves to `commands/DeletePackage/internal/RegistrationGeometry/`. |
| The publication ledger (then in `internal/publication/`) to `Models/Models.exchange.schemas.ts` (2 edges) | The ledger serves `models apply` and `skills` publication, both in beep-harness, so it moves to `commands/Models/internal/`. |

W1a also moves `quality cache-policy` into `commands/Cache/CachePolicy.command.ts`
(the command path is unchanged) and gives the CLI's own entry module one
constant, `REPO_CLI_ENTRY_PATH` in `internal/cli/EntryPath.ts`, used by the
four commands that respawn the CLI (quality task children, the AI-metrics
forwarder timer, lane retirement and the agent-effectiveness eval lanes). The
lint policy fingerprint layout keeps its own parameterized path. Cache's task
router resolves its entry from `import.meta.url` and needs no constant.

## W1b

W1b adds the verifier's must-fix files (PLAN, "Verifier must-fix list") to
`carveOuts`, which turns the issue classification and parsing files into
library content with six edges into the yeet and quality tools, and splits
the schemas they need.
