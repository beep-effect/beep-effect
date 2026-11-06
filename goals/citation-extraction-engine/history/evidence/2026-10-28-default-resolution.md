# Default resolution over verified semantic mentions

Date: 2026-10-28. Private default resolver checkpoint; full parity stays open.

## Implemented behavior

`Resolve.ts` adapts the pinned `resolve_citations` state machine and its
short-case, supra, named-reference and Id. matching rules. Full authorities use
the existing ca1 producer. Repeated full citations share a resource while all
prior full metadata remains available for subsequent name matching. The first
full representative is retained for Id. page validation.

Short cases compare corrected reporter spelling and nullable/missing volume.
A single candidate resource wins before antecedent refinement. Multiple
resources may be refined by the source punctuation helper and case-sensitive
party-name substring matching. Supra uses the same party-name rule and ignores
its textual volume, exactly as the source does. A punctuation-only antecedent
can become the empty substring; that source behavior is preserved.

Named references compare exact nonempty name values against all prior full
metadata strings, including non-name metadata and law/journal values. Court
metadata is projected to its raw/unmapped value or versioned known ID. This is
not a substring match. Multiple matching full rows are deduplicated by resource
identity before selecting an authority.

Id. follows the last successfully resolved resource and validates against its
first full representative through the previously proved numeric helper.
Unknown, failed and ambiguous outcomes clear that last-resource state.
Ambiguous candidates are retained as data without membership; their normalized
oracle projection is non-resolution. No confidence value is invented.

The source can lazily avoid missing reporter fields. The authority producer
now permits a missing-page case without a reporter and permits a selected
edition to supply a corrected reporter without the raw group. A later short
comparison still fails if it actually needs an absent unselected reporter.
Source KeyError, AttributeError and ValueError observations become sanitized
private failures. Final public boundary mapping remains open.

## Evidence and scope

The maintainer producer captures 46 scenarios and 116 mentions. Eighteen scenes
use actual oracle extraction; the other scenes supply synthetic semantic
models with independent raw witness ranges. The target consumes those semantic
models and verifies their witnesses; it does not claim target extraction.
Groups are compared by occurrence membership and encounter order. Five scenes
retain canonical exceptions rather than treating them as non-resolution.

Eight focused tests cover the complete fixture, ambiguity/Id. state reset,
caller mutation during the first digest, basic count rejection and exact
ceilings, known court projection, edition descriptor rejection, stale IDs and
unverified source substitutes. Synthetic witnesses do not replace the existing
exhaustive operation/assertion corpora or close their open projection families.
The producer verifies pin/tree, Python/dependency versions and hash seed, freezes
the oracle clock and retains producer/license/lock hashes.

## Source and resource boundaries

Input requires a genuine canonical source capability. All structural semantic,
edition and limit data is snapshotted before asynchronous work. Every mention
is reverified against that source and its cm1 ID is checked. No raw source
rehash is needed inside this stage. Result graph validation enforces document
identity/reference coherence. Typed failures retain no raw input or causes.

The private processing witness reuses FullCitation; it is not a second public
citation model. Private immutable Chunks preserve source order without repeated
array append copies. Edition data is explicit trusted adapter input; installed
artifact authenticity and vocabulary compatibility remain live Layer duties.
No filesystem, environment, Python or donor access enters production code.
The owning test reads the large fixture through Effect FileSystem and a schema
JSON codec, avoiding a TypeScript literal-union expansion from static JSON.

Source UTF-16, mention, authority, candidate-edge and iteration budgets use the
published explicit limits. Basic iteration work counts processed mentions and
prior-full/refinement scans. Edge work includes matching candidate rows before
resource deduplication. These are private counters, not a completed report or
full safety contract. Complete message/field limits, clock deadlines,
interruptible regex routing and process isolation remain open.

Custom resolver/resource ports and key policy remain unimplemented. This is the
default semantic-resource path only. No canonical/donor/divergence/safety row is
promoted, no phase closes and no public service/Layer is declared complete.

The full server package gate passes (audit 33.3 seconds, docgen 11.1 seconds),
including builds, type checks, tests, lint and documentation. Existing mention,
authority, persistence and text suites remain green. Stable oracle regeneration
is data-identical and its producer hash matches the fixture. The ten-component
evidence audit and goals index/doctor pass with target parity still pending.
New-note/README Markdown checks pass. Cache logs use the `resolve-` prefix.

## Reproduction

```sh
PYTHONHASHSEED=0 "$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/probe-default-resolution.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" \
  --output /tmp/default-resolution-cases.json
bun run beep quality package-verify @beep/law-practice-server
bun run --cwd packages/law-practice/use-cases citation:parity-check --audit
```
