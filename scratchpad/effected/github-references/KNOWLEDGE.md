# github-references — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/github-references/CLAUDE.md -->
# @effected/github-references

GitHub's issue-reference grammar as pure functions: the nine closing keywords and three dialects, strings in and values out — no service, no layer, no client. Extracted from `@effected/github`, which keeps a droppable compat re-export. Published. (File and test counts move; run `pnpm vitest run --project @effected/github-references`.)

**Tier: pure.** Peer-depends on `effect` only; zero runtime dependencies, no IO, `"sideEffects": false`. Never add a dependency here — the package exists so a consumer with no octokit can speak the grammar instead of re-deriving it.

**Design doc:** `@./okf/modules/github-references.md` — load when changing a dialect, adding a keyword set, or ruling on a disagreement with a downstream hand-rolled copy.

## The three dialects

- **Inline-in-prose** — `harvestIssueReferences` (`src/IssueReferences.ts`) scans running text (`fixes #12 and closes #13`), whitespace mandatory, **no colon**, and each hit carries offsets.
- **Bare-line** — `parseBareLineReference` (`src/IssueReferences.ts`) takes the whole trimmed line as the reference (`Closes: #12`), colon **optional**, no offsets: the line *is* the reference, so an offset would restate a constant.
- **Closing-list** — `parseClosingList` / `parseReferenceList` (`src/ClosingList.ts`) read one whole line naming several issues (`Closes #247, #248 and #251`), separated by `,`, by `and`, or by the Oxford `, and`.

**One regex for all of them is the tempting simplification and it fails invisibly.** Accepting the colon inline harvests references GitHub will *not* link, so a pipeline reports an issue closing that merging leaves open. Dialects differ because producers differ — prose for GitHub's scanner, a generated region for humans. Apply that rule if a fourth dialect appears.

## The four adoption-driven surfaces

Downstream adoption drove four additive gaps — none changes a ruling above, none widens the compat re-export below:

- **`harvestReferenceLists(text)`** (`src/ClosingList.ts`) — the closing-list grammar worn inline (`Closes #123, Fixes #456` on one line), a gap neither shipped dialect covered; returns `HarvestedReferenceList` (`ReferenceList` plus `start`/`end`).
- **`parseBareLines`** (`src/IssueReferences.ts`), **`parseClosingLists`**, **`parseReferenceLists`** (`src/ClosingList.ts`) — apply the matching single-line parser across a whole text, one result per line, no line numbers by design.
- **`keywordFamily`** (new `src/KeywordFamily.ts`) — projects any keyword to `"close" | "fix" | "resolve" | "ref"`.
- **`collectReferenceLists(text)`** (`src/ClosingList.ts`) — per line, whole-line `parseReferenceList` first (colon-tolerant), else the line is harvested inline; replaces the trailer/prose interleave downstream hand-rolled (round-2 dogfood finding).

## Rules that are load-bearing

- **`#` is mandatory in every dialect.** `closes: 123` is rejected; GitHub won't link it, and the downstream copy that accepted it reported links GitHub never made.
- **The closing set is the canonical nine.** `REFERENCE_KEYWORDS` (`ref`, `refs`, `references`) is a **separate, non-closing** set: `parseReferenceList` reports it `closing: false`, `parseClosingList` returns `Option.none()`. Never merge the sets or drop below nine — under-linking is silent.
- `parseClosingList` is the closing-only **view** of `parseReferenceList`'s engine, not a second parser. Keep it that way.
- **Every keyword table derives from the keyword constants**, so a keyword added to either set can't drift from the grammar reading it; `closing` is membership in `CLOSING_KEYWORDS`, widened once so no call site casts.
- **The list dialect is whole-line.** Whitespace is `[ \t]` only, so an embedded newline cannot smuggle a second line in, and trailing prose **rejects** the line rather than yielding a partial reading.
- **Duplicates are preserved.** Whether `#12, #12` means one issue or two is the caller's business; collapsing them destroys evidence a caller may be linting for.
- **The unsafe-integer asymmetry is deliberate.** Past `Number.MAX_SAFE_INTEGER`, prose **skips that one match**; the list dialect **rejects the whole line** — a skipped number claims nothing, a list line claims a set. Never "fix" them into agreement.
- **ReDoS posture: one left-to-right scan, no regular expressions at all.** Linearity holds by construction, so no scanner — CodeQL included — can flag it. **No input is truncated**: truncation is the silent change a mega-regex would force. Do not add a length cap.
- **The inline harvester's two whitespace classes are deliberate — never unify them.** Keyword→first-item gap: any whitespace, newlines included. List continuation: `[ \t]` only, so a list can never cross a newline.
- **An unsafe item poisons the whole inline candidate**, not just that item — echoing the whole-line rejection, not the prose skip.
- **The inline `and` separator is lowercase-only.** `closes #1 AND #2` harvests only `#1`. Loosening it is a grammar change, not a local fix; treat a hit as a design conversation.
- **`keywordFamily` is a total `Record`, never `startsWith`.** A keyword added to either set without a family entry is a compile error, not a silent miscategorization.
- **`collectReferenceLists`'s whole-line-first preference is the once-per-posture guarantee.** A colon-less trailer line matches `parseReferenceList` and stops there; only a line it rejects reaches `harvestReferenceLists`. Never reorder the two probes — reversing them double-counts that line.

