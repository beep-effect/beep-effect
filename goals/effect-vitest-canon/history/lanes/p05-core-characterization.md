# P0.5 core characterization

Status: complete. Focused pre-refactor evidence, not conformance acceptance.

Only this report and newly owned private characterization files may change.
Source is the sibling `effect-vitest-filesystem` checkout. Root owns packet state,
verification, promotion and publication. Memory remains 20/21 on the reported
conformance suite; the copy source/destination decision remains user-pending.

The current session has unrestricted filesystem access and approval policy
`never`; no managed-profile mismatch was observed. No permission prompt is needed.

## Setup and evidence boundary

- Observed Node `v24.20.0` at the nvm Node path, Bun `1.4.2` from the requested
  command-scoped mise PATH, host locale `en-US`; installed Effect and
  `@effect/vitest` are `4.0.0-rc.112`, Vitest `4.1.11`.
- Root's `.beep/p05-conformance-review/memory.config.ts` uses an explicit private
  include and the public scratchpad import. This lane reuses that routing but
  uses its own config/cache/output paths. `.gitignore:114–115` ignores `.beep/*`.
- Private evidence directory: `~/.cache/beep/effect-vitest-canon/p05-core-characterization-astra-l53sHd`.
  `source-before.sha256` records 895 files: the four scratchpad targets, all
  non-ignored test-utils/repo-cli package files, platform patch and installed
  NodeFileSystem source, root manifest/lock/Bun version/TypeScript configs.
  These hashes prove content only within that enumerated scope, not git status.
- The existing 17 tests remain untouched. Planned additions are 12 cases covering
  sharing, independent acquisition, buffer ownership, inode identity/defaults,
  signed cursor/errors, numeric boundaries, ordering and glob grammar/bounds.
- Source distinction: recursive `readDirectory` uses code-unit ordering
  (`volume.ts:1886–1933`); clone/detach traversal uses localeCompare
  (`:795,1128,1211`). Copying a tree then reading public inode IDs can expose
  allocation order without importing internals or changing the pending conflict.

## First-run friction (preserved)

- Private TypeScript 6.0.3 compiler run 1 exited 2: unused `encoder` (TS6133),
  and four TS2339 errors because upstream `FileSystem.File` does not expose
  `.fd`. These are probe-authoring errors, not inherited core failures.
  Raw diagnostics: `compiler-run-1.txt`. Correction: remove the unused binding;
  use a fresh public `make` volume for cursor checks and assert descriptor 4 in
  the public error payload after one writeFile acquisition and one explicit open.
  No private property, cast, or impossible flag input is needed.
- Pinned-source preflight caught curried `Str.repeat(count)(text)` before
  execution. The early `suite-first-run.ts` snapshot is a preflight draft, not
  a claim that those bytes ran; executable snapshots are named per actual run.

## Initial results

- Compiler run 2: exit 0, no diagnostics after the two probe corrections.
- Node runtime run 1: **12/12 passed**, exit 0, reported duration 356 ms.
  Worker output confirms actual Node v24.20.0, no Bun runtime, locale en-US.
  The suite and raw output are preserved as `suite-runtime-run-1.ts`,
  `node-run-1.log` and `node-run-1.json`. No runtime expectation was adjusted.
- Confirmed edges so far: negative cursor -3 survives failed non-empty reads/
  writes and successful empty IO; errors carry BadResource and descriptor 4.
  Listing uses `Z,a,é`; copied inode allocation follows `a,é,Z` in this locale.
  Mode `0xffff_ffff` produces full stat mode `0o107777`; raw input bits are not retained.

## Completed runtime evidence

Both runtime runs used exactly the same 261-line suite, with **12 cases passed,
zero failures and zero skips on each runtime**. Bun run 1 exited 0 and reported
255 ms. Its worker reported Bun 1.4.2 at the requested mise executable and en-US;
its Node compatibility version string was v26.3.0, not a separate Node execution.
Raw evidence: `bun-run-1.log`/`.json`. No runtime retry was necessary or performed.

