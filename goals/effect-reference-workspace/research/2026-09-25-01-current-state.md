# Current state census (2026-09-25)

Gathered by the grill session from the live workstation. Host paths under the home directory
are written in the `$HOME/...` form (the `knowledge:refs-check` gate rejects the tilde-relative spelling of paths under `YeeBois` and
`.local`); `~/.config/...` keeps the tilde as the portable convention the gate allows.
Secrets are redacted; only key names are recorded.

## Reference clones today (`$HOME/YeeBois/dev/`)

| Clone | Remote | Tracked files | Last commit | Worktrees | Graft |
| --- | --- | --- | --- | --- | --- |
| `effect` | `git@github.com:Effect-TS/effect.git` | 4278 | 2026-09-25 (`9a5a383cc6`, `main`) | primary + `effect-worktrees/docgen-enforce-examples` (`fix/docgen-enforce-examples-description-fences`) | structural only |
| `effect-tsgo` | `git@github.com:Effect-TS/tsgo.git` | 4702 | 2026-09-22 | primary only | none |
| `t3code` | `git@github.com:pingdotgg/t3code.git` | 23161 | 2026-09-24 | 6 | none |
| `opencode` | `git@github.com:anomalyco/opencode.git` | 7900 | 2026-09-24 | primary only | none |
| `effect-smol` | `git@github.com:Effect-TS/effect-smol.git` | — | 2026-07-14 | — | none (excluded, R2) |

## Existing `$HOME/YeeBois/dev/effect/graft/`

- `INDEX.md`: 1571 per-file wiring cards, 1182 carrying extracted symbols; no concept nodes (no
  deep tier has ever run).
- `.graph/wiring.json`: 19 MB (2026-09-16).
- `.cache/`: `ask-index.json` 10 MB; two extraction caches, `extract.496c9d83e6eb3668.json`
  (2026-09-12, 85 MB) and `extract.c3679fb5d24a63a0.json` (2026-09-16, 86 MB), each with a
  fingerprint. The 09-12 pair is stale and can be pruned during the move.
- `graft/` is untracked (`?? graft/` in `git status`); `.gitignore` and `.git/info/exclude` do
  not mention it.

## beep-effect provisioning surface

- `scripts/setup-effect-ref.sh`: `EFFECT_REF="${BEEP_EFFECT_CHECKOUT:-${HOME}/YeeBois/dev/effect}"`;
  clones if `<ref>/.git` is absent; links `<repo>/.repos/effect`; idempotent; relinks on drift;
  warns and stops if `.repos/effect` exists and is not a symlink.
- Test: `packages/tooling/tool/cli/test/setup-effect-ref.test.ts` (stubs `git` and `realpath`,
  asserts no GNU `realpath` dependency).
- `.gitignore:126` ignores `.repos/*`.
- `beep worktree new` (`packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts`,
  `runWorktreeNew`): `addWorktree` → `git submodule update --init --recursive` → `bun install`
  → `copyLocalFiles(WORKTREE_LOCAL_FILE_ENTRIES)` → summary. `WORKTREE_LOCAL_FILE_ENTRIES` =
  `.env`, `.claude/settings.local.json`, `CLAUDE.local.md`, `.idea/compiler.xml`,
  `.idea/effect.intellij.xml`. **No reference-link step exists.** The worktree created for this
  packet on 2026-09-25 came up with no `.repos/` directory at all.
- `Fleet.service.ts:91` `FLEET_SURFACE_EXCLUDE_PREFIXES` already excludes `.repos/` from fleet
  surface comparisons.

## Fleet link census (2026-09-25)

144 beep-effect checkouts (primary clones plus `*-worktrees/*`): **40 linked** to
`$HOME/YeeBois/dev/effect`, **104 missing** `.repos/effect`. All 30 numbered primary clones that have a
link point at `$HOME/YeeBois/dev/effect`. Full table: `2026-09-25-02-fleet-census.md`.

Clone roles observed: `beep-effect0` is the read-only graft owner (nightly `beep graft deep
refresh --owner $HOME/YeeBois/projects/beep-effect0`); `beep-effect2`, `6`, `7`, `10`, `11`, `12`
were clean on `main` at origin; `beep-effect` sat on `@slop/09-22-26`; `beep-effect4` on
`effect-v3-main-archive`.

