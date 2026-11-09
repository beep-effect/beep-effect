# Friction receipts

## Source family audit: parent traversal is insufficient

The first continuity collector followed reported parents but did not query
reported US child identifiers. Independent source-only review found 55 of 96
candidates had at least one unqueried application identifier, including 19
with unqueried US nodes. The nominal locally closed subset was 41, rather
than 50. Legacy-side unresolved branches can also bridge apparently separate
candidate components. Earlier receipts remain unchanged; no source family or
annotation was qualified. A new bounded bidirectional collection follows
reported US parents and children and retains every unavailable record.

Prevent recurrence by treating every observed unqueried application node as
an explicit unresolved edge, auditing candidate and legacy sides, and never
using a drained parent-only queue as evidence of family disjointness.

## Source acquisition: official redirects need scoped credentials

The first pilot download attempt recorded two HTTP 302 responses and then an
HTTP 429; no archive was acquired. The corrected acquisition follows the
existing USPTO driver's official document-host policy and creates a fresh
credential-free request on the document host. The earlier failure receipt is
retained. HTTP rate limits stop that acquisition; they are not evidence that
1Password access is broken and do not justify asking for new credentials.

## Frozen historical source versus newer mandatory diagnostics

Accepted #2637 mechanically hoisted nested effects in three frozen evaluation
entrypoints. Restoring their original bytes caused 13 `yieldInCallArgument`
diagnostics during server package verification. The original manifest is
retained; an explicit three-entry location addendum preserves exact historical
sources as text artifacts while active runners retain accepted compliant code.
The verifier reports 1,210 original paths and three archives separately, checks
active hashes; SPEC separately requires report-equivalence replay. No diagnostic is disabled.
Future protocol freezes should distinguish immutable historical executable
artifacts from active source paths before repository-wide syntax migrations.

## Closest-only diagnostics hide recurring categories

The global closest-30 sample contained zero node mismatches despite 281 claims
with node-kind/boundary discrepancies. Added a separate nearest-ten sample for
every observed category, keeping the original closest30, counts, scorer and
cohort unchanged. Diagnostic output remains private because it contains source
claim text. The first finite-predicate repair reduces affected node claims from
281 to277 but gives no strict-match gain; other categories can worsen.

## Plausible local consistency is not retention proof

Removing a redundant exact-head restriction after antecedent resolution passed
synthetic tests and independent code review, but the unchanged 538-claim replay
scored33/538: zero gains and four protected losses. The runtime change was
reverted. Its source freeze, complete private outputs, public failure receipt
and proposed patch remain available. Never accept a plausible parser change
from focused examples alone, and do not repair the measurement by editing gold.

## Source verification preparation: temporary storage can fill independently

Preparing the source-verification helper failed with
`write failed: no space left on device` while the shell created a temporary
here-document. The temporary filesystem was nearly full, while the main
filesystem still had 162 GiB available. No actual source-verification run or
source-content operation had started. The sealed helper and evidence remained
unchanged.

Use a task-owned directory on the main filesystem through a command-scoped
`TMPDIR` for synthetic preparation. Keep its writes within the existing
resource accounting; this changes neither source-selection nor runtime or
evaluation limits. Do not delete source artifacts, review receipts or unrelated
temporary files to recover from a preparation error. Check both temporary and
destination filesystems before starting bounded source work.

## Helper verification: bind the interpreter actually launched

The preparation shell selected Python 3.15.1, while the fixed helper entrypoint
launched the system Python 3.14.9. The inherited preparation pin therefore did
not identify the actual helper interpreter. This was found before source use;
the earlier candidate and its review remain unchanged.

Bind the interpreter path, resolved binary, version and digest from the real
helper entrypoint. Run the relevant bounded controls under that interpreter
before accepting their evidence. A passing preparation-shell check does not
establish behavior under a different helper binary.

## Native extraction success can still leave page text unavailable

The closed control-job metadata and artifact sizes show 1,002 page-text
operations, each producing exactly one byte. Ten actual visual/text
comparisons confirmed form-feed-only text with no non-whitespace characters
and disagreement with the rendered pages. Successful tool exit codes did not
establish usable text or source fidelity.

