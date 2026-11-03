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
