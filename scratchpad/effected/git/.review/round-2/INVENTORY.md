# git — round-2 merged inventory

Read all six reports: `part-1/{grok,sol,fable}.md` and `part-2/{grok,sol,fable}.md`, both adjacent `BRIEF.md` files and both third-seat `BRIEF.grok3.md` variants. The briefs pin review commit `60fcfb5ebcdc26765a66cc1f13afc88adcb05d11` and oracle `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. The third seat is the authorized separate Grok 4.7 medium session recorded in each `fable.md`. Seat ids include the part because report ids repeat.

Counts after merging 22 reported records and splitting mixed findings: **Required 9 · Backlog 2 · Handled by the deviation codemod 0 · Rejected 1 · Groups 3**. Repeated production JSON violations share git-r1; both integration suppression reports share git-r4. The third seat's mixed JSON report contributes production sites to Required and examples to Backlog; its terminal-CR report contributes the value/span defect to Required and the unsupported continuation proposal to Rejected.

The full operator revision block, including the later rulings/grilling, overrides older wording. D1–D20, §§12.4–12.5 and §14 govern classification. The merge instruction defers documentation, coverage and vitest-canon work regardless of the briefs' green S2/S3 claims. Required compiler-directive repairs concern concealed diagnostics, not canon preferences. Every required law finding identifies why the stated green gates missed it.

Live checkout: `@lab/effected-2` (request names `@lab/effected`); no branch switch. Read source history with `git log --format=%h:%s --all -- <file>` as well as the current-branch history, and inspected available step-2/S1 diffs, including `7f67982f77`, `05ef80f434`, `fc96c12ac8` and `b35380a409`. This merge makes no unforced-change restoration claim. Diagnostic/law-forced codecs, schema numbers, tagged errors and other already classified round-1 bookkeeping remain central; they are not reopened. Adding skip directives during step 2 does not authorize hiding the diagnostics: git-r4 challenges the suppression itself, not its missing deviation record.

Parsed `standards/effect-laws.allowlist.jsonc`: **zero entries for `scratchpad/effected/git/**`**. There are no `allow-<n>` additions. No round-2 report merely asks to record a law-forced change, so the codemod section has zero new findings.

`required.json` assigns three non-overlapping surfaces. **g1** owns Git.ts, Gitmodules.ts and internal/config.ts (3 source files), plus Git.test.ts, GitConfig.test.ts, Gitmodules.test.ts and internal/config.coverage.test.ts. The cross-file JSON finding joins the service and config-parser fixes into that group. **g2** owns GitCommand.ts (1 source file) and GitCommand.test.ts. **g3** owns only the two integration test files (0 source files). Every file occurs in at most one group. No group owns manifests, locks, shared runner/configuration, PORT_LEDGER.json or README Port notes. Verified upstream-bug evidence and adjusted tests go to central deviation bookkeeping before behavior changes; no bookkeeping edits are delegated here. Probe results below are the seats' recorded evidence, not new runs claimed by this merge.

## Required

### git-r1
- file: scratchpad/effected/git/Git.ts:1786; scratchpad/effected/git/internal/config.ts:421; scratchpad/effected/git/Gitmodules.ts:160
- class: law   severity: required
- standard: D5, D11; standards/effect-first-development.md EF-3; round-1 git-x1 gate-miss precedent.
- evidence: All three production diagnostic paths still call JSON.stringify. Git.ts already defines encodeJsonString at :27 and uses it in commonDir at :2641. EF-3 explicitly bans native JSON serialization; the four-law gate does not scan JSON.stringify. The seats identify the concrete scanner gap, so green gates do not reject this finding.
- failure: Refusal, invalid config-line and submodule field diagnostics encode domain text outside the required schema codec path.
- fix: Use the existing encodeJsonString effect in Git.ts, composing it into the typed refusal and preserving the sensitive-redaction branch. In internal/config.ts and Gitmodules.ts, use an identity-annotated module-local S.fromJsonString(S.String) codec with S.encodeResult and explicit Result handling for these deliberately synchronous paths. Preserve every diagnostic byte, escaping rule, error kind and pre-spawn behavior; add quoting/escaping regressions in Git.test.ts, GitConfig.test.ts and Gitmodules.test.ts. Do not change the already compliant commonDir codec.
- seats: part-1/grok:grok-2-1; part-1/sol:sol-2-2; part-1/fable:fable-2-1; part-2/grok:grok-2-5; part-2/sol:sol-2-5; part-2/fable:fable-2-2 (production sites)

### git-r2
- file: scratchpad/effected/git/Git.ts:2632
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug; GitShape.commonDir pathname-identity contract.
- evidence: Part-1 Sol reports a scripted-spawner probe against both lab and pinned oracle: stdout "/repo/.git\r\n" becomes "/repo/.git", losing a pathname CR; "/repo\npart/.git\n" is rejected as unparseable. The live implementation strips /\r?\n$/ and rejects any remaining LF.
- failure: Valid Unix common-directory names containing a trailing CR or embedded LF cannot retain their identity.
- fix: On the Unix output path, remove exactly the final LF, preserving preceding pathname bytes. Remove the blanket embedded-LF rejection while retaining rejection of the older-Git echoed --path-format response. Add CR/LF pathname-fidelity regressions in Git.test.ts and retain the old-version refusal tests. Supply this verified upstream-bug evidence and adjusted test sites to central deviation bookkeeping before the behavior edit.
- seats: part-1/sol:sol-2-1

### git-r3
- file: scratchpad/effected/git/Git.ts:1821
- class: schema   severity: required
- standard: D5, D11; standards/effect-laws-v1.md law 17; standards/effect-first-development.md EF-12b.
- evidence: rejectNonNaturalNumber reuses Number.isInteger(value) && value >= 0 for depths, limits and stash indexes, without a schema owning the named domain. Sol reports equivalence of S.Finite.check(S.isMultipleOf(1), S.isGreaterThanOrEqualTo(0)) on negative numbers, signed zero, fractions, NaN, infinities and large integral values (9007199254740992, 1e30). Schema-derived guards are not enforced by the stated green gates.
- failure: A named, reused numeric acceptance contract remains an imperative predicate outside its required schema.
- fix: Define one identity-annotated module-local schema for the existing finite nonnegative-integer domain and derive its guard with S.is. Preserve omitted values, acceptance of large integral values, and the existing refusal payload. Do not substitute safe-integer S.Natural. Add boundary regressions in Git.test.ts.
- seats: part-1/sol:sol-2-3

### git-r4
- file: scratchpad/test/git/integration/Git.int.test.ts:1; scratchpad/test/git/integration/GitSurface.int.test.ts:1
- class: tsgo   severity: required
- standard: D11; operator step 2; Quality.command.ts diagnostic-directive policy; round-1 git-r6.
- evidence: Both files contain file-wide @effect-diagnostics skips for strictEffectProvide, nodeBuiltinImport, asyncFunction and processEnv; Git.int additionally skips multipleEffectProvide. Both run helpers repeatedly provide TestLayer; GitSurface also mutates process.env. The compiler includes both files but honors the skips. git log --format=%h:%s --all -- <files> and commit 7f67982f77 (effected-port step 2) show the directives being added, not an admitted exemption. The existing EV010 exceptions concern canon imports, not diagnostic suppression.
- failure: The green compiler gate hides real diagnostics rather than proving integration code satisfies the rules.
- fix: Remove both skip directives and repair every revealed diagnostic within these two integration test files: build one scoped TestLayer context/provisioning boundary, use Effect platform services and Effect composition for fixture operations, and pass protocol/SSH environment through the real spawner instead of mutating process.env. Preserve the real Git binary, real filesystem fixtures, assertions and existing EV010 exception records. Do not edit repo exemption configuration or the lab runner. This is diagnostic repair, not a vitest-canon migration or an unforced-upstream restoration.
- seats: part-1/fable:fable-2-2; part-1/fable:fable-2-3

### git-r5
- file: scratchpad/effected/git/internal/config.ts:313
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug; git-config quoted-subsection grammar.
- evidence: Part-2 Sol records Git 2.56.0 rejecting [remote"origin"]\nurl=u\n with exit 128, while lab and pinned oracle succeed. sol.log:18689 independently records the equivalent [core"x"] header divergence. scanHeader consumes optional whitespace then accepts a quote without requiring a separator.
- failure: GitConfig and Gitmodules accept malformed headers that Git cannot read.
- fix: Record the section-name end and require at least one space or tab before a quoted subsection. Preserve both separators and quoted-empty-subsection acceptance. Add public parse regressions in GitConfig.test.ts and Gitmodules.test.ts, including missing-separator rejection; supply upstream-bug evidence/test sites to central bookkeeping before the behavior edit.
- seats: part-2/grok:grok-2-1; part-2/sol:sol-2-1

### git-r6
- file: scratchpad/effected/git/internal/config.ts:366
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug; Git deprecated dotted-subsection grammar.
- evidence: Git 2.56.0 accepts [remote.]\nurl=u\n and emits remote..url\nu\0; lab and pinned oracle reject it. sol.log:18690 also shows Git accepting [core.] and both scanners producing diagnostics. internal/config.coverage.test.ts:71 currently pins the incorrect rejection.
- failure: Valid empty dotted subsections cannot be parsed despite equivalent quoted empty subsections being representable.
- fix: Remove only the subsection === "" rejection from the dotted-header check; continue rejecting an empty section name. Retarget internal/config.coverage.test.ts to successful parsing and add empty-subsection lookup assertions in GitConfig.test.ts. Supply verified upstream-bug evidence and changed test sites to central bookkeeping before the behavior edit.
- seats: part-2/grok:grok-2-2; part-2/sol:sol-2-2

### git-r7
- file: scratchpad/effected/git/internal/config.ts:463
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug; Git value parsing at EOF.
- evidence: sol.log:20768–20770 shows Git returning first\n for [core]\nx=first\ at EOF while lab and oracle report invalidEscape. :20785–20787 shows the same divergence after a closed quote. Git rejects an open quote (:20782) and a backslash followed by terminal CR (:20771). internal/config.coverage.test.ts:35 pins the incorrect EOF rejection.
- failure: Valid config values ending with a backslash at EOF fail parsing, including after a closed quoted value.
- fix: When backslash is immediately followed by EOF outside an open quote, drop it from the decoded value, end scanning without an escape diagnostic, and include it in the raw value span so a later set replaces it. Preserve rejection of an open quote and backslash followed by terminal CR. Retarget internal/config.coverage.test.ts and add public parse/set regressions in GitConfig.test.ts; supply upstream-bug evidence/test sites to central bookkeeping before the behavior edit.
- seats: part-2/grok:grok-2-3; part-2/sol:sol-2-3

### git-r8
- file: scratchpad/effected/git/internal/config.ts:438–439
- class: bug   severity: required
- standard: D9, D11; §14 upstream-bug; Git terminal-CR value semantics; round-1 git-r15 did not cover valued entries.
- evidence: sol.log:18692 shows x=\r yielding an empty value in Git but CR in the lab; :20788–20790 shows x=a\r yielding a in Git but a\r in lab/oracle. :18682–18684 confirms embedded CR and CRLF behavior. The value loop recognizes LF/CRLF only, so significantEnd includes terminal CR and set removes it. The existing GitConfig.test.ts:530 assertions cover bare keys/headers.
- failure: Decoded values gain a trailing CR, surgical set deletes the line ending, and terminal-CR Gitmodules booleans can fail decoding.
- fix: Stop value scanning before consuming a CR accepted by isLineEnd, preserving source text and value spans. Keep embedded CR (quoted and unquoted), CRLF and invalid backslash-plus-terminal-CR behavior. Add get/set regressions in GitConfig.test.ts for empty/nonempty terminal-CR values and Gitmodules.test.ts regressions for shallow=0\r and shallow=1\r; supply upstream-bug evidence/test sites to central bookkeeping before the behavior edit.
- seats: part-2/grok:grok-2-4; part-2/sol:sol-2-4; part-2/fable:fable-2-1 (decoded-value/span defect)

### git-r9
- file: scratchpad/effected/git/GitCommand.ts:54
- class: schema   severity: required
- standard: D5, D11; standards/effect-first-development.md EF-12b; standards/effect-laws-v1.md laws 17/19; standards/ARCHITECTURE.md §5.
- evidence: GitArg is a named, reused string-or-sensitive-carrier domain. Its handwritten "value" | "url" vocabulary is constructed independently by secretValue/secretUrl and matched by the redaction branch at :112. No schema owns either domain, and the stated green gates leave this declaration intact.
- failure: Argument carriers and redaction policies have only compile-time contracts rather than schema-derived domain definitions.
- fix: Define an identity-annotated module-local redaction LiteralKit and a GitArg schema combining strings with the existing { redact, value } carrier. Derive the type from the schema and preserve the private carrier shape, raw argv and redacted argv. Retain/add sensitive-value and URL-userinfo regressions in GitCommand.test.ts. Keep these domains local; do not add public exports solely for bookkeeping.
- seats: part-2/sol:sol-2-6

## Backlog

### git-b1
- file: scratchpad/effected/git/GitConfig.ts:36
- class: docs   severity: backlog
- standard: D4; operator docs/S2 deferral; GitConfigDiagnosticCode public vocabulary.
- evidence: Both contributing seats identify the only GitConfigErrorCode occurrence in this Details sentence; the class field uses GitConfigDiagnosticCode and no GitConfigErrorCode is exported.
- failure: The diagnostic documentation names a nonexistent type.
- fix: During S2, replace GitConfigErrorCode with GitConfigDiagnosticCode in the sentence.
- seats: part-2/grok:grok-2-6; part-2/fable:fable-2-3
- reason: Documentation work is backlog under the merge instructions; it is not assigned in required.json.

### git-b2
- file: scratchpad/effected/git/GitConfig.ts:568,677; scratchpad/effected/git/Gitmodules.ts:415
- class: jsdoc   severity: backlog
- standard: EF-3; D4; operator docs/JSDoc S2 deferral.
- evidence: The third seat identifies JSON.stringify in the two GitConfig getAll/append examples and the Gitmodules stringify example. These are documentation calls, separate from the production calls merged into git-r1.
- failure: Examples retain the forbidden native JSON serializer.
- fix: During S2, use schema JSON codecs of the correct payload shape: S.fromJsonString(S.Array(S.String)) for getAll arrays and S.fromJsonString(S.String) for rendered module text. Preserve the example output and carried upstream meaning.
- seats: part-2/fable:fable-2-2 (JSDoc examples)
- reason: JSDoc work is backlog under the merge instructions even when its cited law is binding.

## Handled by the deviation codemod

No new round-2 findings. Central recording of prior and future law-forced changes remains the codemod's responsibility; it creates no required repair group.

## Rejected

### git-x1
- file: scratchpad/effected/git/internal/config.ts:438–463
- class: bug   severity: backlog
- standard: D9, D11; §14 upstream-bug requires verified evidence.
- evidence: Part-2 Fable proposes treating backslash plus terminal CR as a continuation. The stronger recorded Git probe in part-2/sol.log:20771–20775 returns exit 128 for [core]\nx=first\\r, and both lab and pinned oracle already reject it.
- failure: The proposed continuation would accept input Git rejects and introduce an unsupported behavioral divergence.
- fix: Reject only the terminal-CR continuation proposal; keep that escape invalid. The independently evidenced terminal-CR value/span fix remains required in git-r8.
- seats: part-2/fable:fable-2-1 (terminal-CR continuation proposal)
- reason: The proposed continuation contradicts the recorded Git probe and has no qualifying §14 cause.

REQUIRED: 9  BACKLOG: 2  CODEMOD: 0  REJECTED: 1  GROUPS: 3
