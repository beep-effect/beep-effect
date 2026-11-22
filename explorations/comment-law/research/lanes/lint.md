# Lint mechanism for the comment law

Lane `lint`, 2026-11-21. Repo paths are relative to the lane checkout at a1b08269809. Everything marked "measured" was run here, with a 5-minute load average between 37 and 52. Prototypes are in `scratchpad/proto/lint/` (`grit/`, `ox/`).

## Answer

1. Biome GritQL cannot express the rule. Tested, not assumed.
2. An oxlint JS plugin rule can. It belongs in `@beep/lint-rules` beside `tsdoc-syntax`, which already reads every comment (`packages/tooling/policy-pack/lint-rules/src/rules/tsdoc-syntax.ts:82`).
3. An oxlint rule alone cannot ratchet 31K existing sites: oxlint 1.94.0 has no bulk-suppression file, and a file-level disable comment silences it. A repo-cli scanner over the merge-base diff must hold the line until a package is clean, and the scanner stays as the absolute gate on clean packages afterwards, because no oxlint setting makes the rule undisableable.
4. Both hosts import one grammar module and one attachment module. The prototypes agreed on 1,722 of 1,722 findings in the 500-file sample but not on the whole tree: oxlint 31,932, scanner 31,556. All 376 extra oxlint findings, in 13 files, are JSDoc on `export { /** doc */ name }` specifiers, which the plugin does not visit (for example `packages/foundation/ui-system/dock/src/Dock.reducer.ts:8`). Sharing the classifier without sharing the attachment visitor is not enough.
5. Land the growth check before any deletion. The last 100 first-parent commits (2026-11-14 to 11-21) include 73 that touch TypeScript in scope; 69 of them introduced banned comments: 1,769 groups introduced, 1,686 net. That is about 5% of the backlog in one week.

## 1. Biome GritQL: no (measured, Biome 2.5.6, `package.json:16`)

| Attempt | Result |
| --- | --- |
| `comment()`, `Comment()`, `JsComment()`, `JsToken()` | "Failed to compile the Grit plugin" |
| Snippets `// $c`, `/* $c */`, and `contains` of a comment snippet | compile, never match |
| A node pattern with a regex | sees trivia inside the node, never its leading or trailing trivia. `JsFunctionDeclaration` sees "interior comment"; `JsReturnStatement` does not see the comment above it; `JsImport` sees neither its header nor its trailing comment; `JsExport` does not see its own JSDoc |
| `file($name, $body)` plus a regex on `$body` | sees everything except the leading comment before the first token and the end-of-file comment |
| The same regex on a file with only a URL string, a template and a regex literal | matches; it cannot tell a comment from text |
| Captured comment used as the span | capture works in the message, but the capture has no source range, so no location |
| `contains r"..."` | resolves to the enclosing node; one diagnostic for the whole file |

So GritQL can report at most one inexact, false-positive-prone diagnostic per file. The only comment-capable Biome rules are the built-in `noCommentText` and `useSingleJsDocAsterisk`; neither bans comments. `oxlint --rules` lists no rule with "comment" in its name either.

The package already states the split: oxlint JS rules are for what GritQL cannot express (`.oxlintrc.json:2-8`, `packages/tooling/policy-pack/lint-rules/README.md:86-91`). A comment ban falls on that side.

## 2. oxlint JS plugin: yes (prototype A, `ox/plugin.mjs`)

`context.sourceCode.getAllComments()` returns line, block and shebang comments with ranges. The fixture covered file header, trailing import comment, a comment inside a template substitution, inline parameter comment, JSX `{/* */}`, a run of line comments (one report per run), and end of file. All were found at exact spans; URL strings, template text and regex literals were not matched; `@__PURE__`, `gitleaks:allow`, `@ts-expect-error`, `biome-ignore` and `/// <reference>` were exempt.

Cost, measured:

