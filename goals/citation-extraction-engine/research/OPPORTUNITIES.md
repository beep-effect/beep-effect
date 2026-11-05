# Citation engine friction receipts

## 2026-10-28 — stale prerequisite and source state

- Work: establish P0 prerequisites and the exact official source baseline.
- Evidence: both prerequisite READMEs now say `completed-retained`; the engine
  packet still described both public contracts as unfinished. The shared
  official reference had advanced away from the required commit.
- Resolution: check public export maps and focused contract tests, retain a
  compatibility record, and run the specified source in a detached cache
  worktree without resetting the shared reference.
- Prevention: make prerequisite/source freshness a consumer admission check;
  retain exact commit/tree checks in every oracle exporter.

## 2026-10-28 — npm configuration breaks donor packaging probe

- Work: run the authorized pinned eyecite-ts suite with its frozen lockfile.
- Evidence: 322 files passed; packaging setup failed with `EALLOWSCRIPTS` because
  npm 12 rejects the workstation's user `allow-scripts` setting in this mode.
- Resolution: rerun with process-local `NPM_CONFIG_USERCONFIG=/dev/null` and
  `NPM_CONFIG_IGNORE_SCRIPTS=true`; all 323 files pass. Preserve the initial
  failure and skip/todo counts in the baseline receipt.
- Prevention: document the isolated, install-scripts-disabled npm environment
  for reproducible donor packaging verification.

## 2026-10-28 — packet-local test is outside workspace discovery

- Work: add an executable public-import prerequisite probe.
- Evidence: root Vitest projects include package `test/**/*.test.ts` files;
  `goals/**/ops/*.test.ts` is outside their include patterns.
- Resolution: put the consumer test in law-practice use-cases' existing test
  surface and run it through that package script.
- Prevention: place executable consumer contract tests with the consuming
  package; reserve packet ops for generation and evidence tools.

## 2026-10-28 — packet Markdown gate has inherited failures

- Work: run the packet's declared Markdown verification command.
- Evidence: the unselected tool shim fails with `No version is set`; selecting
  the already installed 0.22.1 tool works. The full packet then reports
  inherited long table rows and unescaped reflection-template placeholders.
- Resolution: new evidence Markdown passes with zero errors; retain the
  existing full-packet failures as open close-gate work, not as a green result.
- Prevention: pin the tool invocation and make the packet's declared command
  green before its final delivery.

## 2026-10-28 — redundant tokenizer serialization slows oracle export

- Work: capture public-operation input and stage evidence for the full suite.
- Evidence: the first run repeatedly serialized 6,805 extractors per call;
  interrupt traceback identified repeated constructor source-file hashing.
- Resolution: stop the owned read-only exporter, cache source/callable hashes,
  compare declared extractor fields, and share deeply immutable vocabulary
  values by hash. Never memoize frozen Resource, whose citation is mutable.
- Prevention: separate artifact identity from repeated observation payloads and
  require byte-identical regeneration after optimization.

## 2026-10-28 — generic JSON encode would invalidate evidence hashes

- Work: decode normalized Python payloads with Effect Schema JSON codecs.
- Evidence: ordinary JSON parse/encode preserves meaning but may change key
  order and whitespace; hashes bind original UTF-8 bytes.
- Resolution: preserve original bytes with the derived typed view, encode
  coherent pairs byte-identically, and reject forged raw/value pairs. Five
  focused tests include both laws.
- Prevention: declare representation and information laws at integrity-bound
  serialization boundaries before writing the consumer.

## 2026-10-28 — packet names a retired Effect transform API

- Work: build the fixture codec using the checked Effect 4.0.6 source.
- Evidence: `SchemaTransformation.transformOrFail` is absent; the current
  fallible API is `SchemaTransformation.transformEffect` with schema issues.
- Resolution: record the spelling adaptation in SPEC and retain all typed
  failures, directional laws and exact production call requirements.
- Prevention: verify packet API examples against the pinned Effect checkout
  before implementation; do not turn stale names into replacement behavior.

## 2026-10-28 — unseeded oracle tokenizer metadata is nondeterministic

- Work: prove byte-identical public-operation corpus regeneration.
- Evidence: second generation changed only the two tokenizer configuration
  hashes in 760 extraction inputs. A structural comparison identified the
  strings field; the source populates it from a set. Normalized stage/output
  data stayed equal in that comparison.
- Resolution: require `PYTHONHASHSEED=0` at interpreter startup, verify disabled
  hash randomization, record the seed, and regenerate both runs. Preserve the
  source's seeded ordering rather than inventing a sorting transformation.
- Prevention: pin hash/environment inputs before treating generated tokenizer
  configuration as reproducible source evidence.

## 2026-10-28 — edition candidate order varies even with a fixed hash seed

- Work: repeat the complete seeded oracle export byte for byte.
- Evidence: only six of 826 observations differed, solely within edition
  candidate bags. `CitationToken.merge` constructs these through sets. Exact
  changed case pairs and comparison hashes are retained in
  `history/evidence/edition-candidate-order.json`.
