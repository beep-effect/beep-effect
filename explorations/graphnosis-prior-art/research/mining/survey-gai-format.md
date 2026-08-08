# Graphnosis survey — territory: `.gai` binary format, integrity & conformance

Repo surveyed: `/home/elpresidank/YeeBois/dev/Graphnosis` (Apache-2.0, `@nehloo/graphnosis` v0.11.0).
Everything below was read in full or verified empirically against the shipped `dist/` build and the
shipped fixture bytes. Line references are to files in that checkout.

Files read in full:
- `SPEC.md` (582 lines, all sections including the entire §8 v2 proposal)
- `spec/conformance.mjs`, `spec/make-fixtures.ts`
- `src/core/format/gai-reader.ts`, `src/core/format/gai-writer.ts`
- `src/core/graph/content-hash.ts`, `src/core/graph/graph-store.ts`
- `src/core/errors.ts`, `src/core/constants.ts`
- `tests/unit/error-codes.test.ts`, `tests/unit/graph-integrity.test.ts`,
  `tests/unit/loader-index-parity.test.ts`, `tests/unit/legacy-retirement-v080.test.ts`
- `.github/workflows/ci.yml`, `scripts/verify-package.mjs` (header), `package.json`
- `CHANGELOG.md` (targeted sections: 225–400, 640–770, 960–1160), `AGENTS.md`,
  `original-discussion.md` (format-design excerpts)

Empirical probes run (node 22, against `dist/`):
- unpacked every fixture header and body and counted types
- read `signed.gai` without a key
- reframed `minimal.gai` with mutated headers (string version, missing version, version 2, version −1,
  lying `nodeCount`) and mutated bodies (non-array `nodes`, empty map, integer body, `__proto__` key)

---

## 1. What the format actually is

```
┌──────────┬───────────┬──────────────┬────────────┬──────────┬─────────────┐
│  magic   │ headerLen │    header    │    body    │ checksum │  HMAC (opt) │
│ 4 bytes  │  4 bytes  │  headerLen   │  remainder │ 4 bytes  │  32 bytes   │
│  "AIKG"  │  u32 BE   │   msgpack    │  msgpack   │  u32 BE  │ SHA-256     │
└──────────┴───────────┴──────────────┴────────────┴──────────┴─────────────┘
```
(`SPEC.md:47-53`.) Body length is *not stored*: it is `total − 4 − 4 − headerLen − 4 − (32 if HMAC)`
(`SPEC.md:64`). Header is msgpack so a reader can decide whether to proceed before decoding the body
(`SPEC.md:73-74`). Body is a msgpack map with exactly four keys —
`{ nodes, directedEdges, undirectedEdges, metadata }` (`SPEC.md:101`).

The *choice* of MessagePack is argued, not defaulted: `SPEC.md:35-39` is a table of rejected
alternatives with a one-line reason each. The load-bearing one is **"Protobuf / FlatBuffers require
every consumer to compile from the same schema. `.gai` uses MessagePack precisely so that no schema
coordination is needed — the body is self-describing."** That is the whole reason the format can
claim to be portable across organizations without a shared build step.

Two design statements in §0/§3 do most of the work:

1. **Two edge layers over one node set.** `SPEC.md:21-25` — "Directed-only loses similarity and
   co-occurrence; undirected-only loses causality and hierarchy. Carrying both over the same nodes
   lets a query combine *why-chains* (directed) with *what-neighbours* (undirected) in a single
   traversal, rather than running two systems and reconciling them afterwards."
2. **Edges are persisted; indexes are not.** `SPEC.md:170-173` — "A `.gai` file carries no TF-IDF
   index, no embeddings and no adjacency lists. Those are derived and MUST be rebuilt on load. This
   is what keeps the file a description of memory rather than a snapshot of one engine's internals."

The second is the sharpest line in the spec for anyone designing a persisted-knowledge artifact: it
draws the boundary between *the memory* and *one engine's cache of the memory*, and it is the reason
they could change ranking four times without a format break.

---

## 2. Versioning doctrine ("one break, once")

`SPEC.md:339-355`, §8.0. Verbatim: *"A format that breaks twice has taught the market that it breaks.
v2 is intended to be the only breaking version `.gai` ever has, which means the correct posture is to
be greedy now and conservative afterwards."* Two mechanical consequences are then stated as rules:

- **All-or-nothing.** "Everything in this section must land together or not at all. A partial v2 is
  two breaks wearing one version number." (`SPEC.md:345-346`) — this is the operative discipline; it
  converts "we'll do the rest later" into a spec violation.
- **After v2, extension is by must-understand feature tags, not version bumps.** "a reader refuses on
  an unknown *feature tag*, never on an unknown version. That is how PNG and Matroska absorbed decades
  of change without a v2, and it makes the version number vestigial by design."
  (`SPEC.md:347-350`)
- **Three named admissible reasons for a v3, declared in advance** "because 'never' is not credible":
  a broken cryptographic primitive; a node-model dimension not expressible as a feature tag; a legal
  requirement. "Nothing else." (`SPEC.md:352-355`)

### The magic-bytes argument (the best-articulated bit in the document)

`SPEC.md:357-374`. **"The magic bytes do NOT change. v2 files begin `AIKG`, exactly as v1 files do."**
The reasoning is a failure-message argument, not an aesthetic one:

> A v1 reader shown a v2 file frames it, reads `version: 2`, and rejects with *"format version 2 is
> newer than this reader supports"* — an error that names the real cause and tells the holder what to
> do. Change the magic and the same file instead produces *"not a `.gai` file"*, which is false: it is
> a `.gai` file, from a version the reader does not have yet. **A format that reports version skew as
> a wrong-format error teaches its own tooling to treat upgrades as corruption**, and callers act on
> that by quarantining data that is entirely intact. (`SPEC.md:365-370`)