| Run | wall | user CPU |
| --- | --- | --- |
| 500 files, no plugin, 8 threads | 0.06 s | 0.08 s |
| 500 files, plugin loaded, no rule | 0.09 s | 0.11 s |
| 500 files, rule on, 1 / 8 threads | 0.41 / 0.36 s | 0.60 / 0.71 s |
| 500 files, the current root lane (all `beep/*` rules) | 0.78 s | 1.47 s |
| one file, cold | 0.10 s | 0.07 s |
| all 9,851 enforced files, rule alone, 4 / 8 threads | 2.96 / 2.58 s | 6.29 / 5.02 s |
| all 9,851 files, four existing error rules, then plus this one | 3.8 -> 4.4 s | 6.1 -> 7.0 s |
| `lint:oxlint` as it is today, whole checkout | 5.7 s | 9.6 s |

Marginal cost in the existing lane is about 0.6 s wall and 1 s CPU. No cache is needed.

Limits found by trying:

- `/* oxlint-disable beepx/no-comments */` at the top of a file hides every finding and exits 0. So do the forms that do not name the rule: bare `/* oxlint-disable */`, `// oxlint-disable`, bare `// oxlint-disable-next-line`, `/* eslint-disable */` and `/* eslint-disable beepx/no-comments */` (all exit 0, measured). oxlint has no "cannot be disabled" flag. The scanner has to reject every disable form except `oxlint-disable-next-line <other rule> -- <reason>`, including the `eslint-` spellings. The prototype grammar (`ox/classify.mjs`) is looser: it exempts every `oxlint-disable` form.
- `oxlint --help` (1.94.0) offers no suppressions file. `lint:oxlint` runs with `--quiet` (`package.json:391`), so a `warn` level is invisible there.
- Of the 9,851 enforced files, 50 are outside the root oxlint scope: 46 under `**/scripts/**` (13 of those inside `.claude/`), 3 others under `.claude/`, 1 `.semgrep/first-party.ts` (`oxlint --debug=files` diffed against the list). 103 files in oxlint's scope are generated, fixture or vendored and need the exclusions in section 5.

## 3. Repo-native scanner (prototype B, `ox/scan.mjs`, `ox/core.mjs`)

| Engine, single thread, Bun | 500 files | 9,851 files, 110 MB |
| --- | --- | --- |
| oxc-parser 0.148.0, parse and comments only | 0.13 s | 1.3 s |
| oxc-parser, comments plus module record (no AST) | 0.12 s | 1.7 s |
| oxc-parser, comments plus AST walk for JSDoc attachment | 0.24 s | 3.7 s (3.5 s CPU) |
| TypeScript 6.0.2 `createSourceFile` through ts-morph, walk and comment ranges | 0.61 s | 6.1 s (9.1 s CPU) |

The 24 s census figure is not the parser's cost; the census also does per-character line accounting (`census/census.ts`). The AST walk is needed: the module record alone misfiles 6,826 JSDoc blocks (all member docs and 1,158 public ones) as non-exported.

Counts reproduce the census: 6,892 non-exported JSDoc against 6,906; 42,134 public plus module, equal; 5,668 member, equal. Prose is 51,953 individual comments, 24,690 groups.

`oxc-parser` is only a transitive optional dependency of `@shadcn/lint` (`bun.lock:7265`, `bun.lock:9055`); no workspace declares it. Choosing it means a catalog entry for a version already in the lockfile. `storybook` also depends on oxc-parser, at 0.127.0 (`bun.lock:9481`, `bun.lock:10441`), so two versions are installed. `typescript` 7 exposes no JS API here; the repo's other comment scan uses `ts` from ts-morph (`packages/tooling/tool/cli/src/commands/Knowledge/KnowledgeDoctor.domain.ts:34`, `:559`), which is the fallback if the dependency is refused, at about 2.5 to 3 times the CPU on a whole-tree run. That cost hardly matters for the growth check (p50 23 ms of parsing with oxc-parser); the better reason for oxc-parser is that it gives the same ESTree shape the oxlint rule sees, so one attachment visitor serves both.

Booting repo-cli costs about 1.2 s (`beep lint --help`, measured), so a per-edit hook should not go through it.

