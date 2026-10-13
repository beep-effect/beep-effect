### sol-2-1
- file: scratchpad/effected/git/Git.ts:2632
- class: bug   severity: required
- standard: D9, D11, section 14 `upstream-bug`; `GitShape.commonDir` at lines 4209–4221 promises repository identity with only Git’s terminating newline removed.   evidence: A read-only `bun -e` probe provided successful stdout through `scratchpad/test/git/fixtures.ts`’s scripted spawner and called both the port and pinned oracle. Both converted `"/repo/.git\r\n"` to `"/repo/.git"`, losing a pathname’s trailing CR, and rejected `"/repo\npart/.git\n"` with `GitCommandError: unparseable common-dir output (--path-format needs git 2.31 or later)`. These violate the pathname-fidelity property for valid Unix directory names containing CR or LF; no corresponding accepted deviation or round-1 finding exists.
- failure: A common directory ending in CR produces the wrong repository identity. A repository whose directory contains LF cannot be identified even when a supported Git version returns a successful absolute path.
- fix: On the Unix output path, remove exactly the final LF and preserve preceding pathname bytes. Remove the blanket `answer.includes("\n")` rejection; retain detection of the older Git response beginning with the echoed `--path-format` flag. Add CR/LF fidelity regressions and record the verified upstream-bug deviation under section 14.

### sol-2-2
- file: scratchpad/effected/git/Git.ts:1786
- class: law   severity: required
- standard: `standards/effect-first-development.md` EF-3 explicitly prohibits `JSON.parse` and `JSON.stringify`; D5 and D11.   evidence: `rg -n 'JSON\.stringify' scratchpad/effected/git/Git.ts` finds the native encoder inside `rejectOptionLikeRefs`. The stated green gates therefore leave this concrete EF-3 violation undetected. Round-1 `git-x1` rejected restoring native JSON encoding in `commonDir` under this same law; it did not close or authorize this remaining call. The ledger’s schema-first deviation records the `commonDir` conversion, without granting an exception here.
- failure: Every ordinary option-like argument refusal still constructs its diagnostic through the forbidden native JSON API, leaving two diagnostic-string encoding paths governed by different implementations.
- fix: Reuse the existing `encodeJsonString` schema codec for `offending`, composing its result into the same typed refusal. Preserve the diagnostic bytes, `kind: "refused"`, pre-spawn behavior, and the separate sensitive-value redaction branch.

### sol-2-3
- file: scratchpad/effected/git/Git.ts:1821
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 17; `standards/effect-first-development.md` EF-12b requires named or reused domain constraints to be schemas with schema-derived guards; D5 and D11.   evidence: `rejectNonNaturalNumber` implements the named nonnegative-integer domain with `Number.isInteger(value) && value >= 0`, reused for fetch depth, both submodule depths, log limit, stash indexes, and rev-list limit. No schema owns this constraint. A read-only probe confirmed that `S.Finite.check(S.isMultipleOf(1), S.isGreaterThanOrEqualTo(0))` matches the current predicate on negative values, signed zero, fractions, NaN, infinities, and large integral values including `9007199254740992` and `1e30`. The green gates have not enforced this schema-first requirement.
- failure: The shared numeric acceptance contract remains an imperative predicate, so its validation, metadata, and generated domain cannot derive from the schema required by the binding standard.
- fix: Define one identity-annotated module-local schema for the existing numeric domain and use `S.is(...)` in the refusal helper. Preserve acceptance of omitted values and the existing error payload. Avoid substituting `S.Natural` directly: the reference implementation restricts it to safe integers, which would narrow upstream behavior.

REQUIRED: 3
BACKLOG: 0