Then the layering is stated crisply (`SPEC.md:373-374`):
*"The magic answers 'is this the format?'; `requires[]` answers 'can I read this particular file?';
and only the second is allowed to change over time."*

**Provenance worth noting:** the *original* design did the opposite. `original-discussion.md:211`
shows the first sketch as `[4-byte magic: 0x47 0x41 0x49 0x01]  // "GAI" + version` — version packed
*into* the magic, i.e. exactly the per-revision-magic scheme §8.0 later rejects. And the shipped magic
is `AIKG` (`src/core/constants.ts:8`), which does not spell the format's name at all; the constant
carries a comment explaining it is kept for backward compatibility with files written under the old
codename (`src/core/constants.ts:3-7`). So they have already lived the lesson once: the magic is a
*family identifier that outlives the name*, and they wrote the doctrine after paying for it.

---

## 3. Integrity: what is checked, in what order, and why

### 3.1 Checksum

`SPEC.md:183-193`. Sum every byte of `header ++ body` as u8, accumulate mod 2³², store big-endian.
The spec then does something specs rarely do — it warns other-language implementers about a trap the
reference implementation actually fell into:

> Implementations in languages with signed 32-bit arithmetic must use an unsigned right-shift or
> equivalent. A signed mask goes negative above 2³¹ and produces a wrong checksum on large graphs.
> (`SPEC.md:191-193`)

That is a promoted postmortem. The bug is in `CHANGELOG.md:1031-1038` (v0.5.7): the reader used
`& 0xffffffff` while the writer used `>>> 0`, so **every engram over ~17 MB failed the checksum and
was reported as corrupt although its bytes were intact.** Both sides now carry the same warning
inline — `src/core/format/gai-writer.ts:41-46` and an 8-line block at
`src/core/format/gai-reader.ts:67-75` ending "The bytes were always valid; only this comparison was
wrong." Same constraint written in three places (spec, writer, reader) so a future "cleanup" cannot
re-break it silently.

The spec is also blunt that the checksum is not security: *"The checksum detects **corruption, not
tampering** — it is trivially forgeable. A reader MUST NOT present a checksum match as authenticity."*
(`SPEC.md:195-196`)

### 3.2 HMAC and the authenticate-before-parse ordering

`SPEC.md:198-206`: when `header.integrity == "hmac-sha256"`, the last 32 bytes are
`HMAC-SHA256(key, header ++ body)` — the MAC covers header and body but **not** magic, headerLen or
checksum.

The implementation trick is the interesting part. The signed-ness of a file is declared *inside the
msgpack header* — which is the thing you must not parse before authenticating. Chicken and egg. Their
resolution (`src/core/format/gai-reader.ts:43-51`):

```ts
// Authenticate BEFORE parsing (finding #17). The signed-ness of a file lives
// inside the msgpack header, but unpacking attacker-controlled header bytes
// before verifying them feeds the deserializer unauthenticated input. We break
// the cycle by deriving the trailer layout from whether the CALLER supplied a
// key — not from the header content — so the HMAC can be checked over the raw
// header+body byte range first, and `unpack` only ever runs on bytes that have
// passed the checksum (and, in signed mode, the HMAC).
const signedMode = opts.hmacKey != null;
const trailerLen = signedMode ? 4 + 32 : 4; // checksum + optional HMAC
```

So the *caller's* intent, not the file's self-description, determines the byte framing. Order in
`readGai` is therefore: magic → length bounds → checksum → HMAC (`timingSafeEqual`, line 90) →
**then** `unpack(headerBuf)` (line 97) → version gate → downgrade guards → `unpack(bodyBuf)`
(line 125) → structural (dangling-edge) validation (lines 150-159). `CHANGELOG.md:972-978` records it
as a pure reordering with no format change, which is what made it shippable in a patch.

Downgrade handling is bidirectional and fail-closed by declaration
(`src/core/format/gai-reader.ts:112-123`): signed-header-without-key → `GAI_HMAC_KEY_MISSING`;
key-supplied-against-unsigned-file → `GAI_HMAC_UNEXPECTED` "(possible downgrade)". See antipattern
A2 below for why the first of those is effectively unreachable.

### 3.3 Confidentiality — the anti-inference section

`SPEC.md:208-237` is the single most quotable piece of documentation craft in the repo. It exists
because the *surrounding text* invites a wrong conclusion:

> This is stated plainly because the surrounding material invites the opposite conclusion. This
> section is titled Integrity and is mostly about HMAC signing, and a reader scanning for "is this
> protected" finds cryptography and stops. **HMAC answers "did this come from the holder of the key,
> unmodified" — never "can a third party read it."** A signed `.gai` is exactly as readable as an
> unsigned one. (`SPEC.md:213-219`)

And then it explains *why the omission is a decision rather than a gap*: "Encryption belongs to the
layer that knows the trust boundary: which keys exist, who may hold them, how they rotate, and what
happens when one is lost. A format that encrypted its own body would have to answer those questions
on every deployment's behalf, and would answer them wrongly for most." (`SPEC.md:221-225`)

It then converts that into MUSTs on the *caller* (`SPEC.md:229-237`), including a documentation MUST:
"Documentation and interfaces describing `.gai` portability MUST NOT imply that a `.gai` is safe to
hand over merely because it is self-contained." Closing line: *"The single-file design that makes
`.gai` easy to move is exactly what makes an unencrypted one easy to exfiltrate. One file is one copy
operation."*

The pattern to steal: **when a design omits a property that adjacent material implies it has, name the
inference the reader is about to make and refute it in the same section.**

---

## 4. Error classification — by ACTION, not by cause

`src/core/errors.ts:42-75` documents the incident that produced this. The consuming application
classified a failed load by substring-matching the library's prose:

```js
const looksCorrupt = msg.includes('checksum') || msg.includes('HMAC')
                  || msg.includes('Invalid .gai') || msg.includes('signature');
```