## 4. Wiring of existing laws, and what to copy

- **oxlint root lane.** `lint:oxlint` is an uncached Turbo root task (`turbo.json:6274`), a member of `policyStateTasks` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`, `:3945-3948`) and a cheap-gates preflight lane (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:997`). It is excluded from documentation-only diffs (`packages/tooling/tool/cli/src/commands/Ci/DocsPolicy.ts:133`). A new rule needs nothing beyond registration.
- **Package laws.** `lint:laws` is Turbo-cached per package (`turbo.json:6017`), runs `beep-cli lint laws --package .`, and dispatches `LawsPackageLaw` (`commands/Laws/LawsPackage.ts:44-60`). It has no base ref, so it suits absolute laws, not a growth check.
- **Repository text laws** (`no-tracked-python`, `private-home-paths`) share `commands/Laws/internal/TrackedTextFiles.ts`, run uncached, and sit in `policyTrackedDiscoveryTasks`.
- **Git-delta checks** (`knowledge:semantic-delta`) are uncached by contract and left out of a local full-scope lint (`Tasks.ts:3940-3944`).
- **Ratchet core.** `enforceRatchet`, `diffMembership`, `diffTotals` (`internal/ratchet/RatchetLifecycle.ts`, `RatchetDiff.ts`); used by `SchemaFirstScan.ts:25`, `CoverageRegression.ts:40`, `JSDocRatchet.ts:24`, `PackageTestTypecheck.ts:61`, `Goals/Doctor.ts:56`. `diffMembership` is set membership with a quadratic scan; a multiset of normalized text needs a small addition, not a new lifecycle.
- **Pre-commit.** lefthook runs Biome and `oxlint --config .oxlintrc.docs.json {staged_files}` for tooling source (`lefthook.yml:2-18`).
- **Agent feedback.** Claude `PostToolUse` on `Edit|Write` runs `.claude/hooks/law-pulse.sh`, a reminder every fifth edit that says itself it is for "laws without lint rules yet"; only `hookSpecificOutput.additionalContext` reaches the model. Codex has the twin (`.codex/hooks.json`, PostToolUse `Edit|Write|apply_patch`). Cursor has `postToolUse` with the pulse script only (`.cursor/hooks.json`). `.claude/settings.json` denies `Edit(**/.claude/settings.json)`, so the hook is registered through a script.
- **Package handoff.** `quality package-verify` runs `beep:lint` (Biome), `audit`, `docgen`; quick mode runs `beep:lint` and `beep:check` (`commands/Quality/internal/PackageVerify.ts:399-410`). Root oxlint is not among those steps, so without a change an agent can hand off a package that fails this law.
- **Editor.** oxlint has `--lsp`, so a rule in the root config can appear in an editor with an oxc plugin. No oxc setup is tracked under `.idea`. Whether the operator's WebStorm has the plugin is unverified.

## 5. Specification

### Hosts

| Piece | Where | Job |
| --- | --- | --- |
| `comment-grammar.ts` | `packages/tooling/policy-pack/lint-rules/src/rules/` | Pure classifier: `(text, comments, attachment) -> CommentClass`, with the directive registry as a `LiteralKit`-keyed table. New package export, no oxlint import |
| `beep/no-comments` | same directory, registered in `src/rules/index.ts` | Absolute rule, `error`, enabled by `overrides.files` in `.oxlintrc.json` for clean paths only. The list grows until it is every path, then becomes the default |
| `beep laws comments` | `packages/tooling/tool/cli/src/commands/Laws/` | `--check --base <ref>` growth check; `--census` JSON for the estimate; `--strip <ids>` used by `/delete-comment`; rejects directives naming `beep/no-comments` |
| parity test | `lint-rules/test` | both hosts over one fixture corpus |

