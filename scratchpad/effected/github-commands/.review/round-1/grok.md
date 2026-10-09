I'll review the `github-commands` port at that commit against the pinned upstream oracle and the port decisions, and report findings only.The module is small. I'll read the binding decisions, port notes, and both trees before comparing behavior.The port swaps `Object.entries` for `effect/Record`. I'll check whether that changes wire order, then compare tests and the law bar.The port matches the pinned oracle. `R.toEntries` is `Object.keys` plus a property read, so the wire order is unchanged, and the neutralizer is the same grammar. Docs, JSDoc, and test-floor gaps are backlog because S2 and S3 have not run.

### grok-1-1
- file: scratchpad/effected/github-commands/CommandNeutralizer.ts:21
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` (carrier policy, kind-split Example law); `scratchpad/EFFECTED_PORT_GOAL.md` section 10.2   evidence: the class block uses `@remarks`, `@example`, and `@public`, and neither the class nor `lines` / `text` has `@category` or `@since 0.0.0`. The example fence sits under `@example`, not `**Example** (Title)`.
- failure: docgen's beep carrier check fails this file once S2 runs. The upstream prose is still present, so this is a conversion gap, not missing behaviour.
- fix: move `@remarks` into `**Details**`, replace `@example` with one titled `**Example**`, add `@category` and `@since 0.0.0`, and drop `@public`. Keep every upstream sentence.

### grok-1-2
- file: scratchpad/effected/github-commands/WorkflowCommand.ts:6
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`; section 10.2   evidence: `AnnotationProperties` and `WorkflowCommand` use `@remarks` / `@public`; the class example is an `@example` tag; `render` carries `@privateRemarks` (lines 90–94) explaining the inlined property type. No export has `@category` or `@since 0.0.0`. `AnnotationProperties` is type-only, so its Example is optional; the class is a value export and needs a titled Example.
- failure: same S2 docgen failure as the neutralizer. The API-extractor rationale in `@privateRemarks` is load-bearing and must survive the conversion.
- fix: same carrier conversion. Put the inlined-`CommandProperties` note in `render`'s `**Details**`. Add `@category type-level` on `AnnotationProperties` and a protocols/utilities category on the class, both `@since 0.0.0`.

### grok-1-3
- file: scratchpad/effected/github-commands/index.ts:3
- class: docs   severity: backlog
- standard: D4 carried prose must stay true after a law-driven edit; effect-laws-v1 law 6   evidence: the package lead says "with no dependencies and no IO". `WorkflowCommand.ts:1` imports `effect/Record` and `render` calls `R.toEntries` (`WorkflowCommand.ts:101`). Installed `effect` `Record.toEntries` is `Object.keys` plus a property read (`node_modules/effect/src/Record.ts:493` and `:1555`), which is why the wire format matches upstream `Object.entries`. The "no IO" half is still true.
- failure: the lab entrypoint documents a dependency-free package. The law-6 swap made that sentence false.
- fix: change the lead so it states no IO and names `effect/Record` as the only dependency. Do not add a section 14 deviation: the rendered bytes are unchanged.

### grok-1-4
- file: scratchpad/effected/github-commands/README.md:8
- class: docs   severity: backlog
- standard: section 10.3 README adaptation; same law-6 evidence as grok-1-3   evidence: line 8 says "no `effect`, and no dependency at all"; lines 11–15 repeat that and keep the pre-1.0 block; lines 3–6 are npm/Node/TypeScript badges; lines 23–33 are Install; the usage sample on line 38 still imports `@effected/github-commands`. Port notes (lines 64–83) correctly list no added exports and no observable deviations.
- failure: S2 leaves the lab README as the upstream package page, including a dependency claim the source no longer meets.
- fix: apply section 10.3 (drop badges, Install, and the stability block; retarget the sample to the lab entry). Replace the "no effect" sentences the same way as `index.ts`. Leave Deviations empty unless a later edit changes bytes.

### grok-1-5
- file: scratchpad/test/github-commands/CommandNeutralizer.test.ts:37
- class: test   severity: backlog
- standard: D10 and section 11.4 (formatter fidelity); the oracle is `runnerCommands.ts:19` `isDotNetWhitespace`   evidence: the direct V2 sample is `::`, spaces, tab, one NBSP-like space, U+0085, and U+2003. The length-5 alphabet (line 82) is only `: # [ space tab U+0085 CR LF x`. The oracle also treats U+000B, U+000C, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, and U+3000 as leading whitespace. Idempotence (line 107) never includes U+200B. The implementation's `/^[\s\u0085]*::/` matches that set in current ECMAScript (`\s` is WhiteSpace plus LineTerminator, and U+0085 is written explicitly; U+200B and U+FEFF are outside it), but nothing in the suite asserts the unlisted code points.
- failure: a regex edit that drops one of those code points still passes the upstream suite, so a line the oracle calls a V2 command can ship unneutralized.
- fix: add one table over every code point `isDotNetWhitespace` accepts, prefixed to `::x`, and assert the ZWSP prefix plus `isCommand` false. Keep the exhaustive suite. Add a ZWSP idempotence case. S3, not a behaviour change.

### grok-1-6
- file: scratchpad/test/github-commands/WorkflowCommand.test.ts:29
- class: test   severity: backlog
- standard: D10; section 11.4   evidence: escaping is four fixed strings (`%`, CR, LF, `:`, `,`, and the percent-first order). There is no `fcRuns` property. A second `render` of an already rendered command is not idempotent on purpose (`%0A` must become `%250A`, asserted at line 47), so the formatter property is fidelity, not `format(format(x))`.
- failure: the property floor for the formatter is unmet. A regression that escapes only the sampled characters stays green.
- fix: add a sync `it.prop` through `fcRuns` over strings: the message contains no raw CR/LF, percent-decoding `%25` `%0D` `%0A` returns the input, and property values also round-trip `%3A` and `%2C`. Do not assert render-idempotence.

REQUIRED: 0
BACKLOG: 6
