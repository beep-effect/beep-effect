# github-references (lab port of @effected/github-references)


GitHub's issue-reference grammar as pure functions: the nine closing keywords in the three dialects real tools write — inline in prose, one reference per line, and a whole line naming several issues at once. Strings in, values out. No service, no layer, no client, no network, and no octokit anywhere in the dependency graph: `effect` is the only peer and there are no runtime dependencies at all.

## Why @effected/github-references

Deciding which issues a pull request closes is a grammar question, not an API call, and the answer is usually re-derived from memory in a one-line regex. That regex is where the bugs live: accept a colon inline and you harvest references GitHub will not link, so your pipeline reports an issue as closing that merging leaves open. Accept `closes 123` without the `#` and you report a link GitHub never made. Read `Closes #1, #2 and #3` with a parser built for one reference per line and you silently see the first issue and lose the rest.

This package is that grammar written once, with the disagreements resolved on purpose rather than by whoever copied the regex last. Each dialect is a separate function because each has a distinct producer: prose is written by humans for GitHub's own scanner, and a generated references region is written by tooling for humans. The functions are pure and synchronous — no `Effect`, no layer to provide, nothing to stub in a test — so a release script, a lint rule, a commit-message check and an Action can all speak the same grammar without any of them installing a GitHub client.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

`effect` v4 is the only peer dependency and there are no others of any kind. `Option` is the only part of `effect` the surface touches, and nothing here runs an effect, so every function is callable from ordinary synchronous code.

## Quick start

Harvest references out of a pull request body, then read a generated line that names several issues:

```ts
import { harvestIssueReferences, parseClosingList } from "@beep/scratchpad/effected/github-references";

console.log(harvestIssueReferences("Fixes #12 and closes #13."));
// [ { issueNumber: 12, keyword: "fixes", start: 0, end: 9 },
//   { issueNumber: 13, keyword: "closes", start: 14, end: 24 } ]

console.log(parseClosingList("Closes #247, #248 and #251"));
// Option.some({ keyword: "closes", issueNumbers: [247, 248, 251] })
```

## Inline in prose

`harvestIssueReferences` reads the **inline-in-prose** dialect: one of the nine closing keywords in `CLOSING_KEYWORDS`, mandatory whitespace, then `#<number>`, anywhere in the text, case-insensitive, and **no colon** — that is the spelling GitHub itself scans a pull request body for. Every hit carries `start` and `end` offsets into the input, so a caller can underline the match, strip it, or rewrite it in place.

```ts
import { harvestIssueReferences } from "@beep/scratchpad/effected/github-references";

console.log(harvestIssueReferences("closes: 123 and fixes #9"));
// [ { issueNumber: 9, keyword: "fixes", start: 16, end: 24 } ]
// — the colon spelling is not the inline dialect, and `123` has no `#`
```

Duplicates come back as written, because whether `fixes #1, fixes #1` means one intent or two is the caller's question. This is the dialect a release pipeline harvests from commit subjects and pull request descriptions.

## Bare lines

`parseBareLineReference` reads the **bare-line** dialect: after trimming, the whole line *is* the reference, the colon is optional, and anything left over rejects the line. That is the shape a generated references block writes, one reference per line. There are no offsets, because in a dialect where the line is the reference an offset would restate a constant.

```ts
import { parseBareLineReference } from "@beep/scratchpad/effected/github-references";

console.log(parseBareLineReference("Closes: #12"));
// Option.some({ issueNumber: 12, keyword: "closes" })

console.log(parseBareLineReference("closes #12 for real"));
// Option.none() — the bare-line dialect takes the whole line or nothing
```

## Closing lists

`parseClosingList` reads one whole line naming several issues under a single keyword. Items are `#<digits>` separated by a comma, by `and`, or by the Oxford `, and`, and the keyword's colon is optional as in the bare-line dialect.

```ts
import { parseClosingList } from "@beep/scratchpad/effected/github-references";

console.log(parseClosingList("Fixes #1, #2, and #3"));
// Option.some({ keyword: "fixes", issueNumbers: [1, 2, 3] })

console.log(parseClosingList("Closes #1 and please review"));
// Option.none() — trailing prose rejects the line rather than parsing a prefix
```

`parseReferenceList` is the wider reading of the same line. It additionally accepts the non-closing `REFERENCE_KEYWORDS` — `ref`, `refs`, `references` — which associate an issue without closing it, and reports which set matched through a `closing` flag. `parseClosingList` is the closing-only view of exactly that engine, so a `Refs:` line is `Option.none()` there and `closing: false` here:

