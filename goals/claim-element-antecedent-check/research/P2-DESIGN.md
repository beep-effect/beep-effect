# P2 design: rule-based decomposer and antecedent policy

Status: design, 2026-10-14. This document is normative for P2a. The binding contracts are the P0
schema (`values/ClaimElement/`) and the P1 types (`ClaimElementDecomposer`, `AntecedentPolicy`,
`ClaimSelfCheck`). This document only fixes how the rules fill them.

## Lanes

| Lane | Scope | Package | Data |
| --- | --- | --- | --- |
| P2a | The pure decomposer and antecedent policy, plus one synthetic fixture per rule. | `@beep/law-practice-domain` | Synthetic claim text only. |
| P2b | The `ClaimSelfCheck` Layer, the `UsptoClaims` server adapter, and the first vertical slice. | use-cases, server | Public USPTO record. |
| P2c | The labelled set: about 60 element-labelled families and about 200 allowed sets. | domain/use-cases tests | Public USPTO record. |

P2a blocks P2b's slice test. P2c starts once P2b can fetch claim sets.

## Decomposer (`decomposeClaim: ClaimElementDecomposer`)

Implement it in `ClaimElement.behavior.ts`, next to the type. The function is pure and
deterministic: no clock, no randomness, no I/O. It returns `Effect.succeed` or `Effect.fail`
only so that its failures are typed.

### Locating the parts

1. `preamble`, `transition` and `body` are substrings of `claimText`. Find them in that order with
   a forward cursor, so each search starts at the end of the previous one. If any part is missing,
   fail with `unsupported-claim-text`.
2. For a dependent claim, every number in `claimReferences` must name a claim in `claims`.
   Otherwise fail with `claim-not-in-claims`.

### Elements

- **Root** `"<n>"`, kind `preamble-subject`. Its anchor is the preamble with trailing whitespace
  and a trailing comma trimmed.
- **Limitations** `"<n>.a"`, `"<n>.b"`, and so on (letters a–z, then aa, ab, …), kind
  `limitation`. They come from splitting the body at top-level `;`. "Top-level" means outside
  `()` and `[]`.
  - Trim each segment's whitespace.
  - Strip a leading `and ` or `or ` connector, and a trailing `;`, `.`, `, and` or `, or`.
  - The anchor covers the trimmed segment.
  - An empty segment is dropped.
- **Sub-limitations** `"<n>.<x>.i"`, `"<n>.<x>.ii"`, and so on (lowercase roman), kind
  `sub-limitation`. Rule `colon-sublist`: a limitation whose trimmed text ends with `:` absorbs
  every later segment of the body as a sub-limitation, and its own anchor keeps the colon. A second
  colon inside a sub-limitation does not nest further in P2. Each absorbed segment is listed in
  text order.
- **Functional relations**: no rule emits `functional-relation` elements or `functional` edges in
  P2. They are recorded as deferred.

Elements are ordered by `anchor.startChar`. Paths are unique.

### Terms

Scan each element's span left to right for determiners. Match whole words only, case-insensitive,
longest match first:

| Surface | `determiner` |
| --- | --- |
| `at least one`, `one or more` | `at-least-one` |
| `a plurality of`, `plurality of` | `plurality-of` |
| `an` | `an` |
| `a` | `a` |
| `the` | `the` |
| `said` | `said` |
| `its`, `their` | `bare` (unsupported possessive; explicit policy abstention) |

**Head.** Take tokens (`[A-Za-z0-9-]+`) after the determiner. Stop at:
- punctuation `, ; : . ( ) [ ]`;
- the 5-token cap;
- any word in the boundary set, which is `that which wherein whereby where when configured
  adapted operable arranged having comprising comprises including includes containing contains
  being is are was were has have to for in on of at by with from into onto between through via
  and or such so than as each said the a an`.
Rule `participle-boundary`: after the first head token, any token ending in `ed` or `ing` also
stops the head. So "a controller coupled to" has head `controller`, while "a sensing element" keeps
`sensing element`.

Further rules for the head:
- After `the`/`said`, first strip a leading quantifier (`at least one`, `one or more`,
  `plurality of`, `a plurality of`) from the head. So "the at least one sensor" has head `sensor`.
- If the head is empty, emit no term.
- If the head starts with `claim` followed by a number, emit no term (rule `claim-reference`).
- The term anchor runs from the start of the determiner to the end of the last head token.
- `head` is the head tokens, lowercased and joined with single spaces.

Terms are listed in text order within their element. A term belongs to the innermost element whose
span contains it. Sub-limitation text is not also scanned as part of its parent; the parent scans
only its own anchor, which ends at the colon.

### Edges

- `part-of`: one edge from every non-root element to its parent. A limitation's parent is the
  root, and a sub-limitation's parent is its limitation.