- Resolution: sort only normalized exact/variation/all-edition candidate bags,
  keep every candidate and selected edition, record the normalization version,
  and prove all other inputs/stages/outputs equal. Fresh exports now compare
  byte-identically. A reordered-bag corruption is a validator control.
- Prevention: distinguish an unordered ambiguity set from an ordered legal
  decision; retain a source-bound normalization receipt instead of silently
  ignoring unstable fields.

## 2026-10-28 — prose tooling rejects a byte-faithful oracle corpus

- Work: commit the validated generated operation corpus with normal hooks.
- Evidence: spellchecking treats legal abbreviations such as `Sav.` and an
  upstream `Repoter` spelling as errors; Biome also warns about its file size.
- Resolution: exclude this exact generated file from prose/format tooling;
  preserve its bytes and retain the schema/hash/source/span/control gates.
  All authored code and other fixtures remain checked.
- Prevention: classify digest-bound upstream fixture bytes at admission, as
  the existing vendored schema/data exclusions already do.

## 2026-10-28 — current-HEAD base inherited unrelated work

- Work: audit the feature branch before continuing toward one delivery PR.
- Evidence: the shared current HEAD carried seven commits and 209 changed
  files beyond the tracked main base, unrelated to citation extraction.
- Resolution: preserve the shared checkout and a feature recovery reference,
  replay only the two goal commits onto main, reconcile dependencies with a
  frozen install, and repeat package/discovery/operation verification.
- Prevention: compare the proposed feature base with tracked main before
  creating a lane; do not confuse preserving current source context with
  authorization to ship unrelated inherited commits.

## 2026-11-03 — package unit filename also starts full native corpus

- Work: check explicit Bun runtime selection after adding the Node regex adapter.
- Evidence: selecting `CitationHtmlWorkerCorpus.test.ts` starts 1,097 native HTML
  observations, and `CitationHtmlBytes.test.ts` embeds 589 child processes in
  the ordinary package unit tier. Both local commands were stopped.
- Resolution: stop only the owned command tree, retain its incomplete receipt,
  and retain the 25 passing focused worker/ownership tests plus package lint/check.
  Full HTML/byte corpus proof stays hosted.
- Prevention: inspect test bodies and select individual smoke-test names before local
  replay; filenames alone do not bound compute. No partial run is accepted as
  corpus proof.

## 2026-11-03 — Bun test runner can disguise a runtime probe

- Work: qualify the regex worker and complete source corpus under Node.
- Evidence: inside `bunx --bun vitest`, a Node-named Bun shim made the original
  `node -p process.execPath` discovery return Bun. Child-reported runtime identity
  failed the new Node corpus smoke assertion.
- Resolution: reject shim candidates using fixed actual-runtime probes; share
  verified executable discovery between bundled and native-busy fixtures; repeat
  all 12 worker tests and both source smoke tests successfully; correct the
  previous Node proof claim explicitly.
- Prevention: actual child replies must identify runtime and pinned version;
  executable names and parent-shell version observations alone are insufficient.

## 2026-11-03 — spelling check interprets encoded source bytes as prose

- Work: publish independent extractor-selection observations.
- Evidence: normal typos hook treats `Iz` inside a base64 source buffer as a
  misspelling, failing the commit while all native-word assertions pass.
- Resolution: use the existing Schema hex byte codec for this new fixture and
  regenerate its hashes and repeat evidence. The observed bytes are unchanged;
  no spelling allowlist or scanner exclusion is added.
- Prevention: choose the existing hex carrier for opaque native-word fixtures
  before publishing their first digest-bound format.

## 2026-11-03 — an empty Struct is not an exact empty kwargs dictionary

- Work: bind decoded captures to the nine built-in source token constructors.
- Evidence: the actual source rejects unknown plain-token keyword arguments,
  but the target initially accepted one and published token identity zero.
  `S.Struct({})` with excess-property checking did not express the intended
  empty dictionary contract; the 54 independent source failure controls exposed
  the mismatch.
- Resolution: use the existing `S.Record(S.String, S.Never)` schema for empty
  constructor extras. Every source failure control now matches, including
  missing-group precedence and explicit null extras.
- Prevention: use an explicit empty-record schema when the source requires zero
  keyword keys; do not infer exact-dictionary semantics from an empty Struct.

## 2026-11-03 — canonical JSON key order is not regex group-definition order

- Work: materialize native named captures into real token objects.
- Evidence: the oracle export sorts JSON object keys, while source groupdict
  follows compiled named-group ordinals. The optional-first/body controls have
  different lexical and definition order.
- Resolution: retain an independent groupOrder array from actual source
  groupdict and restore target names by their unique capture ordinals with
  Effect Array/Order. Every constructor now asserts its output group-key order.
- Prevention: preserve source-observable order separately before canonical JSON
  normalization; do not treat wire object order as a semantic iteration receipt.

### Bound class methods need an explicit receiver identity

Canonical integration exposed that the existing callable snapshot identifies an
inherited function while losing its bound class. The same Token.from_match
function constructs seven different built-in classes in the default extractors.
Keep that original snapshot within its declared comparison scope; add independent
receiver-class observations before using it as a constructor recipe. The new
source probe checks all 6,805 default records and preserves ordered edition refs.
See history/evidence/2026-11-03-extractor-recipes.md.