Growth rule: take files changed against the merge base, parse base and head blobs in process, and compare the multiset of whitespace-normalized banned groups across the whole diff. Moves and renames cost nothing; a new or reworded comment fails. No baseline file is committed, so no inventory grows (S31) and burn-down PRs do not conflict on one. Parsing cost over the last 100 commits: p50 24 ms, max 1.9 s, plus `git show` per blob. Hosted clones are blobless (`filter: blob:none`, `.github/workflows/check.yml:55`). `git cat-file --batch` does not help: it fetches each missing blob separately. Tested on a six-file blobless clone, git 2.56.1: `cat-file --batch` made 6 fetches, six `git show` calls made 6, and one `git diff -U0 <base> HEAD` made 1, after which `cat-file --batch` made 0. Run one content diff over the in-scope paths first to prefetch, then read blobs. Compare individual comments, not joined runs: with runs as the unit, deleting one line of a three-line run, or deleting the code between two comments, produces a "new" group and fails a PR that only removed text (reproduced). Splitting a run with a blank line does the same. "Reworded fails" is deliberate: editing a comment is the moment to delete it, and it is rare (about 40 of 1,769 introduced groups share half their words with a removed one), so the strictness costs little. Dropping `export` from a documented symbol also fails, which is intended.

Landing it: 69 of the last 73 TypeScript merges would have failed, so every PR open on that day goes red on its next base merge. Land `/delete-comment`, the per-edit hook and the check in advisory mode first, and switch to blocking on an announced date.

Wire the check as a cheap-gates preflight lane beside `lint:oxlint`, as a git-delta policy task, in lefthook on staged files, and as a `package-verify` step restricted to the package. Lefthook must use the growth check, not plain oxlint, or touching any legacy file blocks the commit.

Per-edit hook (Claude and Codex, optionally Cursor): run oxlint with a one-rule config on the edited file (0.1 s), keep findings whose line is in `git diff -U0 HEAD -- <file>`, and emit them as `additionalContext`. It advises; it never blocks.

### Banned classes

| Class | Groups | Status |
| --- | --- | --- |
| Prose: any `//`, `/* */`, JSX or trailing comment that matches no exemption, commented-out code included | 24,690 | banned |
| JSDoc on a non-exported symbol, or attached to nothing | 6,906 in the census, 478 of them wrongly | banned |
| JSDoc on an export in the census test zone and outside `src` | 1,575 groups, 4,899 lines (484 of them, 1,136 lines, in Storybook `stories/`) | banned if the operator agrees: law 15 requires JSDoc in `packages/**/src` and `apps/**/src` (`standards/effect-laws-v1.md:26`) |
| JSDoc on an export in the census test zone but inside `src` (`src/test/*.test-kit.ts`, `src/**/*.fixtures.ts`) | 85 groups, 743 lines | exempt: law 15's globs cover these, and some are published entries (`packages/foundation/capability/mcp-kit/package.json:47`) |
| JSDoc on an export outside law 15 and outside tests: `infra/**` 123 groups / 1,804 lines, `apps/**` non-`src` 70 / 955, `packages/**` non-`src` 23 / 211, `.claude` and root 42 | 258 groups | needs a ruling |
| Suppression without a reason, or naming a tool this repo does not run | 1 known: `packages/drivers/duckdb/src/DuckDbMessageStorage.service.ts:16` (`eslint-disable`) | banned |
| Second line of a directive explanation | at most 19 | banned; reasons are one physical line |
| Member JSDoc on exported types | 5,668 | exempt until the JSDoc law is ruled |

The 478: a declaration exported through `export { x }` or `export default x` is public. The census and both prototypes look only for an `export` keyword at the JSDoc's target and call these local (for example `packages/foundation/capability/chalk/src/Chalk.ts:774`, `packages/drivers/git/src/internal/classification.ts:56`). Reuse `publicExportNames` (`lint-rules/src/rules/docs.ts:202`); it is not exported today. Do not reuse `publicVisitor` (`:218`) as is: it treats only function and class declarations as public through a specifier, so it would miss 122 of the 478 (113 variables, 6 type aliases, 3 interfaces), and it does not visit the 376 JSDoc blocks placed on the specifiers themselves. The true non-exported count is about 6,428, and the "+non-exported JSDoc" line estimate is slightly high.

