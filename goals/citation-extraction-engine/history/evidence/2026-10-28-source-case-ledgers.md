# Source, case and regex ledgers — 2026-10-28

Scope: P0 accounting evidence. All implementation and regex-safety obligations
remain in `audit` with explicit null target/proof fields. Passing the projection
audit is not target parity or permission to close P0.

## Artifacts and independent inputs

`ops/export-ledgers.py` checks the clean official commit/tree, compares every
source-content hash against independent discovery, and requires exact assertion
identity/order agreement between discovery and the separately captured operands.
It writes the following files under the portable eyecite fixture directory:

- `source-inventory.json`: 372 source rows, method/parameter metadata and
  declaration expansion IDs.
- `canonical-cases.json`: 195 capability obligations and 1,583 assertion cases.
- `regex-inventory.json`: 110 source families and 13,610 extractor instances.

Generated row arrays use one record per line; the source parameter graph
retains its readable structured form. This reduces repetitive diff lines
without dropping fields or changing any observed values.

All three record the official repository, pinned commit/tree, BSD-2-Clause
license hash, root notice, generator version/hash and complete file hashes for
discovery, assertion and operation evidence. The test-only schema is
`CitationOracleLedgers` from `@beep/law-practice-use-cases/test`.

The source rows use only the packet's closed kinds: four public operations,
39 model families, 152 helper families, 66 assertion declarations, 110 regex
families and one fixture. Test-method and literal/loop metadata are retained in
separate structured projections rather than mislabeled as runtime cases.
Every operation/model/helper row maps to exactly one individual capability
obligation; seed-family labels organize those obligations without waiving any.
The eight oracle fixture constructors are explicitly assigned `C-023`.

Each assertion case refers to its exact normalized observation hash, source
assertion, test and ordinal. Input/options remain in the observation's producer
context, operands and keyword arguments; expected behavior is its passed
relation. Active iteration references and literal item ordinals are carried
into the case ledger and checked against the original capture. No payload is
silently reduced to a final citation string or a broad method-level result.
The separate operation projection retains all 826 observed calls and hashes.

## Regex scope

The source walk retains regex declarations and builders, direct module calls,
compiled-pattern method calls, escaping sites, native accelerator operations
and all seven positional TokenExtractor construction sites. It includes
patterns in cleaning, metadata, resolution and markup utilities, not just the
central regex module. Data arrays used to compose regexes remain visible source
families. The walk fails on ID collisions and unclassified capability modules.

Both captured tokenizer configurations contain 6,805 instances. Every instance
has an artifact/index identity, exact pattern hash, flags and constructor
identity, verified against the existing content-addressed configuration. The
count is 13,610 configuration instances, not 13,610 independent pattern designs
or completed safety reviews. Constructors/builders and their expanded instances
still need implementation mapping, adversarial evidence and terminal proof.

## Portable validation and negative controls

```sh
python goals/citation-extraction-engine/ops/export-ledgers.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" \
  --output-root packages/law-practice/use-cases/test/fixtures/eyecite
bun run goals/citation-extraction-engine/ops/check-ledgers.ts
python goals/citation-extraction-engine/ops/verify-ledger-controls.py \
  --scratch-root "$HOME/.cache/beep/citation-extraction-engine"
bun run beep quality package-verify @beep/law-practice-use-cases
```

The audit checks compatible projections separately: source declarations versus
capability ownership, assertion events versus cases and declared expansions,
fixture source versus provenance, and source regex families versus regex rows.
It verifies the expanded pattern/flag/constructor data against both tokenizer
artifacts. It does not compare a heterogeneous source inventory to assertion IDs.

Observed: the projection audit passes. The stricter `--complete` mode rejects
the real unfinished corpus, which currently has 15,498 capability, case, family
or instance rows without completion proof. This is an intermediate ledger gate;
the final `citation:parity-check` must also integrate donor dispositions,
divergences, target tests and safety proof before it is available as a close gate.

All 18 corruption controls fail through the actual validator: missing/duplicate
source rows or cases, unknown row kind, wrong observation hash, missing or
misowned capability, missing expansion, composite workflow state, canonical
rejection, missing fixture license, incorrect fixture hash, missing regex family
or instance, duplicate instance, incorrect expanded pattern hash and incorrect
input-evidence hash. Audit baseline acceptance is required before controls run.
The full package audit and docgen pass.

A second clean generation is byte-identical for all three artifacts:

- Source inventory: 993,589 bytes; SHA-256
  `ff6dc98ad78e85c738b773b49938ccbb9117c5fe714b2ed3c12066e7aa049909`.
- Canonical cases: 2,398,220 bytes; SHA-256
  `754f6b781f575fd967091b350af92bb006952f1ac9d8a3e00c5343614df8299b`.
- Regex inventory: 4,909,915 bytes; SHA-256
  `b0e75c4cd10ee153aeafe4f1b40750415c7f32ca0fabaaadc740b9f69f35fa83`.

## Remaining work

The source inventory exposes obligations beyond the 52-method suite. They
still require focused supplemental probes and target tests, including native
accelerator-equivalent behavior, helper/model operations and fixture support.
No canonical obligation is rejected or deferred. Donor export/test dispositions,
normalized divergences, vocabulary-version mapping, limits/execution strategy,
implementation, source anchoring, transformation laws and the one-PR closeout
remain required. P0 and the full goal stay active.
