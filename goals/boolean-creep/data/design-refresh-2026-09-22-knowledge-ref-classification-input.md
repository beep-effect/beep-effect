# Knowledge classifier P2 recovery audit — 2026-09-22

Source commit: `f5e1d4c64f37e0a8c42e217eee5f06841220c161`.

Recovered the interrupted proposal already present in this directory; did not restart broad census or edit canonical/product files. Both saved input snapshots equal their current canonical files byte for byte at this audit. Source and test files equal the named Git commit. Parent integration must verify these hashes before mutating the inventory.

## Exact input hashes

- `goals/boolean-creep/DECISIONS.md`: `3a65df50371937b9ad000949030ef1b5be1ab6148f7c0fd1f2de246542620f44`
- `goals/boolean-creep/data/inventory.jsonl`: `46b954087cab523cdbe80ac0bbb434706803e5f7c95bcbc2b02a8277b1d7d412`
- `goals/boolean-creep/designs/knowledge-ref-candidate.md`: `ec2afe409759560494ab4f7470021e04d3daabdf3796eec9b21a5d1bc9a5d992`
- `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts`: `d5e890c27397f55dd21d003a13426430b65360ec76d572565e71787a03292aa8`
- `packages/tooling/tool/cli/test/knowledge-refs.test.ts`: `94cf4a86180258f8c938d9a50eb55640ec039c799d2ab6e640d6f6f893298ecb`
- Private `input-inventory.jsonl`: `46b954087cab523cdbe80ac0bbb434706803e5f7c95bcbc2b02a8277b1d7d412`
- Private `input-decisions.md`: `3a65df50371937b9ad000949030ef1b5be1ab6148f7c0fd1f2de246542620f44`

## Source findings and corrections

- The user ruling settles only the grammar flags: ambiguity implies goal-uri; ungoverned implies repo-path. It does not narrow patternContext, surface, statuses, anchor/token presence or payload values.
- Verified declaration at 1855–1864, ordered returns at 1961–1965, full host and resolution behavior through 1987, three private producer families at 2512–2692, and adapter at 2958–2967. Verified actual classifier test helpers at 747–781.
- Removed the proposal's incorrect E1 label on the documentation comment: documentation is not an exclusive-write site. The E2 ordered read cascade is sufficient qualification, with owner ruling and docs establishing legal states. No invented runtime rejection guard is claimed.
- Enumerated all sixteen kind/flag triples in `cardinality.json`; six satisfy the two implications. Presence abstraction multiplies independent surface(2), resolution(5), pattern(2), and anchor/token presence(4), yielding 1280/480. This does not enumerate concrete anchor/string payload values and is not execution of the classifier.
- Target retains all five common fields on all four kinds, including reserved upstream. Repo and goal have their respective two-member grammar literals. No fixed-false sibling fields or compatibility flag bag survive.
- Candidate migration must land atomically with this classifier after independent P3/GATE 2. Parent must add the explicit reconciliation against the earlier candidate design, which correctly retained the public flag bag while this contract was unresolved. That older audit remains historical evidence; no duplicate deletion credit.
- Normalized required design headings. Retained full target, migration map, guard accounting, encoded impact, test obligations and sequencing limits.

## Discovery bounds

Graft classifier/type query searched 853 indexed CLI files and found eighteen hits across the owner and its test file: declaration, examples, classifier, one production adapter, and test helpers/calls. Separate domain query verified existing kind/surface/status/anchor declarations. These are repository source consumer findings, not a claim to know every external TypeScript caller.

Graft savings: approximately 69,139 tokens across two calls (42,084 + 27,055).

## Output hashes

- Private `proposed-design.md`: `2a0215d2b13ac93fcfce6432f52f9ed1be30ad145c419c02b8ee4ecb239a2215`
- Private `proposed-row.json`: `0c0c1c4c8bb362b6dd00e2447e7eb463c18ff1903726dfa4b661c72f1e4bade0`
- Private `cardinality.json`: `25d731a21854c971a6698c6f5a7c100aa396a8767b2541b8d1d2cb49988ee946`

## Limits

No product edits, package verification, runtime classifier probe, P3, implementation, census round or gate completion is claimed. Cardinality enumeration and exact-source checks passed. The proposal is ready for parent integration and independent review, subject to its cross-design reconciliation.