### Exemption grammar

Anchored at the start of the comment after `*` and whitespace, case-sensitive, one physical line. Counts are over enforced zones, from the prototype grammar.

| Directive | Pattern | Count |
| --- | --- | --- |
| pure marks | `[@#]__PURE__`, `__NO_SIDE_EFFECTS__`, alone in the comment | 319 |
| Biome | `biome-ignore(-all\|-start\|-end)? <category>...: <reason>` | 220 |
| Fallow | `fallow-ignore-(next-line\|file) <rule> -- <reason>` | 167 |
| TypeScript | `@ts-expect-error <reason>`, `@ts-check`, `@ts-nocheck`; never `@ts-ignore` | 160 |
| Vitest | `@vitest-environment <env>` | 33 |
| coverage | `istanbul\|v8\|c8 ignore <kind> -- <reason>` | 23 |
| semgrep fixtures | `ruleid:`, `ok:`, only in `.semgrep/` (outside the include globs below; needed only if that path is ever added) | 15 |
| triple slash | `/// <reference ...>` | 12 (a 13th is in a fixture) |
| oxlint | `oxlint-disable-next-line <rule> -- <reason>`; never `beep/no-comments` | 8 |
| shader or language markers | `/* glsl */` and similar, alone in the comment | 6 |
| Effect diagnostics | `@effect-diagnostics <rule>:skip-file`, only where `EffectDiagnosticsExemptPath` allows (`commands/Quality/Quality.command.ts:405`) | 6 |
| nosemgrep, bundler (`@vite-ignore`, `webpackIgnore:`), gitleaks (`gitleaks:allow`; "anywhere in the comment" lets any sentence through, so require it alone or at the end of a trailing comment) | | 5, 5, 4 |
| shebang | first byte | 2 |
| licence | a contiguous leading run before the first statement containing SPDX, Copyright, Licensed under, MIT License or Apache License | 76 groups |
| public JSDoc and `@packageDocumentation` | attached to an export in `src`, or before the first statement for `@packageDocumentation` (the prototype accepts `@module` or `@packageDocumentation` anywhere; 7 of 4,934 sit after the first statement) | stays while law 15 stands |

Do not reuse the census regex as the grammar. It is case-insensitive and prefix-only: 25 of its 975 "directives" are prose ("Region override alone leaves...", `infra/test/CiRunners.test.ts:211`; "typos runs inside Lint Policy", `packages/tooling/tool/cli/test/ci-runner-security.test.ts:2018`). It also misses 33 machine-read comments, among them every `/// <reference>`, every semgrep `ruleid:`/`ok:` annotation and the `/* glsl */` markers. A bulk delete from census classes would break type resolution and `semgrep --test`.

The licence regex must not include "ported from" or "adapted from" as the census does. Whether a provenance note must be kept for attribution is an ADR and notices question (`THIRD_PARTY_NOTICES.md`), to settle before those are deleted.

Suppression reasons are where prose will go next. 583 suppression comments exist; median 151 characters, p95 377, max 415. 369 source lines already carry `Owner: ... Exit: ...`. Require a reason and one line now; report reason length in the census; decide on a cap or a mandatory Owner/Exit form after the first waves. Requiring a reason on `@ts-expect-error` has to accept the plain-text form many tests use today.

### Scope globs

Include `apps/**`, `packages/**`, `infra/**`, `tools/**`, root `*.{ts,mts,js,mjs}`, `.claude/**/*.ts` and `**/scripts/**` for `{ts,tsx,mts,cts,js,jsx,mjs,cjs}`. The last two are outside today's `.oxlintrc.json` (`**/scripts/**`, `.claude/**` in `ignorePatterns`), so the scanner covers them and the oxlint rule does not.

Exclude `scratchpad/**`, `goals/**`, `explorations/**`, `research/**`, `docs/**`, `standards/**` (frozen or lab code), `**/{generated,_generated}/**`, `**/*.{gen,generated}.*`, files whose first 600 bytes carry a generated header, `**/{vendor,vendored,sdks}/**`, `**/{fixtures,__fixtures__,__snapshots__,testdata}/**`, `**/dist/**`, `.repos/**`, `**/*.hbs`. Generated files change through their generator.

