<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the glob port read-only against the pinned upstream oracle and round-1 inventory, and report only new findings.The remaining check is the brace-class parser against the pinned oracle, then I will report only new findings.The class-parser tails match. Next I will check the ledger so I do not re-raise closed items, then look for a divergence the gates would miss.The sparse globstar path may return false where the oracle throws. I will probe both implementations without writing anything.### fable-2-1
- file: scratchpad/effected/glob/internal/minimatch.ts:1400
- class: bug   severity: required
- standard: D9 and section 14   evidence: the pinned oracle `#matchGlobStarBodySections` tail scan (`packages/glob/src/internal/minimatch.ts:770-776`) calls `startsWith` on every remaining file slot. For `matchOne(["a", "b", undefined, "c"], [GLOBSTAR, "b", GLOBSTAR, "c"])` the head is empty, the tail `"c"` matches index 3, the body `"b"` matches at index 1, and the next section then reads index 2. The oracle throws `TypeError` from `startsWith`. The lab returns `false` at line 1400. `scratchpad/test/glob/internal/minimatch.coverage.test.ts:56` locks that `false`. No ledger deviation records this result. Law 7 and D15 forbid reproducing the throw with `new TypeError` or `as string`.
- failure: a file array that contains `undefined` between globstar body sections is a non-match in the lab and a thrown `TypeError` in the oracle.
- fix: record the deviation under law 7 and D15, citing that coverage test, in the ledger and README Port notes. Keep the `false` return.

### fable-2-2
- file: scratchpad/effected/glob/internal/minimatch.ts:1470
- class: bug   severity: required
- standard: D9 and section 14   evidence: the oracle `#matchOne` (`minimatch.ts:825-847`) has no undefined-slot return. A non-string pattern slot falls through to `p.test(f)`. `matchOne(["a"], [undefined])` therefore throws `TypeError`. A regexp slot against an undefined file slot runs `RegExp.prototype.test`, which stringifies `undefined` to `"undefined"` and can match. The lab returns `false` for either slot. `minimatch.coverage.test.ts:55` locks `matchOne(["a"], sparse)` as `false`. The type-safety ledger entry does not record this result.
- failure: `matchOne` on an undefined pattern slot is `false` in the lab and a thrown `TypeError` in the oracle. An undefined file slot against a compiled regexp is `false` in the lab and the regexp’s match of `"undefined"` in the oracle.
- fix: record the same law 7 and D15 deviation for this guard, citing `minimatch.coverage.test.ts:54-55`.

### fable-2-3
- file: scratchpad/effected/glob/internal/minimatch.ts:1083
- class: bug   severity: required
- standard: D9   evidence: the oracle `partsMatch` (`minimatch.ts:528-531`) compares slots with `av === bv` before any string method. Two undefined slots are equal, so `partsMatch(new Array(1), new Array(1))` returns `[undefined]`. The lab returns `false` at line 1083. Mixed undefined and `"a"` already returns `false` on both sides, which is what `minimatch.coverage.test.ts:52-53` checks. String patterns never build holes, so the compile path stays aligned.
- failure: two undefined slots at the same index are incompatible in the lab and a successful one-element merge in the oracle.
- fix: delete the early return and apply `startsWith` only after a string check, so `av === bv` still treats two undefined slots as equal.

### fable-2-4
- file: scratchpad/effected/glob/internal/ast.ts:643
- class: docs   severity: backlog
- standard: D4 carried JSDoc must describe the code   evidence: `#fillNegs` at line 658 no longer checks `this !== this.#root`. The coverage ledger entry records that removal. The Details sentence still says a child call throws `ASTError`.
- failure: the private documentation describes a throw the method does not perform.
- fix: delete that sentence from the Details block.

REQUIRED: 3
BACKLOG: 1