## Live beep files naming the reference path (R13 sweep list)

Excluding frozen `explorations/**`, `goals/**`, `scratchpad/**`, and `graft/**`:

```text
AGENTS.md                                   (Tool Routing bullet; graft block)
README.md                                   (§"First-party history vs .repos/effect")
apps/labs/api-docs/DESIGN.md
greptile.json                               (ignorePatterns ".repos/effect/**")
packages/tooling/library/ai-metrics/test/ingest.test.ts
packages/tooling/tool/cli/test/ai-metrics-command.test.ts
packages/tooling/tool/cli/test/commitlint-config.test.ts
packages/tooling/tool/cli/test/fixtures/commitlint/github-squash-no-trailer.txt
packages/tooling/tool/cli/test/fixtures/commitlint/subtree-squash-merge.txt
packages/tooling/tool/cli/test/setup-effect-ref.test.ts
packages/tooling/tool/cli/test/worktree-fleet.test.ts
scripts/knowledge-refs-rewrite.rules.json
scripts/setup-effect-ref.sh
standards/effect-first-development.md       (~25 ../.repos/effect/... links)
standards/effect-vitest.inventory.jsonc
standards/schema-first-development-prompt.md (".repos/effect-v4" hedge at L64-66)
```

Plus the skills and agent that cite `.repos/effect` by relative path:
`.claude/skills/effect-first-development/SKILL.md:119-125`,
`.claude/skills/schema-first-development/SKILL.md:40-41`,
`.claude/skills/atom-reactivity-specialist/SKILL.md:99`,
`.claude/agents/effect-first-developer.md:21`. Because R5 keeps the `.repos/effect` name, most of
these need no path edit; the sweep is about prose that describes *where* the clone lives and
about adding the workspace routing line.

## beep nightly graft deep refresh (the env this packet reuses)

- Timer `beep-graft-deep-refresh.timer` → `.service`, last run 2026-09-25 02:34 CDT.
- `~/.config/beep-graft/env` keys: `GRAFT_PROVIDER=openai`, `GRAFT_BASE_URL=http://127.0.0.1:8317/v1`,
  `GRAFT_API_KEY=<redacted>`, `GRAFT_MODEL=claude-opus-5`, `GRAFT_LLM_RETRIES=12`,
  `DO_NOT_TRACK=1`, `GRAFT_DUMP_DIR=$HOME/.local/state/beep-graft/dump`,
  `GRAFT_SYNTH_MAX_TOKENS=32768`, `GRAFT_SYNTH_JOBS=4`.
- CLIProxyAPI `GET /v1/models` on 127.0.0.1:8317 listed `claude-opus-5` on 2026-09-25.
- Runbook: `docs/runbooks/graft-local-recovery.md` (deep-model section, ~L225-300) documents
  `GRAFT_SYNTH_MAX_TOKENS` (stock synth budget 8192 truncates opus-5 concept batches), the
  `env -i` allowlist, `--ignore-scripts`, and the mise shim resolution the unit relies on.
- Service implementation to mirror: `packages/tooling/tool/cli/src/commands/Graft/GraftDeep.service.ts`
  (`deepBuildStep` L139, `siblingBuildStep` L160, unit rendering ~L470-520,
  `REFRESH_STATUS_VERSION = "beep-graft-deep-refresh/v1"`).

## Toolchain gotcha hit while creating this packet's worktree

`$HOME/YeeBois/projects/beep-effect2/.envrc` (`use flake`, modified 2026-09-25 02:08) puts a nix-built
`bun 1.3.13` ahead of the mise `bun 1.4.2` on PATH. Under the nix bun, `bun run beep …` dies in
`@duckdb/node-bindings` with `libstdc++.so.6: cannot open shared object file` (the binding is a
glibc build; the nix bun's loader does not see `/usr/lib`). The same command succeeds with
`PATH=$HOME/.local/share/mise/installs/bun/1.4.2/bin:$PATH`. Lanes that call the beep CLI from a
non-interactive shell should prepend the mise bun. This is recorded, not fixed, by this packet.