Not covered by either host: JSONC, YAML, TOML, CSS, shell, Grit, SQL, Nix. `biome.jsonc` and `turbo.json` hold substantial prose. Say so in the law and leave it for a later decision.

### Messages

Shape is the package's `Rule: ... Why: ... Fix: ...` (`lint-rules/README.md:53`).

- prose: `Rule: no comments. Why: nothing checks a comment, so it drifts or excuses the code under it. Fix: put it in a name, type, schema annotation, test title or assertion; record a decision in an ADR; fix a hack; then delete it with /delete-comment.`
- non-exported or test JSDoc: `Rule: JSDoc documents exported src symbols only. Why: docgen never reads this block. Fix: delete it, or export the symbol if it is API.`
- malformed suppression: `Rule: a suppression is one line with a reason and names a tool this repo runs. Fix: fix the finding, or write <directive form>.`
- disabling the law: `Rule: beep/no-comments cannot be disabled in source. Fix: remove the comment.`

Do not recommend adding an ADR per comment in the message; the skill decides which are ADR-worthy.

### Autofix: none

No `fix`, no oxlint suggestion. Deletion is mechanically safe but the classification is not, and an autofix would delete decision records unread. Pre-commit already runs `biome check --write`; an oxlint fixer would invite the same.

The mechanical half is proven (`ox/strip.mjs`): deleting all banned prose and non-exported JSDoc from all affected files left every program AST-identical ignoring positions: 4,689 of 4,689, no parse errors, -87,233 lines before formatting (census simulation: -89,019; the 478 exported-by-specifier blocks are in both). 400 deletions were trailing or inline, 30 sat in JSX containers, where an empty `{}` is left. 10 blocks become empty, of which 2 are catch bodies; Biome's `noEmptyBlockStatements` is not in the recommended set this repo uses, so nothing newly fails there. `--strip` should keep the AST-equality check as a postcondition, then run Biome format. AST equality does not cover tests that read source text, or line-keyed catalogs and ratchets; those belong to the migration plan. Because the strip uses the scanner, it never saw the 376 specifier blocks as deletable; a strip built on the oxlint rule would have removed them.

## 6. Order

1. Grammar, scanner, growth check, hook. No deletions. Stops the 1,700 a week.
2. Oxlint rule with an empty override list.
3. Per package: classify, delete, add the package glob to the override in the same PR.
4. When every package is listed, make it the default and turn the scanner into an absolute check over the same paths. Do not drop it: it is the only thing that sees through an oxlint or eslint disable comment.

Registration duties for a new rule: `src/rules/index.ts`, `OXLINT_RULES` in `test/oxlint-harness.ts`, fixtures in `test/oxlint-sources.ts`, `.oxlintrc.json`, and the policy-fingerprint reseal (`bun run beep lint policy-fingerprint --write`, part of `beep:preflight`, `package.json:348`).

## 7. Not verified

- Behaviour under the hosted blobless clone; only local git was used.
- Whether any test asserts on a source comment by reading files. Not searched here.
- The per-edit hook was designed from the existing hooks, not prototyped; only the 0.1 s single-file cost was measured.
- The growth-history figure uses the prototype classifier, so it includes the exported-by-specifier error for JSDoc (353 of 1,769 introduced groups were JSDoc). The prose part is 1,416.

## Refutation pass

