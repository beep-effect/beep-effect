# First-slice independent label review

Date: 2026-10-28. Status: extractor proposal; independent critic review and attorney spot-check pending.

## Scope and independence

This labels only claim 1 of the normalized public-source fixture
`packages/law-practice/server/test/fixtures/claim-element/US20200109732A1.claims.json`.
The expected tree is `US20200109732A1.claim1.expected.json` beside that input.
The extractor read the packet SPEC, P2 design (including its recorded as-built
clarifications), and ClaimElement schema definitions. It did not inspect the
decomposer implementation or live report files, and did not call the decomposer.
The spans and heads were selected manually from the source text; a small local
script located those selected substrings and checked their exact source slices.
`producer: "rule"` describes the contract's expected decomposer output, not the
identity or authority of this independent agent label.

## Rationale

The preamble is root `1`, spanning [0, 47). Its sole term is `A mounting system`
[0, 17), head `mounting system`: `mounting` is the first head token and remains,
while `applied` ends the head under `participle-boundary`.

The body contains no top-level semicolon or colon. It therefore forms one
limitation, `1.a`, spanning [59, 364), with the final period removed. Commas,
reference numerals in parentheses, and functional language do not split it under
P2. There are no sub-limitations or functional-relation elements.

The limitation has eight referring terms, in order:

| Span | Quote | Head |
| --- | --- | --- |
| [59, 72) | the left side | left side |
| [126, 154) | the double tubular rear feet | double tubular rear feet |
| [219, 232) | the left side | left side |
| [257, 266) | the bends | bends |
| [270, 283) | the side part | side part |
| [323, 330) | the tab | tab |
| [339, 347) | the hole | hole |
| [356, 364) | the foot | foot |

Each head ends at punctuation or a declared boundary word. Bare `U-shaped
bends` and pronouns are not terms under this determiner-scanning contract.
The repeated definite `the left side` is not an introducing term. The only
introduction is `A mounting system`, whose head matches none of the eight
referring heads. Consequently the tree has only `part-of(1.a, 1)` and no
antecedent edges. Claim 1 is independent, so there are no dependency edges.

## Confidence and unresolved authority

Extractor confidence: 0.99 for this tree against the declared P2 contract;
proposed acceptance threshold: 0.95, subject to independent critic agreement.
All two element anchors and nine term anchors were verified against the input
text, including half-open offsets and exact quote equality. Root will perform
schema decoding and implementation comparison separately; neither is claimed
here as completed.

No extraction ambiguity remains within this narrow rule contract. Semantic
relationships among bends, side panels, feet, and reference numerals exceed
that contract and are not inferred. The rule-shaped label is not attorney
adjudication of antecedent basis, proof that publication claim 1 was the text
in force at a particular rejection, or completion of the labelled corpus.
Attorney spot-check is pending; independent critic acceptance must be recorded
before this proposal is treated as an accepted label.


## Independent critic result — 2026-10-28

Decision: **accept the claim 1 expected tree as a reviewed P2 rule-contract
label**, with confidence **0.99**, above the extractor proposal's 0.95
threshold. No expected-label correction is required. This is the independent
critic pass of the bounded extractor/critic loop, not an attorney adjudication.
The critic independently read the packet SPEC, P2 design, extractor rationale,
and the ClaimElement element/tree/edge schema definitions. It did not read or
run the decomposer implementation, the antecedent-policy implementation, or any
live report; package decoding and executable comparison remain the root
agent's verification responsibility.

### Exhaustive label audit

The critic checked each element and term against claim 1's `claimText` using
half-open offsets and exact substring equality. All eleven anchors match:
root `1` [0, 47), its `mounting system` term [0, 17), limitation `1.a`
[59, 364), and its eight terms [59, 72), [126, 154), [219, 232), [257, 266),
[270, 283), [323, 330), [339, 347), and [356, 364). The transition occupies
[48, 58); neither that text nor the final period belongs in the two element
anchors under the declared rules. A separate whole-word determiner inventory
finds exactly the nine labelled occurrences, so the proposal omits none.

The root head `mounting system` correctly stops before `applied`; all eight
referring heads in the extractor table stop at their immediately following
parenthesis or boundary word (`of` for `bends`). The four-token head `double
tubular rear feet` remains below the five-token cap. `U-shaped bends`, `its
forward part`, and `them` contain no recognized opening determiner and are not
emitted by this P2 contract. The two occurrences of `the left side` remain
separate referring terms and create no introduction.

Paths `1` and `1.a` are unique, rooted at claim 1, correctly typed, and ordered
by source position. Every term is contained in its owner and terms do not
overlap. The sole edge `part-of(1.a, 1)` has valid existing endpoints and the
required path nesting. There is no top-level semicolon or colon to create a
second limitation or sub-list. The one introducing head `mounting system`
matches none of the referring heads, so no antecedent edge is warranted.
Independent claim 1 has no dependency edge. No functional edge is emitted in
P2. The selected fields, literals, normalized heads, and coherence conditions
conform to the schemas on inspection; runtime schema decoding is not claimed
by this critic.

### Provenance audit and bounded version correspondence

The cached native publication XML for application 16287736 has SHA-256
`26b1aab9582ad56ec51ff361076dc0598ea767e55eadbd8e4d0dd721d53fb691`, matching
`US20200109732A1.provenance.json`. Its claim 1 text, after removal of the
printed claim number, matches the fixture text. It contains no OCR-labelled
XML elements. This native publication remains the source of the labelled
claim; original file-wrapper OCR is corroborating evidence only.

