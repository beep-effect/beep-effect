# Graphnosis survey — territory: product scope discipline, docs craft & positioning

Repo surveyed: `/home/elpresidank/YeeBois/dev/Graphnosis` (Apache-2.0, `@nehloo/graphnosis@0.11.0`,
author Nelu Lazar / Nehloo Interactive LLC). Files read in full: `README.md`, `ROADMAP.md`,
`CONTRIBUTING.md`, `CLA.md`, `NOTICE`, `REFERENCES.md`, `enterprise/enterprise.md`,
`original-discussion.md`, `Dockerfile`, `docker-compose.yml`, `package.json`,
`scripts/verify-package.mjs`, `spec/conformance.mjs`, `.github/workflows/ci.yml`,
`.github/workflows/publish.yml`, `benchmarks/evidence/README.md`; `CHANGELOG.md` read closely for
v0.11.0 / v0.10.0 / v0.9.0 / v0.8.0 and skimmed to v0.1.3; `SPEC.md` §0, §4, §5, §6, §7, §8.0–§8.6;
`AGENTS.md` and `GRAPHNOSIS.md` heads; `git log --oneline -60` plus ~12 full commit bodies.

The one-sentence read: **this is a repo where the writing is a load-bearing engineering artifact,
not marketing residue** — and simultaneously a repo with a large, unmaintained shadow-docs tail
that contradicts the polished surface. Both halves are worth studying.

---

## 1. The README does the demo before it does the argument

`README.md:21-34`:

```
## See it in ten seconds

npx -y @nehloo/graphnosis@latest demo
```

> Opens a 3D graph of a sample corpus in your browser. Ask it a question and watch
> the retrieval walk light up. No install, no API key, no network.

Then immediately, `README.md:32-34`, the *second* command points it at the reader's own data:
`npx -y @nehloo/graphnosis@latest demo ./my-vault-notes`.

Three structural choices make that work, and all three are enforced elsewhere in the repo:

1. **The claim is offloaded to the picture.** `README.md:36-40` explains the visual grammar
   (arrowheads = directed typed logic; plain lines = undirected association) and then closes:
   *"That is the whole idea, and it is easier to see than to read about."* `README.md:496` repeats
   the move at the end of the "How it works" section — *"Run … demo and look at it; the picture
   explains the rest faster than this section can."* The README knows which claims prose is bad at.
2. **"No network" is a build-time commitment, not a boast.** `NOTICE:20-22` — *"This distribution
   redistributes the following third-party software in binary form. The demo viewer vendors it
   rather than loading it from a CDN, so that `npx @nehloo/graphnosis demo` works with no network
   access."* The vendoring exists to make the README's first line true.
3. **The failure modes of the first line are documented at the bottom, not hidden.**
   `README.md:474-485` explains that `npx` inside the clone runs the *published* release
   (a clone is not an installed dependency of itself), and why all six invocations pin `@latest`
   (the CLI first shipped in 0.9.0; an older cached or vendored copy has no `bin`, producing
   `could not determine executable to run`). Commit `aa915f9` is the archaeology: the README
   documented `npx … demo` *before the release that provided it*.

Positioning is layered after the demo, not before it: `README.md:120-171` ("Graphnosis — Agentic
Multi-Graph for AI") states seven properties, each framed as a three-way contrast against **a folder
of `.md`**, **a vector index**, and **a property-graph database**. Every property is one bolded
sentence followed by two-to-four sentences of mechanism. E.g. `README.md:143-146`:
*"Contradictions surface instead of merging… Appending to a `.md` file keeps both silently; a
vector store silently returns whichever ranked higher."*

Then a **negative qualification section**, `README.md:395-411`:
- "**Yes**" (four bullets), "**Probably not**" — *"if you want a hosted memory service, your corpus
  is one document, or plain semantic search already answers your questions. Use a vector store; it
  is simpler and it fits."*
- "**Known limits.**" — contradiction detection misses conflicts with no explicit marker; lexical
  retrieval fails when the question shares no vocabulary with the source; identity extraction still
  false-positives on organization names.

Telling a prospective user to go use the competitor is a positioning move, and it is cheap: it
costs the users who would have churned anyway and buys credibility with everyone else.

---

## 2. ROADMAP.md as a triage instrument, not a wish list

`ROADMAP.md:3` states the file's *function* in its first sentence: *"This document describes what
belongs in the core Graphnosis SDK and what doesn't. It is the reference for triaging issues and
pull requests."*

The mechanism that makes it usable as triage:

- **In-scope is an enumerated export surface, not a theme.** `ROADMAP.md:21-35` lists thirteen
  bullets, each naming actual API symbols: `query()`, `queryHybrid()`, `prompt()`, `edit`,
  `deleteNode`, `supersede`, `correct`, `importMarkdown`, `forgetByTopic`, `forgetByTimeWindow`,
  `previewForgetTopic`, `retired`, `setConfidence`, `setConfidences`, `asOf`, `GraphnosisError`,
  `isCorruption`, `isVersionSkew`, `isCallerError`, `migrateAnalyzer`, `reflect()`,
  `EmbeddingAdapter`, `TextAnalyzer`, `queryGraphs([...])`. Triage becomes a set-membership test
  against a list, not a judgement call about "does this feel core".
- **Out-of-scope is one sentence plus a default.** `ROADMAP.md:57`: *"Anything outside the core
  graph-engine primitives listed above… The default for borderline cases is **'build it as a
  separate package that depends on Graphnosis.'**"* Note the asymmetry: in-scope is
  exhaustively enumerated, out-of-scope is defined as the complement. That is what makes the
  document finite and maintainable.
- **The default is stated twice, and softened the second time.** `ROADMAP.md:68`: *"The default
  answer for borderline cases is 'build it as a separate package' — but there are exceptions, and
  a short conversation is the cheapest way to get to the right answer."* The escape hatch is
  explicit, so the rule reads as a prior rather than a wall.
- **A three-question proposal template**, `ROADMAP.md:63-67`: what you want to build / what problem
  it solves / **why you think it belongs in the SDK rather than an adjacent package**. Question 3
  forces the applicant to make the scope argument, moving the burden off the maintainer.
- `CONTRIBUTING.md:9` closes the loop with an incentive rather than a rejection: *"consider
  publishing it as a separate package that depends on Graphnosis (we'll happily link to community
  packages from the README)."*
- A real instance of the rule being applied lives in the changelog:
  `CHANGELOG.md` (v0.2 entry) — *"Stemming-aware language analyzers (Snowball, Zemberek, …) belong
  in a future `@nehloo/graphnosis-langs` companion package."* The plugin seam (`TextAnalyzer`) is
  in scope; the plugins are not.

`CONTRIBUTING.md:56-61` mirrors this with a "What we will NOT accept" list, of which the
load-bearing item is *"Changes that require network egress from the core SDK (the SDK is
offline-first; network-using features belong in adapter packages)."* That is the same rule
expressed as an architectural invariant, and `src/sdk/index.ts:1-33` encodes it as a
"SECURITY INVARIANTS (enforced by what we re-export, not by runtime checks)" banner with a
four-symbol egress carve-out.

