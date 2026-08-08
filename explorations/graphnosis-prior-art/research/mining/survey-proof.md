# Graphnosis survey — territory: error classification, tests, benchmarks & evidence

Repo: `/home/elpresidank/YeeBois/dev/Graphnosis` (Apache-2.0, `@nehloo/graphnosis` v0.11.0,
TypeScript, Next.js app + published library + CLI + MCP server).

Everything below was read in full or executed live. Where I ran something, the output is
quoted. All `path:line` references are into the Graphnosis checkout.

---

## 0. Shape of the territory

- `src/core/errors.ts` — 192 lines. Two legacy `Error` subclasses + a stable code/class system.
- `tests/` — 9,304 lines total. 25 hand-rolled suites under `tests/unit/`, one ablation script,
  one micro-benchmark, and a LongMemEval harness (`tests/longmemeval/official/`, ~2,900 lines).
- `spec/` — `.gai` format conformance suite (`conformance.mjs`, 91 lines) + a fixture generator
  (`make-fixtures.ts`, 125 lines) + 11 committed fixture files, half deliberately malformed.
- `scripts/verify-package.mjs` — 151 lines, packaged-artifact verifier.
- `benchmarks/` — `benchmarks.md` (512 lines of run history), `dual-graph-and-recall.json`
  (one bench artifact), `evidence/` (8 sanitized per-question JSONL result files + `manifest.json`
  + `checksums.txt` + `verify.mjs` + README).
- `.github/workflows/` — `ci.yml` (74 lines), `publish.yml` (103), `cla.yml` (43).

There is **no test framework**. Every suite is a top-level script that prints `ok`/`FAIL`,
counts failures, and calls `process.exit(failures === 0 ? 0 : 1)`. `npm test` is a single
`&&`-chained string of 26 `tsx` invocations plus `node spec/conformance.mjs`
(`package.json:61`).

---

## 1. The error system (`src/core/errors.ts`)

### 1.1 The incident, written into the source

Lines 42–75 are a long comment block that names the actual production failure rather than
describing the design abstractly:

```
// The consuming application classifies a failed `.gai` load by SUBSTRING-
// MATCHING this package's message text:
//
//     const looksCorrupt = msg.includes('checksum') || msg.includes('HMAC')
//                       || msg.includes('Invalid .gai') || msg.includes('signature');
//
// If true it tries a last-known-good sibling and quarantines the file; if
// false the engram silently disappears from its picker. 0.10.0 added a
// validation whose message begins `Invalid graph:` — not `Invalid .gai` — so it
// matched nothing and lost its recovery path.
```
(`src/core/errors.ts:44-56`)

And then the inverse, which is the load-bearing insight:

```
// The same release made the opposite mistake worse: `Invalid .gai file: format
// version N is newer than this reader supports` DOES contain `Invalid .gai`, so
// a consumer routing that prefix to "corrupt" would QUARANTINE A PERFECTLY GOOD
// FILE written by a newer version. Version skew is not corruption and must
// never be handled as it.
```
(`src/core/errors.ts:58-62`)

### 1.2 Two axes: code and CLASS

```ts
export type GraphnosisErrorClass =
  | 'corruption'    // bytes damaged or forged — safe to quarantine, try a backup
  | 'version-skew'  // a newer writer produced a valid file — NEVER quarantine
  | 'caller'        // the call was wrong — retrying unchanged will not help
  | 'config';       // runtime config disagrees with the stored artifact
```
(`src/core/errors.ts:78-88`)

15 codes (`src/core/errors.ts:90-107`), and exactly one frozen mapping:

```ts
export const ERROR_CLASS: Readonly<Record<GraphnosisErrorCode, GraphnosisErrorClass>> =
  Object.freeze({ ... });
```
(`src/core/errors.ts:114-133`)

The JSDoc on that table states the reason for singularity: *"deliberately the only place this
relationship is written down — a second copy is how the app ended up with two divergent
classifiers that disagreed with each other"* (`src/core/errors.ts:109-113`).

The framing that makes this different from an ordinary error-code enum:

> *"the question a consumer actually asks is not 'which error' but 'what do I do about it'"*
> (`src/core/errors.ts:65-66`)

Predicates are three lines each and branch on the class, not the code:

```ts
export function isCorruption(err: unknown): boolean {
  return err instanceof GraphnosisError && err.codeClass === 'corruption';
}
```
(`src/core/errors.ts:172-192`; `isVersionSkew`, `isCallerError` identical in shape)

### 1.3 One class with a code field, NOT subclass-per-error

```ts
export class GraphnosisError extends Error {
  readonly name = 'GraphnosisError';
  readonly code: GraphnosisErrorCode;
  readonly codeClass: GraphnosisErrorClass;
  constructor(code: GraphnosisErrorCode, message: string) {
    super(message); this.code = code; this.codeClass = ERROR_CLASS[code];
  }
}
```
(`src/core/errors.ts:145-154`)

The stated rationale (`src/core/errors.ts:135-144`) is the part worth stealing:

- `instanceof` does not survive **duplicated module instances** — two copies of the package in
  a dependency tree, or an esbuild bundle that inlines it ("the app's MCP bundle does exactly
  that").
- `instanceof` does not survive **`JSON.stringify` across an IPC or JSON-RPC boundary**; a
  string code does, "as long as the boundary copies own enumerable fields."

So the taxonomy is data (a frozen record) and the carrier is a field, not a prototype chain.
The two *pre-existing* subclass errors (`AnalyzerMismatchError`,
`EmbeddingAdapterMismatchError`, `src/core/errors.ts:11-40`) are left in place — they were not
retrofitted, they just carry `readonly name = 'ClassName'` so V8 stacks stay readable
(`src/core/errors.ts:1-3`).

### 1.4 Additive-only evolution, and a named trap

> *"THE MESSAGES ARE FROZEN. Every message string on the load path is now load-bearing for at
> least one already-shipped consumer. Codes are ADDITIVE: add a code, never reword a message."*
> (`src/core/errors.ts:68-70`)

Two specific traps are called out:
1. Do not introduce the word `signature` into any message **or code description** — the shipped
   classifier matches it and no message contains it today, so adding it would silently
   reclassify an unrelated failure as corruption (`src/core/errors.ts:71-74`).
2. Do not change the `Invalid .gai` / `Invalid graph` prefixes (`src/core/errors.ts:75`).

`gaiError(code, message)` is documented as *"this factory exists to attach a code, never to
reword"* (`src/core/errors.ts:156-162`), and `codedError` is an alias kept solely so no existing
call site has to move (`src/core/errors.ts:164-169`).

### 1.5 The test that enforces all of it (`tests/unit/error-codes.test.ts`)

Four sections; I ran it and all 12 checks pass.

**§3 is the interesting one.** It reads the *source text* of two files and asserts a frozen list:

```ts
const src = ['src/core/format/gai-reader.ts', 'src/core/graph/graph-store.ts']
  .map((f) => require('node:fs').readFileSync(f, 'utf8')).join('\n');
