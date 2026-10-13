I'll review the yaml visitor, parser, and document internals against the pinned upstream oracle and the port decisions, and I won't repeat anything round 1 already closed.Round 1 already closed the visitor, lexer, and fold items. I'll read the current sources against the pinned oracle and look only for defects that survived those fixes.The fold and equality helpers match the recorded fixes. Next I’ll check the lexer and CST walker for incomplete repairs and new divergences.The remaining review is the quoted-scalar CR fold and the lexer indent reset. I will pin those against the oracle and the recorded deviations before writing findings.### grok-2-1
- file: scratchpad/effected/yaml/internal/cst-visitor.ts:469
- class: bug   severity: required
- standard: D11 bug; YAML 1.2 block-mapping empty keys. Not a re-raise of cst-empty-values (that fix stays).   evidence: `findMapContent` skips newlines, then `expectingKey = true` whenever any later sibling source is `:`. For `a: 1\n: 2\n` the block-map children are `:`, `1`, newline, `:`, `2`. The scalar `1` is therefore forced to a key and `2` is emitted as its value. `cstEvents` yields keys `a`, `1` and value `2`. The same input is two entries, key `a` value `1` and an empty key value `2`. `: 1\n: 2\n` likewise yields key `1`, value `2` instead of two empty-key values. Upstream does not promote across `:`, so this mislabel is new. Same-line cases the suite already pins (`a:\nb: 2`, `b: 1`) keep the promotion.
- failure: A value scalar before an empty-key `:` is reported as the next key, and the empty key disappears.
- fix: Promote only when the `:` has no newline between it and the scalar. Add CST projections for `a: 1\n: 2\n` and `: 1\n: 2\n`.

### grok-2-2
- file: scratchpad/effected/yaml/internal/fold.ts:62
- class: docs   severity: backlog
- standard: D9; section 14 (one ledger row per behavioural divergence)   evidence: Upstream `fold.ts` keeps a pending split across `\n`, so `foldScalarLine("hello world\nthis is longer", "", 20, 0)` folds the 11-character first line at the space. The lab clears that split and sets `end = i + 1 + lineWidth`, returning the input unchanged. `scratchpad/test/yaml/internal/fold.property.test.ts:19` pins the new idempotence. README Port notes and the `w1-yaml` deviations record only the more-indented compensation blank, not this width-fold change.
- failure: Width-fold bytes diverge from the pinned upstream and the deviation is unrecorded.
- fix: Add one `upstream-bug` ledger and Port-notes row citing that property test. Do not revert the reset.

REQUIRED: 1
BACKLOG: 1
