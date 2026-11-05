# Versioned authority identity producer

Date: 2026-10-28. Local P1 checkpoint; the complete goal remains active.

## Source rules and protocol

The private server producer adapts `CitationBase.__hash__`,
`ResourceCitation.__hash__`, `CaseCitation.__hash__`, `corrected_reporter` and
`Resource.__hash__` from pinned eyecite `models.py`. BSD-2-Clause attribution
remains in the source header and root notice. It returns the existing ca1
brand; no second public authority model or persisted entity ID is introduced.

The ordered JSON protocol begins with `citation-authority/v1`:

- Ordinary full cases use volume when present, page and corrected reporter.
  Metadata, other group keys, occurrence identity and current ReporterId do
  not enter that key. A selected edition supplies its frozen short spelling;
  otherwise the raw reporter group is used.
- A case with an explicit null page uses its occurrence ID, preserving the
  oracle's conservative object-unique behavior without a process address.
  Identical replay is stable; distinct verified occurrence IDs stay separate.
- Full law and journal citations use their distinct family, all legal group
  keys/values and the entire candidate-edition bag. Missing and explicit-null
  keys differ. Edition multiplicity remains significant. Group insertion
  order and candidate order are normalized under the packet's declared bag
  law; selected edition and textual metadata do not change this resource key.

The SHA-256 digest of that UTF-8 protocol becomes ca1. This is a representation
adaptation; it does not reproduce Python's process hash integer. Equality and
resource grouping are the observable contract. Changing this protocol requires
a new ID version and consumer migration.

## Trust and evidence limits

The helper consumes a decoded FullCitation and a mention ID from the verified
mention producer. Its selected-edition descriptor is explicit trusted adapter
data. It checks the reference against the citation's selected edition and
rejects absent/mismatched descriptors. It does not authenticate the descriptor
spelling or recompute occurrence identity. The future live engine must resolve
and validate its frozen artifact and mention before calling. No filesystem,
configuration, Python or donor access enters production source.

The maintainer-only `ops/probe-authority-identity.py` verifies the clean oracle
commit/tree, Python 3.11, disabled hash randomization, frozen dependency
versions and clock. It captures 13 extracted full citations, all 169 resource
equality comparisons and independently computed ca1 vectors. The committed
fixture retains producer/license/lock hashes and source provenance.

Cases cover repeated and metadata-varied cases, differing volume, repeated
missing pages, two distinct historical CIT spellings, repeated and distinct
statute sections, and repeated journal citations. The target test checks the
entire matrix and all protocol vectors. It also checks the shared current CIT
reporter ID, which must not collapse those two authorities. Additional tests
exercise component order, descriptor rejection, null-key/edition multiplicity
and sanitized crypto failure. A sixth test checks candidate-bag order
normalization separately from multiplicity.

This is focused identity proof over decoded semantic fixtures. It is not
parser, extraction, full resolver, artifact-loader, extension or safety proof.
The canonical/donor/divergence ledgers remain open and no row is promoted.
Document relationships and the bounded engine pipeline remain unfinished.

The complete server gate passes (audit 31.8 seconds, docgen 10.9 seconds),
as does the downstream use-case gate. Both include build/type/test/lint and
documentation checks. The ten-component audit passes with target parity still
pending. Goals index/doctor and new-note/README Markdown checks pass. A fresh
oracle regeneration is data-identical and its producer hash matches the
committed script. Cache logs use the `authority-` prefix.

## Reproduction

```sh
PYTHONHASHSEED=0 "$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/probe-authority-identity.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" \
  --output /tmp/authority-identity-cases.json
bun run beep quality package-verify @beep/law-practice-server
bun run --cwd packages/law-practice/use-cases citation:parity-check --audit
```