```ts
import { parseClosingList, parseReferenceList } from "@beep/scratchpad/effected/github-references";

console.log(parseReferenceList("Refs #7, #8"));
// Option.some({ keyword: "refs", closing: false, issueNumbers: [7, 8] })

console.log(parseClosingList("Refs #7, #8"));
// Option.none() — a reference list, but not a closing one
```

## Harvesting reference lists inline

`harvestReferenceLists` generalizes the closing-list grammar to the inline-in-prose posture: several lists can share one line of running text, each ending at its own last valid item.

```ts
import { harvestReferenceLists } from "@beep/scratchpad/effected/github-references";

console.log(harvestReferenceLists("Closes #123, Fixes #456"));
// [ { keyword: "closes", closing: true, issueNumbers: [123], start: 0, end: 11 },
//   { keyword: "fixes", closing: true, issueNumbers: [456], start: 13, end: 23 } ]
```

Both keyword sets play, exactly as in `parseReferenceList`, and each hit carries `start` / `end` offsets like `harvestIssueReferences`. An issue number past `Number.MAX_SAFE_INTEGER` anywhere in a candidate drops the whole candidate, never a partial list, and scanning resumes after it.

## Reading a multi-line text

`parseBareLines`, `parseClosingLists` and `parseReferenceLists` apply their single-line parser across every line of a text and collect the hits in order. Rejected lines contribute nothing, and results carry no line numbers — a caller that needs positions keeps its own split loop.

```ts
import { parseBareLines, parseClosingLists } from "@beep/scratchpad/effected/github-references";

console.log(parseBareLines("Closes: #12\nsome unrelated line\nFixed #34"));
// [ { issueNumber: 12, keyword: "closes" }, { issueNumber: 34, keyword: "fixed" } ]

console.log(parseClosingLists("Fixes #1, #2\nRefs #9\nCloses #3 and #4"));
// [ { keyword: "fixes", issueNumbers: [1, 2] }, { keyword: "closes", issueNumbers: [3, 4] } ]
```

`parseReferenceLists` reads the same lines the wider way, admitting `REFERENCE_KEYWORDS` alongside the closing nine.

### Collecting both postures at once

`collectReferenceLists` reads a text the way a real trailer/prose interleave actually looks: each line is tried as a whole-line reference list first (colon-tolerant, per `parseReferenceList`), and only a line that isn't one is harvested inline (no colon, per `harvestReferenceLists`). That preference order means a colon-less trailer line contributes its list exactly once, never once per posture. Results carry no offsets — this is the line-granular reading; a caller that needs spans reaches for `harvestReferenceLists` directly.

```ts
import { collectReferenceLists } from "@beep/scratchpad/effected/github-references";

console.log(collectReferenceLists("Fixes: #10\nprose mentioning closes #11"));
// [ { keyword: "fixes", closing: true, issueNumbers: [10] },
//   { keyword: "closes", closing: true, issueNumbers: [11] } ]
```

## Keyword families

`keywordFamily(keyword)` collapses any of the twelve keywords across both sets to one of four families — `"close"`, `"fix"`, `"resolve"`, `"ref"` — for a caller building a Closes/Fixes/Refs-style map instead of switching on all twelve spellings by hand.

```ts
import { keywordFamily } from "@beep/scratchpad/effected/github-references";

console.log(keywordFamily("resolved"));
// "resolve"
```

## Grammar rules worth knowing

- **The `#` is mandatory in every dialect.** `closes: 123` is not a reference; GitHub does not link it, and a parser that accepts it reports links that were never made.
- **The list dialects are whole-line.** Same-line whitespace is `[ \t]` only, so an embedded newline cannot smuggle a second line past a parser whose contract is one line, and trailing content rejects the line instead of yielding a partial reading.
- **A list never continues past a newline, inline or whole-line — though an inline one may open across one.** `harvestReferenceLists`'s continuation separators are `[ \t]` only, so once a candidate has its first item the list ends at the line; the one newline-tolerant spot is the opening gap between the keyword and the first `#`, which takes any whitespace exactly like `harvestIssueReferences`. And like that harvest, it takes no colon — the colon spelling belongs to `parseReferenceList` and the bare-line dialect.
- **Duplicates are preserved, in order.** Whether `#12, #12` means one issue or two is the caller's business; collapsing them would destroy evidence a caller may be linting for.
- **Keyword case does not matter, and the result is canonical.** `CLOSES`, `Closes` and `closes` all match, and `keyword` always comes back lowercased.
- **Unsafe issue numbers are treated differently on purpose.** Digits past `Number.MAX_SAFE_INTEGER` make the prose harvest *skip that one match*, while the list dialects — whole-line and inline — reject the *whole line or candidate*: surrounding prose makes no claim about a skipped number, but a list is a single claim about a set of issues that a partial result would misrepresent.
- **No input is truncated and no length cap applies.** The list dialect is parsed by a single character-by-character scan — no regular expressions at all — so a hostile line cannot trigger catastrophic backtracking and there is nothing to defend with truncation.