The manual pass ended through its reviewed metadata-only abort route. All
144 outcomes, partial observations, 992 unobserved pages and unknown predicates
remain recorded; no fidelity, truth or bank admission was granted. Keep this
failed pass intact. A corrective OCR derivation from the same cached images
needs a separate bounded, reviewed source scope and must preserve the original
extracts. OCR output alone cannot establish fidelity or source truth.

Check text availability before scheduling expensive comparisons. Also measure
transport and model-review time before choosing a document-level time limit:
the first 23-page document closed partial after four observations, with a
recorded elapsed upper bound of 206.82 seconds under the 300-second limit.

### Private constructor probes must use schema-backed anchors

The structural compiler's first private budget probe passed shape-only anchor
objects into a constructor that production calls with schema-backed `TextAnchor`
values. An exhausted span returned that unbranded fallback, causing a schema
failure in frame construction. The original and extracted implementations
behaved identically on that invalid private input. Preserve the failed probe and
its diagnostic; do not report it as a production parser regression. The corrected
probe uses `TextAnchor.make`, and its original-module budget run completed.
Constructor probes should reuse production value constructors before interpreting
failure-path differences. Earlier invalid-input comparisons remain separate from
valid-source evidence, with no reference or historical-result changes.

### Exercise the pinned manifest's path representation before reader admission

The metadata-only reader preflight rejected the original mechanical manifest's
relative `files[].path` entries because the concrete executor required absolute
paths. No source reading or clock started. Preserve that refusal and executor
version. The additive repair must resolve relative entries beneath the pinned
canonical source directory while retaining absolute-entry behavior, duplicate
rejection and path confinement. Check both real manifest representations and
escape controls before issuing a reading authority; keep the existing manifest
hash, resource ceilings and all original evidence unchanged.


### Measure bounded response transport before source-reader admission

The cached-image continuation stopped on its second response writer with
`WRITER_TIME_LIMIT`. The first page comparison remains recorded; all remaining
page outcomes are unknown, and the pass stays revoked. The writer reserved its
frame length before failing, but never created a completed response file. Its
20-second alarm covers initialization, transport, guards, parsing and validation
as well as file writing. Existing telemetry cannot attribute the elapsed time to
one of those stages. Do not describe this as a slow disk write or a completed
image delivery.

Before proposing another reading phase, reproduce the response transport with
synthetic image-sized frames under the same time, memory and storage ceilings.
Measure startup, frame transfer and validation separately; preserve native exit
and cleanup evidence. Any repair must keep the original failed pass, its unknown
outcomes and all resource charges intact. Synthetic transport success would
establish transport behavior only, with no source-fidelity or reference admission.

## Decision lane flag: a `goals/` branch name reads as a broken path

Recording a decision with the lane flag set to this branch rendered the branch
name as inline code in the SPEC decision block. Hosted Lint Policy then failed
`knowledge:semantic-delta` with one introduced `broken-tracked-path` finding,
because a `goals/` prefix looks like a tracked repo path. Local package checks and
cheap gates do not run that scan. Dropping the optional lane field and regenerating
the block cleared it. The decisions tool could reject or differently render a lane
value that resembles a repo path.

## Quick package verify runs no tests

While adding fallback kind tests, a script gated its commit on
`quality package-verify --quick`, which runs only lint and check. It committed a
failing test, caught by a separate test run moments later and amended before any
push. Gate a commit on the package's tests as well as that command, or have the
quick form say plainly that it ran no tests.

## A follow-up lane's draft inherits an earlier PR's title

A lane branched from #2975 before that PR was squashed. Its commits stay in the
lane's history even after merging main, and `yeet open` took the draft title from
the oldest branch commit. #2987 therefore opened with #2975's title, which would
have become its squash subject. Check the title after opening. Branching follow-up
work from main after the squash would avoid it, or the tool could warn when the
oldest commit's subject matches a merged pull request.