- `depends-on-element`: for a dependent claim, one edge from root `"<n>"` to root `"<p>"` for each
  `p` in `claimReferences`.
- `antecedent`: only within the claim. When a referring term (`the`/`said`) has exactly one
  introducing term in the same claim with an equal head and an earlier anchor, emit one edge.
  Cross-claim resolution belongs to the policy and is not emitted as an edge in P2.

`producer` is `rule`. Build the result through `ClaimElementTree` decoding. A coherence failure is
a decomposer bug, surfaced as `incoherent-tree`.

## 2026-10-28 explicit unsupported-possessive coverage

Live examiner text for application 16287736 identifies `its forward part`.
The bounded scan now retains `its` and `their` phrases as `bare` terms,
using the same head/anchor rules and treating both words as head boundaries.
The policy emits `pattern-not-covered` with rule `unsupported-determiner`
for these terms. It does not infer a possessive antecedent. Gold labels must
include these spans; this change is abstention coverage, not pronoun resolution.

## Policy (`antecedentPolicy: AntecedentPolicy`)

Implement it in `Antecedent.policy.ts`, next to the type. It is total: it never throws or fails,
and it never skips silently.

1. **Index.** Map claim number to its tree and claim number to its `PatentClaim`.
2. **Chains.** For claim `n`, a chain is every path `n → p → … → root` that follows
   `claimReferences`. A multiple dependent claim has several chains. Chains are sorted
   lexicographically by number sequence. A reference to a number at or above `n`, or to an absent
   claim, makes the chain unresolvable (rule `chain-unresolvable`). Each referring term on it then
   becomes `pattern-not-covered`.
3. **Referring terms.** These are terms with determiner `the` or `said`. Skip the idioms `the same`,
   `the like`, `the art`, `the other`, `the following`, `the case` (rule `non-referential-idiom`):
   they produce no finding.
4. **Resolving one referring term against one chain.**
   - **Introductions in the chain** are terms with determiner `a`, `an`, `at-least-one` or
     `plurality-of` that are either in the same claim with `anchor.startChar` before the referring
     term, or anywhere in an ancestor claim of the chain.
   - **Exact match.** Collect the introductions in the chain whose `head` equals the referring
     head.
     - One match: resolved, no finding.
     - Two or more distinct anchors: `ambiguous-antecedent`, rule `multiple-introductions`.
   - **Number variant.** If nothing matched exactly, normalize the number of both heads. On the
     last word only: `ies`→`y`, `es`→ nothing after `s`/`x`/`ch`/`sh`, and a final `s`→ nothing.
     - One variant match: `number-mismatch`, rule `determiner-number-mismatch`.
     - Several variant matches: `ambiguous-antecedent`.
   - **Ordinal variants.** If nothing matched so far, collect introductions whose head ends with
     ` <referring head>` and whose prefix is an ordinal or a single modifier, as in "first sensor"
     for "sensor". Two or more: `ambiguous-antecedent`, rule `ordinal-variants`. Exactly one:
     resolved, rule `single-modified-introduction`, no finding.
   - **Outside the chain.** If still nothing matched, look for an exact-head introduction in a
     claim outside the chain. If found: `antecedent-outside-chain`, with the first such
     introduction by claim number and then anchor.
   - **Otherwise:** `missing-antecedent`, rule `definite-without-introduction`.
5. **Coverage limits** produce `pattern-not-covered` and never a pass:
   - a tree whose `claimNumber` names no claim (rule `tree-without-claim`): one finding per
     referring term;
   - a chain that runs through a claim with no tree (rule `chain-through-undecomposed`): referring
     terms not resolved inside the decomposed part of the chain.
6. **Output.** There is one finding per referring term per failing chain. Findings are sorted by
   claim number, then referring `anchor.startChar`, then chain. `chain` is the chain checked, and
   `referring` is the term's `ClaimTermRef`.

## Rule fixtures (P2a acceptance)

Write one fixture per rule. Each fixture is synthetic claim text written for the test, with no
client or corpus text. It lives in `packages/law-practice/domain/test/claimElementFixtures.ts`
(module-level `PatentClaims` values plus expected trees and findings) and is exercised by
`test/ClaimElement.rules.test.ts`. The test compares the decomposer's tree with the expected tree
by structural equality (`Equal`) and the policy's findings by deep equality.

