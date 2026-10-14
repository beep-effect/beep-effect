### sol-3-1
- file: scratchpad/effected/git/GitConfig.ts:699
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; `GitConfig.set`, `append`, and `addSection` promise to create the requested entry or section while preserving existing values.   evidence: Read-only probes against the reviewed source reproduce this with `GitConfig.parseResult("[core]\nx=a\\")`: `append("core", undefined, "x", "b")` succeeds but returns `getAll("core", undefined, "x") === ["ax = b"]`; `set("core", undefined, "y", "b")` succeeds but leaves `y` absent and changes `x` to `"ay = b"`; `addSection("remote", "o")` succeeds but creates no remote section and changes `x` to `"a[remote o]"`. Git 2.56.0, reading the resulting text through `git config --file /dev/stdin --list -z`, confirms those interpretations. Inputs ending in backslash-LF or backslash-CRLF reproduce the same failures in both the lab and pinned oracle. The separator decisions at lines 393 and 965 have the same problem. These edit failures are distinct from round-2 git-r7’s parser acceptance and value-replacement repair.
- failure: A newline added after an EOF backslash becomes a continuation, and an existing final continued newline leaves the logical value open. Newly inserted keys and section headers become part of the preceding value, silently corrupting configuration despite a successful `Result`.
- fix: Make the separator logic terminate an unfinished logical value before inserting new content. Add the additional line ending needed for a bare EOF backslash or a final LF/CRLF continuation, and apply that logic consistently in `appendAtEof`, `append`, and `insertEntry`. Add regressions asserting preservation of the original value and existence of the newly requested key/section; record the verified upstream correction under §14.

### sol-3-2
- file: scratchpad/effected/git/internal/config.ts:454
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; git-config value fidelity and surgical replacement semantics.   evidence: A read-only differential probe with input `"[core]\nx=a \\\n\n"` returns `"a \0"` from Git 2.56.0 via `git config --file /dev/stdin --get -z core.x`, while both the lab and pinned oracle decode `"a"`. A tab before the continuation, CRLF continuations, and a comment on the following line reproduce the loss. Calling `set("core", undefined, "x", "z")` produces `"[core]\nx=z \\\n\n"`: Git reads `"z "`, although the lab reports `"z"`. The continuation branches advance `i` without updating `significantDecoded` or `significantEnd`. The newly accepted EOF-backslash branch likewise loses preceding whitespace; `scratchpad/test/git/GitConfig.test.ts:225` currently pins that incorrect expectation for `"first \t\\"`.
- failure: Whitespace immediately before a continuation is significant to Git but discarded by the scanner. Its raw span also remains outside the replacement, so `set` can leave significant whitespace attached to the replacement value. The lab can therefore disagree with Git both before and after an edit.
- fix: Commit pending decoded whitespace when consuming a continuation or the permitted EOF backslash, and extend the raw replacement span through that token. Preserve trimming of ordinary unquoted trailing whitespace. Add LF, CRLF, tab, comment, EOF, and `set` fidelity regressions; correct the existing EOF-whitespace assertion and record the new evidence under §14.

### sol-3-3
- file: scratchpad/effected/git/internal/config.ts:502
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; git-config’s treatment of leading unquoted whitespace.   evidence: Read-only probes with `"[core]\nx=\"\" b\n"` and `"[core]\nx=\\\n b\n"` return `"b\0"` from Git 2.56.0 through `git config --file /dev/stdin --get -z core.x`. Both the lab and pinned oracle return `" b"`. The control input `"[core]\nx=\" \" b\n"` correctly returns `"  b"` in all three implementations. The scanner skips whitespace only immediately after `=`, then unconditionally appends later whitespace to `decoded`.
- failure: An empty quoted prefix or an initial continuation causes leading unquoted spaces to enter the decoded value. `GitConfig` lookups and `Gitmodules` field decoding consequently return different strings from Git for valid configuration text.
- fix: Skip unquoted whitespace while the decoded value is still empty, including after empty quotes and initial continuations. Retain explicitly quoted or escaped whitespace and preserve source offsets. Add public parsing regressions with the quoted-space control case, and record the verified upstream correction under §14.

### sol-3-4
- file: scratchpad/effected/git/GitCommand.ts:2299
- class: docs   severity: backlog
- standard: D4; the `GitCommand.configList` example should demonstrate a usable configuration read.   evidence: The example calls `GitCommand.configList(".gitmodules", "local")`, producing both `-f .gitmodules` and `--local`. The equivalent read-only invocation `git config -f /dev/stdin --local --list -z` exits 129 with `error: only one config file at a time`. Compilation and argv inspection do not detect that Git rejects the combination.
- failure: The example teaches callers to construct an invocation that cannot enumerate configuration.
- fix: Use `GitCommand.configList(".gitmodules")` and remove `--local` from the expected argv. If demonstrating a scoped read, use a separate example with the file argument omitted.

REQUIRED: 3
BACKLOG: 1