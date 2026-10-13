### sol-2-1
- file: scratchpad/test/github-references/IssueReferences.property.test.ts:57
- class: test   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9/D10/D11 and §11.4; `IssueReferences.ts` documents newline-tolerant inline whitespace and same-line bare-reference whitespace.   evidence: A read-only `bun --no-cache -e` probe reproduced the exact assertion with `text = "fixes\n#1"`. `harvestIssueReferences(text)` returns `{ issueNumber: 1, keyword: "fixes", start: 0, end: 8 }`, while `parseBareLineReference(text.slice(0, 8))` returns `None`; line 57 expects `Some({ keyword: "fixes", issueNumber: 1 })` and throws. Both parsers agree with the pinned upstream oracle on this input.
- failure: The new fidelity property asserts a false relationship between two deliberately different dialects: every inline match must also be a valid bare-line reference. Valid inline references whose opening whitespace contains a newline violate that assertion. The structured positive sample at line 52 always uses a tab, so it does not expose this contradiction.
- fix: Validate the projected keyword and issue number through `parseBareLineReference(stringifyBare(hit))`, while keeping the existing harvest normalization and exact-offset comparisons. Add newline-containing opening gaps to the structured positive samples so the property explicitly preserves the documented dialect distinction. Preserve both parsers’ behavior.

### sol-2-2
- file: scratchpad/test/github-references/ClosingList.property.test.ts:46
- class: test   severity: required
- standard: `goals/effect-vitest-canon/SPEC.md` D5; `scratchpad/EFFECTED_PORT_GOAL.md` §11.2 requires Option assertions through `@effect/vitest/utils`.   evidence: Line 46 compares two `O.Option<T>` values with `assert.deepStrictEqual`; lines 81, 82 and 86 likewise compare parser Options directly against `O.some(...)` or `O.none()`. The new `IssueReferences.property.test.ts` repeats this at lines 39, 57 and 64–65. These property files were absent from the round-1 review commit `3fa5876691901fccf3d1cd29e9324564df134b56`; these are new S3 occurrences. The stated green gates at `a12bef2` therefore missed these noncanonical container assertions.
- failure: The newly added properties bypass the binding Option assertion contract, comparing container representations instead of asserting Some/None and their payloads through the canonical helpers.
- fix: Use `assertSome(actual, expectedPayload)` and `assertNone(actual)` for known outcomes. For round-trip comparisons with a generated expected Option, match on that expected Option and invoke the corresponding canonical helper on the actual result. Apply this to the new property files while retaining ordinary assertions for plain arrays, strings and schema values.

REQUIRED: 2
BACKLOG: 0