### Keep configuration encoding separate from native installation

The composed tokenizer accepts decoded native configuration, including bigint
hashes and byte arrays. Decode persisted fixture codecs once, then validate the
installation through S.toType of the model. Reapplying the encoded codec would
reject valid owned native data. Source Aho filter construction also reads global
EXTRACTORS, so controlled source setup must explicitly install and restore that
global rather than assume the dataclass constructor argument controls filtering.
See history/evidence/2026-11-03-native-tokenizer-composition.md.

### Preserve runtime hash parameters during canonical composition proof

The complete default catalog references 2,533 distinct editions. Date/None hashes
are runtime facts even with a fixed string-hash seed, so exact intermediate set
order must be tested with an explicit captured profile. The source replay verifies
all other edition facts and supplies only those hash parameters to the actual
source implementation. It does not normalize intermediate order or establish
fresh-process production semantics. The installing server must authenticate the
metadata separately from the canonical regex artifact. See
history/evidence/2026-11-03-canonical-tokenizer-catalog.md.

### Give clock-changing source profiles independent TestClock owners

The metadata-year corpus installs several source import-time calendar bounds,
while other controls move time across a year boundary. Sharing a test-layer
clock caused an extractDeadline failure when concurrent tests moved it. Upstream
TestClock.layer in a separate nested it.layer for each test preserves the
intended ownership and avoids direct Effect.provide inside test bodies, which
the repository's strict Effect diagnostic rejects. Thirteen focused tests now
pass without deadline weakening or diagnostic suppression. See
history/evidence/2026-11-03-metadata-year.md.


### Keep native hex fields outside natural-language spelling checks

The metadata string corpus preserved repeated native words as hexadecimal bytes.
The commit hook misread ed0ded0ded0ded0d as a misspelled word. A spelling type
limited to metadata-strings.json now ignores only its hexadecimal bytes fields;
prose and every source/schema/hash/replay assertion remain checked. A reusable
byte-field-aware spelling classifier would avoid repeating fixture exceptions.
See history/evidence/2026-11-03-metadata-strings.md.


### Share invocation allocation authority before composing metadata stages

Independent context, capture and metadata helper ceilings would restart the
same produced-text allowance. The context planner also checked retained words
after copying them. Captured Effect Ref reservations and preflighted Unicode
receiving copies now connect these stages without new process infrastructure.
A source calendar ceiling is captured once and can be reinstalled under a fresh
invocation budget. Complete compositor adoption remains required; see
history/evidence/2026-11-03-composed-text-budget.md.


### Reuse authenticated artifact payloads in secondary source corpora

The first edition-inference capture duplicated all canonical payloads and exceeded
Biome's 1 MiB input limit. Keeping canonical references and independent source
outcomes reduces it to 889700 bytes; existing authenticated fixtures still own
payload verification. No formatter exclusion or limit change is needed. See
history/evidence/2026-11-03-edition-inference.md.

- 2026-11-03 full-law oracle controls: law editions did not expose five distinct
  date-bound pairs, so the initial producer assertion failed before output.
  The final controlled full-law model vectors use actual canonical editions
  across source families, which the original model accepts. The receipt names
  that scope explicitly; default-tokenizer cross-family assignment is not
  inferred. Inspect source artifact diversity before selecting fixture controls.

- 2026-11-03 resource correction: a deadline test reused its adapter after
  releasing a manual sleep signal, making every later matching timer expire
  immediately. The ordinary empty-reporter bypass assertion now runs before
  timer release; the dedicated expiry assertion remains unchanged. Fallow also
  identified cognitive complexity in the page method; extracting the exact
  native marker scan removed the finding without suppression or floor changes.

- 2026-11-03 positive lookahead: first grammar pass accepted a verbose space
  after '?' that the actual V0 parser rejects. An independent '(? = a ) a'
  oracle case exposed it before publication; the header now reads the immediate
  assertion delimiter. New replay-helper complexity and an unused helper export
  were corrected by sharing the existing row/capture assertions and keeping
  their inner helper private, without changing a gate or adding suppressions.

- 2026-11-03 journal composition: a generic callback requirement incorrectly
  listed Clock as a service, while installed Effect exposes it as a
  Context.Reference. Type checking caught the artificial remaining Clock
  requirement; the dependency union now lists only real required services while
  the captured Clock is explicitly provided. Fallow source/test duplication was
  eliminated through shared owned context/captures, calendar/admission setup and
  deadline assertions. A configuration codec was hoisted after Oxlint identified
  repeated inline schema compilation. All fixes preserve existing quality floors.

- 2026-11-05 hosted repair: aggregate deprecated-import output hid the path of
  its single warning. Replaying that exact rule with the JSON reporter isolated
  an oversized generated recipe corpus, rather than a deprecated import. The
  source producer now losslessly interns edition references/extra values and
  proves expansion equality; the fixture fits the existing limit. Earlier local
  checks also omitted an old negative assertion test for newly supported
  lookahead and the global single-field tag rule; focused existing regression
  suites and exact policy checks should accompany grammar/fixture changes.
