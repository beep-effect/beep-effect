# Effect Reference Workspace — Sources & Provenance

- **Source exploration:** none. This packet was authored directly from a `/grill-me` session on
  2026-09-25 (Fable 5.1 orchestrator, operator present). Rulings:
  `2026-09-25-00-aligned-design.md`.
- **Provenance:** live workstation census in `2026-09-25-01-current-state.md` and
  `2026-09-25-02-fleet-census.md`; graft semantics read from the machine-local Graft checkout.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `graft-workspace` | Workspace federation semantics | Graft (`$HOME/YeeBois/dev/Graft`, v0.18.0) | `src/graph/workspace.ts:1-24`, `:97-101` | multi-repo mode | reference |
| `graft-children` | Child discovery (no symlinks, no dot-dirs) | Graft | `src/graph/scopes.ts:329-341` | why move, not link | reference |
| `graft-fuse` | Rank fusion across separate repos | Graft | `src/ask/fuse.ts:25-29` | federated `ask` | reference |
| `graft-build-flags` | `--follow-nested-repos`, `--only-dir`, `--no-gitignore` | Graft | `src/cli.ts:345-369` | build policy | reference |
| `graft-readme-multi` | "Monorepos, submodules & multi-repo folders" | Graft | `README.md:458-493` | layout choice | reference |
| `beep-provisioner` | Effect reference provisioner | beep-effect | `scripts/setup-effect-ref.sh` | S1 base | extend |
| `beep-provisioner-test` | No-GNU-realpath property | beep-effect | `packages/tooling/tool/cli/test/setup-effect-ref.test.ts` | S1 test | extend |
| `beep-worktree-new` | `runWorktreeNew` bootstrap steps | beep-effect | `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts` (`WORKTREE_LOCAL_FILE_ENTRIES`, `runWorktreeNew`) | S2 hook | extend |
| `beep-graft-deep` | Nightly deep refresh service and unit rendering | beep-effect | `packages/tooling/tool/cli/src/commands/Graft/GraftDeep.service.ts:139-195`, `:439-520` | S2 idioms | reuse |
| `beep-graft-runbook` | Deep-model env, synth budget, `env -i` hardening | beep-effect | `docs/runbooks/graft-local-recovery.md` (deep-model section) | R4, R9 | reference |
| `beep-agents-graft` | Denied graft commands, CLI-only decision | beep-effect | `AGENTS.md` graft block; `.claude/settings.json` permissions | R3 | reference |
| `beep-models-seed` | `graft.deep` → `claude-opus-5` × `proxy-workflow`; `codex.heavy` → `gpt-6-astra` medium | beep-effect | `packages/tooling/tool/cli/src/commands/Models/Models.seed.ts:9`, `:106-113`, `:161` | R4, R11 | reference |

**How these inform implementation:** S1 keeps the provisioner's shape (idempotent, relink on
drift, portable path resolution) and adds manifest-driven members and the workspace link. S2
copies the GraftDeep service's step runner, output bounds, status file, notification, and
`SystemdUnit` rendering rather than inventing a second timer idiom. The move is dictated by
graft's `Dirent.isDirectory()` child discovery.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Effect-TS/effect | MIT | reference-only | indexed as a workspace member; never vendored |
| Effect-TS/tsgo | MIT (`LICENSE`, Copyright (c) 2026 Effect) | reference-only | indexed as a workspace member |
| Graft (`$HOME/YeeBois/dev/Graft`) | see its `LICENSE` | reference-only | CLI consumer; no code ported |

## 3. External research sources

None. Every claim traces to files on this workstation named above.

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| `@beep/repo-cli` Graft group | `packages/tooling/tool/cli/src/commands/Graft/` | reuse idioms |
| `@beep/repo-cli` Worktree group | `packages/tooling/tool/cli/src/commands/Worktree/` | extend (`linkReferences` step) |
| systemd unit rendering | `packages/tooling/tool/cli/src/internal/systemd/SystemdUnit.ts` | reuse |
| `@beep/schema` `LiteralKit` | `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:732` | reuse |
| `commands/Refs/` | new group | NET-NEW |
| `scripts/references.json` | new manifest | NET-NEW |

## 5. Cross-links & provenance

- Sibling packets: `goals/model-routing-sync` (owns the `graft.deep` and `codex.heavy` bindings
  this packet cites), `goals/agent-pool-doctrine` (lane doctrine).
- Decision log entries to append at P4: graft workspace as the sanctioned reference index
  (`standards/memory-architecture/04-decision-log.md`, alongside the 2026-09-08 graft entry).
- Grill transcript: not stored; rulings are the durable record.
