### sol-1-1
- file: scratchpad/effected/git/Gitmodules.ts:36
- class: schema   severity: required
- standard: D11; D9 and §14 (`upstream-bug` established by a failing round-trip); standards/schema-first-development-prompt.md, “Precision carries invariants.”   evidence: A read-only probe in both the lab and pinned oracle constructed `GitmodulesEntry.make({ name: "a", path: "p\0q", url: "u" })`, wrapped it in `Gitmodules`, and encoded it through `FromString`. Construction and encoding succeeded; decoding the encoded text failed. `GitConfig.parseResult` rejected that output as containing a NUL byte. The same failure reproduces with a NUL-containing `branch`.
- failure: `path`, `url`, `branch`, and `update` accept strings that the serializer cannot represent as valid git-config. Consequently, the codec successfully emits a document that its own decoder rejects.
- fix: Use one named, NUL-free string schema for those four fields, retaining optionality for `branch` and `update`. Record the verified upstream-bug deviation under §14 and add an encode/decode regression.

### sol-1-2
- file: scratchpad/effected/git/Gitmodules.ts:142
- class: schema   severity: required
- standard: D11; D9 and §14 (`upstream-bug` established by a failing fidelity property); standards/schema-first-development-prompt.md, “Precision carries invariants.”   evidence: In both the lab and pinned oracle, a schema-valid `Gitmodules` containing `{ name: "a", path: "p1", url: "u1" }` and `{ name: "a", path: "p2", url: "u2" }` encoded successfully through `FromString`. Decoding returned one entry: probe output was `input: ["p1", "p2"], decoded: ["p2"]`.
- failure: The typed model permits duplicate logical names, but decoding merges their sections with last-wins semantics. Encoding and decoding a valid model silently loses entries and their earlier field values.
- fix: Add a uniqueness check by case-sensitive `name` to the `entries` schema. Preserve duplicate-section merging for incoming text; reject duplicate names in the constructed typed model. Record the upstream-bug deviation and add the fidelity regression.

### sol-1-3
- file: scratchpad/effected/git/internal/config.ts:255
- class: bug   severity: required
- standard: D11; D9 and §14 (`upstream-bug`); installed `git-config(1)`, deprecated subsection syntax.   evidence: The manual specifies that dotted subsection names are lowercased and then compared case-sensitively. A read-only `git config --file /dev/stdin --get` probe over `[branch.Master]\nremote=origin\n` returned `origin` for `branch.master.remote`, but exited 1 for `branch.Master.remote` and `branch.MASTER.remote`. The scanner preserves `"Master"` and `matchesSection` instead folds both sides. Additionally, both the lab and pinned oracle rejected `[submodule.Alpha]\npath=a\nurl=u\n[submodule.alpha]\npath=b\n` with `missingUrl` for `"alpha"`; Git read both sections under `submodule.alpha`.
- failure: Dotted headers retain the wrong decoded subsection identity. Config lookups accept addresses Git does not accept, and `.gitmodules` decoding can split one logical submodule into separate entries or falsely report missing required fields.
- fix: Lowercase dotted subsections during scanning and compare decoded subsections case-sensitively in `matchesSection`. Preserve quoted subsection case and the original text. Record the deviation, update the existing dotted-subsection corpus expectations, and add the mixed-case duplicate-section regression.

### sol-1-4
- file: scratchpad/effected/git/internal/config.ts:247
- class: bug   severity: required
- standard: D11; D9 and §14 (`upstream-bug`); installed `git-config(1)`, syntax for the remainder of a section-header line.   evidence: The manual recognizes the remainder of a section-header line as variable declarations. A read-only `git config --file /dev/stdin --list -z` probe accepted `[core] bare = false\n` and returned `core.bare\nfalse\0`. Both the lab and pinned oracle returned `GitConfigParseError` with `invalidSectionHeader`, “unexpected text after the section header.”
- failure: Valid Git configuration with an entry on the same line as its section header cannot be parsed.
- fix: After scanning `]`, allow and scan an inline variable declaration. Track its entry span separately from the header so surgical edits do not remove or overwrite the header. Record the upstream-bug deviation and add parsing and editing regressions.