Two symmetric failures fell out of that:

1. v0.10.0 added a message beginning `Invalid graph:` (not `Invalid .gai`), so it matched nothing, the
   recovery path never ran, and **the engram silently disappeared from the app's picker.**
2. `Invalid .gai file: format version N is newer than this reader supports` *does* contain
   `Invalid .gai`, so a prefix-matching consumer would **quarantine a perfectly good file written by a
   newer version.**

The fix is the taxonomy at `src/core/errors.ts:77-88`. The axis is *what the caller should do*:

| class | meaning |
|---|---|
| `corruption` | bytes damaged or forged — safe to quarantine and try a backup |
| `version-skew` | a newer writer made a VALID file this reader cannot read — **never quarantine, upgrade** |
| `caller` | the call was wrong (missing/unexpected key); retrying identically will not help |
| `config` | runtime configuration disagrees with the stored artifact |

Comment at line 77: *"What a consumer should DO about it. This is the axis that matters."*
`ERROR_CLASS` (`src/core/errors.ts:114-133`) is an `Object.freeze`d total map from 15 codes to those
4 classes, described as *"The ONE mapping from code to class. Frozen, and deliberately the only place
this relationship is written down — a second copy is how the app ended up with two divergent
classifiers that disagreed with each other."*

Three further mechanism choices worth copying:

- **One error class with a string `code`, not one subclass per failure.**
  `src/core/errors.ts:135-144`: *"`instanceof` does not survive duplicated module instances (two copies
  of the package in a dependency tree, or an esbuild bundle that inlines it — the app's MCP bundle does
  exactly that), whereas a string code does. It also survives `JSON.stringify` across an IPC or
  JSON-RPC boundary, which `instanceof` cannot."* That is a real, named deployment fact, not a style
  preference.
- **Predicates over the class, exported for consumers**: `isCorruption` / `isVersionSkew` /
  `isCallerError` (`src/core/errors.ts:171-192`). The consumer never touches the code list.
- **Messages are frozen as a compatibility surface.** `src/core/errors.ts:68-75`: "THE MESSAGES ARE
  FROZEN. Every message string on the load path is now load-bearing for at least one already-shipped
  consumer. Codes are ADDITIVE: add a code, never reword a message." Plus a *negative* rule — "Do not
  introduce the word `signature` into any message or code description — the shipped classifier matches
  it, and no message contains it today, so adding it would silently reclassify an unrelated failure as
  corruption."

### 4.1 The test that guards the frozen strings

`tests/unit/error-codes.test.ts:96-129` is unusual enough to describe precisely. It reads
`gai-reader.ts` and `graph-store.ts` **as text** and asserts:

1. all 12 frozen substrings are still present byte-identical (lines 101-117);
2. a *negative* constraint — extract every message literal with
   `/gaiError\(\s*'[A-Z_]+',\s*([`'"])([\s\S]*?)\1/g` and assert none matches `/signature/i`
   (lines 123-126). Comments are explicitly allowed; only strings that can reach a caller matter;
3. **a non-vacuity check on its own scanner** — `check('the message-literal scan actually found
   messages — not vacuous', messageLiterals.length >= 10)` (lines 127-128). Without that, a regex that
   stops matching turns constraint (2) into a permanent pass.

Section 4 of the same file (lines 131-140) asserts the table is total, `Object.isFrozen`, and that
**exactly one** code is `version-skew` and it is the format-version one — an assertion about the shape
of the taxonomy, not just its contents.

The non-vacuity guard on a source-scanning assertion is the transferable bit; most repos ship the
scan and never prove it found anything.

---

## 5. Conformance: fixtures, levels, and how the suite is wired

### 5.1 Negative-majority fixtures shipped as bytes

`spec/fixtures/` ships 10 files + 1 key; 6 are deliberately malformed. Both the generator and the
runner open with the same thesis (`spec/conformance.mjs:6-9`, `spec/make-fixtures.ts:4-9`):

> Half the fixtures are malformed on purpose: the useful question about a format reader is not what it
> accepts but what it REFUSES. A reader that parses `bad-checksum.gai` without complaint is not
> conforming, however well it handles valid input.

And the reason to ship bytes rather than a test suite (`spec/conformance.mjs:11-12`): *"A second
implementation, in any language, should be able to run the same fixtures and reach the same verdicts.
That is the point of shipping them."* `SPEC.md:327-328` states the bar honestly: *"A third
implementation passing all ten is what would make `.gai` a standard rather than a file layout. Until
then this document describes one program."*

The runner is 92 lines with two primitives — `accepts(file, expect)` and `rejects(file, why)` — where
`rejects` treats *silent acceptance* as the failure (`spec/conformance.mjs:47-55`).

**Wiring.** `node spec/conformance.mjs` is the last entry in the `test` npm script
(`package.json`, `scripts.test`), `prepublishOnly` runs `lint:lib && build:lib && npm test`, and
`.github/workflows/ci.yml:48-52` runs the same chain on every push and PR with the comment: *"The full
suite, which now includes spec/conformance.mjs — the only gate that exercises the .gai reader's
refusal behaviour against the BUILT artifact rather than the TypeScript sources."* The CI file's own
header (`ci.yml:3-17`) is a postmortem: before it existed, the first verification happened *inside the
publish job after the tag was already public*, and tag `v0.7.1` is still dangling on origin as a
result — *"A version number was spent to discover a problem this workflow would have caught for free."*

### 5.2 The fixture generator corrupts *and re-frames*

`spec/make-fixtures.ts` builds one good file (`const good = writeGai(minimal)`, line 67) and then
derives each bad fixture from it by a single surgical mutation. The craft is in what happens *after*
the mutation:

- `bad-checksum.gai` (lines 73-77): flip one body byte at `4 + 4 + headerLen + 8` and **leave the
  checksum alone** — so the only thing wrong is the checksum.