---

## 3. "There is one implementation of the engine, on purpose"

`README.md:61-67`, in a blockquote titled "On other languages":

> Retrieval from a fixed graph is deterministic — the same `.gai` and question give the same
> subgraph — and independent ports are the fastest way to lose that, because tie-breaking, hash
> iteration order and Unicode handling all differ subtly between runtimes. Cold ingest that enables
> optional LLM summaries is not deterministic unless those generated summaries are pinned. So other
> languages get a process boundary, not a rewrite.

What makes this good rather than defensive:

- It names three *specific* divergence mechanisms (tie-break, hash iteration order, Unicode),
  each of which has a matching bug in this repo's own changelog: tie-breaking
  (`CHANGELOG.md:642-647` — ties broke on `nanoid()` ids, so two builds of one corpus differed on
  21/40 questions); Unicode (`CHANGELOG.md:859-873` — ASCII `\b` boundaries meant "știe" and "记住"
  never matched).
- It **states its own exception in the same breath** (cold ingest with LLM summaries is not
  deterministic).
- It ships the alternative it recommends. `README.md:49-59`: `serve` gives an HTTP endpoint
  (`curl localhost:7777/query -d '{"q":"…"}'`) and the same binary is an MCP server. So "process
  boundary, not a rewrite" is an offer, not a refusal.

`SPEC.md:464-471` extends the same reasoning into the conformance model (see §6 below): a format
wants many implementations, an engine does not.

---

## 4. The honesty norms — this is the strongest material in the repo

### 4a. A badge that says the number is being re-measured

`README.md:13`:

```
[![Benchmark](https://img.shields.io/badge/LongMemEval-re--measuring-8a8f98?style=flat)](benchmarks/benchmarks.md)
```

The badge slot where every project puts its best number instead says `re-measuring`, in grey.
`README.md:415-423`:

> **A current headline figure is deliberately not quoted here.** This release line changed
> retrieval — retirement, expiry and structural ranking all moved — so the last measured score no
> longer describes the code you would install. … The number returns when the run does.

The table that remains (`README.md:427-432`) is labelled *"What is published and reproducible today,
from earlier release lines"* and its first row reads **"historical single-run best"**, not "best".
`README.md:435-438` closes: *"They are a single run each on an older line — read them as evidence
that the ablations separate, not as a current score."*

Supporting machinery, and this is what turns the honesty into infrastructure:

- `benchmarks/evidence/` ships eight raw per-question `.jsonl` scoring records
  (`cloud-paired-78.0.jsonl`, `ablation-naive-topk-49.0.jsonl`, …) with `checksums.txt` and
  `manifest.json`.
- `node benchmarks/evidence/verify.mjs` recomputes each headline count and exits non-zero if any
  disagree (`README.md:436-438`).
- `benchmarks/evidence/README.md:30` gives a one-liner a skeptic can run without any of their code:
  `grep -c '"correct":true' cloud-paired-78.0.jsonl   # → 390`.
- `benchmarks/evidence/README.md:10-14` explains the sanitization *and its cost*: the dataset's
  `question` and `gold` text are removed for license reasons, `question_id` is retained so counts
  still verify against the public dataset.
- `benchmarks/evidence/README.md:33-37` even records a CLI footgun in the reproduction command:
  *"`run.ts` enables boolean flags by bare presence (`--enable-router`), and the
  `--enable-router=true` form does **not** work."*
- `benchmarks/benchmarks.md:397-399` labels the 78.00% run *"the highest single run of its family,
  not a canonical figure. Runs 18-23 of the same configuration span 72.8-76.4%, so this is the top
  of a distribution rather than a stable level."*
- `benchmarks/benchmarks.md:466-471` runs a leaderboard where Graphnosis sits **sixth of seven**,
  and then spends a paragraph explaining why a competitor's higher-looking number (MemPalace 96.6%)
  is a different metric (R@5 retrieval recall vs end-to-end QA) — *"Both metrics are valid."*
- `CHANGELOG.md:657-662`: `--source-floor` *"validated the flag, printed it in its banner and
  recorded it in traces, while `AnswerOptions` had no such field — so every run labelled a
  source-floor arm was a null arm and a replicate of the default configuration… Runs r38-r40 in the
  benchmark record remain replicates; **they are not retro-labelled**."* Bad runs are left in the
  record, annotated, rather than deleted.

Commit `dbe82a2` states the policy: *"The run log keeps its history and loses only its claim to be
current."*