Case names below correspond to numbered names in the suite and raw reporters.
All test imports use public `@beep/scratchpad/memfs`, `@effect/vitest` and
`@effect/vitest/utils`; observations use only public make/layer and FileSystem.

| Case | Concrete passing assertions on Node and Bun |
|---|---|
| 01 writes a marker in one test body | Marker initially absent, write then read `first body`. |
| 02 reads and updates the previous body's marker | Separate test-body scope in the same it.layer block reads the prior marker, appends, reads `first body+second body`. |
| 03 separate make acquisitions isolate observable files | First volume's path absent in second; same path then holds `first` and `second` independently. |
| 04 writes and reads own their byte buffers | Write a subarray view, mutate backing bytes, still read ABC; mutate readFile/readAlloc results, stored bytes remain ABC; mutate a buffer after handle.write, stored result remains DBC. |
| 05 hard links share inodes and bytes while copies do not | Source/alias inode IDs equal and nlink=2; copy ID differs and nlink=1; alias write changes source to `changed`, copy remains `before`. |
| 06 fresh root tmp and file modes and owners are exact | Fresh root lists only tmp; root/tmp type Directory, full mode 0o40755, uid/gid=0; file type File, full mode 0o100644, uid/gid=0, nlink=1. |
| 07 signed seek defers errors and zero-length IO preserves the cursor | Absolute -1 then relative -2 returns -3; read/readAlloc/write/writeAll fail with PlatformError→BadResource, module FileSystem, exact method, descriptor 4, description `Invalid file position`; read buffer and file bytes unchanged. Empty read/write succeed with 0 and retain -3; seek to 0 restores reading `content`. |
| 08 mode and owner numeric boundaries preserve data on failure | For -1, 1.5, 2^32, NaN and +Infinity: chmod and each chown input reject with BadArgument, exact method and mode/uid/gid descriptions. Original mode/owners/bytes unchanged. Maximum uint32 accepted: masked stat mode 0o107777, uid/gid=4294967295. No invalid compile-time flag cast is used. |
| 09 recursive listing order differs from locale-ordered clone allocation | Listing is pre-order with directories Z,a,é and children Z.txt,a.txt,é.txt. Copied public stat inode IDs advance 1–12 in a,é,Z directory/child order. Glob returns the exact sorted nine file paths. This observes allocation via public metadata, not a parser helper. |
| 10 glob escapes and classes match literal names | Escaped star/question/backslash match their literal filenames; [a-b] yields a,b; [!a-b] yields hyphen,c; escaped hyphen class yields hyphen. |
| 11 glob braces and explicit dot segments preserve hidden-file behavior | Nested brace alternatives match a.txt,b.txt,c.md. **/*.txt omits dotfiles/hidden directories; explicit dot prefix or [.] includes dotfile; explicit .hidden path finds its file; **/.*.txt finds root and visible-directory dotfiles. |
| 12 glob accepts 256 alternatives and rejects 257 without mutation | 256 alternatives find item0/item255; 257 fail BadArgument/glob with `brace expansion exceeds 256 alternatives`; 257 nested braces fail with `brace nesting exceeds 256 levels`. Listing and both file contents remain unchanged. |

## Commands and reproducibility

All commands run from the filesystem worktree. Every compiler/runtime command
has prefix `PATH="$HOME/.local/share/mise/installs/bun/1.4.2/bin:$PATH"`.
Complete executable commands, including absolute outputs, are in `commands.md`
in the evidence directory. No bun test, package proof, global config or source
rewrite was used.

```sh
node node_modules/typescript/lib/tsc.js --project .beep/p05-core-characterization/tsconfig.json --pretty false
node node_modules/vitest/vitest.mjs run --config .beep/p05-core-characterization/vitest.config.mjs --configLoader native --reporter verbose --reporter json --outputFile <evidence>/node-run-1.json --no-color
bun node_modules/vitest/vitest.mjs run --config .beep/p05-core-characterization/vitest.config.mjs --configLoader native --reporter verbose --reporter json --outputFile <evidence>/bun-run-1.json --no-color
```