- `future-version.gai` (lines 88-104): unpack the header, set `version = 99`, re-pack, **recompute
  `headerLen` and the checksum**, and reassemble. The file is otherwise perfectly valid, so it can
  *only* fail the version gate.
- `dangling-edge.gai` (lines 107-122): unpack the body, retarget `directedEdges[0].to` to
  `'no-such-node-id'`, re-pack, **recompute the checksum**, reassemble — so it passes framing and
  checksum and can only fail the endpoint check.

That re-framing is what makes each negative fixture a *single-defect isolator*. A generator that
mutated bytes without repairing the envelope would produce fixtures that all fail at the checksum, and
the suite would prove nothing about the later gates. This is the most directly portable piece of test
craft in the repo.

### 5.3 Conformance levels declared per layer (v2 proposal)

`SPEC.md:464-483`, §8.3. The argument first:

> A file format benefits from many independent implementations: that is what proves the bytes are
> unambiguous. A retrieval engine does not — ranking is a design position, and two engines that rank
> differently are not two implementations of one thing. Stating a single, undifferentiated "conforming"
> would force those two facts into one claim and make it useless. (`SPEC.md:466-471`)

| level | covers | must |
|---|---|---|
| **L1 — container** | §1 byte layout, §2 header, §4 integrity | frame, checksum-verify, reject per §5.1 |
| **L2 — model** | §3 node/edge model, §8.1 `(id, rev)` | round-trip every node, edge, revision and metadata field without loss; honour §8.2 rule 4 |
| **L3 — retrieval + authority** | §5.3 traversal, §8.2 ceilings in full, §8.4 skill execution | enforce `maxAutonomy` as a hard gate; implement path-maximum traversal |

Then the status-anxiety fix (`SPEC.md:479-483`): **"Most implementations need only L1 or L2, and
declaring L2 is a complete claim, not a partial one."** Without that sentence the level ladder becomes
a shaming device and everyone over-claims. And the enforcement hook: *"`maxAutonomy` is enforceable at
L3, and an implementation declaring L3 while ignoring it is non-conforming — without that, §8.2 is
advisory text."*

---

## 6. What a conforming reader must do (§5) and how the reader implements it

`SPEC.md:243-250` — reject: non-`AIKG` magic; unknown `version`; `headerLen` exceeding file length;
checksum mismatch; HMAC mismatch when a key was supplied; **an edge referencing a node id absent from
`nodes`**.

The dangling-edge rule gets the best justification in the reader
(`src/core/format/gai-reader.ts:144-149`):

> A dangling edge is not a harmless orphan: traversal follows it and the missing endpoint silently
> contributes nothing, so a truncated or edited file degrades retrieval in a way nothing reports. One
> pass here turns a quiet wrong answer into a refusal.

`SPEC.md:252-259` — rebuild: indexes are not in the file and MUST be rebuilt *"with the same
tokenisation the file was written with. Where an implementation records analyzer provenance in
`metadata`, a reader MUST honour it rather than assume its own default: a corpus tokenised under one
stopword set and queried under another has an index that disagrees with its own contents."*

`SPEC.md:261-276` — traverse (non-normative but expected of a dual-graph reader): walk both layers in
one pass rather than treating undirected as a fallback; decay with distance; treat `weight` as a
multiplier; **break ties deterministically** because *"score alone is not a total order, and many nodes
tie exactly on a real corpus. Ties broken by iteration order make results depend on how a candidate
set was built rather than on the query."* Closing: *"Retrieval SHOULD be a pure function of
`(file, query)`. Reading a clock or writing telemetry during retrieval makes results irreproducible
and un-auditable."*

Their own history on tie-breaking is instructive and lives in the changelog: v0.8.0 broke ties on node
id and *called that deterministic*; it was not, because ids come from `nanoid()` and differ per ingest,
so *"two ingests of the same corpus returned evidence in different orders, and sometimes different
evidence"* (`CHANGELOG.md:390-395`). v0.9.0 moved ties to provenance — `source.file`, then
`source.offset`, then `contentHash` — measured "before the fix: two builds of one corpus inside a
single process differed in evidence order on 21 of 40 questions and in evidence set on 6 of 40. After:
0 and 0" (`CHANGELOG.md:642-647`). **The tie-break key must be a property that survives re-ingest;
identity minted at ingest time is not one.**

---

## 7. Derived-state provenance (the strongest shipped idea in this territory)

The file deliberately carries no index — but it carries the *identity of the tokenizer that would
rebuild one*. `metadata.analyzerAdapterId` is written into the body (confirmed by unpacking
`all-edge-types.gai`: metadata keys are `createdAt, updatedAt, sourceFiles, nodeCount,
directedEdgeCount, undirectedEdgeCount, version, analyzerAdapterId, edgePolicyId, personCount`).

Enforcement is a typed error whose message tells the caller both ids and both remedies
(`src/core/errors.ts:11-22`):

```
[graphnosis] analyzer mismatch: index was built with '<saved>' but the runtime is configured with
'<runtime>'. Re-build the index with the matching analyzer or pass { analyzer } to the Graphnosis
constructor.
```

`tests/unit/loader-index-parity.test.ts` is the guard, and its header names the defect class exactly
(lines 1-16): three implementations of "rebuild TF-IDF from a loaded graph" disagreed —

```
builder            sections IN,  graph's analyzer
SDK rebuildIndex   sections IN,  analyzer resolved from metadata
MCP cache          sections OUT, `ascii-fold` unconditionally, no check
```

> `documentCount` is in the idf numerator for every term, so a different node set means a different
> score for every query — the same .gai ranked differently depending on which loader opened it. That
> makes any before/after retrieval measurement a measurement of the loader.

The test asserts vocabulary size and every IDF weight to 1e-12 across paths (lines 51-61), that the
index adopts *the graph's own* analyzer rather than the caller's default (lines 72-78, including a
legacy graph that must be indexed with the legacy analyzer), and that an unresolvable analyzer id
**throws rather than silently defaulting** (lines 84-89).

