# Bounded six-form public Layer — 2026-11-08

The actual `CitationExtractorLive` now composes pinned isolated recognition,
canonical source verification, original UTF-16 projection, existing mention and
authority identities, and strict document-local resolution. Its server-only
service is `CitationExtractor` in law-practice-use-cases/server; installation is
exported from law-practice-server/layer. The legacy four-operation engine stays
available. No API or historical test was retired.

## Actual public-path acceptance

`CitationSixFormProjection.test.ts` invokes the public Layer on every frozen
input independently on Bun and Node. Both runtime tests pass: 29 inputs and 33
labeled occurrences each, including original locator/pin/antecedent/lexical-core
quotes and UTF-16 ranges, semantic fields, ambiguity, orphans, negative/empty
inputs and local authority relationships. Every quote is produced through the
published genuine source/anchor verifier, not decoded from a receipt. This is a
finite reviewed-profile result, not a general accuracy claim.

`CitationExtractorControls.test.ts` has nine passing controls. Caller/source
mismatch and source prerequisite failure refuse before parser spawn. Real parser
candidate, mention, authority and aggregate quoted-text exhaustion refuse the
whole result after independently observed physical retirement. A diagnostic
emitted after a valid response is refused as a source-free public transport
failure. Source resolver and Digest remain captured when callers replace them;
the method is statically R = never. Captured TestClock still controls the
deadline when a caller supplies a never-sleep Clock. Deadline and two successive
cancellations acknowledge three physical retirements and allow capacity reuse.

Only late-warning and synchronous-block controls use purpose-built child
fixtures. The block runs after a real direct recognizer call; it demonstrates
supervisor responsiveness and retirement, not a measured pathological donor
regex. All discovery/profile calls use the real pinned recognizer.

The final two-file public suite passes 11 tests. A combined six-file run also
passes 34 tests across public extraction, controls, legacy/new artifact identity,
legacy public engine composition and native admission. The fourth quoted-text
budget control was added after that combined run and is covered by the final
11-test public run. The separate worker/socket/process run passes 21 tests;
report/error contracts pass four tests. No combined coverage percentage is
claimed.

## Identity, prerequisites and installation

The new artifact uses `citation-extractor-artifact/v1`, `six-form/v1`, strict
linking/v1, eyecite-ts 0.34.2 and its exact lock integrity. It commits trusted
implementation/runtime claims, effective policy and the canonical vocabulary
version. The new report names those actual profile/recognizer/vocabulary
versions and reports excluded recognizer tokens without claiming exhaustive
outside-profile discovery. No Python oracle, invented confidence or selected
reporter edition is asserted. Unknown edition candidates remain absent.

The installer must authenticate its implementation/runtime and supply the
correct worker launch capability. Hashing configuration commits those claims;
it does not authenticate arbitrary executable bytes. Actual tests bundle the
production worker entries and execute them with the selected runtime. They do
not establish a separately deployed application's build attestation.

Compatibility is refreshed against current public contracts by real imports and
source/test type checking: SourceTextResolver, SourceTextIdentity,
VerifiedSourceText, TextAnchor and the canonical verification producers;
CourtReporterArtifact/ArtifactVersion; existing Citation, CitationMention,
CitationDocument and identity/resolution owners. No generated vocabulary import,
new offset converter or structural-proof shortcut is used. Runtime source
proofs remain server capabilities, not client exports.

## Repository and hosted proof

Full server source/test types pass, as does emitting the use-cases declarations.
Focused package laws and JSDoc pass; three inherited server naming advisories
remain. Syncpack now passes after correcting three workspace specifiers.
Driver examples use the repository's titled fenced example convention. Fallow
changed-code audit and health both report zero findings after removing actual
startup/configuration duplication and exposing static worker entry references;
no suppressions or advisory/health baselines were expanded.

Shared snapshot/admission assembly reuses Schema and existing Effect owners.
Both artifact tests retain the legacy fixed digest. MIT/BSD notices and historical
corpora remain preserved. No dependency, timeout or limit was increased to hide
an assertion failure. Broad hosted acceptance, review, reflection closeout and
verified merged retention remain incomplete until exact-head evidence exists.
