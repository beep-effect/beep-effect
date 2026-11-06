# Custom resolution callback contract observations

Date: 2026-10-28. Source evidence only; target custom resolution remains open.

## Provenance and reproduction

`ops/probe-custom-resolution.py` executes only as a maintainer tool against the
clean pinned eyecite checkout. It checks commit/tree, Python 3.11.15, hash seed
zero and the frozen eyecite/reporters/courts versions before importing source.
The output binds the exporter, resolve.py, models.py and BSD-2-Clause license
hashes. It constructs explicit semantic witnesses without invoking extraction;
no original-source extraction or span parity follows from these results.

The retained output is
`packages/law-practice/use-cases/test/fixtures/eyecite/custom-resolution-observations.json`.
It contains 18 contexts, 56 input occurrences and 53 callback events. SHA-256:
`19ce5a31fbcae943e71a0d580145d499a9fb911cd8fe5cf16226dc08a686a7af`.
The source pin remains `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`.

Run portable evidence controls with:

```sh
python3 goals/citation-extraction-engine/ops/verify-custom-resolution-controls.py
```

For exact replay, run that verifier with the pinned Python environment and
`PYTHONHASHSEED=0`, passing `--oracle-root` pointing to the clean oracle root.
Replay writes to an owned temporary directory and compares the entire decoded JSON
with the retained file, preserving all values and array order. Formatting-only
whitespace may differ because the repository formatter owns JSON layout.
It does not overwrite the retained evidence.

## Observed behavior and implementation implications

- The five callbacks dispatch in input order; unknowns dispatch no callback.
  Full callbacks also receive law/journal citations. A port must cover all five
  branches and preserve call order.

- Short, supra, reference and Id. callbacks can create a resource without a
  prior full citation. A following default Id. can resolve to it. Requiring a
  full representative for every authority cannot represent canonical custom
  callback results.

- A custom full callback can merge different full citations. Default Id. checks
  the first member's page. Preserve first-member state independently of the
  latest full citation.

- None, False, zero, empty string and empty tuple are stored in the prior-full
  list but produce no output group. Missing, falsy and grouped resource state
  cannot be collapsed prematurely.

- Keys 1 and True group together, retaining the first key object. Resource
  equality and key representation need an explicit adapter contract.

- The Id. callback sees groups before the current mention is appended. A
  callback snapshot must reflect the exact stage of processing.

- A supra callback can clear the shared prior-full list; subsequent default
  short resolution sees the empty list. Existing groups remain. Replacing
  mutable callback state with a read-only view changes observable behavior
  unless a lawful state protocol preserves it.

- An unhashable truthy resource fails with TypeError. A callback ValueError
  stops further dispatch. Port error mapping must be finite and redacted while
  preserving failure/dispatch behavior.

The current `CitationAuthority.fullMentionId` constraint and whole-document
default-key revalidation are valid for the implemented default path, but do
not yet support these custom results. The adaptation must address the domain
authority variants, resource identity protocol, document persistence checks,
and service ports together. Do not weaken source evidence verification or
reuse a fabricated full mention to satisfy the current schema.

Mutable callbacks can do more than the single mutation witnessed here. These
18 contexts are focused evidence, not exhaustive callback or Python hashable
protocol coverage. No equivalence law for arbitrary host objects is asserted.
The service-port design must settle remaining state/key questions against
source evidence before custom resolution is enabled.

## Verification and scope

Portable controls pass. Pinned replay also matches every decoded value. The
verifier checks all 18 unique contexts and expected groups/errors, all-five
dispatch, first-key retention, pre-append Id. state, callback failure dispatch
and mutation visibility. No TypeScript implementation is exercised by this
lane. It neither adds target-tested contexts to the existing 76/210 default
totals nor promotes a canonical ledger, donor, divergence or safety row.

No production source changed. Public service integration, custom-resource
target proof and the complete target parity gate remain unfinished. The goal
and both current phases remain in progress.