Generalized rule: **if a file omits derived state, it must record the identity of the procedure that
derives it, and the loader must fail closed when that identity is unknown.** Otherwise "rebuild on
load" is a silent-divergence machine, and every A/B measurement is confounded by which loader ran.

---

## 8. Where invariants are enforced — and the bound they are enforced at

`src/core/graph/graph-store.ts:35-56` names `fromSerializable` as *"the single funnel every load path
goes through — `readGai`, `fromBuffer`, the SQLite loader, and the public `fromSerializable` export —
so it is where the edge-weight invariant is enforced."*

The reason it is enforced at all is a *proof dependency*, stated explicitly:

> Since 0.10.0 traversal returns the MAXIMUM over paths (Theorem 3). The proof that a best-first
> frontier delivers that rests on score strictly decreasing along a path, which holds only while each
> hop's multiplier stays below 1. Every writer here emits weights in (0, 1], so a file that does not is
> corrupt or forged — and the `.gai` container's integrity check is an additive byte sum its own writer
> documents as catching corruption, not tampering. (`graph-store.ts:42-49`)
>
> Above the threshold the failure is silent and total: scores rise along a path, heap pops stop
> arriving in non-increasing order, the dominance test discards strictly better entries, and retrieval
> returns a confidently wrong ranking. `Infinity` is worse still — every reachable node ties at
> Infinity and the ranking collapses onto the tie-break. (`graph-store.ts:51-55`)

And then the bound itself — this is the part worth stealing (`graph-store.ts:57-72`):

```ts
// The bound is the PROOF's bound, not the writers' convention.
//
// Writers emit weights in (0, 1] and `cosineSimilarity` is clamped to make
// that exact. But files written before that clamp carry 1-ULP overshoots from
// cosine — 1.0000000000000002 was measured on a real round-trip in the test
// suite — and refusing to open an existing memory over one ULP would be a
// data-availability bug introduced in the name of a correctness one.
//
// What the traversal actually needs is that each hop's multiplier stays below
// 1, i.e. `DECAY_FACTOR * w < 1`, so the true ceiling is 1/DECAY_FACTOR.
const CEILING = 1 / DECAY_FACTOR;               // 1/0.6 ≈ 1.667
const bad = (w: number): boolean => !Number.isFinite(w) || w <= 0 || w >= CEILING;
```

Three things at once: (a) validate at the *deserialization* boundary because the container's checksum
is explicitly not a tamper check; (b) derive the acceptance bound from the *downstream theorem*, not
the *upstream writer convention*; (c) treat "refusing to open an existing memory" as a bug of equal
severity to accepting a bad one. Most validators pick the writer's convention and then discover they
have bricked a year of files over a float artifact.

(See antipattern A5: the *other* structural invariant, dangling edges, was not put in this funnel.)

---

## 9. `contentHash`: one definition, frozen by the format

`src/core/graph/content-hash.ts` exists purely to collapse three byte-identical private `simpleHash`
copies (`graph-builder.ts`, `incremental.ts`, `correction-engine.ts`) into one. The argument
(lines 4-15):

> Invariant I5 says `∀n: n.contentHash = h(n.content)`. That statement needs a single `h` to be
> checkable at all... They happened to be byte-identical, so nothing was broken; but three copies of a
> hash function are three chances for one to drift, and a drift would mean the same content hashing
> differently depending on which code path produced the node. Dedup and re-ingest both key on this
> value, so that divergence would silently split memories that are the same, or merge ones that are
> not.

Two further points:

- **Callers must know it is not cryptographic** (lines 16-21): DJB2 folded to 32 bits, ~25% chance of
  at least one collision at 50k nodes, so *"Every consumer that MERGES or DROPS on a hash match must
  therefore verify content before acting... A hash match is a hint, never a proof of identity."*
  `CHANGELOG.md:351-355` records the version where that was actually violated: dedup and the federated
  query path dropped nodes on a hash match alone, *"so a collision could hard-delete unrelated content
  in a system whose guarantee is that nothing is ever hard-deleted."*
- **The algorithm is frozen by the format, not by taste** (lines 23-25): *"Kept as DJB2-over-
  `charCodeAt` deliberately: changing the function changes every `contentHash` in every existing `.gai`
  file, which is a format-breaking migration, not a refactor."*
- A UTF-16 honesty note (lines 32-35): `charCodeAt` walks code units, so astral characters contribute
  two surrogates. *"That is stable and self-consistent, which is all the invariant requires, but it is
  worth knowing before anyone compares these values against a hash computed elsewhere."*

---

## 10. §6 Known weaknesses — the spec names its own soft spots

`SPEC.md:279-299`, opening with *"Stated here because a specification that hides its soft spots is
worse than one that names them."* Four entries:

1. **`contentHash` is 32-bit.** With the birthday math spelled out: *"at least one collision at roughly
   5% by 20,000 nodes and 25% by 50,000. A reader MUST NOT treat equal `contentHash` as proof of equal
   content."*
2. **Counts in the header are unauthenticated when the file is unsigned** — which is why §2 declares
   them advisory: *"A reader that trusts a count over the body can be made to allocate or truncate
   incorrectly by a malformed file."* (`SPEC.md:87-89`) I verified this holds: rewriting `nodeCount`
   to 9999 in an otherwise-valid file is accepted and ignored; the reader returns the 6 real nodes.
3. **The checksum is not a MAC.**
4. **`accessCount` is mutable state inside an otherwise declarative file.** *"It makes ranking depend
   on usage history, which is intended, but it also means two files with identical content can rank
   differently."* This is the subtle one — it is the reproducibility hazard that survives even after
   §8.5's id and timestamp work, and they flag it rather than let it be discovered.

---

## 11. The v2 proposal in detail (§8) — the design ideas worth stealing