The original CLM XML document `JSNRXQGZRXEAPX2` identifies application 16287736,
claim 1 and official date 2019-02-27. Its claim 1 contains OCR-confidence tags
and spaces inside `(1 a)` and `(1 b)`. The critic independently removed the
printed claim number and compared all remaining non-whitespace characters
with the native-publication fixture: they are identical. This verifies the
reported correspondence without converting the OCR text into a gold source.
It is not byte equality, and offsets continue to index the native fixture.

The cached document inventory reports 67 records and contains 67 records. It
lists the original CLM on 2019-02-27, non-final rejection
`K56UZ6OLRXEAPX4` on 2020-01-09, and the next CLM on 2020-05-08; no other CLM
appears between the original and rejection. The intervening inventory also
contains no document explicitly labelled as a claim amendment. Together with
the original-text comparison and the examiner's claim 1 recitations, this
strongly supports correspondence of native-publication claim 1 to the claim
text examined on 2020-01-09. Publication on 2020-04-09 alone would not establish
that correspondence. Residual uncertainty is the completeness/classification
of the cached inventory and the OCR origin of the original corroborating
transcription; no fresh source retrieval or visual original-page check was
performed in this critic lane.

The retained office-action section in provenance explicitly rejects claims
1–8 under §112(b) and quotes `the foot` as lacking antecedent basis in claim 1.
The labelled [356, 364) term matches that phrase exactly. The same section
also criticizes `its forward part`, which P2's determiner-only scan does not
cover. Acceptance of this selected positive span must not be reported as full
coverage of the examiner's objections. The critic checked that retained text
and the document inventory identity/date; it did not independently retrieve
the office action or verify the full transcription against original pages.

### Concrete record findings and acceptance limits

1. The provenance fields still say `labelStatus: "unlabelled"` and
   `qualification: "candidate; publication postdates rejection; correspondence
   with in-force original claim 1 requires independent verification"`.
   Following this review, those descriptions are stale for this single claim.
   Root should record reviewed rule-contract label acceptance and the bounded
   independently checked correspondence above, preserving the distinction
   between native publication source and original OCR corroboration. Do not
   upgrade any other claim's label or the whole publication family by inference.
2. The publication's later date is a real qualification, now addressed with
   corroborating original claim text and inventory chronology rather than an
   assumption. Any statement that the original XML is native/non-OCR, or that
   the publication date alone proves the in-force version, would be rejected.
3. Attorney spot-check and agreement remain pending. This pass accepts the
   narrow expected tree and supports the recorded positive phrase; it does not
   close P2c, establish corpus-level accuracy, or attest legal definiteness.
   Root must still record successful schema decoding and strict implementation
   comparison before treating the first vertical slice's technical checks as
   passed.

## Revision 1: explicit possessive abstention (2026-10-28)

The independent critic identified that the previous contract omitted the
examiner-recited possessive phrase. Under the amended P2 design's bounded
`its` / `their` abstention rule, the extractor independently reread claim 1 and
added `its forward part` at [199, 215), determiner `bare`, head `forward part`,
to limitation `1.a` in text order. `of` ends the head. No `their` phrase occurs
in this claim. All other labels remain correct and unchanged: two elements,
now ten total terms, and only the `part-of(1.a, 1)` edge.

This revision supersedes the earlier statement that pronouns are not scanned:
the amended contract retains these possessive surfaces explicitly so the policy
can emit `pattern-not-covered` / `unsupported-determiner`, without inferring an
antecedent or emitting an antecedent edge. The added phrase and all retained
anchors were checked against exact source slices. No implementation or live
report was inspected or executed. Extractor confidence remains 0.99 against the
amended contract; independent critic re-review, schema/implementation checks,
and attorney spot-check remain pending. This is a rule-contract label, not
attorney adjudication or corpus completion.


## Independent critic round 2 — explicit possessive coverage (2026-10-28)

Decision: **accept the revised claim 1 expected tree**, confidence **0.99**
against the amended P2 design, exceeding the 0.95 threshold. No label correction
is required. This second bounded critic round supersedes the earlier critic's
contract-specific omission of `its forward part`; all provenance qualifications
and pending attorney sampling remain in force.

The critic reread the amended design and revised expected JSON independently
of implementation and prediction output. Exact source-slice checks pass for
all twelve anchors: two elements and ten terms. A fresh whole-word inventory
finds the original nine determiner openings plus exactly one supported
abstention opening, `its` at offset 199; there is no `their` opening. The added
term is correctly placed in limitation `1.a`, between the terms beginning at
126 and 219, at [199, 215), quote `its forward part`, determiner `bare`, head
`forward part`. The following `of` ends its two-token head, and its span lies
within the limitation without overlapping either neighbour. `bare` satisfies
the existing schema's surface check because the quote opens with none of its
recognized introducing/referring determiner surfaces. Here it records the
amended unsupported-possessive convention, not a substantive assertion that
the phrase has no linguistic determiner.

The retained element boundaries, unique paths, kinds, all original heads and
anchors, and sole `part-of(1.a, 1)` edge remain correct under the amended
contract. The new bare term is neither an introducing term nor an eligible
referring term for an antecedent edge. It therefore creates no new edge. Its
expected policy treatment is explicit `pattern-not-covered` with rule
`unsupported-determiner`, with no inferred antecedent. The original `the foot`
positive remains [356, 364) and is unchanged.

No further extraction ambiguity or concrete label defect was found. The
retained examiner text's possessive objection is now represented as an explicit
coverage limitation rather than silently omitted. This does not establish
full semantic coverage or attorney agreement. Runtime schema decoding, exact
implementation equality, and policy-output verification remain root's checks;
this critic read neither implementation nor prediction/live-report output and
did not execute them. Native publication text remains the label source, and
original file-wrapper OCR remains corroboration only.
