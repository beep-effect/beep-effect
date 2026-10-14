# Git — round-3 merged inventory

Seats read: part-1/{grok,sol,fable}.md and part-2/{grok,sol,fable}.md (six reports), with both adjacent BRIEF.md files and BRIEF.grok3.md route supplements. The third seat in each part ran as grok-4.7 medium under the recorded Fable fallback. Part-1 Fable and part-2 Grok reported no findings.

Reviewed commit: `3ad7b305790c7f0903f6d55766c55186745ba2d1`. Merge checkout: `@lab/effected-2`, HEAD `843c475bfdf0e57f6f5d813d956a92b06bd73cdc`; the requested branch was `@lab/effected`. No branch switch was made. Source and tests for git have no diff against the reviewed commit. The pinned oracle is `~/.cache/beep/effected-port/upstream/af7566a9da2eff169cb74955efcc5ede1e5de9f8/packages/git`.

Counts: 10 submitted records (9 required, 1 backlog), merged into 6 required and 1 backlog; 0 codemod and 0 rejected; 2 repair groups. Duplicate seat records contribute evidence and are not rejections. `standards/effect-laws.allowlist.jsonc` contains zero entries for `scratchpad/effected/git/**`, so no `allow-<n>` records are needed.

The operator revision, all subsequent operator rulings, D1–D20, §12.4–12.5 and §14 control this merge. The briefs' blanket S2/S3-green statement does not override the requested docs/JSDoc/coverage/vitest-canon deferral. Evidence below attributes runtime probes to the reporting seats; this merge ran no tests, diagnostics or runtime probes. Only the two inventory artifacts are authored. Ledger and README Port-notes recording belongs to the central deviation codemod, outside repair-group ownership.

## Required

### git-r3-1
- file: scratchpad/effected/git/GitCommand.ts:295,316; scratchpad/effected/git/Git.ts:1027,1202
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; fixed NUL-delimited log framing and CommitInfo.sha's object-id contract.
- evidence: Part-1 Sol's read-only differential probe used the lab and pinned-oracle command constructors with `log.showSignature=true`. Git exited 0, but log stdout began `No signature\n\0<sha>…`, producing `GitCommandError` with detail `unparseable log output: log output did not open with a record separator`. commitInfo stdout began `No signature\n<sha>\0N\0…`; both implementations returned a sha containing the banner. Adding `--no-show-signature` restored both prefixes while retaining `%G?`. Part-1 Grok independently identifies the same framing defect; part-2 Fable cites the part-1 probe. Current constructors still omit the flag.
- failure: Repository or global signature-display configuration makes successful history reads fail and silently corrupts the object id returned by commitInfo. The ordinary output fixtures and green gates miss this configuration-dependent case.
- fix: Add `--no-show-signature` to both GitCommand.log and GitCommand.commitInfo, preserving `%G?` and message bytes. Update the exact argv assertions in GitCommand.test.ts, Git.test.ts and GitLog.test.ts; add real-Git regressions for both methods with repository-local `log.showSignature=true` in integration/GitSurface.int.test.ts, restoring fixture config afterward. The verified upstream correction needs central §14 recording, not a README or ledger assignment to this group.
- seats: part-1/grok:grok-3-1; part-1/sol:sol-3-1; part-2/fable:fable-3-1