### 11.1 `(id, rev)` identity as the *carrier* for merge (§8.1, `SPEC.md:378-415`)

The framing is what makes this good: it does not argue for revisions on aesthetic grounds, it argues
that **without a place to put a conflict, every merge implementation is forced into one of three
wrong moves**:

> With one slot per id the implementation has three choices and all are wrong: overwrite one (silent
> loss, contradicting the indelibility guarantee), mint a fresh id for the loser (losing the fact that
> these are two revisions of the *same* thing), or emit the conflict edge as the self-loop `n1 → n1`,
> which asserts that a fact conflicts with itself. The `contradicts` edge type already exists (§3.3);
> it has nowhere meaningful to point. (`SPEC.md:387-394`)

Rules: `id` stable for the lifetime of the memory and unchanged by content edits; `rev` a monotone
per-`id` integer from 1; the node map keyed by the pair; exactly one rev is `head`; **"Conflict is the
state of an id having more than one head."** (`SPEC.md:396-405`)

Migration is called out as the reason to do it *now*: *"Every v1 file is the degenerate case of exactly
one rev per id: a v1→v2 migrator assigns `rev = 1` to every node and marks it head. This is mechanical
and lossless, which is the main argument for doing it at v2 rather than later."* (`SPEC.md:407-410`)

And the scope honesty: *"`(id, rev)` gives merge a place to put a conflict. It does not by itself
define the merge *algebra* — commutativity, associativity and idempotence still have to be specified
and proven over the resulting structure. That work is downstream of this section and is not claimed
here."* (`SPEC.md:412-415`)

### 11.2 Byte-level reproducibility: ids from POSITION (§8.5, `SPEC.md:524-571`)

The problem statement is concrete: *"Backup deduplication sees every unchanged engram as changed, a
sync reports a mismatch on an untouched cortex, and a standards body cannot specify 'the file for this
corpus' because there is no such thing."*

The obvious fix is named and rejected: *"Deriving `id` from content would do it, and it directly
contradicts §8.1: a content-derived id changes whenever content changes, which is exactly what `id`
must never do if two revisions of one memory are to be relatable. Adopting it would buy reproducibility
and destroy merge."* (`SPEC.md:534-538`)

The resolution:

```
id = H(graphId ‖ sourceFile ‖ sectionPath ‖ ordinal)
```

*"Every input is a coordinate in the corpus, not a fact about the text. Re-running the same build
assigns the same ids; **editing a node's content leaves its id untouched**, because its position did
not move."* And `contentHash` moves onto the *revision*: *"content-addressing moves to the revision,
where it belongs, rather than to identity, where it breaks things."* (`SPEC.md:544-553`)

The limitation is stated with its blast radius: insertions shift subsequent ordinals, so ids after an
insertion point change **on rebuild only, never on incremental edit** — and *"A rebuild is a new graph
that happens to be similar, and treating it as one is honest."* (`SPEC.md:554-558`)

**The half everyone forgets** (`SPEC.md:560-565`): *"Reproducibility also requires that `createdAt` and
any build-time metadata be derived from the inputs. A writer MUST accept a `buildInstant` and use it
for every timestamp it mints; where the source carries its own date, that date wins. A build that reads
the system clock is not reproducible no matter how its ids are allocated, and this is the half most
easily forgotten because nothing about it looks like identity."*

Conformance framing (`SPEC.md:567-571`): byte reproducibility is an **L2** property — two conforming
writers given the same corpus, `graphId` and `buildInstant` MUST emit identical bytes — *"the strongest
available statement that a second implementation is really the same format and not merely a compatible
one, and it is checkable by a third party with no access to either codebase."*

Note the current implementation is nowhere near this: ids are nanoid (`aczV69DgQybOGoiEiFDmS` in
`minimal.gai`) and `createdAt` is `Date.now()` (fixture node carries `createdAt: 1785189414090`).

### 11.3 `maxAutonomy` — an authority ceiling that travels with the memory (§8.2, `SPEC.md:417-462`)

The problem: *"A skill that may act on its own carries a limit on how far it may go. In v1 that limit
is not expressible in the file, so it can only live in the application holding it — and a `.gai` moved
to a different application therefore arrives with its procedure intact and its constraints absent. The
receiving side has no way to learn that a step was never meant to run unattended, and no way to
discover that it is missing something."* (`SPEC.md:419-425`)

Field: `maxAutonomy?: 'L0' | 'L1' | 'L2' | 'L3'` in node metadata, `L0 < L1 < L2 < L3`. The five rules
are what make it more than decoration (`SPEC.md:434-458`):

1. **A ceiling is a maximum, never a grant.** A host MUST NOT execute above it; MAY execute below;
   MAY refuse entirely. *"The field can only ever lower authority."*
2. **Monotone under composition.** A subgraph's effective ceiling is the **MINIMUM** over its members.
   *"Borrowing a skill therefore cannot raise the ceiling of the graph that borrows it — the strictest
   member governs."*
3. **It survives transport**, because it is node metadata carried by the same subgraph envelope as the
   steps.
4. **Absence is not permission.** Unspecified means *"the most restrictive level [the host] supports
   for unattended execution. This is the rule that makes the field fail closed, and it is the
   difference between a ceiling and a suggestion."*
5. **The writer of a node cannot raise its own ceiling** — *"the thing proposing an action does not
   approve its own limits."*

Then the honesty (`SPEC.md:460-462`): *"This is advisory unless a conformance level mandates it. An L2
reader that ignores `maxAutonomy` still parses the file correctly. That is why §8.3 exists: the field
is only as strong as the level that requires it."*

### 11.4 Skill subgraphs (§8.4, `SPEC.md:486-522`)

