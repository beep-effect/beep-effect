# Effect Module Paths

Import every Effect module from its dedicated public leaf path, including nested
modules such as `effect/cli/Command` and `effect/http/HttpClient`. This file is the
only place in the repository (outside `patches/`) that spells out the retired
`unstable` paths, so agents searching for an old path land here.

## The move

Effect [#8354](https://github.com/Effect-TS/effect/pull/8354) (merged
2026-09-22) moved every module out of the `effect/unstable/` namespace to a
top-level path, with no compatibility re-exports. Two follow-ups renamed paths
again: [#8365](https://github.com/Effect-TS/effect/pull/8365) renamed `httpapi`
to `http-api`, and [#8382](https://github.com/Effect-TS/effect/pull/8382)
folded the `arbitrary` barrel into the single `effect/Arbitrary` module.

| Retired path | Current path |
| --- | --- |
| `effect/unstable/<module>` | `effect/<module>` (`ai`, `cli`, `cluster`, `devtools`, `encoding`, `eventlog`, `http`, `net`, `observability`, `persistence`, `process`, `reactivity`, `rpc`, `schema`, `socket`, `sql`, `workers`, `workflow`) |
| `effect/unstable/httpapi` | `effect/http-api` |
| `effect/unstable/arbitrary`, `effect/unstable/arbitrary/Arbitrary` | `effect/Arbitrary` |
| `packages/effect/src/unstable/<module>/` | `packages/effect/src/<module>/` (`httpapi` is `http-api/`; `arbitrary/Arbitrary.ts` is `Arbitrary.ts`) |
| `packages/effect/dist/unstable/<module>/` | `packages/effect/dist/<module>/` (same two exceptions) |
| `packages/effect/{test,typetest,dtslint}/unstable/<module>/` | `packages/effect/{test,typetest,dtslint}/<module>/` (directory names unchanged) |

Validate a path against the installed package (`node_modules/effect/package.json`
`exports`) or the Effect reference checkout (`.repos/effect`), never from
memory. Training data predates the move.

## Still `@stability unstable`

The move changed paths, not stability. The relocated modules still carry
`@stability unstable`, so the `@effect/tsgo` rules `unstableApiUsage`,
`experimentalApiUsage`, and `apiStabilityLeak` stay off in `tsconfig.base.json`
(declared in `tsgoDisabledRules`, enforced by `beep quality tsgo-rules`).

The tag is also no reason to avoid a module: use any `@stability unstable`
Effect module or feature wherever it fits, instead of hand-rolling what it
provides. It warns that the API may change on an Effect bump, not that the
module is unfit for production (Code Laws in `AGENTS.md`).

## Enforcement

`bun run beep laws retired-effect-paths --check` (`lint:retired-effect-paths`)
fails on any retired path in a git-tracked text file and prints the
replacement. Allowlisted: this file, `patches/`, and `.gitleaksignore`. A
patch's removed and context lines are the vendor's published bytes and must
match upstream for the patch to apply; a `.gitleaksignore` entry is a
`commit:path:rule:line` fingerprint of a historical commit, where the old path
was the real one.

## Decision log

Grilled 2026-10-14 (operator ruling: rewrite every reference, no historical
copies).

| # | Decision | Reason | Reverse by |
| --- | --- | --- | --- |
| D1 | Rewrite every retired path in the repository, including completed goal packets, explorations, scratchpad, and research packets. | Old paths in historical prose misdirect agents that read them as current. | `git revert` of the migration commit. |
| D2 | Research packets are rewritten despite the immutability law in `research/README.md`; that README records the exception. | Operator ruling D1 overrides packet immutability for retired module paths. | Remove the exception line. |
| D3 | Quoted upstream text is rewritten too. Effect URLs that pointed at a retired path are re-pinned to the new path at commit `74d19304da`. | Re-pinning keeps the links resolvable after the path rewrite. | Restore URLs from git history. |
| D4 | `patches/` is exempt. | Removed and context lines must match the vendor's bytes. | None needed; the patch goes away when drizzle-orm publishes against `effect/sql`. |
| D5 | This file is the single canonical record of the mapping. | One allowlisted file keeps the gate simple and gives searchers one landing page. | Move the table, update the allowlist. |
| D6 | The regression gate is a new law over all git-tracked text, not an extension of `laws effect-imports`. | Most stale references live in prose and JSON, which the import law does not read. | Delete the law and its lint script. |
| D7 | Agent memory and rule files outside the repo are rewritten too; session transcripts are not. | Memory is read as current guidance; transcripts are logs. | Not applicable (outside the repo). |
| D8 | Rewrite, record, and gate ship in one PR. | The gate lands green against a clean tree. | Revert the PR. |
| D9 | `.gitleaksignore` is exempt, like `patches/`. | Its fingerprints name the path as it was in the fingerprinted commit; rewriting them un-ignores those findings. | None needed. |

## Per-module enforcement

`bun run beep laws effect-imports --check` rejects imports through both the
root barrel and public nested barrels. The checker discovers nested barrels
from the installed Effect export map and their namespace re-exports, then
validates each destination against the public exports. Leaf imports remain
valid, including named functions from `effect/Function`.

Use the same command with `--write` for mechanical repairs. Run `--mode jsdoc`
and `--mode markdown` for examples; `--check --enforce-documentation` makes
those checks blocking. Unknown bindings and unsupported barrel usages require
review and fail the check. The write command never guesses their destinations.

On 2026-10-14, a published `@effect/tsgo` 0.53.0 compiler probe verified that
`preferNamespaceImport` reports `Command` imported from `effect/cli` and
suggests `effect/cli/Command`. It also reports the required named `pipe` import
from `effect/Function` and named type imports from leaf modules. Its upstream
rule documentation marks it as non-fixable. The installed 0.51.1 compiler does
not ship that rule. Keep the compiler pin unchanged for this migration: the
existing import law enforces barrel avoidance without changing leaf import
syntax or the Function exception.

Source: [upstream preferNamespaceImport rule](https://github.com/Effect-TS/tsgo/blob/main/docs/rules/prefer-namespace-import.md).

The follow-up migration extends the law, rewrites code and examples, checks
idempotence, and ships in one PR. It creates no goal or exploration packet.
The previous miss occurred because the checker only registered the root
`effect` barrel; relocated nested barrels were outside its mapping.
