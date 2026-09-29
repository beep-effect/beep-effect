# Opportunities

Friction ledger for `explorations/effect-schema-parity`. Record a receipt at
the moment the friction happens, never at closeout: what you were doing, the
evidence (command, error text, PR or file), and what would have prevented it.
This repo is public: redact secrets, write home paths as `$HOME/...` rather
than the tilde form, drop session and machine ids, quote only the minimal
identifying error text.

## 2026-09-28 — Inventory tools pass only because the reference clone has not moved

- **Doing:** reopening the packet at decompose and planning the inventory
  refresh at `inventoryPin` `e5f7d12af9`.
- **Evidence:** both prototype tools hard-assert the reference working tree.
  `research/tools/schema-inventory.ts:25-26` throws unless
  `git -C .repos/effect rev-parse HEAD` equals the hard-coded pin, and `:66`
  throws "Dirty upstream source" unless the working-tree bytes equal the
  `git show` bytes; `research/tools/verify-schema-inventory.ts:16-18` and
  `:31-33` repeat both checks. On 2026-09-28 they pass only because
  `referenceHead` happens to equal the pin; the next nightly
  `pull --ff-only` of `$HOME/YeeBois/references/effect/effect` breaks both.
- **Would have prevented it:** read the pin from the root `package.json`
  catalog and every source byte through `git -C .repos/effect show
  <inventoryPin>:<path>`, with no HEAD or working-tree assert. The planned
  `effect-schema-inventory` lint must inherit that shape.

## 2026-09-28 — The exploration had no friction ledger, and the template ships none

- **Doing:** recording the first reopen friction.
- **Evidence:** `explorations/effect-schema-parity/research/OPPORTUNITIES.md`
  did not exist; `explorations/_template/research/` holds only `SOURCES.md`.
  The goal ledger header this file copies tells writers to use `~` for home
  paths, which the knowledge refs gate flags in live exploration files.
- **Would have prevented it:** an `OPPORTUNITIES.md` in
  `explorations/_template/research/` with the `$HOME/...` rule in its header.

## 2026-09-28 — `beep worktree new` defaults the branch to `feat/<name>`

- **Doing:** cutting the packet-only lane, which needs a `docs/` branch.
- **Evidence:** `defaultWorktreeBranch` returns `` `feat/${name}` ``
  (`packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts:100`),
  so a docs lane must pass `--branch docs/<name>` explicitly.
- **Would have prevented it:** a `--prefix` option, or a line in the command
  help naming `--branch` for non-feature lanes.

## 2026-09-28 — A zsh loop variable named `path` silently rewrote PATH

- **Doing:** Lane A placing all 55 `CAPTURE.md` paths at the pin with
  `git cat-file -e`.
- **Evidence:** `for path in ...` in zsh rebinds the tied `PATH` array, so
  every lookup reported MISS and `wc: command not found` followed.
- **Would have prevented it:** never use `path` (or `cdpath`, `fpath`) as a
  loop variable in agent shells; a note in the lane recipe.

## 2026-09-28 — Grounding counts named no counting unit

- **Doing:** Lane A verifying "`Schema.ts` grew from 541 to 598 export names".
- **Evidence:** the same pin yields 541→598 unique (kind, name) pairs, 549→606
  raw declaration lines, and 362→392 distinct names. The grounding report
  stated only the first without saying which it was.
- **Would have prevented it:** every count in a grounding report names its
  unit and the command that produced it.

## 2026-09-28 — The F03 idiom regex matches a file name, not an export

- **Doing:** Lane B reconciling the SchemaUtils census with `idiom-census.mjs`.
- **Evidence:** `research/idiom-census.mjs:18` searches for
  `withConstructorDefaults(`, which is a file name; the exports are
  `withNoneDefault` and `withConstantDefault`, so the F03 census missed 1,982
  production occurrences, the largest SchemaUtils surface.
- **Would have prevented it:** census by exported symbol from the barrel's
  export list, never by file name.