## Out of scope, on purpose

Cross-repo (`owner/repo#N`) and full-URL (`https://github.com/owner/repo/issues/N`) references; issue-*state* classification — state is not grammar; anything querying GitHub, which is `@effected/github`'s tier.

## The @effected/github compat re-export

`@effected/github` takes this package as a `workspace:^` dependency **for one reason**: it re-exports six moved names — `CLOSING_KEYWORDS`, `ClosingKeyword`, `IssueReference`, `harvestIssueReferences`, `BareLineReference`, `parseBareLineReference` — so old-home consumers keep compiling. Riders:

- The re-export is **droppable at a later `github` bump** — `github`'s `__test__/IssueReferencesCompat.test.ts` stops it lapsing silently before then.
- The closing-list surfaces are deliberately **not** re-exported from `github`. New consumers import this package; widening the surface would make it permanent by accident.

## Testing and building

Tests live in `__test__/`, use `@effect/vitest`, assert with `assert.*` — never `expect`. The suite moved from `github` **unchanged**, the check that the move was a move; do not rewrite it. The closing-list suite carries the design doc's drift rulings as executable cases, plus a hostility case pinning the linear-time posture. `KeywordFamily.test.ts` and the adoption-driven cases pin the rules above: whitespace-class split, lowercase-only `and`, exhaustive twelve-keyword `keywordFamily` coverage, and `collectReferenceLists`'s once-per-posture preference.

```bash
pnpm vitest run --project @effected/github-references   # this package's tests, from the repo root
pnpm build --filter @effected/github-references         # dev + prod, from the repo root
```

Never run `node savvy.build.ts --target prod` directly. `package.json` stays `"private": true`.