| # | Rule | Fixture |
| --- | --- | --- |
| 1 | basic resolution | "A system comprising: a sensor; and a controller coupled to the sensor." → no findings; one intra-claim `antecedent` edge |
| 2 | `said` | the same with "said sensor" |
| 3 | `definite-without-introduction` | "the housing" never introduced → `missing-antecedent` |
| 4 | `multiple-introductions` | two "a sensor" then "the sensor" → `ambiguous-antecedent` with 2 candidates |
| 5 | `determiner-number-mismatch` | "a plurality of sensors" then "the sensor" → `number-mismatch` |
| 6 | quantifier strip | "at least one sensor" then "the at least one sensor" → resolved |
| 7 | `an` | "an actuator" then "the actuator" → resolved |
| 8 | dependent resolution | claim 2 "The system of claim 1, wherein the sensor is optical." → resolved via claim 1 |
| 9 | multiple dependent | claim 3 depends on 1 or 2; "the lens" is introduced only in 2 → chain [3, 2, 1] resolves; one `antecedent-outside-chain` finding with chain [3, 1] |
| 10 | outside chain | "the lens" is introduced only in a sibling claim → `antecedent-outside-chain` |
| 11 | preamble subject | claim 2's preamble "The system of claim 1" resolves to claim 1's "A system" |
| 12 | `non-referential-idiom` | "the same" produces no finding |
| 13 | `colon-sublist` | a limitation ending in ":" with two sub-items gives paths `n.b.i`, `n.b.ii` and `part-of` edges |
| 14 | `claim-reference` | "claim 1" is not a term |
| 15 | `tree-without-claim` | a tree for claim 9 that is absent from `claims` → `pattern-not-covered` |
| 16 | `chain-through-undecomposed` | claim 3 → 2 (no tree) → 1 → `pattern-not-covered` for an unresolved term |
| 17 | `ordinal-variants` | "a first sensor", "a second sensor", "the sensor" → `ambiguous-antecedent` |
| 18 | `single-modified-introduction` | "an optical sensor" then "the sensor" → resolved |
| 18b | `participle-boundary` | "a controller coupled to the sensor" gives head `controller` |
| 19 | `unsupported-claim-text` | a body not found in `claimText` → `ClaimDecompositionError` |
| 20 | `claim-not-in-claims` | a dependent claim referencing claim 7, which is absent → `ClaimDecompositionError` |

Further acceptance for P2a:
- Every rule id used in code appears in this table.
- A property test checks determinism: decomposing the same claim twice gives `Equal` trees.
- `bun run beep quality package-verify @beep/law-practice-domain` passes.

## P2a as built (2026-10-14)

The implementation follows this design, with these recorded deviations:

- **Colon split.** A top-level `:` followed by whitespace, or ending the body, also ends a segment,
  and the colon stays on the left. A segment that is only `:` is dropped. Without this,
  `colon-sublist` never fires on natural text ("comprising: a lens; and …"). It also handles the
  normalizer's body shape, which starts with the transition colon.
- **`claim-not-in-claims`** also fires when the claim's own number is absent from `claims`, as
  the P1 contract states.
- **Rule ids.**
  - Outside-chain findings use `outside-chain`.
  - Several number-variant matches give `ambiguous-antecedent` with rule
    `determiner-number-mismatch`.
  - `chain-unresolvable` has fixture 21, and collapsed duplicate `pattern-not-covered` findings
    have fixture 16b.
- **Idioms.** A `the` term is skipped when the first word of its head is an idiom word, so
  "the same rate" is skipped too. Otherwise "at the same rate" would be a false positive.
- **Duplicates.** `pattern-not-covered` carries no chain, so findings that would be identical
  across chains collapse into one.
- **Participles.** Words of four letters or fewer and `-eed` words ("speed", "feed") are not
  participles. So "a high speed sensor" keeps the head `high speed sensor`; a regression test
  covers it.
- **Lint.** The two bindings carry a one-line suppression of `missingPipeableSignature`, because
  the P1 signatures are fixed and not pipeable.

Known limits for P2c to measure. Each will be fixed or kept by its measured FP rate, not by guess:
- `-ing` nouns after the first head token end the head ("a coil spring" gives `coil`; "a bearing
  housing" gives `bearing`).
- Verbs outside the boundary set join the head ("the housing holds" gives `housing holds`).
- The number normalizer turns "lens" into "len", so "lens"/"lenses" are never number variants.

## Data access status (2026-10-14)

- The USPTO ODP key on this workstation returns `403` (see `OPPORTUNITIES.md`), so the
  `UsptoClaims` `application` source and office-action provenance wait for the operator to
  regenerate the key.
- P2a and the `ClaimSelfCheck` Layer (tested with an in-memory `UsptoClaims`) proceed without
  data.
- The adapter is written against the ODP documents shape. Its XML handling is fixed only after one
  live probe shows which `CLM` download options carry XML.

## Out of scope for P2a

- The use-cases Layer and the server adapter (P2b).
- The labelled set (P2c).
- Functional relations, Markush groups and LLM proposals.
