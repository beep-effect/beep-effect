# github-commands — round-1 merged inventory

Seats read: `grok.md`, `sol.md`, `fable.md` and their shared adjacent `BRIEF.md`; recursive discovery found no part-N reports. Review target: `3fa5876691901fccf3d1cd29e9324564df134b56`, branch `@lab/effected`, pinned oracle `af7566a9da2eff169cb74955efcc5ede1e5de9f8`.

Counts: **Required 3 · Backlog 6 · Codemod 1 · Rejected 1 · Groups 1**. All 24 seat records are accounted for. Native-runtime allowlist entries whose file starts with `scratchpad/effected/github-commands/`: **0**, so there are no `allow-<n>` additions. No report demonstrates an unforced lab shape/test rewrite requiring upstream restoration.

Binding precedence: the complete operator revision/rulings/grilling block, D1–D20, section 12.5 and section 14. S2/S3 items stay backlog. The native-helper finding cites a concrete gate blind spot; green gate failures are not invented. Evidence below is attributed to the seat reports; this inventory pass did not rerun tests or probes. Sol's enumeration evidence contributes to the codemod record, while its conflicting remedy is separately rejected; those are dispositions of one defect, not two defects.

Write surface: `g1` owns three source files (`WorkflowCommand.ts`, `CommandNeutralizer.ts`, `index.ts`), both existing test files, and the README/PORT_LEDGER.json edits required to record the verified upstream bug. The cross-file helper finding forces one group. The oracle helper is read-only input. Law-forced bookkeeping remains with the central codemod; serialize its shared README/ledger writes with the required fix wave.

## Required

### sol-1-2

- file: scratchpad/effected/github-commands/CommandNeutralizer.ts:2
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D11; D9 and section 14, verified upstream-bug; CommandNeutralizer.test.ts:31/:97 quiet-line fidelity contract.   evidence: Sol's read-only probe shows isCommand("\uFEFF::error::x") === false, but both the lab and pinned upstream return "\u200B\uFEFF::error::x". Fable's U+0000..U+10000 probe finds U+FEFF is the only extra code point in [\s\u0085] versus helpers/runnerCommands.ts:19-35. ECMAScript \s includes U+FEFF; the .NET oracle excludes it. The existing quiet-input fixture includes the BOM, but the exhaustive neutralizer alphabet omits it.
- failure: The neutralizer inserts an invisible character into a quiet BOM-prefixed line, violating the existing unchanged-output guarantee. This inherited bug is demonstrated by a concrete counterexample; it is not merely a request for broader coverage.
- fix: Before changing behavior, record the verified upstream-bug in PORT_LEDGER.json and README Port notes -> Deviations, citing the counterexample and adjusted test. Replace V2 with /^[\t-\r \u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]*::/ and correct its whitespace comment. In CommandNeutralizer.test.ts add the unchanged-output regression for "\uFEFF::error::x" and a focused table proving every oracle whitespace code point still receives the U+200B prefix and becomes non-command. Retain the existing exhaustive suite and oracle helper.
- seats: sol-1-2, fable-1-2

### sol-1-3

- file: scratchpad/effected/github-commands/WorkflowCommand.ts:13
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md section 5, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data; EFFECTED_PORT_GOAL.md D2, D5 and D11.   evidence: AnnotationProperties is an exported six-field optional-primitive payload consumed by notice, warning, error and annotation, but its sole definition is an interface. It is representable as a structural schema and falls outside the service-contract/type-level-machinery exceptions. Both seats identify the missing runtime contract; Fable cites exactOptionalPropertyTypes and S.optionalKey as preserving the optional structural shape.
- failure: The authoritative payload definition disappears at runtime and supplies no decoder, identity metadata or Arbitrary. Green diagnostics do not enforce conversion of this representable interface into a domain schema.
- fix: Replace the interface with an IdentityComposer-annotated S.Struct named AnnotationProperties, with optional title/file string fields and optional startLine/endLine/startColumn/endColumn number fields, and derive the same-name type from typeof AnnotationProperties.Type. Use S.optionalKey and the numeric base required by schema laws (S.Finite where required); add no extra integer/range constraints, coercion or automatic decoding in command helpers. Export the schema value through index.ts while preserving the existing type export and structural call signatures. Add focused runtime-contract checks in WorkflowCommand.test.ts without rewriting upstream assertions. Added-export and any law-forced finite/identity bookkeeping belong to the central per-class deviation codemod.
- seats: sol-1-3, fable-1-3

### sol-1-4