const FROZEN = [ 'Invalid .gai file: magic bytes mismatch', ... 12 entries ... ];
const missing = FROZEN.filter((m) => !src.includes(m));
check('all 12 frozen message strings are still present, byte-identical', missing.length === 0, ...);
```
(`tests/unit/error-codes.test.ts:96-117`)

Then the **negative constraint**, implemented by extracting only the message literals (so a
comment mentioning "signature" is allowed but a reachable message is not):

```ts
const messageLiterals = [...src.matchAll(/gaiError\(\s*'[A-Z_]+',\s*([`'"])([\s\S]*?)\1/g)]
  .map((m) => m[2]);
check('no error MESSAGE contains the word "signature" — the classifier trap',
  messageLiterals.every((m) => !/signature/i.test(m)), ...);
check('the message-literal scan actually found messages — not vacuous',
  messageLiterals.length >= 10, `${messageLiterals.length} found`);
```
(`tests/unit/error-codes.test.ts:123-128`)

That last line is the pattern that recurs everywhere in this repo: **a scan-based assertion is
always paired with an assertion that the scan found anything at all.**

§4 asserts the table is total, frozen (`Object.isFrozen`), and — pinned as a literal —
*"exactly one code is version-skew, and it is the format-version one"*
(`tests/unit/error-codes.test.ts:137-139`).

§2 is honest about what it cannot construct: rather than forge a version-99 header, it asserts
the *contract* (`ERROR_CLASS.GAI_VERSION_UNSUPPORTED === 'version-skew'`) with an in-line note
saying why, and then adds a non-vacuity check that `isCorruption` is not constantly false
(`tests/unit/error-codes.test.ts:74-88`).

### 1.6 Refusal design (`src/core/corrections/confidence.ts`)

The `caller` class exists mostly for `setConfidence`. The mechanism worth porting:

```ts
function refusalFor(graph, nodeId, value, reason, now, supersededIds): GraphnosisError | null
```
(`src/core/corrections/confidence.ts:155-162`) — the validator **returns the error it would
throw** instead of throwing. Docstring: *"Extracted so the batch path can check every entry
before mutating anything."* That is how `setConfidences` gets atomicity for free, and the test
pins it: one bad entry refuses the whole batch, nothing is written, the version is not bumped,
and the message names **every** failing entry (`tests/unit/confidence-primitive.test.ts:403-453`).

The messages name the correct API rather than describing the violation:

- `... got ${value}. Zero is reserved for retirement (RETIRED_CONFIDENCE); to stop serving this
  memory call deleteNode(), which leaves a tombstone and stays auditable. Use clampConfidence()
  if saturating is what you meant.` (`src/core/corrections/confidence.ts:180-195`)

and the tests assert that the message contains the fix:
`check('the message names clampConfidence, so the fix is in the error', /clampConfidence/.test(err.message))`
(`tests/unit/confidence-primitive.test.ts:314-315`),
`check('the refusal points at deleteNode(), which leaves a tombstone', /deleteNode/.test(err.message))`
(`tests/unit/confidence-primitive.test.ts:330-331`).

**Reserved-sentinel design.** `RETIRED_CONFIDENCE = 0` (`src/core/graph/retirement.ts:135`) sits
*below* the legal write range `CONFIDENCE_MIN = 0.01` (`src/core/corrections/confidence.ts:83`),
so a live value can never collide with the retirement audit marker. The test asserts the
relation itself, not just behaviour:
`check('RETIRED_CONFIDENCE is below the live floor, so the two can never collide', RETIRED_CONFIDENCE < CONFIDENCE_MIN)`
(`tests/unit/confidence-primitive.test.ts:332-334`). And refusing to clamp is deliberate:
*"NaN is refused, not clamped into something plausible"*, *"above the ceiling is refused, NOT
silently clamped"* (`tests/unit/confidence-primitive.test.ts:287-292`).

### 1.7 Export-surface enforcement by import

`tests/unit/confidence-primitive.test.ts:28-39` imports `isCorruption`, `isCallerError`,
`GraphnosisError`, `ERROR_CLASS`, `RETIRED_CONFIDENCE` **from `@/sdk/index`**, with the comment:

> *"Step 1.3 shipped this taxonomy in `@/core/errors` only. The `exports` map publishes three
> entry points and blocks deep imports, so no consumer could import `isCorruption` at all.
> These symbols are imported at the top of THIS FILE from '@/sdk/index' — if any of them
> stopped being re-exported, the file would not compile."*
> (`tests/unit/confidence-primitive.test.ts:455-461`)

(Caveat — see antipattern A4: nothing typechecks the tests, so "would not compile" is only true
in an editor. At runtime under `tsx` the import would resolve to `undefined` and the
`typeof === 'function'` checks below it would catch it.)

---

## 2. Testing craft

### 2.1 Non-vacuity as a standing clause

Every scan, fixture, or differential is accompanied by a check that it exercises anything:

| assertion | file:line |
|---|---|
| `'the message-literal scan actually found messages — not vacuous'` | `tests/unit/error-codes.test.ts:127` |
| `'isCorruption() is not constantly false'` | `tests/unit/error-codes.test.ts:85` |
| `'a real built graph produces edges at all — the check is not vacuous'` | `tests/unit/traversal-path-maximum.test.ts:132` |
| `'the two orders genuinely DIFFER on this graph'` | `tests/unit/traversal-path-maximum.test.ts:99` |
| `'the random graphs DO exercise the defect — fifo falls short somewhere'` | `tests/unit/traversal-path-maximum.test.ts:287` |
| `'the two builds mint different node ids (fixture is doing its job)'` | `tests/unit/ingest-determinism.test.ts:88` |
| `'the two comparator fixtures mint different ids (test is not vacuous)'` | `tests/unit/ingest-determinism.test.ts:203` |
| `'the alias check can actually detect an alias (positive control)'` | `scripts/verify-package.mjs:140` |
| `'fixture actually contains section nodes'` | `tests/unit/loader-index-parity.test.ts:65` |
| negative control: `'title-cased structural headings do not become people'` | `tests/unit/graph-integrity.test.ts:248-250` |

### 2.2 Mutation results recorded in prose, with numbers

They neutralise their own guards and write down what happened:

- *"BFS walks outgoing edges, incoming edges backwards, and undirected edges, in three separate
  loops with three separate guards — a fixture that covers only the outgoing one passes with
  the other two guards deleted. **(Measured: it did.)**"*
  (`tests/unit/traversal-determinism.test.ts:198-201`) — followed by three separate fixtures,
  one per edge direction, plus a fourth for a *retired seed* (the case a "filter the final
  selection" guard misses, `tests/unit/traversal-determinism.test.ts:243-252`).
- *"Without this case, deleting the Giki gate was caught **0 times in 10 runs**."*
  (`tests/unit/retirement.test.ts:364-367`) — and when the state's old constructor disappeared
  they set it directly rather than drop the case, because *"dropping the case because its old
  constructor disappeared would have left the three checks below passing vacuously — guarding
  nothing while reading as green"* (`tests/unit/retirement.test.ts:369-373`).
- *"Every guard below is written so that removing the guard makes a named check go red — see the
  neutralisation log in the milestone report."* (`tests/unit/confidence-primitive.test.ts:20-22`)
- Two *failed* fixture attempts documented in full, with the reason each was inert:
  *"Each fixture passed 20/20 against a surgically reverted comparator while appearing to guard
  it."* (`tests/unit/ingest-determinism.test.ts:144-158`) — the conclusion was to test the
  comparator (`orderByProvenance`) directly rather than through a built graph.

### 2.3 Fixture-realism: hand-authored ids are a blind spot

```
 * `traversal-determinism.test.ts` hand-authors node ids ('a', 'b', ...) and so never exercises
 * the ids the engine actually mints. Every real node id comes from `nanoid()`, which changes on
 * every build — so a tie-break on node id passes a fixture test and still reorders evidence in
 * production. That is exactly what shipped: on a 40-question sample, evidence ORDER differed on
 * 21/40 and the evidence SET on 6/40 between two builds inside one single-threaded process.
```
(`tests/unit/ingest-determinism.test.ts:1-14`)

The fixture then **forces ties rather than hoping for them** — 12 documents with byte-identical
text so cosine scores tie exactly and the tie-break alone decides order
(`tests/unit/ingest-determinism.test.ts:32-42`) — and identity is compared **by content, never
by id**, since ids are expected to differ (`tests/unit/ingest-determinism.test.ts:75-79`).
It also asserts the comparator is a **total order**: 30 distinct provenances must yield 30
distinct positions, "or ties would silently fall through to insertion order"
(`tests/unit/ingest-determinism.test.ts:208-212`).

Related: compatibility fixtures are produced by the *published old version*, not hand-built —
`tests/fixtures/legacy-v080-four-producers.gai` was written by *"the v0.8.0 public API
(git archive v0.8.0 → write-legacy-gai.mts)"*, and the test first asserts the fixture's shape
(what v0.8.0 actually wrote: `deletedAt` vs `forgottenAt` vs a bare `supersedes` edge) before
asserting the new predicate handles all four
(`tests/unit/legacy-retirement-v080.test.ts:1-14, 75-90`).

### 2.4 Differential testing against brute force (`tests/unit/traversal-path-maximum.test.ts`)

The header states a proof and then says which premises are tested rather than asserted:

> *"Every hop multiplies the running score by DECAY_FACTOR and an edge weight in (0, 1]. Score
> therefore strictly decreases along any path, so under best-first the FIRST dequeue of a node
> is provably its path maximum — which is what makes the `visited` set safe... That argument has
> two premises, and a comment asserting them is worth nothing."*
> (`tests/unit/traversal-path-maximum.test.ts:10-27`)

- Premise 1 (weights in (0,1]) is checked on a graph built through the **real ingest path**
  (`:112-136`) *and* enforced at the **load funnel**, because ingest is only one of five ways a
  graph enters memory: *"`readGai`, `fromBuffer`, the SQLite loader and the public
  `fromSerializable` export all accept whatever the bytes say, and the .gai integrity check is
  an additive byte sum its own writer documents as catching corruption rather than tampering"*
  (`:139-146`). The test then asserts `fromSerializable` refuses `Infinity`, `NaN`, `-0.5`, `0`,
  and `1/DECAY_FACTOR` (`:160-163`) — this is the `GRAPH_EDGE_WEIGHT_INVALID` code, classed
  `corruption`.
- A deliberate tolerance decision is encoded: a 1-ULP cosine overshoot (`1.0000000000000002`) is
  **accepted**, because *"refusing to open a memory over one ULP would be a data-availability
  bug introduced in the name of a correctness one"* (`:164-169`), while `cosineSimilarity` is
  clamped at source so new graphs cannot produce it (`:170-171`).
- Premise 2 (the heap returns the max) is a 2000-trial differential against a brute-force
  enumeration of every walk ≤ `MAX_TRAVERSAL_HOPS`, with a deterministic mulberry32 PRNG
  (*"a test that fails one run in twenty is not a guard"*, `:174-186`). The random-graph
  generator is engineered against known blind spots, each documented:
  - spread weights, because *"a uniform-weight graph cannot exhibit the defect, which is exactly
    why the synthetic T3 corpus showed zero difference"* (`:234-237`);
  - a third of edges undirected, because *"a differential that skips a whole branch proves
    nothing about it"* (`:239-242`);
  - multiple seeds at different scores, because with one seed *"a deleted heapify loop would
    pass every assertion"* (`:254-258`).
  - an independent check that FIFO never *exceeds* the brute-force max, which would mean the
    brute force is wrong (`:276-278`).

Live run: all 15 checks pass, including
`best-first equals the brute-force path maximum on 2000 random graphs (directed + undirected)`.

### 2.5 Wiring tests as a separate class

`tests/unit/structural-expansion-wiring.test.ts:1-13` states the taxonomy explicitly: the
focused suite calls the helper directly, which *"catches branch defects inside the helper and
misses every defect that leaves the helper intact while disconnecting it from queryGraph —
including zeroing the budget share, skipping the call, dropping the additions cap, or inflating
the share past the shipped half-reserve."* So there are two suites: one for the unit, one that
goes through `queryGraph` and pins the constant.

Same idea in `tests/unit/loader-index-parity.test.ts:1-18`: three independent implementations of
"rebuild the TF-IDF index from a loaded graph" disagreed (the MCP one dropped section nodes and
hard-coded an analyzer). Because `documentCount` is in the IDF numerator for every term,
*"the same .gai ranked differently depending on which loader opened it. That makes any
before/after retrieval measurement a measurement of the loader."* The suite asserts IDF equality
to 1e-12 across loaders and that an unresolvable analyzer id **fails closed**
(`AnalyzerMismatchError`) rather than defaulting (`:83-89`).

### 2.6 Architecture-fitness by source scan

```ts
const QUERY_DIR = new URL('../../src/core/query/', import.meta.url).pathname;
for (const name of readdirSync(QUERY_DIR)) { ... if (/corrections\/confidence|setNodeConfidence|setNodeConfidences/.test(src)) offenders.push(name); }
check('no module under src/core/query/ imports or calls the confidence write', offenders.length === 0);
```
(`tests/unit/confidence-primitive.test.ts:256-274`)

With the rationale: *"The behavioural check above proves today's query path does not write
confidence; this one stops a future one from starting to, which is how `recordAccess` became a
problem in the first place."*

### 2.7 A "does not move the benchmark" property

`tests/unit/embedding-cosine-bounded.test.ts` fixes a dot-product-masquerading-as-cosine bug and
tests four named properties: BOUNDED, THRESHOLD, SCALEFREE, and — the notable one — **NEUTRAL**:

> *"on unit-norm vectors the new scorer equals the old dot product to within 1e-12, so the fix
> cannot move a benchmark number for any adapter that was already normalizing"*
> (`tests/unit/embedding-cosine-bounded.test.ts:24-26`, implemented at `:127-138`).

I.e. a correctness fix ships with a proof that it does not invalidate published evidence. The
suite also states why the invariant cannot be delegated: *"Nothing in the PUBLIC
`EmbeddingAdapter` contract requires unit-norm output... so 'the embedder normalizes' is an
assumption about third-party code, not an invariant"* (`:20-23`).

### 2.8 Tests that encode a decision, including the road not taken

`tests/unit/seed-budget.test.ts:1-17` holds two measured truths simultaneously:
1. a counterfactual wider seed pool *can* recover the crowded-out answer;
2. production stays at `SEED_OVERSAMPLE = 1` *"because global widening caused a four-point
   LongMemEval regression and does not address the dominant residual."*

The same four-point regression is cited again as the reason the `sourceFloor` magnitude is
pinned with two values rather than one (`tests/unit/traversal-determinism.test.ts:318-323`).

---

## 3. The packaged-artifact verifier (`scripts/verify-package.mjs`)

The docstring names the exact blind spot:

> *"All 24 gated test suites import through the `@/*` alias, which tsconfig maps to `./src/*`.
> Not one of them imports `dist/`. So the entire test suite passes against TypeScript sources
> that npm never ships, and the artifact consumers actually install is verified by nothing at
> all."* (`scripts/verify-package.mjs:5-13`)

Four failure modes it lists as invisible to tsc, eslint and src-importing tests
(`:14-22`): unrewritten `@/` specifiers in `dist/`, a runtime file missing from `files[]`, an
`exports` subpath pointing at nothing, a `bin` without a shebang.

Mechanism:
1. Refuse to run if `dist/` is missing — *"or we would verify an empty package and call it a
   pass"* (`:53-58`), exit code 2.
2. `npm pack` into a scratch tmpdir (`:64-66`).
3. `npm install <tarball>` into a **fresh, empty consumer package** — no workspace, no aliases
   (`:70-76`).
4. Generate a probe that `import()`s every non-`.json` key of `pkg.exports` **by its public
   specifier**, from outside the repo (`:78-98`). `./package.json` is excluded with a reason:
   a bare `import()` of it fails on a missing import attribute, *"which would be a false failure
   about the probe rather than the package"*.
5. Assert the root entry exports ≥ 20 symbols — *"A dist that resolves but exports nothing is
   the subtle version of broken"* (`:100-104`).
6. grep the installed tree for surviving `from '@/` / `require('@/` — with a five-line comment
   about the **exit code inversion** that cost a false failure on the first run: *"`grep -rl`
   exits 1 when it finds NOTHING, and that is the outcome we want. Treating a non-zero exit as
   an error inverts the check — a clean package reports as broken. Exit 2 is a real grep error
   and must still fail."* Absolute `/usr/bin/grep` because grep may be a shell function
   (`:107-123`).
7. **Positive control**: write `__canary.js` containing `import x from '@/core/types';`, re-run
   the same grep, assert it is found, delete it (`:127-140`) — *"a guard reported without its
   mutation is unproven."*

---

## 4. The `.gai` conformance suite (`spec/`)

Thesis, stated twice (once in the generator, once in the runner):

> *"Half the fixtures are malformed on purpose: the useful question about a format reader is not
> what it accepts but what it REFUSES. A reader that parses `bad-checksum.gai` without complaint
> is not conforming, however well it handles valid input."*
> (`spec/conformance.mjs:7-10`; `spec/make-fixtures.ts:4-9`)

> *"A second implementation, in any language, should be able to run the same fixtures and reach
> the same verdicts. That is the point of shipping them."* (`spec/conformance.mjs:11-12`)

The runner imports **`dist/core/format/gai-reader.js`**, not `src/` — it is the only gate in
`npm test` that exercises the built artifact (`spec/conformance.mjs:22`, echoed in
`.github/workflows/ci.yml:48-50`).

Fixture generation is byte-surgery on a real written file, so the malformations are realistic:
flip one body byte after `magic(4) + headerLen(4) + header` (`spec/make-fixtures.ts:73-77`),
truncate to 60% (`:79-80`), write `0xffffff` into the headerLen slot (`:82-84`), msgpack-unpack
the header, set `version = 99`, re-pack, **recompute the additive checksum**, and reframe
(`:86-104`), and repoint a directed edge at `'no-such-node-id'` with the checksum recomputed
(`:106-122`). A signed fixture ships with its key in `spec/fixtures/signed.key`, and the key
string itself is `'conformance-fixture-key-do-not-use-in-production'` (`spec/make-fixtures.ts:47`).

Live run (`node spec/conformance.mjs`): 11 passed, 0 failed. Full output recorded in §8 below.

---

## 5. Benchmark evidence

### 5.1 The self-verifying evidence bundle (`benchmarks/evidence/verify.mjs`)

Origin story in the docstring:

> *"every number asserted in it — in a filename, in the manifest, in a delta — should be
> recomputable from the rows shipped alongside. This checks that, and it exists because one was
> not: the manifest described the embedding contribution as +11.8 when its own rows give
> 78.00 - 64.60 = 13.40. Nothing caught it because nothing was checking."*
> (`benchmarks/evidence/verify.mjs:4-11`)

Four layers:
1. SHA-256 every file against `checksums.txt` (`:24-32`).
2. **Filename-vs-content**: parse the score out of the filename (`cloud-paired-78.0.jsonl`) and
   recompute it from the rows; fail if they differ by ≥ 0.05 (`:34-46`). The score is therefore
   in the filename *and* checked, so a stale copy cannot be quoted.
3. **Every asserted delta names the two arms it is a difference OF** (`:48-72`):
   ```js
   const DELTAS = [
     ['embedding contribution',   'cloud-paired-78.0',        'zero-embed-enrich-64.6',    13.4],
     ['enrichment',               'zero-embed-enrich-64.6',   'zero-embed-noenrich-62.2',   2.4],
     ['answer model',             'zero-embed-noenrich-62.2', 'on-device-41.6',            20.6],
     ['graph vs flat (tfidf)',    'zero-embed-noenrich-62.2', 'ablation-naive-topk-49.0',  13.2],
     ['graph vs flat (on-device)','on-device-41.6',           'on-device-naive-topk-35.8',  5.8],
   ];
   ```
   with the comment: *"Getting that pairing right is the whole point: 13.2 is the TF-IDF
   graph-vs-flat delta (62.2 - 49.0) and comparing 78.0 against the same flat arm instead would
   move two variables at once — retrieval mode AND embeddings — and produce a number that means
   nothing."*
4. **Prose-to-check binding**: regex every manifest `description` for `+N.N point` claims and
   fail if any number is not in the `DELTAS` table (`:83-91`). Documentation prose is thereby
   constrained by the checker.

Live run: all 8 checksums ok, all 8 filename accuracies ok, all 5 deltas ok, 8 manifest runs for
8 files, 5 manifest `+N.N` citations all matched. Exit 0.

### 5.2 Provenance discipline in `manifest.json`

- Every run carries `file`, `score`, `sha256`, the exact `command`, a `description`, **and a
  `command_provenance` field with an honesty grade**:
  - `"exact — confirmed by author"`
  - `"confirmed — author-attested; the run's machine-generated folder-name label records router+summaries+prefs"`
  - `"exact — recorded verbatim in the run's results.md (results 34)"`
  - and for the additive-scoring arm: *"the run's results.md records argv but NOT the
    GNOSIS_SCORE_RULE env var (**a harness gap, now fixed for future runs**); this arm is
    identified by its distinct 56.20% score vs the 62.20% max-wins arm that shares the same
    argv."* (`benchmarks/evidence/manifest.json`, runs array)
- A top-level `flag_semantics` field documents a **parser footgun** in the harness itself:
  *"run.ts parses a flag with no following value as the string 'true'... Do NOT write
  `--enable-router=true` — the parser does not split on '=', so that form leaves the flag unset
  (false)."* Repeated in the README (`benchmarks/evidence/README.md:35-37`).
- Sanitization is explicit and reasoned: the dataset's `question`/`gold` text is stripped
  because LongMemEval carries its own license; rows key back by `question_id`
  (`benchmarks/evidence/README.md:11-14`).
- A one-line reproduction is offered: ``grep -c '"correct":true' cloud-paired-78.0.jsonl # → 390``
  (`benchmarks/evidence/README.md:29-31`).

### 5.3 The reproducibility pin added *after the fact*

The single most transferable idea in the benchmark territory
(`benchmarks/evidence/manifest.json:74`, `traversal_order`):

> *"Every run in this bundle was produced under the pre-0.10.0 FIFO traversal frontier... SDK
> 0.10.0 changed the DEFAULT to 'best-first' — the paper's path-maximum semantics (Theorem 3) —
> which alters retrieval output on roughly 9% of real multi-session queries, 6% of them
> returning a different set of evidence nodes. The commands above therefore carry an explicit
> `--traversal-order fifo` so they still reproduce these exact scores on 0.10.0 and later.
> WITHOUT that flag they traverse best-first and will NOT land on the recorded number. **The flag
> did not exist when these runs were made; it was added in 0.10.0 precisely so a pre-0.10.0
> measurement stays reproducible.** These are NOT 0.10.0 numbers, and none of them should be
> compared against a 0.10.0 run — the arms must be re-measured for that."*

So: when a default changed, they shipped a flag that restores the *old* semantics, retrofitted
it into the archived commands, and stated the incomparability boundary in the same breath.

### 5.4 Admitting uncertainty in the shopfront

- **The badge.** `README.md:13`:
  `[![Benchmark](https://img.shields.io/badge/LongMemEval-re--measuring-8a8f98?style=flat)](benchmarks/benchmarks.md)`
  — grey, and the value is `re-measuring`, not a number.
- **The section refuses to quote a headline.** `README.md:417-423`: *"**A current headline
  figure is deliberately not quoted here.** This release line changed retrieval — retirement,
  expiry and structural ranking all moved — so the last measured score no longer describes the
  code you would install... The number returns when the run does."* The four published arms are
  then shown with the caveat *"They are a single run each on an older line — read them as
  evidence that the ablations separate, not as a current score"* (`README.md:434-438`).
- **Known limits** are listed in the README body, including *"good, not solved"*
  (`README.md:405-411`).
- **In-file banner** in `benchmarks.md:401-406`: *"**No run in this log is current.**... Every
  figure below therefore describes code that is no longer the code... Until then, treat this
  file as history."*
- **The headline is called a distribution top, not a level**: *"the highest single run of its
  family, not a canonical figure. Runs 18-23 of the same configuration span 72.8-76.4%, so this
  is the top of a distribution rather than a stable level"* (`benchmarks.md:397-399`).
- **A comparability boundary section** (`benchmarks.md:494-512`): every run through 42 sent no
  `temperature`, so the provider default (~1.0) applied; the runner now defaults to 0; *"Scores
  either side of that boundary are not directly comparable."* Sampling noise is **measured**, not
  guessed: *"roughly ±0.3 pp of headline noise — measured from Runs 38-40, which share a
  configuration and land 0.6 pp apart while disagreeing on 8-10% of individual questions."*
  It then prescribes the control arm needed to re-anchor the ladder, and names a *second*
  unpinned input: *"The enrichment cache is a separate unpinned input: its 25,269 entries were
  generated before pinning and are still consumed, so a 'temperature 0' run on a warm cache is
  not a fully pinned run, and is a different run on a cold one."*
- **In-place corrections with a `> **Corrected.**` block** rather than silent edits
  (`benchmarks.md:185`): a paragraph had cited Run 32 as the comparator; the correction explains
  that Run 32 differs on two counts (answer model, and it is an ablation arm not a baseline),
  names the artifact it is published as, and states that *"the manifest's reading is the correct
  one, and the §12.4 decomposition that rests on it (62.20 − 56.20 = +6.0) is unaffected."*
- **Failed runs are kept in the log with their failure modes**: Run 9 (158 embedding rate-limit
  errors — *"the run was already serial; its 158 failures were embedding rate-limit errors, not
  a concurrency failure"*, `:171-175`), Run 21 (a **cache-key bug**: the key hashed the input but
  not the prompt, so a "tightened prompt" run served the previous run's byte-identical outputs;
  *"Total waste: ~$0.75... and the +0.20pt came purely from gpt-4o variance"*; fixed by adding
  `PROMPT_VERSION = 'v2-strict-cap3'` to the cache key, `:295-315`).
- **Which numbers were re-judged and which were carried forward** is disclosed inline:
  *"'held' rows carry Run 22 counts forward — the routing fix did not alter these answers, so
  they were not re-judged; only multi-session was re-measured"*, followed by an authoritative
  reconciliation table recomputed from the raw JSONL, noting *"the GPT-4o judge re-scores with
  small variance between passes even at temperature 0"* (`benchmarks.md:367-383`).
- **A caveat section that undercuts their own win**: after the preference-extraction improvement,
  *"gpt-4o-mini only partially honored the cap=3 instruction... a real shrinkage, but far from
  the 80% reduction the prompt targeted"*, and *"Multi-session slipped 2 questions... 8 loss→win
  vs 9 win→loss — gpt-4o noise, nothing systematic"* (`benchmarks.md:337-341`).
- **Metric-kind honesty about competitors**: MemPalace's 96.6%/100% are `recall@5`, not
  end-to-end QA; both metrics are called valid and the difference explained
  (`benchmarks.md:100-102, 470-472`; repeated at `tests/longmemeval/official/README.md:167-169`).

### 5.5 The measuring instrument stamps and tests itself

`tests/longmemeval/official/evidence-recall.ts` produces a report whose envelope is as
interesting as its numbers:

```js
{
  instrument: 'graphnosis-longmemeval-evidence-recall-v1',
  instrumentSourceSha256: hashFile(fileURLToPath(import.meta.url)),
  argv: process.argv.slice(2),
  recordedEnv, generatedAt,
  dataset: { path: relative(process.cwd(), datasetPath), sha256: hashFile(datasetPath), selectedQuestions },
  config: { ... }, definitions: { ... }, summary, rows
}
```
(`tests/longmemeval/official/evidence-recall.ts:866-880`)

- **The instrument hashes its own source**, so two reports can be checked as measurements from
  one instrument revision (stated at `tests/longmemeval/official/README.md:49-50`).
- The dataset path is deliberately recorded relative: *"An absolute path leaks the operator's
  home directory into every artifact, and says nothing a reader of the report can use"*
  (`:875-877`).
- **A `definitions` block travels with the numbers** (`:892-908`) — micro vs macro recall, any vs
  complete coverage, what a "session unit" and a "turn unit" are, and the
  `unannotatedTurnPolicy`: questions with zero `has_answer=true` turns are excluded from
  turn-level denominators and reported separately, *"rather than being counted as automatic
  successes or failures"* (also `README.md:72-75`).
- **`--self-test` runs unit tests of the metric implementation itself** (`:918-975`):
  `scoreUnits` partial / empty / complete cases, the gold-turn mapping against a synthetic
  question, and the prompt-evidence node filter. The instrument is testable without the system
  under test.
- **`assertOutputOutsideData`** refuses `--out` anywhere under `data/`: *"the benchmark evidence
  directory is read-only"* (`:708-718`).
- Cache-backed enrichment modes are labelled by honesty level: `cache-only` aborts on a single
  miss before any LLM fallback or cache write; `cache-partial` skips misses, records coverage,
  and is explicitly *"not benchmark-equivalent"* (`README.md:58-65`).

`tests/longmemeval/official/paired-delta.mjs` compares two such reports:
- everything is **paired on `questionId`** — *"Unpaired intervals would be wider and wrong"*
  (`:5-7`);
- fixed-seed mulberry32, never `Math.random` — *"so the interval printed today is the interval
  printed next year"* (`:9-11`, seed `0x9e3779b9` at `:19`);
- 10,000-resample paired bootstrap CI (`:76-92`), a paired permutation test with the standard
  `+1` correction (`:99-118`), and an **exact two-sided McNemar** over discordant pairs
  (`:121-146`);
- it prints the two reports' `instrumentSourceSha256` and stamps ` MISMATCH` when they differ
  (`:169-171`) — you are told when you are comparing measurements from two different instruments.

### 5.6 The judge is pinned and verbatim

`tests/longmemeval/official/judge.ts:1-6`: *"Prompt templates are copied VERBATIM from
xiaowu0162/LongMemEval at src/evaluation/evaluate_qa.py (get_anscheck_prompt). Do not edit these
strings - any deviation would invalidate comparability against published leaderboard scores."*
Judge model ids are pinned to dated snapshots (`'gpt-4o': 'gpt-4o-2024-08-06'`, `:16-19`),
`temperature: 0` with a comment (`:126`), and even the **parsing rule** is copied with its source
cited: `// Parsing rule from evaluate_qa.py: label = 'yes' in eval_response.lower()` (`:129-130`).

### 5.7 The ablation that is also a CI gate

`tests/ablation-scoring/maxwins-vs-additive.ts` is in `npm test` (`package.json:61`). It compares
the shipped max-score-wins traversal against an inline additive (spreading-activation / PPR-style)
transcription in which *only the three score-update sites* differ, each marked `// <<ADDITIVE>>`
(`:115, :121, :128`). Three mechanisms:

1. **Control by construction, not coincidence.** The max-wins arm is pinned to
   `traversalOrder: 'fifo'` because the inline reference can only be a FIFO transcription, so an
   unpinned arm *"would mean the two arms differed in TWO variables, and this script exists to
   isolate ONE. Measured: on this fixture both orders give identical max-wins scores, so pinning
   changes no number here"* (`:170-178`).
2. **A faithfulness gate.** The real traverser is also run through its gated
   `GNOSIS_SCORE_RULE=additive` branch and must match the inline reference to 1e-9
   (`:186, :219-222`) — the reference implementation cannot silently drift from the thing it
   claims to mirror.
3. **A recorded drift incident.** A 20-line comment (`:133-152`) documents that the block *was*
   stale — it still applied a ×1.3 recency boost the real traverser had deleted, read
   `Date.now()`, and wrote `lastAccessedAt`/`accessCount` back onto scored nodes — with the
   arithmetic showing the damage was bounded: *"the hub read 1.404 here against 1.080 from the
   real traverser... 1.404 / 1.3 = 1.080"*, and no rank moved.

It ends with four named invariants and a non-zero exit (`:224-236`): the gated branch matches
the reference; max-wins keeps the in-degree-15 popularity hub dead last; additive promotes it
(the failure mode being prevented); the real answer node outranks the hub under max-wins.

### 5.8 The one bench artifact that undercuts a marketing claim

`tests/bench/dual-graph-and-recall.ts` writes `benchmarks/dual-graph-and-recall.json`. It records
hardware, a fixed RNG seed, dataset path, graph size, and three separated measurements:

- **C2 dual-graph coverage**: of 290,915 1-hop connected pairs, 56.4% are only-directed, 35.2%
  only-undirected, 8.4% both; at 3 hops the median seed reaches 3 nodes via directed edges, 90.5
  via undirected, 107 via the union (`benchmarks/dual-graph-and-recall.json:23-43`). That is a
  genuinely useful number for the dual-graph thesis.
- **Latency decomposed by cacheability**: the synonym map is *"a pure function of the graph (not
  the query), so a persistent recall server caches it once per graph. Measure it separately to
  report the query-dependent cost"* (`tests/bench/dual-graph-and-recall.ts:196-206`) —
  `synonymMapBuildMedian: 0` and `queryDependentMedian: 1409.4` in the artifact.
- **`.gai` vs JSON size**: `jsonToGaiRatio: 1.14`, `gaiPctOfJson: 88`
  (`benchmarks/dual-graph-and-recall.json:53-59`). The binary format is 12% smaller than JSON —
  and they published it anyway. See antipattern A5 for where the product surface still claims
  "40-60% smaller".

---

## 6. What CI actually gates

`.github/workflows/ci.yml` opens with the incident that caused it (`:3-17`):

> *"Until now this repository had exactly two workflows — `cla.yml` and `publish.yml` — and
> neither runs on a push or a pull request. The first time anything was verified was when a tag
> was pushed, which is to say: after the tag was already public, and inside the same job that
> publishes to npm. That is not hypothetical. Tag `v0.7.1` sits on origin with no `## v0.7.1`
> section in the CHANGELOG, no npm version and no GitHub Release — a dangling public tag left by
> a run that failed after tagging. A version number was spent to discover a problem this
> workflow would have caught for free."*

Design rule: **run exactly the chain `prepublishOnly` runs, on every push and PR, before a tag is
ever involved** (`:15-17`). `prepublishOnly` is `lint:lib && build:lib && test`
(`package.json:46`).

The gated steps, in order:

| step | what it covers | line |
|---|---|---|
| `npm ci` | also runs `prepare` → `build:lib` as a side effect | `ci.yml:40` |
| `npm run lint:lib` | eslint over **`src/core src/sdk` only** | `ci.yml:42-43`, `package.json:45` |
| `npm run build:lib` | `tsc -p tsconfig.build.json` — typechecks `src/{core,sdk,cli,mcp}` | `ci.yml:45-46` |
| `npm test` | 26 `tsx` suites + `node spec/conformance.mjs` | `ci.yml:51-52` |
| `npm run verify:package` | pack → install → import every exports subpath | `ci.yml:58-59` |
| version-vs-npm report | `::warning::` (not a failure) if package.json already matches npm latest | `ci.yml:64-74` |

The explicit build step is kept even though `npm ci` already builds, *"if `prepare` ever stops
running it, silence would look like success"* (`ci.yml:37-39`).

**Not gated:** `next build` / the app; `eslint` over `src/cli`, `src/mcp`, `src/app`, `tests/`;
any typecheck of `tests/**` (see A4); `benchmarks/evidence/verify.mjs` (see A3);
`tests/longmemeval/longmemeval.test.ts` (the 12-question internal suite CONTRIBUTING.md:16 says
"should not regress"); anything requiring an API key.

**Release gates** (`.github/workflows/publish.yml`, tag push only):
1. Extract the `## v<TAG>` CHANGELOG section with awk and **fail if empty** — *"has bitten us
   once already (v0.5.0 shipped to npm but no release notes — backfilled manually)"* (`:38-66`).
   The same extracted block is reused as the GitHub Release body, so the check and the artifact
   cannot diverge.
2. **Tag must equal `v$(package.json version)`** (`:68-87`), with the ordering rationale:
   *"This runs LAST among the checks and immediately before the irreversible step, so it also
   catches anything earlier in the job that rewrote package.json."* And the failure it prevents:
   *"`npm publish` takes no version argument — it publishes whatever `package.json` says — so
   tagging `v0.11.0` on a tree whose package.json still reads `0.10.0` publishes 0.10.0 again...
   The two artifacts then disagree permanently, and npm is not retractable."*
3. `npm publish` with **npm OIDC trusted publishing** — `id-token: write`, no `NPM_TOKEN` secret,
   `provenance: true` in `package.json:34-37`. Node 24 is pinned because its bundled npm 11.x
   satisfies OIDC's ≥11.5.1 requirement *"without any self-upgrade dance"*, with the prior
   failure recorded (`:26-30`).

---

## 7. Antipatterns

**A1 — Conformance asserts "it threw", not *why*.** `rejects()` catches anything and calls it a
pass (`spec/conformance.mjs:47-55`). The repo has a whole stable-code/class system built for
exactly this question, and the conformance harness does not use it. Live proof that it matters:
`truncated.gai` is rejected with `Invalid .gai file: checksum mismatch`, not
`Invalid .gai file: truncated` — so `GAI_TRUNCATED` is never observed by the suite, and a second
implementation that rejects every malformed file with a single generic error would "conform".

**A2 — The dual-graph half of the format is never conformance-tested.** Running the suite prints
`minimal.gai — 6 nodes, 4+0 edges` and `all-edge-types.gai — 10 nodes, 10+0 edges`: zero
undirected edges in both, despite `spec/make-fixtures.ts:45` describing minimal as *"small graph
with both edge layers"* and `:62` naming the other fixture `all-edge-types.gai` /
*"broad edge-type coverage"*. Consequently the frozen messages
`'Invalid .gai file: undirected edge '` and `'Invalid graph: undirected edge '`
(`tests/unit/error-codes.test.ts:110-113`) have no fixture behind them, and the undirected
dangling-edge branch (`src/core/format/gai-reader.ts:157`) is unexercised by conformance.

**A3 — The evidence verifier is not wired to anything.** Its docstring says *"Exits non-zero on
any disagreement, so it can gate a release"* (`benchmarks/evidence/verify.mjs:12-13`) and the
README tells readers to run it (`README.md:436`), but it is absent from `package.json:61`
(`npm test`), from `prepublishOnly` (`package.json:46`), and from `.github/workflows/ci.yml`.
The bundle is self-verifying only if a human remembers.

**A4 — 9,300 lines of tests that are never typechecked.** `npm test` runs every suite through
`tsx`, which strips types without checking them; `tsconfig.build.json:39-41` excludes
`**/*.test.ts`; there is no `typecheck` script and no `tsc --noEmit` in any workflow. The suites
lean hard on `as unknown as KnowledgeGraph` casts to build fixtures
(e.g. `tests/unit/traversal-determinism.test.ts:61`,
`tests/unit/traversal-path-maximum.test.ts:54`), so type drift between a fixture and the real
type is invisible in exactly the place they claim compile-time protection
(`tests/unit/confidence-primitive.test.ts:458-461`: *"if any of them stopped being re-exported,
the file would not compile"* — nothing compiles it).

**A5 — Documentation drift in the shipped product surface, in places nothing checks.**
- `src/app/view-gai/page.tsx:224` tells users *".gai (MessagePack) is typically 40-60% smaller"*
  than JSON; the repo's own artifact records 88% of JSON, i.e. 12% smaller
  (`benchmarks/dual-graph-and-recall.json:57-58`).
- `src/app/view-gai/page.tsx:146` says the magic bytes are `47 41 49 01` = `"GAI" + version 1`;
  `GAI_MAGIC` is `[0x41, 0x49, 0x4B, 0x47]` = `AIKG` (`src/core/constants.ts:8`, and the
  conformance fixture note at `spec/conformance.mjs:65` says *"magic is not AIKG"*).
- `AGENTS.md:55` still documents *"Confidence decays ~1%/day after 7 days without access (floor
  at 0.1)"* and `AGENTS.md:43` *"Soft-delete sets validUntil + confidence 0.1"*; decay is opt-in
  and off by default (`tests/unit/reflect-no-decay.test.ts:15-19`) and retirement drives
  confidence to `RETIRED_CONFIDENCE = 0` (`src/core/graph/retirement.ts:135`).
- `CONTRIBUTING.md:58` still calls the format `.aikg`.
The contrast is the lesson: the *evidence bundle* has a checker that binds prose to data
(`benchmarks/evidence/verify.mjs:83-91`); nothing plays that role for the README, the app, or
the agent guide, and those are exactly the places that rotted.

**A6 — Serial `&&` runner with 25 hand-rolled harnesses.** `package.json:61` chains 27
invocations with `&&`, so the first failing suite aborts the remaining ~20 and there is no
aggregate report — one red hides the rest, and a bisect costs a full re-run per suite. 27 files
define their own `let failures = 0` and 25 define their own `check()` with subtly different
formatting (`tests/unit/error-codes.test.ts:33-37` vs
`tests/unit/traversal-determinism.test.ts:21-29` vs `spec/conformance.mjs:24-26`). The
zero-dependency instinct is defensible; the absence of a 20-line shared
`tests/_harness.ts` is not. Related: the stale count in
`scripts/verify-package.mjs:7` (*"All 24 gated test suites"* — there are 26 `tsx` suites plus
conformance).

---

## 8. Live command output (recorded 2026-08-06)

```
$ node benchmarks/evidence/verify.mjs
... 8 checksums ok ...
accuracy vs filename
  ok    ablation-additive-scoring-56.2.jsonl — 56.20% over 500 rows
  ok    ablation-full-context-22.6.jsonl — 22.60% over 500 rows
  ok    ablation-naive-topk-49.0.jsonl — 49.00% over 500 rows
  ok    cloud-paired-78.0.jsonl — 78.00% over 500 rows
  ok    on-device-41.6.jsonl — 41.60% over 500 rows
  ok    on-device-naive-topk-35.8.jsonl — 35.80% over 500 rows
  ok    zero-embed-enrich-64.6.jsonl — 64.60% over 500 rows
  ok    zero-embed-noenrich-62.2.jsonl — 62.20% over 500 rows
asserted deltas
  ok    embedding contribution: +13.40   enrichment: +2.40   answer model: +20.60
  ok    graph vs flat (tfidf): +13.20    graph vs flat (on-device): +5.80
manifest consistency  — 8 runs / 8 files; all 5 cited deltas checked
Evidence bundle verified: every asserted number is recomputable from the rows.   EXIT=0

$ node spec/conformance.mjs
must parse:  minimal.gai 6 nodes 4+0 · all-edge-types.gai 10 nodes 10+0 · empty-graph.gai 0 nodes
must reject: bad-magic (magic bytes mismatch) · bad-checksum (checksum mismatch)
             truncated (checksum mismatch)    · header-len-overflow (header length out of range)
             future-version (format version 99 is newer…) · dangling-edge (directed edge …)
signed files: correct key ok · wrong key rejected
11 passed, 0 failed   EXIT=0

$ tsx tests/unit/error-codes.test.ts     → 12/12 ok, "All error-code checks passed."
$ tsx tests/unit/traversal-path-maximum.test.ts → 15/15 ok, incl. "best-first equals the
  brute-force path maximum on 2000 random graphs (directed + undirected)"
```

---

## 9. One-paragraph summary

The territory's centre of gravity is an unusually disciplined *evidence* culture layered on a
plain-JS test substrate. The error system's contribution is the class-above-code axis
(`corruption` / `version-skew` / `caller` / `config`) with a single frozen code→class table,
carried on one error class with a string field rather than a subclass hierarchy, because
`instanceof` dies across bundling and JSON boundaries; the message strings are treated as a
frozen public API with a test that pins twelve substrings and forbids one word. The tests read
like incident reports: every guard carries the defect that motivated it, every scan carries a
non-vacuity check, and several carry a measured mutation result ("caught 0 times in 10 runs").
The benchmark side is the strongest part: an evidence bundle that recomputes its own filenames,
deltas and prose claims and exits non-zero; a manifest that grades the provenance of each
command; a retroactively-added `--traversal-order fifo` flag that keeps archived measurements
reproducible after a default changed; an instrument that hashes its own source, ships its metric
definitions inside the artifact, and unit-tests itself with `--self-test`; and a public README
that flies a grey `re-measuring` badge and refuses to quote a current number. The weaknesses are
all *unenforced-claim* weaknesses: the evidence verifier is not in CI, tests are never
typechecked, conformance asserts refusal without asserting the refusal's code, and the
documentation surfaces that have no checker (the app page, AGENTS.md, CONTRIBUTING.md) have
drifted from the code.