### git-r3-2
- file: scratchpad/effected/git/Git.ts:1198,1207,2703
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; standards/effect-first-development.md EF-1/EF-3; Effect owns fallibility and runtime boundaries.
- evidence: Part-1 Sol reports `git log -1 --format=%H%x00%G?%x00%B '3ad7b305790c7f0903f6d55766c55186745ba2d1^{tree}'` exiting 0 with empty stdout/stderr; an equal-endpoint revision range does likewise. Feeding that output through lab commitInfo defects with `Schema validation failed` at S.asserts, and the pinned oracle also defects. Current parseCommitInfo does not check either separator and the success handler directly evaluates it. `git log --format=%h:%s -- Git.ts` and `git show fc96c12ac8 -- Git.ts` show that step 2 replaced an unsafe signature-status cast with S.asserts; S1 commit b35380a409 also forced law changes. This is a demonstrated parser bug, not an unforced change to restore.
- failure: A permitted caller-supplied revision that selects no commit escapes the declared typed error channel as a schema defect.
- fix: Return a non-throwing parse result from parseCommitInfo; require both separators and a valid signature-status field. Map absent or invalid fields to GitCommandError with kind `failed`, the invocation's redacted args, cwd and an explanatory detail, following Git.log's parse-failure handling. Preserve successful message bytes and use schema-derived validation without unsafe casts. Add empty/tree-ref output regressions in Git.test.ts and a real tree-ref or empty-range regression in integration/GitSurface.int.test.ts. Central §14 recording handles the verified upstream correction; do not restore the removed cast.
- seats: part-1/grok:grok-3-2; part-1/sol:sol-3-2

### git-r3-3
- file: scratchpad/effected/git/Git.ts:1845,4859
- class: schema   severity: required
- standard: D5, D11; standards/ARCHITECTURE.md §5; standards/effect-first-development.md EF-12b; standards/schema-first-development-prompt.md “Schema owns pure data.”
- evidence: SshFromEnv remains a handwritten interface with command, program and variant Option<string> fields. Git.layer constructs that payload and make/resolveSshEnv use it for transport precedence. It is named, reused configuration data, with no schema-derived shape or identity/field annotations. The source demonstrates the internal-model violation left by the stated green gates.
- failure: The SSH configuration payload has a compile-time-only definition instead of the required executable schema contract.
- fix: Replace the module-local interface with an identity-annotated SshFromEnv schema using S.Option(S.String) fields and derive the type from it. Preserve Option representation, blank-value handling, precedence, transport behavior and the existing construction semantics; introduce no new input restrictions or public export. Retain the SSH environment/precedence regressions in Git.test.ts.
- seats: part-1/sol:sol-3-3

### git-r3-4
- file: scratchpad/effected/git/GitConfig.ts:393,699,965
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; append/set/addSection must create the requested entry or section and preserve existing values.
- evidence: Part-2 Sol's probes start with `[core]\nx=a\\`. append(x,b) succeeds but getAll(x) becomes `["ax = b"]`; set(y,b) leaves y absent and changes x to `ay = b`; addSection(remote,o) creates no remote section and changes x to `a[remote o]`. Git 2.56.0 confirms those interpretations with `git config --file /dev/stdin --list -z`. Final backslash-LF and backslash-CRLF inputs reproduce the failures in lab and oracle. Current appendAtEof, append and insertEntry choose separators only from the last newline, ignoring an open logical continuation. This differs from the closed round-2 EOF-acceptance/value-replacement finding.
- failure: Inserted keys or headers are consumed into the preceding value even though the edit reports success.
- fix: Make insertion separators terminate an unfinished logical value before new content. Supply the extra line ending needed for a bare EOF backslash or a final LF/CRLF continuation consistently in appendAtEof, append and insertEntry, while preserving ordinary formatting and existing values. Add append, set and addSection regressions in GitConfig.test.ts for all three endings, asserting both the old value and the new key/section against Git semantics. Central §14 recording handles this verified upstream correction.
- seats: part-2/sol:sol-3-1