## Out of scope

Cross-repo references (`owner/repo#12`) and full-URL references (`https://github.com/owner/repo/issues/12`) are real GitHub spellings that this package does not read yet — guessing at their shape would freeze an API nobody has driven. Issue *state* is out of scope too, because state is not grammar, and anything that asks GitHub a question belongs to [`@effected/github`](https://www.npmjs.com/package/@effected/github).

## Coming from @effected/github

The grammar used to live in `@effected/github`, which still re-exports exactly the six original names — `CLOSING_KEYWORDS`, `ClosingKeyword`, `IssueReference`, `harvestIssueReferences`, `BareLineReference`, `parseBareLineReference` — so code written against the old home keeps compiling. That re-export is a compatibility shim and may be dropped at a later `@effected/github` release; the closing-list surfaces are deliberately not part of it. Import from this package instead, and drop the `@effected/github` dependency entirely if the grammar is all you wanted from it.

## Features

- `harvestIssueReferences(text)` — every inline closing reference in running text, in document order, each with `issueNumber`, canonical `keyword` and `start` / `end` offsets.
- `harvestReferenceLists(text)` — every reference list found inline in running text, in document order, each with `keyword`, `closing`, `issueNumbers` and `start` / `end` offsets.
- `parseBareLineReference(line)` — the one reference a whole trimmed line carries, colon optional, as an `Option`.
- `parseBareLines(text)` — every bare-line reference in a multi-line text, one per line, collected in order.
- `parseClosingList(line)` — the issues a whole line names under one of the nine closing keywords, comma-, `and`- or Oxford-separated.
- `parseClosingLists(text)` — `parseClosingList` applied across every line of a text, collected in order.
- `parseReferenceList(line)` — the same line under the closing *and* non-closing keyword sets, reporting which matched through a `closing` flag.
- `parseReferenceLists(text)` — `parseReferenceList` applied across every line of a text, collected in order.
- `collectReferenceLists(text)` — every reference list in a multi-line text, whole-line first and inline only for a line that isn't one, so a colon-less trailer line never counts twice.
- `keywordFamily(keyword)` — a keyword's tense-collapsed family: `close`, `fix`, `resolve` or `ref`, total over both keyword sets.
- `CLOSING_KEYWORDS` / `ClosingKeyword` — the nine keywords GitHub acts on, and the type of one of them.
- `REFERENCE_KEYWORDS` / `ReferenceKeyword` — the three non-closing keywords that associate without closing.
- `IssueReference`, `BareLineReference`, `ClosingList`, `ReferenceList`, `HarvestedReferenceList` — the result types, one per dialect reading.
- `KeywordFamily` — the type of `keywordFamily`'s return value.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/github-references` 0.7.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

| Export | Facets | Why |
| --- | --- | --- |
| `ListKeyword` | value, type | Added by review round 1; see the deviations below. |

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Lab uses typed Enum record lookups and closing flags where upstream used two native keyword Sets (scratchpad/test/github-references/ClosingList.test.ts:139; scratchpad/test/github-references/ClosingList.test.ts:176).
- **schema-first** — Lab exports four LiteralKit domains and five Struct models with derived types where upstream supplied tuples, a union and interfaces, retaining plain parser outputs (scratchpad/test/github-references/IssueReferences.test.ts:92,101; scratchpad/test/github-references/ClosingList.test.ts:139,151; scratchpad/test/github-references/KeywordFamily.test.ts:13).
- **numeric-domains** — Lab adds safe integer runtime model constraints where upstream interfaces declared number fields, retaining upstream scanner rejection (scratchpad/test/github-references/IssueReferences.test.ts:101; scratchpad/test/github-references/ClosingList.test.ts:151).
- **type-safety** — Lab obtains checked typed keywords through Enum lookups where upstream cast parsed keywords and closing-only projections (scratchpad/test/github-references/IssueReferences.test.ts:117; scratchpad/test/github-references/ClosingList.test.ts:176).
- **effect-first** — Lab uses Option absence and Effect string/flow helpers where upstream used undefined sentinels and native line-processing methods, retaining parser semantics (scratchpad/test/github-references/IssueReferences.test.ts:126,137; scratchpad/test/github-references/ClosingList.test.ts:188,209).
- **effect-imports** — Lab uses dedicated effect/<Module> imports in source, tests and the example where upstream imported the root effect barrel (module suite scratchpad/test/github-references/**).
- **identity-annotations** — Lab annotates domains, models and fields through three $ScratchpadId composers where upstream had no identity annotations (module suite scratchpad/test/github-references/**).

### Dependency backlog

None.