Structural rather than a new node kind: a skill is ordinary nodes and `precedes` edges distinguished
only by the `evidence` tag. Steps = `evidence: 'skill:seq'`; loops = `skill:loop;max=N` where *"A loop
without a bound is invalid — an unbounded loop in a borrowable artifact is an unbounded obligation."*;
branches = `skill:branch;when=<predicate>`; calls = `skill:call;target=<id>`. Contract (trigger,
prerequisites, produces, success criterion, out-of-scope) lives in metadata on the head step; the
ceiling is the min over steps.

The consequence they call out (`SPEC.md:492-495`): *"An L1 or L2 implementation therefore needs no
skill support at all: it round-trips them correctly by round-tripping nodes and edges."* The
`evidence` field is already documented in v1 as a free-form namespace tag used to bound traversal
across subsystems (`SPEC.md:175-178`) — so the v2 skill encoding costs zero new format surface. That is
the extension-without-a-break discipline of §8.0 applied concretely.

### 11.5 §8.6 Deliberately NOT in v2 (`SPEC.md:573-582`)

Two items, each with the reason for exclusion *and* the reason it is now less urgent:

- **Widening `contentHash` to SHA-256** — "§6 already calls for it — but it rewrites every hash in
  every existing file. Recorded as the leading v3 candidate under §8.0's first admissible reason. Note
  that §8.5 reduces the urgency: identity no longer rests on the hash, so a collision costs a dedup
  false positive (already guarded by content comparison) rather than a wrong node."
- **A merge algebra** — carrier provided, operation not claimed.

Having a "deliberately not" list with *forward pointers to the admissible-v3 reasons* is what stops
the greedy-v2 posture from becoming a kitchen sink. It is the counterweight to §8.0.

---

## 12. Antipatterns — verified, with evidence

### A1. `SPEC.md` §7's fixture table is factually wrong about the fixtures the repo ships

`SPEC.md:310` claims `minimal.gai` is "2 nodes, 1 directed edge, 1 undirected edge". Actual header:
`{"version":1,"nodeCount":6,"directedEdgeCount":4,"undirectedEdgeCount":0,...}`.

`SPEC.md:312` claims `all-edge-types.gai` has "Every directed and undirected type in §3.3 present at
least once." Actual: 10 directed edges of exactly **two** types (`contains`, `precedes`) out of the 15
directed types in §3.3, and **zero** undirected edges out of 7 undirected types.

And the suite cannot catch it because `spec/conformance.mjs:60-61` calls `accepts('minimal.gai')` and
`accepts('all-edge-types.gai')` with **no expectations object** — the `expect` mechanism exists
(lines 29-40, and is used for `empty-graph.gai`) but is not applied to the two fixtures whose whole
purpose is coverage. So the flagship "every edge type" conformance fixture exercises 13% of the type
registry and the suite asserts nothing about it. A second implementation that supports only `contains`
and `precedes` would pass.

### A2. Reading a signed file without a key reports `corruption` — the exact misclassification the error taxonomy exists to prevent

`SPEC.md:202-206`: *"A reader NOT given a key, reading a file that declares `integrity`, MUST treat the
file as unverified and SHOULD say so."* `SPEC.md:311`: `signed.gai` "Rejects without it flagged
unverified."

Measured against the shipped `dist/`:

```
readGai(signed.gai)  ->  code=GAI_CHECKSUM_MISMATCH  class=corruption
                         msg="Invalid .gai file: checksum mismatch"
```

Mechanism: `trailerLen` is derived from the caller's key (`gai-reader.ts:50-51`), so in unsigned mode
the 32-byte HMAC is misattributed as body bytes and the checksum fails first. The reader *knows* this
— `gai-reader.ts:114-117` says so — and keeps the `GAI_HMAC_KEY_MISSING` guard at line 118 "for the
cases that reach here", but for a real signed file nothing reaches it. `GAI_HMAC_KEY_MISSING` is
classed `caller`; `GAI_CHECKSUM_MISMATCH` is classed `corruption` (`errors.ts:115-124`), and
`corruption` is documented as "safe to quarantine and try a backup". So a consumer that follows the
library's own published classification will **quarantine a perfectly good signed file whose only
problem is that the key was not passed** — the same class of destructive misrouting that
`GAI_VERSION_UNSUPPORTED` was carved out to prevent. `spec/conformance.mjs:73-88` tests only
correct-key and wrong-key, never no-key, so the divergence from §4 and §7 is untested.

### A3. The version gate is type-guarded into a bypass, and is set one version ahead of what exists

`gai-reader.ts:103`: `if (typeof header.version === "number" && header.version > GAI_VERSION_SUPPORTED)`.
Measured on reframed copies of `minimal.gai` (checksum recomputed, otherwise valid):

```
version: "99" (string)  -> ACCEPTED
version: missing        -> ACCEPTED
version: -1             -> ACCEPTED
version: 2              -> ACCEPTED
version: 99             -> rejected GAI_VERSION_UNSUPPORTED   (control)
```

`SPEC.md:78` says `version` is a required int; the reader enforces neither presence nor type, so any
non-number value silently disables the single gate §5.1 requires. Separately,
`GAI_VERSION_SUPPORTED = 2` (`gai-reader.ts:7`) while the writer emits `GAI_VERSION = 1`
(`constants.ts:9`) and §8 states plainly *"Status: PROPOSAL. Nothing here is implemented"*
(`SPEC.md:334`). A genuine v2 file — `(id, rev)` node identity, `maxAutonomy` semantics — would be
accepted by this reader and read as if it were v1, which is precisely the outcome the reader's own
comment condemns: *"an unknown version may reuse a field name with a different meaning, and a reader
that shrugs produces a graph that is wrong rather than absent"* (`gai-reader.ts:100-102`). The spec
compounds it by writing its own document revision into the format field: `SPEC.md:1` is
"specification v0.2" and `SPEC.md:78` says the format version is "`2` for this document", while every
file the writer produces says 1.

### A4. Only nine failure shapes are coded; everything else escapes as an uncoded `TypeError`