Config limits collection to this suite, one worker, ordered/nonconcurrent tests,
and an owned `.beep/p05-core-characterization/.vite` cache. The first two tests
intentionally depend on ordered shared-volume state; do not randomize or run the
second alone. Public constructor acquisition and test-body scopes own resources.
For a future promoted-core comparison, change only the import to
`import * as Subject from "@beep/test-utils/MemoryFileSystem"`; retain this snapshot
and use new raw-output filenames. There is no requirement to expose private models.

## Source immutability

Before/after inventories each contain **895 identical SHA256 records**, including
every enumerated non-ignored test-utils and repo-cli file, the conformance helper,
patch, source engine and manifest/config inputs. Both manifest files have SHA256
`6b2c70db400333d6c0ed9f3bebb845e997becb3c1f06c3c39a7c19bcf9cd6ed3`.
The installed patched runtime JS also matches in the separate before/after files.
Selected identical before→after content hashes (paths relative to source worktree):

| File | SHA256 before = after |
|---|---|
| scratchpad/memfs/internal/volume.ts | `06db3607f02b7a5434914a6179b5914910c6eb5ee5a1373b872216bdeea6d30f` |
| scratchpad/memfs/MemoryFileSystem.ts | `0602e3ab19dcd5339436f53621f43e3a28e30368191c3d6cc3194e9aedb06600` |
| scratchpad/memfs/index.ts | `e7ff0ee2159946b2647c06637eeee1f6a6440fa40f55bdf243f56ad9595765ff` |
| scratchpad/test/MemoryFileSystem/MemoryFileSystem.test.ts | `8854f8286f63808e4a15183aa8a9d9fe50521edba39b5a2bdfc3d38223ea8bb3` |
| packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts | `7a088666d2734dbc27089e8d5a4faac36c79787b01f069c20baab7a3d824922e` |
| patches/@effect%2Fplatform-node-shared@4.0.0-rc.112.patch | `6a6360bd4412d585c76c2f122eda593160ab7523380138e70c02c462c0a6b6e0` |
| packages/tooling/test-kit/test-utils/package.json | `24403441e545150f1f51e0e2315d9b5ef6226f57fcf0d2a6327349a105f14f0e` |
| packages/tooling/tool/cli/package.json | `afcc48072032175baf36b3a7ea79950d274f1bea5e14aba48c4ff60cba7c9d0c` |

Executable suite SHA256: `ff4f2527d00374b00b2087e32e335dd01c2b59108444dd785a0b75d80cce118b`.
Raw compiler failure, successful runs and before/after hashes remain separate
files; no earlier evidence/report was rewritten. Only the new report and owned
private suite/config/cache/evidence paths changed. D5's documentation is untouched.

## Interpretation and handoff

- The locale-dependent inode allocation order is characterization for these
  en-US runtimes, not a newly invented portable FileSystem requirement. Directory
  listing/glob order and clone allocation order must not be conflated in a refactor.
- Negative seek and zero-byte IO behavior, delayed descriptor failures, and mode
  masking are inherited observations, not proposed fixes. Preserve them pending
  an explicit behavior decision. No engine runtime failure was found in these cases.
- Private compiler success covers this probe and its imported closure, not the
  future schema rewrite or package acceptance. Existing 17 cases were reused as
  design evidence, not recopied or rerun. No conformance suite was rerun here.
- Effect-first guidance shaped scoped tests/public imports/assertion helpers;
  Unslop tightened this report. No agents, web research, approval or waiver was used.
- **Still unresolved:** copy metadata choice; green Node/Bun/Memory conformance;
  green-conformance prerequisite to promotion; future refactor verification and every PR gate. D1–D14
  and Root's Codex CLI/Grok routes remain intact. Stop after this completed evidence.
