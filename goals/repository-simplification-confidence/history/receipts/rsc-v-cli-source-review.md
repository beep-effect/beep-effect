# CLI source review receipt

Source head: `a0b0df414732a07b4449f07e1cafd397cf995af0`.
Route: separate read-only Claude CLI, `claude-opus-5-5`, medium, existing subscription.
All 37 source hashes independently verified by the worker.

**Terminal zero for head `a0b0df4147`.** All earlier findings are fixed, and I found nothing new to act on at any severity. This was a read-only review. I ran no typecheck, tests, repo scan or other gates, and wrote nothing.

## Snapshot
- **Digests:** `review-source-digests-r6.json` and `-r7.json` differ in one entry only, `single-project-emit.test.ts` (`cff05f5d…` → `1b9ce27a…`). The other 36 files are unchanged, so they still rest on the R1 full review and the R2 re-review. I compared the digest files only and did not re-hash anything on disk.
- **Coverage:** I read the whole file (`single-project-emit.test.ts:1-363`) and traced every row in all four tables (`:212-226`, `:232-250`, `:256-324`, `:331-351`). Each one gives the result the test expects.

## R6 repair: fixed
- **The new check (`:83`):** before any launcher parsing, if any word starts with `-` and contains compiler/build tokens, `compilerArguments` returns `O.none()`. The segment then goes to the conservative lexical check.
- **New rows (`:295-298`):** each script stays a single word after the tokenizer, and none contains any of `` \ ` ( ) < > $ ``, so they all reach `:83`.
  - `env -S'tsc --force'`, `env --split-string='tsc -b .'`, `npm exec --call='tsc --force'` and `npx --call='tsc -b .'` each start with `-` once `env`/`npx`/`npm exec` are split off.
  - In each, `tsc` is preceded by `'`, and the build flag is preceded by a space and followed by a space or `'`.
  - Result: `None`, then the lexical check, then flagged.
- **The check can only add flags, never remove them:**
  - If one word satisfies both regexes at `:137-138`, the space-joined segment does too.
  - Inside the word, `tsc` can't match at the start because the word starts with `-`. Every match boundary that falls at the word's edge becomes a space or the end of the text after joining.
  - So `:83` never turns an existing catch into a pass, and every one of main's compiler catches still holds.
- **Inert rows are unchanged:** I checked each "should pass" row for a word that starts with `-`.
  - These have no `tsc` in the dash word: `--package`, `-u`, `--filter`, `--filter-prod`, `-w`, `--forceful`, `-p`, `--`, `-b`.
  - `npx --package 'tsc -b' echo ready` and `bunx tsc -p 'folder --force/tsconfig.json'` keep the compiler text in a separate quoted word that doesn't start with `-`.
  - None of these rows changes result.

## Earlier findings: all still fixed
- **R1 P2 (Bun fallback):** `:101-108`.
- **R1 P3 (`pipe` import):** `:8`.
- **R2 P3 (pnpm/npm fallback):** `:109-125`.
- **R3-a (npm options):** `run` is the only definite "no" (`:123`), and `--loglevel` takes a value (`:113`).
- **R3-b (command substitution), R4 (parentheses), R5 (attached redirect):** all go through the whole-script check at `:146`.
- **R6 (option with an attached command):** `:83`.

## Checked, not findings
- **Quoted options:** `env '-S' 'tsc --force'` and `npx "--call=tsc --force"` are caught a different way. The quoted word isn't treated as a launcher option, so it becomes the "command", which falls to `Match.orElse` and then the lexical check.
- **Extra flags in some odd scripts:** `:83` also scans words after `echo`, and after the compiler's own arguments. A script like `echo --x='tsc -b'` would now be flagged. That fits a conservative review tripwire, and a grep found no live `beep:build` or `beep:check` script using these forms.
- **Forward reference:** `:83` uses `containsCompilerBuildTokens`, which is defined later at `:136`. It only runs at call time, so there's no temporal-dead-zone problem. I found no `no-use-before-define` rule in `.oxlintrc*`, `eslint.config.*` or `biome.json*`, but I didn't run lint, so whether lint passes is unproven.

## Limits
- **Not run:** typecheck, tests, lint, docgen, the repo manifest scan and any runtime behaviour.
- **Gaps main had too (not regressions):** other spellings of the build flag (`-B`, `--b`, `-build`), quote-split or backslash-split tokens such as `--for"ce"` and `tsc\ -b`, and full shell or launcher-grammar evaluation, which `:140-145` already says the guard doesn't attempt.
- **Out of scope:** inventory, goals, RDF and Pacer.
