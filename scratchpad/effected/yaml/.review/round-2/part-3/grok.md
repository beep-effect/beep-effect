I'll review the four yaml files against the upstream oracle and the round-1 inventory, then report only new findings. First I'm loading the binding decisions, prior review, and the port notes so I don't re-raise closed items.Round 1 already closed a large set on these four files. I'll check that those fixes landed at `2f515ae`, then look for new divergences against the pinned oracle.The four files are large, so I’ll compare their control flow with the pinned oracle and check that the round-1 fixes didn’t change behaviour.The public signatures match the recorded rest/dual deviations. Next I’ll compare the rendering and composition branches that those rewrites actually changed.The remaining risk is the canonical multiline emitter and the unread map, sequence, and block-composer bodies. I am comparing those against the pinned oracle before filing anything.The multiline canonical branch still differs from upstream. I am reading the fold renderer and the parser’s quoted-folding rules to see whether that difference changes values.### grok-2-1
- file: scratchpad/effected/yaml/internal/stringifier.ts:572
- class: bug   severity: required
- standard: D9 and section 14 (a different formatted byte is a deviation; allowed causes are only `law:<id>` or `upstream-bug:<evidence>`)   evidence: `renderSingleQuotedMultiline` ends a trailing-newline value in `'\n'` (upstream `stringifier.ts` returns that string). The lab then does `sq.replace(/\n'$/, `\n${indent}'`)`. For `"a\n"` and indent `"  "` upstream emits `'a\n\n'`; the lab emits `'a\n\n  '`. `foldFlowLines` trims a whitespace-only last line, so both decode to `"a\n"`. The yaml-test-suite canonical byte compare stays green because no fixture hits this shape, and the coverage test only checks `parse(text) === value`. README Port notes and the yaml ledger deviations do not record this byte change.
- failure: Canonical plain or single-quoted scalars that end in `\n` gain indent spaces before the closing quote whenever `indent` is non-empty. Upstream emits the quote in column 0. The decoded value is unchanged.
- fix: Return `sq` unchanged.

### grok-2-2
- file: scratchpad/effected/yaml/internal/stringifier.ts:569
- class: docs   severity: backlog
- standard: section 14 recording procedure; round-1 inventory rule that ledger and Port-notes rows are central   evidence: On canonical plain or single-quoted input, `/\n[ \t]/` forces `renderDoubleQuoted`. Upstream calls `renderSingleQuotedMultiline` for the same values. `foldFlowLines` `trimStart`s continuation lines, so upstream `'first\n\n   \tsecond'` (indent `"  "`) decodes to `"first\nsecond"`, dropping the space and tab. The double-quoted form decodes to `"first\n \tsecond"`. `scratchpad/test/yaml/internal/stringifier.coverage.test.ts:109` locks that preservation. No README or ledger deviation cites it.
- failure: Canonical output for a plain or single-quoted scalar whose value contains a newline followed by a space or tab differs from upstream and is unrecorded. The value is the one upstream's own folder drops.
- fix: Keep the branch. Add the central deviation entry with that test citation. Do not revert it.

REQUIRED: 1
BACKLOG: 1