### sol-1-5
- file: scratchpad/effected/git/Gitmodules.ts:93
- class: bug   severity: required
- standard: D11; D9 and §14 (`upstream-bug`); Git’s boolean conversion, verified through `git config --bool`.   evidence: Read-only `git config --file /dev/stdin --bool --get submodule.a.shallow` probes returned `true` for `2`, `-1`, `+1`, and `0x10`, and `false` for `00`. Both the lab and pinned oracle returned `GitmodulesDecodeError` with `reason: "invalidValue"` for `shallow=2` and `fetchRecurseSubmodules=2`.
- failure: The decoder accepts only the numeric spellings `"0"` and `"1"`, rejecting other valid Git boolean values. Valid `.gitmodules` documents therefore fail decoding.
- fix: Extend `parseBool` to recognize Git’s supported integer syntax and convert zero to false and nonzero to true, retaining rejection of malformed numeric input. Record the deviation and add cases for both boolean fields.

### sol-1-6
- file: scratchpad/effected/git/internal/config.ts:146
- class: bug   severity: required
- standard: D11; D9 and §14 (`upstream-bug`); malformed-input contract of `GitConfig.parseResult`, checked against Git.   evidence: Read-only Git probes rejected `[core]\n\rbad@line\n` and `[core]\nbare\rjunk\n` with exit 128, “bad config line 2.” Both the lab and pinned oracle returned success. The first input produced no entries; the second produced a bare `bare` entry while discarding `junk`. The same unconditional carriage-return treatment appears after a key at line 289 and after a header at line 247.
- failure: A carriage return followed by other characters is treated as a complete line ending, allowing malformed text to pass and silently discarding its suffix.
- fix: Distinguish CRLF or an allowed terminal carriage return from a carriage return followed by non-newline text at line, header, and bare-key boundaries. Diagnose the latter instead of skipping its suffix. Record the deviation and add both malformed-input regressions.

### sol-1-7
- file: scratchpad/effected/git/internal/config.ts:133
- class: bug   severity: required
- standard: D11; D9 and §14 (`upstream-bug`); Git configuration parsing, verified against the Git executable.   evidence: A read-only `git config --file /dev/stdin --list -z` probe accepted `\uFEFF[core]\nbare=false\n` and returned `core.bare\nfalse\0`. Both the lab and pinned oracle returned `GitConfigParseError`, first treating the leading BOM as an invalid variable-name character and then reporting `bare` before any section.
- failure: A valid UTF-8 BOM-prefixed Git configuration cannot be parsed.
- fix: Recognize an initial U+FEFF during scanning while preserving the original text and absolute offsets. Record the upstream-bug deviation and add a BOM-prefixed parse/stringify regression.

### sol-1-8
- file: scratchpad/effected/git/Gitmodules.ts:98
- class: schema   severity: required
- standard: D5; D11; standards/effect-laws-v1.md laws 17 and 19; standards/schema-first-development-prompt.md, “Derive behavior instead of duplicating truth.”   evidence: The ignore-policy domain is independently declared in `GitmodulesEntry.ignore` at line 51 and in the named `IGNORE_VALUES` array at line 98. Decoding uses the second declaration through a handwritten `.find` membership check at line 206.
- failure: The named finite domain has two independent definitions, and parser acceptance is maintained separately from the field schema. This violates the required schema-first, named-`LiteralKit` contract despite the existing green gates.
- fix: Define one internal `LiteralKit(["all", "dirty", "untracked", "none"])`, use it for the field schema, and derive decoder membership from that same value. Preserve the current case-folding behavior.

### sol-1-9
- file: scratchpad/effected/git/GitCommand.ts:545
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md, “Hard requirements” and “Description and section grammar”; D4; reviewer brief’s explicit S2 deferral.   evidence: The focus files still contain forbidden `@remarks` carriers, including this class block and `internal/run.ts:21`. `GitConfig.ts:325` retains `@example`; public declarations across `GitCommand.ts`, `GitConfig.ts`, and `Gitmodules.ts` lack canonical `@category`, `@since 0.0.0`, and the required titled examples.
- failure: The carried documentation does not yet satisfy the final JSDoc contract. This remains backlog because S2 has explicitly not run.
- fix: During S2, preserve the existing prose while converting carriers to `**Details**`/`**Gotchas**` and titled `**Example** (Title)` sections; add canonical categories, `@since 0.0.0`, and meaningful examples on owning value declarations.

REQUIRED: 8
BACKLOG: 1