I'll review the github-references port against the pinned upstream oracle and the binding decisions, and report findings only. First I'm loading the review surfaces and the recorded deviations so I don't re-raise accepted ones.The review is confined to the github-references lab and the pinned oracle. Next I’ll read the binding decisions, recorded deviations, and both trees.Index and keyword family match the oracle aside from the `.js` → `.ts` rewrite. I’ll diff the parsers and tests next.### grok-1-1
- file: scratchpad/effected/github-references/IssueReferences.ts:51
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; D5 (LiteralKit for named literal domains, kits land in S4); schema-first repo-laws §9   evidence: `ClosingKeyword` is a named domain (`export type ClosingKeyword` at line 51, used by `IssueReference`, `BareLineReference`, and `KeywordFamily`). The membership guard at line 53 is an anonymous `S.is(S.Literals(CLOSING_KEYWORDS))`. Law 19 reserves `S.Literals` for an anonymous inline union that is never named. The four S1 gates do not check this. `S.is` of a `LiteralKit` built from the same `CLOSING_KEYWORDS` tuple is the same membership test, so results stay identical.
- failure: The keyword domain and its guard are two parallel definitions. Callers of the named type have no kit (`.Enum`, per-member `.is`, `$match`).
- fix: Keep `CLOSING_KEYWORDS` as the value export. Add an unexported `const ClosingKeyword = LiteralKit(CLOSING_KEYWORDS)`, set `isClosingKeyword` to `S.is(ClosingKeyword)`, and change the type to `export type ClosingKeyword = typeof ClosingKeyword.Type`. Leave the kit unexported so the barrel kinds stay as they are.

### grok-1-2
- file: scratchpad/effected/github-references/ClosingList.ts:60
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; D5; schema-first repo-laws §9   evidence: `ReferenceKeyword` is named at line 60. Lines 92 and 95 build two more anonymous `S.Literals` schemas, one for `[...CLOSING_KEYWORDS, ...REFERENCE_KEYWORDS]` and one again for `CLOSING_KEYWORDS`. `parseReferenceList` (line 228) and `harvestReferenceLists` (line 430) both depend on those guards. Same runtime membership as today's `S.is(S.Literals(...))`.
- failure: `ReferenceKeyword` can drift from the guard that accepts it, and the closing-keyword schema is rebuilt instead of derived from the `IssueReferences` domain.
- fix: Unexported `LiteralKit(REFERENCE_KEYWORDS)` for `ReferenceKeyword`, and `S.is` of one `LiteralKit` over the concatenated tuple for `isReferenceKeyword`. Derive `isClosingKeyword` from the `IssueReferences` kit (or a second unexported `LiteralKit(CLOSING_KEYWORDS)` in this file). Keep both consts as the value exports. Keep the kits unexported.

### grok-1-3
- file: scratchpad/effected/github-references/KeywordFamily.ts:19
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; D5; schema-first repo-laws §9   evidence: `KeywordFamily` is the named four-stem domain, written as a hand-rolled union. `FAMILIES` (line 26) is the exhaustive `Record<ClosingKeyword | ReferenceKeyword, KeywordFamily>` the module documents as the totality proof. No schema exists for the stem union.
- failure: The stem domain is only a type alias, so it is outside `LiteralKit` and `S.is`.
- fix: `const KeywordFamily = LiteralKit(["close", "fix", "resolve", "ref"])` with no `as const` on that array, and `export type KeywordFamily = typeof KeywordFamily.Type`. Keep `FAMILIES` and `keywordFamily` as they are so a keyword added to either const array still fails the record. Leave the kit unexported.

### grok-1-4
- file: scratchpad/effected/github-references/IssueReferences.ts:60
- class: schema   severity: backlog
- standard: schema-first repo-laws §1 and §2; D9; section 14   evidence: Exported pure-data interfaces: `IssueReference` (line 60), `BareLineReference` (line 80), `ClosingList` (ClosingList.ts:67), `ReferenceList` (ClosingList.ts:79), `HarvestedReferenceList` (ClosingList.ts:365). Upstream tests use `assert.deepStrictEqual` against plain object literals (`scratchpad/test/github-references/IssueReferences.test.ts:16`, `ClosingList.test.ts:167`). `S.Class` instances compare unequal under `deepStrictEqual` because prototypes differ. §2 says `S.Struct` when the boundary shape is the real output and a class adds nothing.
- failure: The result models are not schemas. Turning them into classes changes the values the upstream suite pins.
- fix: Hold for a recorded section 14 cause. If a later stage converts them, use `S.Struct` so the boundary stays a plain object, and adjust the smallest `deepStrictEqual` expectations in the same change.

### grok-1-5
- file: scratchpad/effected/github-references/IssueReferences.ts:110
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-2   evidence: `safeIssueNumber` returns `number | undefined`. Callers at lines 145 and 183 branch on `=== undefined`. `scanSeparator` (ClosingList.ts:148) and `unsafeNext` (ClosingList.ts:448) use the same sentinel. Public parsers already return `Option` or skip the match. Upstream behavior of those parsers is unchanged.
- failure: Domain helpers still signal absence with `undefined`.
- fix: Return `O.Option<number>` from `safeIssueNumber` and consume it with `O.match` or `O.isSome` at the two call sites. Same skip and reject results.

### grok-1-6
- file: scratchpad/effected/github-references/IssueReferences.ts:118
- class: jsdoc   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §10.2; .patterns/jsdoc-documentation.md   evidence: S2 has not run. Value and type exports still carry `@public`, `@remarks`, and `@example` (`IssueReferences.ts`, `ClosingList.ts`, `KeywordFamily.ts`, `index.ts` `@packageDocumentation` at line 31). No `@category` or `@since 0.0.0`. Examples that were rewritten already use `effect/Option` and `./index.ts`.
- failure: Docgen with `enforceDescriptions`, `enforceExamples`, and `enforceVersion` will reject these carriers.
- fix: Carrier conversion in the S2 pass: `@remarks` to `**Details**` or `**Gotchas**`, `@example` to a titled `**Example**`, add `@category` and `@since 0.0.0`. Keep every example body.

### grok-1-7
- file: scratchpad/effected/github-references/README.md:3
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §10.3   evidence: The title and the Port notes block (line 206) match §10.3, including upstream `0.7.0` from the oracle `package.json`. Still present: npm, license, Node, and TypeScript badges (lines 3–6), the pre-1.0 stability block and `@effected/pnpm-plugin-effect` (lines 10–20), the Install section (lines 28–42), and example imports from `@effected/github-references` (lines 49, 64, 78, 92, 104, 118, 132, 148, 160).
- failure: The README is still the upstream package page with a lab title.
- fix: In the S2 README pass, drop the badges, the stability block, and the Install section, and point the examples at the lab barrel. Leave the Why, grammar, and Features prose.

REQUIRED: 3
BACKLOG: 4