### git-r3-5
- file: scratchpad/effected/git/internal/config.ts:448,454,459; scratchpad/test/git/GitConfig.test.ts:225
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; git-config value fidelity and surgical raw replacement spans.
- evidence: Part-2 Sol reports Git 2.56.0 reading `[core]\nx=a \\\n\n` as `a ` (NUL-terminated), while lab and oracle decode `a`. Tabs, CRLF continuations and a following comment reproduce the loss. set(x,z) leaves `x=z \\\n\n`, which Git reads as `z ` while the lab reports `z`. Continuation branches advance i without committing significantDecoded/significantEnd; the accepted EOF-backslash branch also loses preceding whitespace. GitConfig.test.ts:225 explicitly expects `first` for the raw value `first \t\\`. Commit b7736181ef added EOF acceptance for the round-2 verified bug; the new evidence challenges its remaining whitespace behavior rather than requesting restoration of the old rejection.
- failure: Significant whitespace is lost during parsing and left outside the replacement span, so edits can retain unwanted value bytes while reporting the requested value.
- fix: Commit pending decoded whitespace when consuming a continuation or the allowed unquoted EOF backslash, and extend the significant raw span through that token. Continue trimming ordinary unquoted trailing whitespace. Add LF, CRLF, tab, following-comment, EOF and set-fidelity regressions in GitConfig.test.ts and internal/config.coverage.test.ts; correct the EOF-whitespace expectation at GitConfig.test.ts:225 without weakening the invalid quoted/terminal-CR escape cases. Central §14 recording handles the new verified upstream evidence.
- seats: part-2/sol:sol-3-2

### git-r3-6
- file: scratchpad/effected/git/internal/config.ts:502
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; Git's leading unquoted whitespace semantics.
- evidence: Part-2 Sol reports `[core]\nx="" b\n` and `[core]\nx=\\\n b\n` yielding `b` from Git 2.56.0, while both lab and oracle return ` b`. The quoted-space control `[core]\nx=" " b\n` returns `  b` in all implementations. The scanner skips whitespace only immediately after the equals sign, then appends later unquoted whitespace even while decoded is empty.
- failure: An empty quoted prefix or initial continuation introduces leading spaces that Git discards, affecting GitConfig lookups and downstream Gitmodules decoding.
- fix: Skip unquoted whitespace while the decoded value is still empty, including after empty quotes and initial continuations. Retain quoted or escaped whitespace and correct source offsets/replacement spans. Add public parsing regressions in GitConfig.test.ts and scanner regressions in internal/config.coverage.test.ts, including the quoted-space control. Coordinate with git-r3-5 in the same group so significant continuation whitespace and leading-whitespace rules remain consistent. Central §14 recording handles this verified upstream correction.
- seats: part-2/sol:sol-3-3

## Backlog

### git-b3-1
- file: scratchpad/effected/git/GitCommand.ts:2299
- class: docs   severity: backlog
- standard: D4; operator/user S2 documentation deferral.
- evidence: The configList example supplies both `.gitmodules` and `local`, producing `-f .gitmodules --local --list -z`. Part-2 Sol reports the equivalent read-only `git config -f /dev/stdin --local --list -z` exiting 129 with `error: only one config file at a time`. The example remains in the source; compiled examples and argv inspection miss Git's rejection.
- failure: The example teaches an unusable configuration read.
- fix: During the documentation pass, use GitCommand.configList(".gitmodules") and remove --local from the expected argv; demonstrate a scoped read separately with the file omitted.
- seats: part-2/sol:sol-3-4
- reason: Docs/JSDoc work is backlog under the explicit merge instruction; it creates no required.json assignment.

## Handled by the deviation codemod

No submitted finding is solely a request to record a law-forced change. Identity keys, S.Finite substitutions, tagged errors, added exports and native-runtime replacement bookkeeping remain centrally owned. The forced S.asserts history does not excuse the demonstrated runtime defect in git-r3-2. No unforced-divergence restoration is asserted by these reports.

## Rejected

None. Every submitted defect supplies evidence and a concrete fix; the required bugs exercise cases missed by the green gates, and git-r3-3 demonstrates the surviving internal schema violation. The documentation finding stays backlog. Duplicate records are merged above with every contributing seat id.

Repair ownership: g1 owns Git.ts and GitCommand.ts plus their listed tests (git-r3-1–git-r3-3); g2 owns GitConfig.ts and internal/config.ts plus their listed tests (git-r3-4–git-r3-6). Each group has two source files, and every listed source/test file belongs to exactly one group. Required repairs do not assign repo configuration, package manifests, locks, ledger or README Port notes. Round 3 is final: the orchestrator proves the final fix wave with the module audit, with no fourth review.

REQUIRED: 6  BACKLOG: 1  CODEMOD: 0  REJECTED: 0  GROUPS: 2