---
<!-- okf/modules/github-references.md -->
---
type: Module
title: "@effected/github-references"
description: GitHub's issue-reference grammar as pure functions, extracted from @effected/github.
status: stable
kind: package
resource: ../../packages/github-references
tags: [bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 989d8c3e20ed123dca6c742568404bc04f1c71371f0a89a6e0dc2dfd9565bd7f
---

# @effected/github-references

`@effected/github-references` is GitHub's issue-reference grammar as pure
functions: the nine closing keywords, a separate non-closing reference set,
and three dialects that read them. Strings in, values out — no service, no
layer, no client. `packages/github-references/src/` is three modules: the
two prose-and-line dialects (`IssueReferences.ts`), the list dialect with
its inline form (`ClosingList.ts`) and the keyword-family projection
(`KeywordFamily.ts`).

It is a package rather than a corner of [`@effected/github`](github.md)
because the grammar and the GitHub client have opposite dependency costs.
Pure-but-GitHub-shaped vendor rules belong in the kit rather than in a
consumer, but that rule says nothing about *which* kit package hosts them:
hosting the grammar beside the client cost `github`'s own consumers nothing
and cost an octokit-free consumer the whole client tree for a few lines of
pure string work — see
[the extraction decision](../decisions/github-references-extracted-for-install-weight.md).
The test before hosting the next pure vendor rule is not "does a client
already link here" but "can the consumers most likely to re-derive it
actually reach it".

## Tier and dependencies

**Pure tier**, per [the tier taxonomy](../glossary/library-tier.md). `effect`
is the only peer; zero regular dependencies, no services, no layers, no `R`
anywhere, `"sideEffects": false`. The inline and bare-line dialects are regex
and string work; everything in `ClosingList.ts` is a regex-free character
scan.

The dependency arrow points at this package: `@effected/github` takes it as
a regular `workspace:^` dependency, for one reason only — see
[the compat re-export](#the-github-compat-re-export).

## Naming

`@effected/github-references`, directory `packages/github-references`. The
short form `github-refs` was rejected on two counts: inside the GitHub
domain "refs" is already git-refs vocabulary (`refs/heads/...`), so the
short name would name the wrong thing, and house style is unabbreviated.

## The three dialects

One regex for all three is the tempting simplification, and it is wrong in
a way nobody would notice: accepting the colon inline would harvest
references GitHub will not link, so a pipeline would report an issue as
closing when merging the pull request actually leaves it open. The dialects
differ because their producers differ — prose is written by humans for
GitHub's scanner, a generated region is written by tooling for humans — and
that is the rule to apply if a fourth dialect appears.

- **Inline-in-prose** (`harvestIssueReferences`, `src/IssueReferences.ts`)
  scans running text — `"fixes #12 and closes #13"` — with mandatory
  whitespace and no colon, because that is the spelling GitHub's own
  scanner honours when it decides what a pull request closes. Each hit
  carries offsets; a digit run outside the safe-integer range is skipped
  rather than parsed, since rounding it silently yields a different,
  existing issue number.
- **Bare-line** (`parseBareLineReference`, `src/IssueReferences.ts`) takes
  the whole trimmed line as the reference — `"Closes: #12"` — with an
  optional colon, because a generated references region writes one
  reference per line and the colon reads better there. It deliberately
  carries no offsets: the line *is* the reference, so an offset would be a
  constant restated.
- **The closing-list dialect** (`src/ClosingList.ts`) reads one whole line
  naming several issues — `Closes #247, #248 and #251` — through two entry
  points over one engine: `parseClosingList(line)` answers a `ClosingList`
  (closing keywords only), and `parseReferenceList(line)` answers a
  `ReferenceList`, the superset that also accepts the non-closing
  `REFERENCE_KEYWORDS` (`ref`, `refs`, `references`), because GitHub's
  linker links `Refs #N` without closing it. `closing` is the
  discriminator, and `parseClosingList` is the closing-only view of the
  same engine rather than a second parser — a commitlint rule needs the
  strict closing view, a changesets harvester needs the categorized
  superset, and a consumer that fused the two would either link nothing for
  `Refs` or claim `Refs` closes something.

### Grammar

A whole-line dialect, the bare-line posture rather than the prose one —
after trimming, the entire line must be `<keyword>[:] <ref-list>`:

- Keyword is case-insensitive, and the result carries the canonical
  lowercase form.
- The colon is optional, as in bare-line.
- Whitespace is `[ \t]` only, so embedded newlines cannot smuggle a second
  line into a single parse.
- List items are `#<digits>`, separated by `,`, by `and`, or by the Oxford
  `, and`. At least one item is required, and `#` is mandatory.
- Trailing prose rejects the line — a whole-line dialect that ignored a
  tail would report a partial reading of a line it did not actually
  understand.
- Duplicates are preserved; deduplication is the caller's business.
- Any item whose digits exceed `Number.MAX_SAFE_INTEGER` rejects the whole
  line — the deliberate contrast with `harvestIssueReferences`, which
  skips an unsafe match in prose, because in prose the surrounding text is
  not a claim about the skipped number, while a list line's partial
  reading would misrepresent it as referencing fewer issues than it does.

The head pattern is derived from the two keyword constants rather than
spelled a second time, so a keyword added to either set cannot drift from
the grammar that reads it, and `closing` is membership in
`CLOSING_KEYWORDS`, tested once against a widened set so no call site
casts.

## Drift settlements

Downstream hand-rolled copies of this grammar disagreed with each other.
The kit is the place that settles the disagreement, and each settlement is
a ruling, not an average:

| Question | Settlement |
| --- | --- |
| Keyword set | The canonical nine GitHub documents; narrower downstream variants converge upward. |
| Bare `closes: 123` | Rejected — `#` is mandatory, since GitHub requires it for a same-repo closing reference. |
| The `Refs` category | A separate, non-closing keyword set, surfaced through `parseReferenceList` with `closing: false`. |
| ReDoS posture | A single left-to-right character scan — `ClosingList.ts` contains no regular expressions at all, so worst-case time is linear by construction and no input truncation is needed. |

One accepted behaviour delta, agreed downstream in advance: the kit's
`[ \t]+` separator is tighter than a `\s+` some downstream copies used — a
whole-line dialect whose separator class contains newlines is not really a
whole-line dialect. The inline harvester keeps that separator class
unchanged and admits the wider `\s` set in exactly one place, the
keyword-to-first-item gap, where the inline posture requires it.

## The companion surfaces

Four surfaces sit beside the dialects, all additive, none reopening a
ruling above and none part of the compat re-export:

- **`harvestReferenceLists(text)`** (`src/ClosingList.ts`) — the closing-list
  grammar worn inline (`Closes #123, Fixes #456` on one line), a gap
  neither original dialect covered on its own. Results are
  `HarvestedReferenceList` — a `ReferenceList` widened with `start`/`end`
  offsets. Word boundaries hold on both sides of the keyword; the
  keyword-to-first-item gap admits any whitespace including newlines, while
  list continuation keeps `[ \t]` only, so a list cannot cross a newline;
  an unsafe item anywhere skips the entire candidate rather than yielding a
  partial list; and the `and` separator stays lowercase-only in prose, so
  `closes #1 AND #2` harvests only `#1` — loosening it is a grammar change,
  not a local tweak.
- **`parseBareLines`, `parseClosingLists`, `parseReferenceLists`** — the
  per-line application every call site was writing as a `split("\n")` plus
  an `Option`-collect loop. No line numbers, deliberately: most consumers
  only aggregate the references, and a consumer that needs positions keeps
  its own split loop.
- **`keywordFamily(keyword)`** (`src/KeywordFamily.ts`) — the
  close/fix/resolve/ref projection consumers were spelling as
  `keyword.startsWith("fix")`, replaced by an explicit total `Record` keyed
  by every keyword, so a keyword added to either set without a family entry
  is a compile error rather than a silent miscategorization.
- **`collectReferenceLists(text)`** — the per-line composition of the
  whole-line and inline postures, for a text that mixes generated trailer
  lines with human prose. Per line, `parseReferenceList` is tried first —
  colon-tolerant, the line dialect's posture — and only a line that is not
  a whole-line list falls through to `harvestReferenceLists` on that same
  line. A line that matches whole-line never also gets harvested, so a
  colon-less trailer line, valid under both readings, contributes its list
  exactly once.

## Out of scope, recorded

- **Cross-repo and full-URL references.** Neither dialect's consumers emit
  them, and guessing their shape would freeze an API nobody has driven.
- **Issue-state classification.** Issue state is not grammar; a second
  consumer should drive it, and the first will likely want it from the
  client rather than from a parser.
- **A `@changesets/get-github-info` replacement.** That is API-tier work —
  it queries GitHub — so it belongs to `@effected/github` if anywhere,
  never to a pure grammar package.

## The github compat re-export

`@effected/github` re-exports exactly the six names the grammar was
extracted from it under — `CLOSING_KEYWORDS`, `ClosingKeyword`,
`IssueReference`, `harvestIssueReferences`, `BareLineReference`,
`parseBareLineReference` — so consumers that adopted the grammar in its
old home keep compiling. That re-export is the only reason `github` depends
on this package — see
[the compat re-export decision](../decisions/github-compat-re-export-droppable.md).
Two riders: it is droppable at a later `github` bump, once consumers import
from the new home, and the closing-list surfaces and the companion
surfaces above are deliberately not re-exported from `github`, so the
compat surface cannot widen by accident.

The promise is a test, not a comment:
`packages/github/__test__/IssueReferencesCompat.test.ts` exercises the
value exports through the entry point and annotates values with the type
exports, so compiling is the assertion for the types.

## Testing

`@effect/vitest`, `assert.*` — never `expect`; tests in `__test__/`, one
file per module. The suite carries the drift settlements as executable
rulings rather than as prose: keyword casing and canonicalization, the
optional colon, each separator form including the Oxford comma, mandatory
`#`, trailing-prose rejection, duplicate preservation and the whole-line
rejection on an unsafe digit run sitting beside `harvestIssueReferences`'s
skip-in-prose behavior for contrast. A hostility case pins the ReDoS
posture — a pathological long line parses in linear time and is neither
truncated nor hung on. The companion surfaces pin their own rules the same
way, including `keywordFamily` asserted exhaustively over every keyword
rather than sampled, and `collectReferenceLists`'s once-per-posture
preference, including a colon-less line proven to contribute once rather
than twice.