- file: scratchpad/effected/github-commands/WorkflowCommand.ts:39; scratchpad/effected/github-commands/WorkflowCommand.ts:50/:101-104; scratchpad/effected/github-commands/CommandNeutralizer.ts:14/:64/:76
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5 and EF-6; AGENTS.md Code Laws; EFFECTED_PORT_GOAL.md D5 and D11.   evidence: Sol identifies native replaceAll in both escaping functions and native replace/split in the neutralizer. Fable additionally identifies native filter/map/join and an ad-hoc undefined guard in render, and native map/join in the neutralizer. Effect 4 supplies String.replaceAll/replace/split, Array.filter/map/join and Predicate.isNotUndefined. The seats explain the gate miss: NoNativeRuntime checks Object statics at :451, not these prototype-helper sites.
- failure: Core protocol transformations retain native helpers and a duplicated predicate despite available Effect equivalents. This is a cited idiom violation outside the green native-runtime gate's coverage. All these sites share one native-helper migration root cause and are deduplicated into one finding.
- fix: Import String, Array and Predicate from their effect/<Module> paths, and flow/pipe from effect/Function. Express escapeMessage as flow(Str.replaceAll("%", "%25"), Str.replaceAll("\r", "%0D"), Str.replaceAll("\n", "%0A")); express escapeProperty as flow(escapeMessage, Str.replaceAll(":", "%3A"), Str.replaceAll(",", "%2C")). Keep render's R.toEntries snapshot, then use Effect array filtering with a sound tuple refinement checking P.isNotUndefined, mapping and A.join(","); preserve property ordering and getter-read behavior. Use Str.replace with the existing global LEGACY regex, Str.split with the existing LINE_BREAK expression, A.map and A.join("\n") in CommandNeutralizer. Preserve percent-first escaping, global replacement and line splitting; retain upstream assertions in both test files.
- seats: sol-1-4, fable-1-4, fable-1-5

## Backlog

### grok-1-1

- file: scratchpad/effected/github-commands/CommandNeutralizer.ts:21
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md carrier policy and titled Example law; EFFECTED_PORT_GOAL.md section 10.2; round-1 brief: S2 has not run.   evidence: All three seats cite @remarks at :21/:70, @example at :44, @public, and missing @category/@since 0.0.0. Fable also cites the relative ./index.ts example import at :46 and missing method examples.
- failure: The upstream documentation carriers and export metadata need conversion before S2 docgen compliance.
- fix: At S2 convert @remarks to **Details**, the intentional-command warning to **Gotchas**, and @example to a titled **Example** (Title) with a compilable lab-entry import. Add appropriate @category/@since 0.0.0 and meaningful method examples, drop @public, and retain all upstream two-parser, idempotence and no-detector prose.
- seats: grok-1-1, sol-1-6, fable-1-7

### grok-1-2

- file: scratchpad/effected/github-commands/WorkflowCommand.ts:6
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md carrier policy, export metadata and titled Example law; EFFECTED_PORT_GOAL.md section 10.2; S2 deferred by operator order.   evidence: All seats cite @remarks at :6/:34/:45/:55/:82, @example at :65, missing @category/@since 0.0.0, and legacy @public. Grok/Fable additionally cite render's @privateRemarks at :90-94; Fable cites the relative example import at :67.
- failure: The annotation and renderer documentation retain legacy carriers and lack canonical export metadata and examples.
- fix: At S2 convert legacy carriers to **Details**, **Gotchas** and titled **Example** (Title) sections; use a compilable lab-entry import and add appropriate export metadata/examples. Preserve escaping-order and newline-injection explanations and move the inlined-property/API-Extractor rationale into render's Details. Describe AnnotationProperties according to its schema/value/type shape after the required fix.
- seats: grok-1-2, sol-1-5, fable-1-6

### grok-1-3

- file: scratchpad/effected/github-commands/index.ts:2-3
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D4 and section 10.1, carried prose must remain true after law-forced changes; S2 deferred.   evidence: The package lead says "with no dependencies and no IO", while WorkflowCommand.ts imports effect/Record. Fable notes the required schema/helper migrations also add Effect modules and @beep/identity.
- failure: The entrypoint incorrectly claims the lab module has no dependencies.
- fix: At S2 preserve the no-IO claim and replace the dependency-free claim with wording accurate for the final imports, including Effect and @beep/identity after the schema fix. Do not copy the seats' proposed "only dependency is effect" wording once identity is imported. Route law-forced deviation bookkeeping through the central codemod.
- seats: grok-1-3, fable-1-8

### grok-1-4

- file: scratchpad/effected/github-commands/README.md:8/:23-38
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3 README adaptation; S2 deferred.   evidence: All seats cite release badges at :3-6, dependency-free prose at :8/:11-15, the stability block, upstream Install instructions at :23-33 and the @effected/github-commands usage import at :38. Fable's ninth record uses its file path as the heading instead of an id; it is normalized here as fable-1-9.
- failure: The lab README still describes and installs the upstream package and makes a false dependency guarantee.
- fix: At S2 remove the specified badges, Install instructions and stability boilerplate; retarget usage to the lab entrypoint; describe final dependencies accurately; preserve Why, protocol/hardening explanations and attribution. The verified BOM bug's deviation is part of sol-1-2; law-forced enumeration and added-export bookkeeping are central-codemod work. Do not retain Grok's disproven blanket claim that rendered bytes are always unchanged.
- seats: grok-1-4, sol-1-7, fable-1-9 (path-headed ninth record)