### 4b. Changelog entries state what a change COSTS, in numbers

- `CHANGELOG.md:318-326` (best-first frontier): the fix is justified against the paper's
  path-maximum theorem with the concrete counterexample (*"On the reference 5-node chain the
  successor scored 0.0216 where the theorem requires 0.216"*) and closes: *"**Cost: roughly 1.4x
  the traversal time of the old order on a 19k-node graph.**"*
- `CHANGELOG.md:308-314` (v0.10.0 release header): *"Measured on real multi-session corpora: about
  9% of queries return a different ranking and 6% return a different SET of evidence nodes. Any
  accuracy or latency figure measured before 0.10.0 describes the old traversal and has to be
  re-run rather than carried forward. `traversalOrder: 'fifo'` reproduces the pre-0.10.0 behaviour
  exactly, for anyone who needs to re-derive a published number."* — a compatibility switch shipped
  specifically so third parties can re-derive numbers this release invalidated.
- `CHANGELOG.md:686-707`: an earlier "about 41% mean query latency" claim is **withdrawn as a
  constant**, with the reason (*"it cited a machine-local `/tmp` path a reader cannot reach, and it
  described one point on a curve as if it were a single overhead"*), replaced by a five-row measured
  table across N ∈ {4,8,12,24,48}, and then the withdrawn figure is placed back on the curve:
  *"The withdrawn '41%' sits inside that reproducible range (near N=12 vs N=4); it is not 'well
  above' the curve — it is on it."* Self-correction that does not overcorrect.
- `CHANGELOG.md:765-774`: *"Measured on the LongMemEval corpus that silently discarded **80 of
  3,747 nodes (2.1%)** at one scale and **467 of 19,416 (2.4%)** at another."*
- `CHANGELOG.md:360-365`: `forgetTopic` substring matching — *"measured at 127 unintended
  retirements out of 2,151 for a single three-letter topic."*
- `CHANGELOG.md:642-647`: *"Measured before the fix: two builds of one corpus inside a single
  process differed in evidence order on 21 of 40 questions and in evidence set on 6 of 40. After:
  0 and 0."*
- `CHANGELOG.md:719-724`: *"turned headings like 'Governing Law' and 'Related Work' into people —
  **95 of 211 identities on this repository's own markdown**, with no real person among them."*
  They dogfooded the bug on their own repo and reported the ratio.
- `CHANGELOG.md:445-451` is the most unusual: an experiment that came back **null** is reported as
  null. *"LongMemEval `temporal-reasoning` does not set `validUntil` on ingest (0/118k nodes on a
  30-question sample), so the free evidence-recall harness is a **null for the expiry split
  itself**. Turn micro-recall … is **84.21%** (64/76), not 1.0 — that figure is ordinary retrieval,
  not evidence about damp-vs-exclude. The damp decision rests on the synthetic expiry fixture…"*
  They separate "what the number is" from "what the number is evidence for".

### 4c. An "Errata (added after release)" section inside a shipped changelog

`CHANGELOG.md:367-384`, under `## v0.10.0`:

> ### Errata (added after release)
>
> - **0.10.0 introduced two new error message strings and this entry did not say so.** Consumers
>   that classify load failures by matching message text were therefore never updated. **Recorded
>   here rather than quietly fixed:**
>   - `Invalid graph: <type> edge <id> has weight <w>; …` — note the prefix is **`Invalid graph`**,
>     NOT `Invalid .gai`. A classifier matching the older prefix does not recognise it, and a load
>     failure it was meant to route to recovery instead falls through.
>   - `Invalid .gai file: format version <n> is newer than this reader supports` — this one DOES
>     contain `Invalid .gai`. A consumer routing that prefix to "corrupt" would quarantine a
>     **perfectly valid file written by a newer version**. Version skew is not corruption and must
>     not be handled as it.
>
> These strings are now frozen: they are load-bearing for at least one downstream classifier.
> Stable `code`s are planned for 0.11.0 so that no consumer has to match prose again.

Four separate craft moves in eighteen lines: (a) amend a released entry rather than rewrite it,
(b) say explicitly that the omission is being recorded not hidden, (c) name the *downstream
consequence* of each string, distinguishing "misroutes" from "destroys good data", (d) commit to a
follow-up with a version number — which is then delivered (`CHANGELOG.md:227-266`, v0.11.0 error
codes) and *keeps the messages byte-identical and test-frozen* so the substring classifiers the
errata was written for keep working during migration.

### 4d. Saying plainly that a body is not encrypted, in the document where the belief forms

`README.md:156-162`:

> **The body is not encrypted, so treat it as you would the source documents.** A `.gai` holds the
> memories in the clear; `strings` on one prints them. HMAC signing proves a file came from the
> holder of the key and was not modified — it does not stop anyone from reading it. … The
> single-file design that makes a `.gai` easy to move is the same property that makes an
> unencrypted one easy to leak.

`SPEC.md:208-237` is the normative version, and its diagnosis of *why the omission was dangerous* is
the transferable part:

> This is stated plainly because the surrounding material invites the opposite conclusion. This
> section is titled Integrity and is mostly about HMAC signing, and a reader scanning for "is this
> protected" finds cryptography and stops. **HMAC answers "did this come from the holder of the key,
> unmodified" — never "can a third party read it."**

Then it (a) says the omission is *deliberate rather than pending* and gives the design reason
(*"Encryption belongs to the layer that knows the trust boundary: which keys exist, who may hold
them, how they rotate, and what happens when one is lost."*), and (b) converts the disclaimer into
**RFC-2119 obligations on the caller**, `SPEC.md:229-237`:

- an implementation that moves `.gai` across any trust boundary MUST encrypt them and MUST NOT
  present the checksum or a valid MAC as evidence of confidentiality;
- **"Documentation and interfaces describing `.gai` portability MUST NOT imply that a `.gai` is safe
  to hand over merely because it is self-contained."** — a normative requirement placed on *the
  project's own marketing copy*.

Commit `ac951e6` is the reasoning trail, and includes the self-indictment:

> The README went further and recommended it: a .gai was described as something to copy, commit and
> hand to someone. That is advice to put unencrypted memories in a repository and give them to a
> third party, in the document most readers see first.

Follow-on commit `576cd0b` ("the corruption class does not mean tampered with") applies the same
lens to the error taxonomy: the `corruption` class had been described as "damaged or forged", and
they corrected it because *"Describing it as forgery detection in the document consumers read while
writing their handler is how a downstream system ends up treating an unsigned file as verified."*
The generalized rule they are operating: **audit the document where the reader forms the belief, not
the document where the fact is technically true.**

### 4e. Breaking-change classification by *which view of the type breaks*

`CHANGELOG.md:9-15` — the v0.11.0 header, before any section:

> **Three changes are visible to callers even though none of them removes or renames a public
> export.** If you supply your own embedding adapter, seed `score` values move… If your TypeScript
> code CONSTRUCTS a `CorrectionResult` (a test double, a mock, a wrapper), it stops compiling until
> you add one field. If you classify load failures with `err.name === 'Error'` … that check now
> returns false. Message-substring classifiers are unaffected: those strings are frozen and tested.

And `CHANGELOG.md:28-32`:

> **`CorrectionResult.affectedNodeIds` is now required.** Readers are unaffected — the field is
> always populated. Anyone who CONSTRUCTS the type in TypeScript must add it. **This is listed here
> rather than under Added because "additive" describes the reader's view only, and the constructor's
> view is the one that breaks a build.**

That is a genuinely sharp taxonomy for a structurally typed language: a field addition is additive
to consumers and breaking to producers, and semver has no vocabulary for the distinction, so they
put it in the release header.

Paired with it, `CHANGELOG.md:217-223` gives a **version-agnostic adoption snippet** — code that is
correct on *both* the old and new version, so a consumer can land the change before upgrading:

```ts
const res = g.edit(nodeId, content, reason);
const liveId = res.affectedNodeIds?.[0] ?? nodeId;
```

> On <= 0.10.0 the field is absent and the fallback is correct. On 0.11.0 you get the new node.
> Additive — no consumer breaks.

Also worth stealing: `CHANGELOG.md:212-215` names the workaround the missing API forced —
*"the only way to learn the new id was to observe `graph.nodes.size` across the call and take the
first entry past the old size… **If you wrote that, you can delete it.**"* Telling the reader which
of their code to delete is a better migration note than telling them what to add.

### 4f. A changelog entry carrying a cross-repo release-ordering constraint

`CHANGELOG.md:486-492`:

> - **Release sequencing for soft-delete honesty.** The desktop app's content-erasing
>   `__gn-forgotten:` tombstone is, on an SDK before this one, what keeps forgotten content out of
>   prompts — the SDK-side gates that replace it land here. Order: **publish this SDK, move the
>   app's dependency pin, then land the app's already-written tombstone removal.** Landing the app
>   change first, against an older SDK, would make every `forget` a privacy no-op — content retained
>   *and* still served. **Do not reorder.**

A public changelog is an odd place for an internal deploy runbook, and that is exactly why it
works: the ordering constraint is *derived from the semantics of the release*, so it belongs with
the release note. Anyone else composing the two packages needs the same ordering.

---

## 5. Commit-message craft: subject is a claim, body is an argument

Subjects (see `git log --oneline -60`) are plain-English assertions in the imperative or
declarative, conventional-commit-prefixed, no ticket numbers:

```
chore: the lockfile records the version it is a lock for
docs(changelog): the corruption class does not mean tampered with
docs: state plainly that a .gai body is not encrypted
docs(spec): v2 keeps the AIKG magic — version skew is not a wrong-format error
docs(spec): write section 8 for an implementer, not for a reader of this repo
feat(sdk): set a memory's confidence directly, with a receipt that cannot lie
fix(query): embedding seed scores are a cosine again, not a bare dot product
chore(repo): match milestone reports by shape, not by name
test(query): prove the final retirement gate directly
fix(ingest): supersede blocks re-ingest, delete restores it
```

Bodies follow a recognizable four-move shape: **(1) what was actually wrong, in mechanism;
(2) why the obvious reading of it is wrong; (3) what it costs / what it does NOT change;
(4) what is deliberately left undone.**

The purest specimen is `7a19c4b`, a two-line lockfile fix:

> package-lock.json declared 0.8.0 while package.json declared 0.11.0. The two have disagreed at
> every published tag since 0.8.0 … so this is not new and has never broken a release. `npm ci` does
> not check the root version field, only the dependency tree, and the tree here is unchanged: the
> diff is two lines.
>
> Fixing it anyway because a version file that disagrees with the others is the thing a release
> checklist exists to catch, and **a checklist that has learned to ignore one of its own signals is
> worth less than one line of diff.**

It argues *against its own change* first, then states the second-order reason. Note also
`chore(test): use a neutral constant for the resample seed` — *"The seed spelled a name. Any fixed
value reproduces the draw; this one carries no incidental meaning."* Two sentences for a constant
rename, and they are the right two.

`aa915f9` ends with an explicit **Deferred** paragraph:

> Deferred: the CLI's own --help (src/cli/index.ts:425-428) and the two viewer "lost the local
> server" strings still print the unpinned form, so a user copying from --help can still land on a
> shadowed resolve. Fixing those needs a build:lib and is a code change, not a docs one.

…and a **Worth checking after this lands** paragraph noting that the newly-tracked screenshots use
repo-relative paths, so they render on GitHub but not on npmjs.com (where `docs/` is excluded by
`.npmignore`). Both are the kind of thing normally lost to a reviewer's head.

`dbe82a2` contains the single best verification claim in the repo:

> Five documented calls did not match the shipped signatures… **Each corrected snippet was executed
> from a packed tarball in a clean consumer rather than read.**

That is the docs-correctness analogue of `scripts/verify-package.mjs` (§7): documentation is proven
against the *published artifact*, not against the source tree.

---

## 6. The spec is written for a stranger who will implement it

`SPEC.md:6-9` sets the asymmetry up front:

> This document is the normative description. Where it and any implementation disagree, **this
> document is wrong and should be fixed** — but until it is, the implementation is what exists.
> That asymmetry is deliberate: **a format with one implementation and no written spec is a file
> layout, not a standard.**

Three sections do the work:

**§0 "Why not an existing format"** (`SPEC.md:27-41`) — a five-row table rejecting JSON/NDJSON,
Parquet/Arrow, GraphML/GEXF/GraphSON, Protobuf/FlatBuffers and property-graph-DB export, each for a
*specific* disqualifying property (e.g. Protobuf: *"Require every consumer to compile from the same
schema. `.gai` uses MessagePack precisely so that no schema coordination is needed — the body is
self-describing."*). Closing line: *"The goal is not to beat any of these on their own ground."*

**§6 "Known weaknesses"** (`SPEC.md:279-299`) — *"Stated here because a specification that hides its
soft spots is worse than one that names them."* Then, quantified:

> **`contentHash` is 32-bit.** At cortex scale collisions are not hypothetical: the birthday bound
> puts at least one collision at roughly 5% by 20,000 nodes and 25% by 50,000. A reader MUST NOT
> treat equal `contentHash` as proof of equal content — compare the content itself before
> deduplicating or merging.

…and `CHANGELOG.md:351-355` shows that weakness being exploited *in their own code*: dedup and the
federated query path dropped a node on hash match alone, *"so a collision could hard-delete
unrelated content in a system whose guarantee is that nothing is ever hard-deleted."*

**§8.3 Conformance levels** (`SPEC.md:464-483`) — the most transferable idea in the file:

> Conformance is declared per layer, because the layers have genuinely different requirements.
> **A file format benefits from many independent implementations: that is what proves the bytes are
> unambiguous. A retrieval engine does not — ranking is a design position, and two engines that rank
> differently are not two implementations of one thing.** Stating a single, undifferentiated
> "conforming" would force those two facts into one claim and make it useless.

| level | covers | must |
|---|---|---|
| L1 — container | §1 byte layout, §2 header, §4 integrity | frame, checksum-verify, reject per §5.1 |
| L2 — model | §3 node/edge model, §8.1 `(id, rev)` | round-trip every node/edge/revision/metadata field losslessly; honour §8.2 rule 4 |
| L3 — retrieval + authority | §5.3 traversal, §8.2 ceilings, §8.4 skills | enforce `maxAutonomy` as a hard gate; implement path-maximum traversal |

> **Most implementations need only L1 or L2, and declaring L2 is a complete claim, not a partial
> one.** An L2 implementation reads and writes every memory in the file faithfully; it simply does
> not promise to rank them the same way.

This is the resolution to the §3 tension: they refuse to sanction a second *engine* implementation
while actively courting second *container* and *model* implementations. `SPEC.md:327-328`:
*"A third implementation passing all ten is what would make `.gai` a standard rather than a file
layout. Until then this document describes one program."*

Commit `e67c68e` — *"docs(spec): write section 8 for an implementer, not for a reader of this repo"*
— is the editorial rule that produced §8:

> Five passages justified a requirement by describing this project rather than the format: one cited
> two of our own documents disagreeing, others counted what the reference implementation does or
> does not export… A specification is read by someone deciding whether to implement it, and internal
> inconsistency on display reads as an unstable format. It is also unnecessary — a document that
> contradicts another can be corrected quietly and at no cost, while a spec that quotes the
> contradiction makes it permanent.

### §8.0 "One break, once"

`SPEC.md:339-355`:

> A format that breaks twice has taught the market that it breaks. v2 is intended to be the only
> breaking version `.gai` ever has, which means the correct posture is to be **greedy now and
> conservative afterwards**. Two consequences:
>
> - Everything in this section must land together or not at all. **A partial v2 is two breaks
>   wearing one version number.**
> - After v2, extension happens through a `requires[]` must-understand list in the header: a reader
>   refuses on an unknown *feature tag*, never on an unknown version. That is how PNG and Matroska
>   absorbed decades of change without a v2, and **it makes the version number vestigial by design.**
>
> Three admissible reasons for a v3 are named in advance, because "never" is not credible: a
> cryptographic primitive is broken, the node model gains a dimension that cannot be expressed as a
> feature tag, or a legal requirement forces a change. Nothing else.

Paired with **§8.6 "Deliberately NOT in v2"** (`SPEC.md:573-582`), which lists two things the author
*wants* and is refusing, with the refusal reasoned:

> - **Widening `contentHash` to SHA-256.** Tempting, and §6 already calls for it — but it rewrites
>   every hash in every existing file. Recorded as the leading v3 candidate under §8.0's first
>   admissible reason. Note that §8.5 reduces the urgency: identity no longer rests on the hash…
> - **A merge algebra.** §8.1 provides the carrier and §8.5 makes two builds of one corpus
>   comparable. The operation — commutative, associative, idempotent, proven over `(id, rev)` — is
>   downstream and **is not claimed here**.

And `SPEC.md:412-415` does the same inside a feature: `(id, rev)` gives merge *a place to put a
conflict*; *"It does not by itself define the merge algebra… That work is downstream of this section
and is not claimed here."* The repeated phrase "is not claimed here" is doing scope-discipline work
in a document, which is where scope creep actually starts.

`SPEC.md:357-376` (commit `245e542`) is the corollary reasoning about magic bytes: v2 keeps `AIKG`
because *"A format that reports version skew as a wrong-format error teaches its own tooling to
treat upgrades as corruption"*, and because *"if the version lived in the magic, every future
revision would need new magic — precisely the per-version breakage that the `requires[]`
must-understand list exists to avoid. The magic answers 'is this the format?'; `requires[]` answers
'can I read this particular file?'"*

`ROADMAP.md:41-51` compresses all of §8 into eleven lines for the reader who will not open the spec
— including *"the bar is deliberately high and the window is v2"*.

---

## 7. Process craft: prove the artifact, and prove the prover

`scripts/verify-package.mjs:3-31` opens with a `WHY THIS EXISTS` block that is a small essay:

> All 24 gated test suites import through the `@/*` alias, which tsconfig maps to `./src/*`. Not one
> of them imports `dist/`. So the entire test suite passes against TypeScript sources that npm never
> ships, and **the artifact consumers actually install is verified by nothing at all.**
>
> Concretely, every one of these ships green today:
>   - `tsc-alias` fails to rewrite a path, so `dist/**` keeps `@/core/...` specifiers Node cannot
>     resolve;
>   - a runtime file (a copied vendor asset, the CLI sample dir) is missing from `files[]`, so it
>     builds locally and 404s on install;
>   - an `exports` subpath points at a file that does not exist;
>   - the `bin` entry is not executable or has no shebang.
>
> Every one of those is invisible to `tsc`, invisible to eslint, and invisible to a test that imports
> `src/`. **They are only visible to someone who installs the tarball — which, until now, was the
> user.**

The script then: refuses to pack when `dist/` is missing (`:55-58` — *"This is the failure this whole
script is guarding against, so it must not be possible to skip it silently"*), `npm pack`s, installs
the tarball into a scratch dir as a real dependency, imports every declared `exports` subpath from
outside the repo, and asserts the root entry exports **≥ 20 symbols** (`:103-104` — *"A dist that
resolves but exports nothing is the subtle version of broken"*).

Two details worth stealing verbatim:

- `:109-114` — a comment documenting a bug the check itself had: *"`grep -rl` exits 1 when it finds
  NOTHING, and that is the outcome we want. Treating a non-zero exit as an error inverts the check —
  a clean package reports as broken. Exit 2 is a real grep error and must still fail. Absolute path
  because `grep` is a shell function in some environments and silently returns nothing."* The
  false-failure that cost them a run is preserved as the comment.
- `:127-140` — a **positive control**: the script writes a `__canary.js` containing an unrewritten
  `@/` specifier, re-runs the grep, asserts it is found, then deletes the canary.
  *"a guard reported without its mutation is unproven."* Commit `a9c65ee` states the general form:
  *"a check that has never reported a problem has not been shown to be able to."*

`spec/conformance.mjs:6-12` applies the same inversion to a format reader:

> Half the fixtures are malformed on purpose: **the useful question about a format reader is not
> what it accepts but what it REFUSES.** A reader that parses `bad-checksum.gai` without complaint
> is not conforming, however well it handles valid input.
>
> A second implementation, in any language, should be able to run the same fixtures and reach the
> same verdicts. That is the point of shipping them.

Its `rejects()` helper (`:46-55`) treats *silent acceptance* as the failure, and it imports from
`dist/` (`:22`), so it is the only gate that exercises the shipped reader.

`.github/workflows/ci.yml:3-17` and `publish.yml:38-88` are both comment-first, and both name a real
incident:

- `ci.yml:10-13`: *"Tag `v0.7.1` sits on origin with no `## v0.7.1` section in the CHANGELOG, no npm
  version and no GitHub Release — a dangling public tag left by a run that failed after tagging.
  **A version number was spent to discover a problem this workflow would have caught for free.**"*
- `publish.yml:38-44`: the CHANGELOG-section extraction gate exists *"…which has bitten us once
  already (v0.5.0 shipped to npm but no release notes — backfilled manually)"*. The same extracted
  block becomes the GitHub Release body, so the changelog is the single source.
- `publish.yml:68-78`: the tag-vs-`package.json` gate, placed **last** among the checks — *"This runs
  LAST among the checks and immediately before the irreversible step, so it also catches anything
  earlier in the job that rewrote package.json."* Gate ordering justified by irreversibility.
- `ci.yml:37-39`: the build step is kept even though `npm ci` already builds via `prepare`, because
  *"if `prepare` ever stops running it, silence would look like success."*
- `ci.yml:64-74`: a **warning-only** step comparing `package.json` version to the npm latest, so the
  duplicate-version failure surfaces on `main` rather than at tag time.

Every one of those comments answers "why does this step exist" with a named past failure. That is
the pattern: **CI comments are incident post-mortems compressed to five lines.**

---

## 8. Attribution / vendoring hygiene

`NOTICE:18-36` is short and complete:

- names the redistributed bundle and version (`3d-force-graph (v1.80.0)`), the copyright holder, and
  the license;
- names the **transitive** dependencies bundled *inside* the minified file — three.js,
  three-forcegraph, three-render-objects, d3-force-3d, kapsule, accessor-fn — which a naive
  `license-checker` over `node_modules` would miss entirely, because they are inlined into one
  vendored `.min.js`;
- says where the license text ships in the published artifact
  (`dist/cli/vendor/3d-force-graph.LICENSE`);
- and states **why** the vendoring exists — *"so that `npx @nehloo/graphnosis demo` works with no
  network access"* — tying the legal obligation back to a product property.

Provenance: it was *not* attributed until commit `7bc5baa` ("clean dist before building, and
attribute the vendored viewer"), which bundled the NOTICE fix with a discovery that
*"sixteen orphaned files from a previous format module survived every build and would have shipped —
including declarations, so a consumer could type-check an import that has no runtime behind it."*

`REFERENCES.md` is the academic counterpart and carries one rule worth copying (`REFERENCES.md:8-9`):
*"These describe the design this SDK implements. **Where a paper and the code disagree, the code is
what exists** — the papers are dated, and several claims in them have been superseded by later
releases."* Each paper entry then names the **file** it corresponds to (`src/core/query/traverser.ts`,
`tests/longmemeval/official/judge.ts`, `src/core/format/gai-writer.ts`,
`src/core/enrichment/session-summarizer.ts`), so a reader can go from citation to implementation in
one hop. `REFERENCES.md:108-110` explicitly separates "Related Work" from "Directly Used" and states
independence: *"Graphnosis was developed independently and does not derive from any of these works."*
`REFERENCES.md:35-40` lists a paper as *"Draft — not yet deposited"* rather than implying it exists.

`CLA.md` is honest about provenance too (`CLA.md:7`): *"adapted from the Apache Software Foundation's
Individual Contributor License Agreement (v2.2) and the Project Harmony Individual CLA."*
`CONTRIBUTING.md:23` gives the *reason* for the CLA rather than just the requirement, and
`CONTRIBUTING.md:25` sets the cost expectation: *"It takes about 30 seconds."*

---

## ANTIPATTERNS — what not to copy from this repo

### A1. `enterprise/enterprise.md` — a 694-line orphaned security doc, three months stale, pointed at from the source

Last touched **2026-05-09** (`git log -1 -- enterprise/enterprise.md` → `feat: .aikg format +
brain-mapping docs`), while README/ROADMAP were revised 2026-08-04. It is the second-longest document
in the repo and is **not linked from README.md, ROADMAP.md or CONTRIBUTING.md** — but it *is* linked
from the code: `src/sdk/index.ts:33`, *"See `enterprise/enterprise.md` for the full IT/security
posture."*

Concrete falsehoods a security reviewer would act on:

| line | claim | reality |
|---|---|---|
| `enterprise/enterprise.md:301` | *"The full codebase is **MIT-licensed**"* | `LICENSE` + `package.json:6` + `NOTICE:4` = Apache-2.0 |
| `:301` | *"The `.aikg` format specification is documented in `src/core/format/`"* | the spec is `SPEC.md`; that sentence predates it |
| `:529-531` | *"`publishConfig.access: "restricted"` by default. Consumers need explicit access; the package is not on the public registry until we flip it."* | `package.json:35` → `"access": "public"`, and it is on npm |
| `:579`, `:599`, `:612` | worked examples call `g.loadAikg(...)` / `g.saveAikg(...)` | those methods do not exist; `src/sdk/index.ts:951,982` are `saveGai` / `loadGai` (renamed in 0.3.0, commit `1a3682c`) |
| `:7`, `:11`, `:46`, … (~25 occurrences) | `.aikg` extension | `.gai` since commit `c4fe01d` |
| `:536` | *"Publish with 2FA + OTP"* | `publish.yml:12-16` uses npm OIDC trusted publishing with **no** NPM_TOKEN |
| `:231` | *"`.aikg` files … are not encrypted at rest"* is buried under "Data at rest" | the README/SPEC treatment (§4d) is far stronger and this section undercuts it |

The doc is also the only place a genuinely useful artifact lives — the worker_threads ingest
sandbox (`:416-480`), the parser CVE table (`:398-408`), the auditor checklist for embedding egress
(`:241-246`), the soft-delete reason-prefix convention table (`:249-272`). So it is *simultaneously*
the most stale and one of the most valuable documents in the repo. **The lesson: a long,
high-authority doc that no top-level page links to will not be maintained, and the danger scales
with how authoritative it sounds.** If you keep one, either link it from the README (so it is on the
maintenance path) or add a dated staleness banner.

### A2. `AGENTS.md` / `CLAUDE.md` are shadow specs that assert behaviour the changelog reversed

`AGENTS.md` last touched **2026-05-09**. Three of its "Security and Robustness Guardrails" describe
behaviour that was subsequently classified as a *bug*:

- `AGENTS.md:40` — *"**Auto-pruning:** Orphan nodes (zero edges) are removed after graph
  construction"*. `CHANGELOG.md:765-774` (v0.8.0): *"Retrieval no longer deletes memories… silently
  discarded 80 of 3,747 nodes (2.1%)… Orphan removal is now off by default."*
- `AGENTS.md:43` — *"Soft-delete sets validUntil + confidence 0.1"*. `CHANGELOG.md:456-458` (v0.9.0):
  retired nodes carry `confidence: 0`; and `CHANGELOG.md:136-144` documents that `0.1` is now the
  *live floor* (`CONFIDENCE_MIN`), the opposite meaning.
- `AGENTS.md:55` — *"Confidence decays ~1%/day after 7 days without access (floor at 0.1)"*.
  `CHANGELOG.md:573-584` (v0.9.0): decay was measuring *age, not disuse*, compounded to the floor
  within a day for any host reflecting on a schedule, and is now **opt-in** (`reflect(…, { decay:
  true })`), default off.
- `AGENTS.md:70` — *"All dependencies MIT or Apache-2.0 licensed"* is an unverified standing claim
  with no gate behind it (no license-check step in `ci.yml`).

`CLAUDE.md:56,68,130,146` still use `.aikg` throughout. An agent handed these files writes code
against three behaviours that no longer exist. **Agent-instruction files are documentation with a
higher blast radius than prose docs and no reader who will notice they are wrong.**

### A3. `GRAPHNOSIS.md:5` calls the store "encrypted" — the exact claim the maintainer spent a commit refuting

`GRAPHNOSIS.md:5`: *"This project uses **Graphnosis** as its long-term memory: a local, **encrypted**
store the user owns, reached through MCP."*

Directly contradicts `SPEC.md:210` (*"**The body is not encrypted. A `.gai` file is readable by
anyone who has it.**"*) and `README.md:156`, and violates the normative rule those very edits added
at `SPEC.md:232-235` — *"Documentation and interfaces describing `.gai` portability MUST NOT imply
that a `.gai` is safe to hand over…"*. `GRAPHNOSIS.md` was last touched 2026-06-23, six weeks before
`ac951e6`. The safety-critical statement was fixed in two files and missed in the third, in the same
repo. **If you make a claim normative, grep for its negation across every tracked file, including the
ones you think are for a different audience.**

### A4. The badge says "re-measuring" and links to a document whose first sentence asserts the withdrawn number

`README.md:13` links the `LongMemEval-re--measuring` badge to `benchmarks/benchmarks.md`.
`benchmarks/benchmarks.md:3` — the very first content line — reads: *"…a system whose deterministic,
TypeScript-only memory stack … **scores 78.00%** on the official LongMemEval benchmark, **above Zep
(71.20%)**…"*, present tense. `:14` repeats it as a section heading. The withdrawal notice does
exist — but it is at **`:402-408`**, 400 lines down, inside the Run 30 subsection:
*"**No run in this log is current.** … Every figure below therefore describes code that is no longer
the code."*

So the honest disclaimer is placed *below* 400 lines of the claim it retracts, and reached by a link
whose anchor text is the retraction. Everything needed to fix it is already written; it is purely a
load-order defect. **Retractions must be placed where the reader arrives, not where the narrative
reaches them.** (The README's own handling, `README.md:415-423`, is the correct pattern and is
sitting one file away.)

### A5. `npm test` is a hand-maintained 25-command `&&` chain

`package.json:61` is a single string chaining 25 `tsx tests/unit/*.test.ts` invocations plus
`tests/ablation-scoring/maxwins-vs-additive.ts` and `node spec/conformance.mjs`, with no test runner.
Consequences: no parallelism; the first failure hides every later suite; a new test file runs only if
someone remembers to append it to the string (silent under-coverage, not a red build); and
`spec/conformance.mjs:22` imports from `dist/`, so `npm test` has an undeclared dependency on a prior
`build:lib`. This is the *same failure class* the repo diagnosed and fixed elsewhere — commit
`0c9e833`, *"chore(repo): match milestone reports by shape, not by name"*: *"The ignore list was nine
literal filenames, so each new review round shipped untracked only if someone remembered to add it."*
The lesson was applied to `.gitignore` and not to the test script.

### A6. `original-discussion.md` is a raw chat transcript at the repo root, and it teaches the wrong magic bytes

`original-discussion.md` (415 lines, last touched 2026-05-09) is a verbatim Q&A transcript plus a
planning dump: a Next.js file tree (`:257-353`), three implementation phases (`:355-398`), and a
verification plan. Almost none of it describes the shipped code — the repo is now an npm SDK with a
CLI, not a Next.js app with `/ingest` and `/pipeline` routes.

The load-bearing defect: `original-discussion.md:211` documents the format header as

```
[4-byte magic: 0x47 0x41 0x49 0x01]  // "GAI" + version
```

The real magic is `0x41 0x49 0x4B 0x47` = `AIKG` (`SPEC.md:245`, `spec/conformance.mjs:65`). This is
**precisely the error for which commit `0441884` deleted a different document**:

> Its first structural claim was wrong. It documented the magic bytes as 0x47 0x41 0x49 0x01 —
> "GAI" plus a family byte — where the format uses 0x41 0x49 0x4B 0x47, "AIKG". An implementation
> written from that document produces a file the reference reader rejects at byte 0, and the error it
> reports says nothing about the real cause.

`gai-format/gai-format.md` was removed for that; `original-discussion.md` carries the identical wrong
bytes, at the repository root, and survives. The removal commit's own justification applies verbatim:
*"It could only be found by someone browsing the repository, which is exactly who would then
implement from it."* **A document deletion that is not accompanied by a repo-wide grep for the
same false claim is half a fix.**

---

## Cross-cutting observations (not findings, but the shape of the thing)

- **The repo's strongest documents are the ones under active edit, and the correlation is
  near-perfect.** README/SPEC/ROADMAP/CHANGELOG/REFERENCES were all touched in the last four days of
  history and are exceptional. AGENTS/CLAUDE/enterprise/original-discussion were last touched in May
  and are all wrong in ways that matter. There is no middle. Doc quality here is a function of
  *recency of edit*, not of *care at authoring time* — which argues for fewer, linked documents over
  more, orphaned ones.
- **The honesty is asymmetric in a specific, learnable direction: they are hardest on their own
  numbers and softest on their own docs.** Withdrawing a benchmark headline, publishing a null
  result, retro-labelling null arms, and shipping an errata section are all rarer than fixing a stale
  `.aikg`. The cheap thing was skipped and the expensive thing was done.
- **Almost every honesty mechanism is anchored to a named past incident.** v0.7.1 dangling tag →
  `ci.yml`. v0.5.0 empty release notes → `publish.yml` gate. 0.10.0 undisclosed strings → errata +
  frozen-string test. `/tmp` latency figure → the five-row curve. False grep failure → the exit-code
  comment. Nothing is a policy invented in the abstract.
- **"Refusal" is the recurring test-design idea.** `spec/conformance.mjs` (six of ten fixtures are
  malformed on purpose), `verify-package.mjs` (the canary positive control), the confidence
  primitive's five refusal codes (`CHANGELOG.md:116-120`), and `SPEC.md:5.1`'s reject-list. The
  repeated formulation: *a guard reported without its mutation is unproven.*