Measured with checksum-valid bodies (an unsigned `.gai` body is attacker-modifiable by design — the
checksum is "trivially forgeable", `SPEC.md:195`):

```
body.nodes = "x"    -> TypeError: data.nodes.map is not a function        (code undefined)
body = {}           -> TypeError: data.directedEdges is not iterable       (code undefined)
body = 7            -> TypeError: data.directedEdges is not iterable       (code undefined)
```

Those messages contain neither a `GraphnosisError` code nor either frozen prefix (`Invalid .gai` /
`Invalid graph`), so the shipped consumer classifier quoted in `errors.ts:49-52` routes them to
"not corrupt" and the engram *silently disappears from the picker* — the literal incident
`errors.ts:53-56` was written to close, still reachable through the body-shape path. `readGai` type-asserts
the body (`gai-reader.ts:125-130`) rather than validating it; `fromSerializable` then trusts
`data.nodes.map` (`graph-store.ts:95`). (Prototype pollution via a `__proto__` metadata key was tested
and does **not** occur — msgpackr does not install it as a prototype.)

### A5. The "single funnel" holds one structural invariant and not the other

`graph-store.ts:35-56` explicitly names `fromSerializable` as the funnel *"every load path goes
through — `readGai`, `fromBuffer`, the SQLite loader, and the public `fromSerializable` export"* and
puts the edge-weight check there. The dangling-edge check — a §5.1 MUST-reject — lives **only** in
`readGai` (`gai-reader.ts:150-159`); a repo-wide grep for `GAI_DANGLING_EDGE` finds it in
`errors.ts` and `gai-reader.ts` and nowhere else. `sqlite-store.ts:251` returns
`fromSerializable(serializable)` with no endpoint validation. Net effect: the SQLite persistence path
and the public `fromSerializable` export accept a graph the `.gai` reader refuses, so "what a valid
graph is" depends on which door it came through — and the doc comment asserting otherwise makes the
gap harder to notice, not easier.

### A6. `writeGaiAtomic` is triplicated and none of the copies fsyncs the parent directory

Byte-identical copies at `src/sdk/index.ts:357-367`, `src/mcp/tools/export.ts:46-56`, and
`src/mcp/tools/update_graph.ts:115-123`. Each does open(tmp, 0o600) → write → `fsyncSync(fd)` →
close → `renameSync`. The rename itself is never made durable — a power loss after `rename(2)` but
before the directory entry is flushed can lose the update, which is the standard second half of the
atomic-write recipe. This is in a repo that centralized `simpleHash` into `content-hash.ts` **for the
explicit reason** that "three copies of a hash function are three chances for one to drift"
(`content-hash.ts:9-12`) — the same argument applies unchanged here, and the durability gap is exactly
the kind of thing that would then need fixing in three places.

### A7 (noted, not ranked). `AGENTS.md` is a stale third truth surface

`AGENTS.md` ("Graph Integrity") still states *"Auto-pruning: Orphan nodes (zero edges) are removed
after graph construction"* and *"Content hash deduplication: Identical content produces identical
hashes; duplicates are merged"*. Both are false as of v0.8.0: `CHANGELOG.md:765-770` removed orphan
pruning as a defect (*"Retrieval no longer deletes memories... silently discarded 80 of 3,747 nodes
(2.1%)"*), and `tests/unit/graph-integrity.test.ts:130-143` asserts the opposite of the dedup claim —
identical content from two sources must retain both attributions. The agent-facing document is the
stale one, which is the worst of the three to have wrong.

---

## 13. Miscellaneous mechanisms worth remembering

- **Legacy compatibility proved with a file written by the old published tag, not a hand-built
  fixture.** `tests/unit/legacy-retirement-v080.test.ts:1-13`: *"Hand-built nodes cannot prove this
  defect: it is about what published tags persisted. The fixture at
  `tests/fixtures/legacy-v080-four-producers.gai` was written by the v0.8.0 public API (git archive
  v0.8.0 → write-legacy-gai.mts)."* It then asserts *the shape v0.8.0 actually wrote* (lines 76-90:
  delete → `deletedAt`; supersede → neither marker, only a `supersedes` edge; topic-forget/cascade →
  `forgottenAt`) **before** asserting that the current predicates classify it correctly, and includes a
  live control node that must NOT be retired. Marker strings are unique sentinels
  (`DELETE_SECRET_zarquon_delete`) so the end-to-end assertion is "this string does not appear in the
  produced prompt".
- **Errata sections in the changelog.** `CHANGELOG.md:367-384` is an `### Errata (added after release)`
  block under v0.10.0 recording that the release introduced two message strings and the entry did not
  say so — *"Recorded here rather than quietly fixed."* Amending a shipped changelog entry in place, as
  an errata block, is a better honesty mechanism than a silent edit.
- **The publish-gate hierarchy.** `scripts/verify-package.mjs:1-30` exists because *"All 24 gated test
  suites import through the `@/*` alias, which tsconfig maps to `./src/*`. Not one of them imports
  `dist/`. So the entire test suite passes against TypeScript sources that npm never ships, and the
  artifact consumers actually install is verified by nothing at all."* It packs the tarball, installs
  it into a scratch dir, and imports every declared `exports` subpath from outside the repo.
  Related caveat: `spec/conformance.mjs:22` imports from `dist/`, but the `test` npm script does not
  build first — only `prepublishOnly` and CI do. So a bare local `npm test` can run the conformance
  suite against a stale build while every other suite runs against `src/`; "green" covers two different
  trees in one command.
- **A constant with a full experimental record attached.** `constants.ts:27-57` — `SEED_OVERSAMPLE = 1`
  carries ~30 lines documenting the measurement for it, the measurement against it (paired p=0.006 on
  LongMemEval), and the specific 2×2 ablation that would settle it. Not format work, but it is the
  house style: the value is the conclusion of a written argument, not a magic number.