### grok-1-5

- file: scratchpad/test/github-commands/CommandNeutralizer.test.ts:37/:82/:107
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10 and section 11.4; S3 property/coverage work deferred by operator order.   evidence: The direct V2 samples and length-5 exhaustive alphabet omit several .NET whitespace code points. Grok/Fable cite missing U+000B/U+000C/U+00A0/U+1680/U+2000-U+200A/U+2028/U+2029/U+202F/U+205F/U+3000 assertions and lack of U+200B-seeded idempotence cases. Fable correctly identifies U+FEFF as excluded by the oracle; Grok's claim that ECMAScript \s excludes U+FEFF is false and is superseded by the Sol/Fable probes.
- failure: The S3 fidelity/idempotence floor lacks systematic whitespace and seeded-ZWSP coverage. The concrete BOM behavior defect is already required under sol-1-2.
- fix: At S3 complete the oracle-whitespace table and add a ZWSP-seeded idempotence case while retaining the exhaustive suite. Reuse the BOM and focused whitespace regressions added by sol-1-2 instead of duplicating them; remaining broad test-floor work stays backlog.
- seats: grok-1-5, fable-1-11

### grok-1-6

- file: scratchpad/test/github-commands/WorkflowCommand.test.ts:29/:47-50
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10 and section 11.4; goals/effect-vitest-canon/SPEC.md; S3 deferred.   evidence: Escaping is checked with fixed strings and percent-first examples; there is no fcRuns-backed property. Both seats note render deliberately escapes an already escaped percent sequence again, so formatter idempotence is inapplicable.
- failure: The formatter fidelity property floor is unmet; sampled examples cannot cover arbitrary message and property strings.
- fix: At S3 add fcRuns-backed properties over arbitrary strings: no raw CR/LF in the rendered message; decoding the protocol's %25/%0D/%0A escapes once returns the original message; property values also round-trip %3A/%2C and contain no raw colon/comma. Decode escapes in one pass to avoid recursively decoding literal escape text. Retain upstream tests and do not assert render idempotence.
- seats: grok-1-6, fable-1-10

## Handled by the deviation codemod

### fable-1-1

- file: scratchpad/effected/github-commands/WorkflowCommand.ts:101
- class: law   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9 and section 14; Grilling, 2026-10-09 (later): one per-module/per-class codemod entry for law-forced native-runtime replacements; effect-laws-v1 law 6.   evidence: Sol and Fable independently report a getter that makes sibling property second non-enumerable: Object.entries renders "::debug first=a::m", whereas R.toEntries renders "::debug first=a,second=b::m". Fable cites NoNativeRuntime's forbidden Object.entries rule and Effect's Object.keys-snapshot implementation. The reported ledger has deviations: [] and README says Deviations: None.
- failure: The existing law-forced enumeration replacement changes an edge-case byte result, and its bookkeeping is absent. The evidence is accepted; the later operator ruling assigns this recording work centrally and requires keeping the native-runtime replacement.
- fix: Keep R.toEntries. Have the per-module native-runtime deviation codemod list WorkflowCommand.ts:101, Object.entries' interleaved descriptor/read behavior, the Effect key-snapshot behavior, reason law:native-runtime, and any adjusted upstream tests in the module ledger and README. Handle added AnnotationProperties exports and any law-forced identity/finite changes through their corresponding per-class codemod outputs. This record creates no required repair group.
- seats: fable-1-1, sol-1-1 (same-defect evidence; remedy rejected below)
- disposition: Handled centrally; excluded from required.json.

## Rejected

### sol-1-1

- file: scratchpad/effected/github-commands/WorkflowCommand.ts:101
- class: bug   severity: backlog
- standard: EFFECTED_PORT_GOAL.md Grilling, 2026-10-09 (later), removal of every scratchpad/effected native-runtime exception; section 12.5 rejection rule.   evidence: Sol's getter/enumerability counterexample is concrete and is retained in the deduplicated fable-1-1 codemod record. Its proposed fix restores Object.entries with a new narrowly documented allowlist exception.
- failure: The proposed remedy would reintroduce a forbidden native-runtime site and exception.
- fix: Reject the Object.entries/allowlist remedy; keep the Effect form and route the accepted law-forced-deviation evidence to fable-1-1's central codemod record.
- seats: sol-1-1
- rejection: The proposed Object.entries exception contradicts the later operator ruling removing every scratchpad/effected native-runtime exception; the accepted evidence is deduplicated under fable-1-1.