Adversarial review, 2026-11-21, load average about 33. Reruns are in `scratchpad/proto/lint-refute/`. Wrong statements above were corrected in place; this section lists what changed. The hosts-and-ratchet recommendation survives with five corrections.

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Biome GritQL 2.5.6 cannot do it | confirmed | All 50 cases rerun. Node names fail to compile, snippets never match, `JsReturnStatement`, `JsImport` and `JsExport` regexes miss their trivia, the `file` body regex misses LEADING and EOF and matches `fp.ts` (URL, template, regex only). `JsFunctionDeclaration`, `JsFunctionBody` and `JsxExpressionChild` do match interior text, which the table says |
| `getAllComments` works, precedent at `tsdoc-syntax.ts:82` | confirmed | Line read; fixture and full-tree run |
| Cost | confirmed | 9,851 files: 2.65 s at 4 threads, 2.41 s at 8, 4.5 to 5.0 s CPU; root lane today 6.9 s wall and 11.4 s CPU under this load (5.7 / 9.6 before) |
| Scanner cost | confirmed | 500 files 0.27 s including start, all files 3.07 s wall. ts-morph 7.6 s wall and 10.7 s CPU here (6.1 / 9.1 before) |
| oxc-parser only transitive | corrected | Also a hard dependency of storybook, at 0.127.0 |
| Prototypes agree | corrected | 1,722 of 1,722 in the sample holds, but the sample was too small. Full tree 31,932 against 31,556; 376 JSDoc blocks on export specifiers in 13 files, none the other way |
| 73 / 69 / 1,769 / +1,686 | confirmed, with context | Rerun gives the same numbers. The distribution is skewed: one commit adds 421 and the top five add 876 (half); the median is 6. 62 of the 73 have a net increase, 7 add some but none net. "1,700 a week" is one week |
| 4,689 of 4,689 AST-identical, -87,233 lines | confirmed | Rerun, no diffs, no parse errors |
| 10 empty blocks, 2 catch bodies, Biome quiet | confirmed | `empty.mjs` rerun; Biome with the repo config reports no lint finding on an empty catch or an empty while, only formatting |
| 478 wrongly local | confirmed | Rerun. 329 functions, 113 variables, 27 classes, 6 type aliases, 3 interfaces. The proposed fix through `publicVisitor` was wrong |
| 25 false and 33 missed directives | confirmed | `dl.mjs` rerun, lists match. 18 of the 33 sit in shipped or test code (12 references, 6 glsl); the 15 semgrep marks are in one file outside the proposed scope |
| 1,660 test JSDoc groups are outside law 15 | refuted | 85 groups, 743 lines, are under `packages/**/src`; 484 of the rest are Storybook stories. 1,575 groups, 4,899 lines, are outside law 15 |
| package-verify skips oxlint | confirmed | `PackageVerify.ts:399-410`; its audit step is the root `beep-cli audit packages`, whose tasks are build, check, test and lint (`Quality/Tasks.ts:5249`), with lint being Biome |
| File-level disable silences the rule; scanner rejects directives naming it | corrected | Bare and `eslint-` forms silence it too, so rejecting named directives is not enough |
| `git cat-file --batch` suits blobless clones | refuted | One fetch per missing blob; prefetch with one content diff. Only the local simulation was run, not hosted CI |
| Scope: 50 files outside oxlint, 103 inside it needing exclusion | confirmed (same files, 13 counted under both headings) | 46 under `scripts/` (some of them in `.claude/`), 3 other `.claude/`, 1 `.semgrep/` |
| Member JSDoc, 5,668 | confirmed, with a label problem | "Member JSDoc on exported types" is mostly class members and object literal properties: 1,901 sit on object literal properties (5.9K lines), 1,188 on interface or type members, the rest on class members; 110 are on private members (1.3K lines). Private members and object literals have no public-API reason to be exempt |
| Owner/Exit lines, 369 | close | 364 lines match `Owner: .*Exit: ` in ts/tsx under packages, apps, infra and tools; the original pattern is not recorded |
| 1.2 s CLI boot | confirmed | 1.198 s wall |

Not checked: the per-edit hook, the growth check on hosted CI, WebStorm support, and other lanes' claims. An option the lane did not weigh is a single engine: write base blobs to a temporary directory and run the oxlint rule on both sides (40 files cost 0.34 s). It removes the parity problem and the new dependency for the growth check, but it honours disable comments and cannot do the AST-checked strip, so it does not beat the scanner.
