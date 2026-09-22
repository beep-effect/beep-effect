# Effect Schema Parity — Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

Pre-research grill, 2026-09-12, run with `/grill-with-docs` from the WebStorm
scratch before any RESEARCH.md existed. These entries are the operator's
locked intent; the align stage ratifies or revises them once research has
produced the knowledge layer and the candidate lists.

## 2026-09-12 — Comparison baseline

**Question:** What is the "before"? The brief asked for a pre-rc.112 checkout
compared against main, but the repo is already on rc.115.

**Answer:** Audit beep-effect's schema usage directly against effect main.
Use `git diff effect@4.0.0-rc.112..main` (28 schema-relevant commits) only as
a "recently changed, look here first" hint list. No clone, no checkout;
`.repos/effect` already tracks main with every tag.

**Rationale:** A version changelog misses idioms that predate rc.112 and were
never adopted. Rejected: strict rc.112 to main changelog first; snapshot
c8349ed to main (three days of upstream, already absorbed by the rc.113/115
bumps).

## 2026-09-12 — Packet shape

**Question:** The brief bundles four wants (upstream delta, queryable
knowledge base, repo-wide idiom migration, `@beep/schema` deletions). One
packet or several?

**Answer:** One exploration packet graduating into exactly one goal, phased
internally.

**Rationale:** Operator's call; the recommendation was one exploration
graduating into three goals (knowledge + gate, retirements, idiom campaign).
Rejected: knowledge base first with the rest deferred; a single packet doing
everything end to end without graduating.

## 2026-09-12 — Knowledge layer

**Question:** How is the per-symbol "queryable knowledge" produced, and how
does it serve both agents and a hosted gate when graft indexes are
git-ignored and `.repos/effect` is machine-local?

**Answer:** Hybrid, graft-led. (1) `graft build --only-dir packages/effect/src`
inside `$HOME/YeeBois/dev/effect` (structural, no LLM key) so agents query it
with `graft ask "<q>" --source <effect-dir>` and a second `graft mcp
<effect-dir>` server. (2) A repo script emits one sha-pinned JSONL row per
exported schema-relevant symbol (module, name, kind, signature, JSDoc
sections, examples, since, sha), committed as a repo-cli test fixture like
`effect-vitest-rc115`, and re-pinned on every effect bump. Sub-agent prompts
are templated from those rows; nobody hand-copies JSDoc.

**Rationale:** Mechanical extraction is deterministic and cheap; agent quota
is spent on judgment. The committed inventory is what lets the gate run
hosted. Rejected: sub-agent-authored per-module documents (drift on every
bump, quota spent on transcription); graft-only with a local-only gate
(contradicts the standing-gate close condition); pulling effect into this
repo's graft with `--follow-nested-repos` (476+ upstream files rank alongside
repo code; freshness churn on every fetch).

## 2026-09-12 — Equivalence test for retirement

**Question:** "If effect ships it, delete ours" needs a test for "ships it";
name overlap is weak evidence.

**Answer:** Same intent is enough. When upstream covers a concept's intent,
retire the `@beep/schema` concept and adapt every consumer to whatever
upstream offers, accepting behaviour changes.

**Rationale:** Operator's call, taken over the recommendation (retire only
when the concept's existing test suite passes against the substituted
upstream symbol, with narrowings recorded). Recorded risk: silent semantic
drift across 2,508 importing files, and some upstream surfaces are plain
value modules with no schema (`HttpStatus`, `HttpMethod`, `Url`), so "same
intent" will sometimes mean adopting a non-schema surface. Rejected: a thin
`@beep/schema` re-export alias (contradicts "delete entirely").

## 2026-09-12 — Goal closing condition

**Question:** "One goal" must close, but "new and going forward" is a
standing property.

**Answer:** The goal closes when a standing gate exists and the backlog it
found is zero. It ships (a) the knowledge layer, (b) an upstream-parity
detector lane fed by the inventory, and (c) drives that lane's findings to
zero. "Going forward" is the lane on every effect bump, not an open goal.

**Rationale:** Rejected: closing on the 56 listed modules and the retirement
PRs only (no automation, drift returns); a rolling campaign goal (conflicts
with packet lifecycle laws and same-PR closeout).

## 2026-09-12 — Performance

**Question:** "Optimizing schema performance at all costs": which
performance, and does it override readability and doctrine?

**Answer:** Type-check cost first (tsc/type-instantiation; the repo has a
TS2589 flake class and heavy `@beep/schema` docs), runtime decode/encode on
hot paths second (Result/sync codec APIs). Every change carries a
before/after number; no readability regression without one. "At all costs"
becomes "no unmeasured cost". Upstream lead: `657254b821` "Optimize Schema
initialization (#8196)".

**Rationale:** Rejected: runtime decode only; no performance lane.

## 2026-09-12 — Module list roles

**Question:** The 56 listed paths mix core schema modules with http/ai/rpc/
sql/encoding/net/observability/devtools modules. Same role?

**Answer:** No. Role A (adoption surfaces): `Schema*`, `JsonSchema`,
`VariantSchema`/`Model`, `Arbitrary`, `StandardSchema`, `SCHEMA.md`,
`migration/schema.md`. Role B (idiom exemplars): everything else, mined for
how effect's own authors compose schemas (annotations, class patterns, error
modelling, encoding boundaries) to form the idiom rubric for the repo-wide
audit. B modules are not adoption targets.

**Rationale:** Rejected: all 56 as adoption surfaces (broadens into http/ai/
rpc parity that rules and other packets already cover); dropping B (loses
the exemplar mining the "idiomatic, precise, clean" intent depends on).

## 2026-09-12 — Orchestration lane

**Question:** Which lane runs the "maximally optimized specialized
sub-agent prompts"?

**Answer:** Codex exec lanes (`codex exec --model gpt-6-astra`, `medium`
effort per repo `AGENTS.md`), one per Role A module or `@beep/schema`
concept, each prompt generated from the inventory rows plus graft output for
that module, each writing a findings file into the packet. Fable orchestrates
and judges. The Codex pool is available again as of 2026-09-12 (second
ChatGPT subscription).

**Rationale:** Preserves the scarce Fable weekly limit per the delegation
rules. Rejected: native Workflow children under `claudex` (same pool, plus
5-hour session-limit deaths); Fable `Agent` subagents (forbidden for bulk
work).

## 2026-09-12 — PR batching

**Question:** `@beep/schema` is imported from 2,508 files; Yeet caps
base-delta capture at 512 KiB and squash merges drop late pushes. How do
retirements ship?

**Answer:** One PR for everything, regardless of size: retirements, consumer
migrations, idiom fixes, and the gate at zero.

**Rationale:** Operator's call, taken over the recommendation (one PR per
retired concept with all its consumers). Precedent: #1060 migrated ~830 files
in one PR. Plan around: merge main early and often against the 512 KiB
capture cap, use the manual `gh pr` route for very large path counts, and
never push after the squash. Rejected: one PR per consumer package then a
final deletion PR (the old module lingers as a de facto deprecation window);
one PR per upstream module family.

## 2026-09-12 — Gate home

**Question:** Where does the standing parity gate live?

**Answer:** A new `UpstreamParity*` detector family inside the existing
`schema-first` lint command, next to `SchemaFirstDetectors.ts`, driven by
the committed JSONL inventory under the repo-cli test fixtures, with its own
inventory file so its floor ratchets independently. Every effect bump re-pins
the fixture exactly like the effect-vitest procedure.

**Rationale:** Reuses store, ratchet, scan, and grouped-finding machinery.
Rejected: a separate `lint:upstream-parity` lane (duplicates machinery, adds
to the lane-economics budget); a `graft check`-style freshness script only
(catches staleness, not reintroduced hand-rolling).

## 2026-09-12 — Doctrine surface

**Question:** "Same intent, delete and adapt" generalises to an upstream-first
rule for `foundation/modeling`. Where is it recorded?

**Answer:** A `standards/architecture/DECISIONS.md` entry (upstream-first for
`foundation/modeling`, precedent 2026-07-08 upstream PGlite) plus the
operational rule in the `@beep/schema` README: a concept is retired the
moment upstream covers its intent, in the same PR as its consumer migration.
Written in the goal, not now.

**Rationale:** Architecture-wide, hard to reverse, resolves a real tradeoff,
so it meets the DECISIONS bar. Rejected: README only (other foundation
packages keep hand-rolling); record nothing until the first retirement lands.

## 2026-09-12 — Deliverable of this session

**Question:** What is produced now?

**Answer:** The WebStorm scratch rewritten in place as a decision-annotated
kickoff prompt, and this packet seeded at stage 0 with the original brief
verbatim and this grill. Nothing committed.

**Rationale:** Rejected: scratch rewrite only; a sibling clarified scratch
with the original untouched (provenance now lives in CAPTURE.md instead).

## 2026-09-14 — LiteralKit retires; its helpers are ergonomics

**Question:** LiteralKit has 536 consumers and is a standing coding rule
("use LiteralKit, never a hand-rolled union"). Upstream `Schema.Literals`
carries `literals`, `members`, `mapMembers`, `pick`, and `transform`. Does
the same-intent rule retire it, or does the derived helper surface (`is.x`,
`Enum`, `Options`, `HashSet`, `$match`, `pickOptions`, collision checks)
justify KEEP?

**Answer:** Retire. The schema intent is covered by `S.Literals`; every
LiteralKit extra is a derivation over that schema, which is ergonomics, not
intent. Call sites move to `S.Literals` plus `S.is(member)` and `effect/Match`
where a guard or exhaustive match is needed; the 536 consumers get call-shape
rewrites by codemod, not hand edits. The standing rule becomes "use
`S.Literals` for literal unions, never a hand-rolled `S.Union(S.Literal…)`".
Collision and coverage checks vanish with the kit. MappedLiteralKit follows
the same reasoning.

Consequences to carry into the goal: rewrite the LiteralKit remediation string
in `SchemaFirstPolicy.ts`; rewrite the AGENTS.md Code Laws line and the
schema-first skill and agent text; the user's global rule
(`$HOME/.claude/rules/effect-coding-standards.md`) names LiteralKit and is the
user's to edit, so the goal flags it rather than touching it.

**Rationale:** The retirement rule is "same intent ⇒ retire, adapt consumers,
same PR; no thin re-export alias". A derivation kit kept beside the retired
schema is that alias with a different label. Rejected: retire the schema but
keep a derivation kit (relabelled re-export, and the kit would need its own
parity audit every bump); KEEP with a written reason (the same-intent rule
loses its teeth on the first concept large enough to hurt).

## 2026-09-14 — Role B modules may be retirement targets

**Question:** HttpMethod, HttpStatus, MimeType, Jsonl, Toml, and Yaml are
covered only by Role B modules (`effect/unstable/http/*`,
`effect/unstable/encoding/*`), which the module-roles decision excluded as
comparison targets. Which decision bends?

**Answer:** Module-roles bends. That decision scoped the inventory mining to
Role A; it was never a statement that Role B cannot replace a local concept.
All six retire. Recorded losses: MimeType's closed category schema becomes a
lookup (`unstable/http/Mime.ts` has no schema); Jsonl's call shape becomes the
Ndjson stream/channel shape; HttpStatus's named codecs become value-module
lookups. Each loss is a consumer adaptation, not a reason to keep the concept.

**Rationale:** Consistency with the LiteralKit ruling: the test is intent
coverage, not which upstream directory covers it. Rejected: keep the exclusion
and KEEP all six (six permanent exceptions to the same-intent rule for a
scoping accident); split by surface kind (schema-bearing retire, value-only
keep), which would keep MimeType and HttpStatus on a distinction consumers do
not care about.

## 2026-09-14 — SchemaUtils: ship the selective-statics goal, then retire statics

**Question:** SchemaUtils is ADAPT with survivor `collectAnnotationsAt`, but
goal `schema-utils-selective-codec-statics` (P4 Yeet in progress) is building
a keyed selective `withCodecStatics` registry on top of it. How do the two
sequence?

**Answer:** The goal ships first, unchanged. After its P4 PR merges, the
parity goal lands the F15 `withCodecStatics` detector and the statics
retirement in one PR. `collectAnnotationsAt` remains the survivor. The parity
goal's plan cites the merged PR as its precondition.

**Rationale:** Reworking an in-flight PR against a rule that is not yet in
force costs a review cycle for no correctness gain; retiring the registry
right after it merges is a normal same-intent retirement with a precise
consumer list. Rejected: exempt selective statics as an idiom (contradicts the
retirement rule); fold the goal into parity (blocks a finished PR on an
unstarted one).

## 2026-09-14 — Wire shape: upstream default per boundary, recorded in a table

**Question:** Retired transports (Timestamp, Duration inputs,
ArrayBuffer→Uint8Array, MutableHashMap/Set, Graph snapshots) each have an
upstream codec with a different default encoding. What is the policy?

**Answer:** Each boundary adopts the upstream default shape, and the goal SPEC
carries a boundary→codec table (persisted column, HTTP payload, in-memory,
log line) naming the codec per boundary. Persisted and external contracts (DB
columns, HTTP payloads already served) keep byte-identical encoding, chosen
from the upstream variants (`S.DateTimeUtcFromString` vs millis,
`S.DurationFromString|Millis|Nanos`, `S.Uint8Array` vs base64, array wire
fields for the mutable collections, `S.Graph` + `S.toCodecJson`). Only
in-memory shapes may change.

**Rationale:** The table makes the encoding choice reviewable once per
boundary instead of per call site, and the byte-identity clause is what keeps
migrations out of the retirement PRs. Rejected: accept upstream defaults
everywhere (silent encoding changes on stored data); freeze every wire shape
with local codecs (keeps the transports we are retiring).

## 2026-09-14 — Case-string brands retire; rejection uses a check

**Question:** KebabStr, PascalStr, SnakeStr brand a string by case. Upstream
covers normalization through `S.decodeTo` with `String.kebabCase` and
siblings, but not rejection of a wrongly cased input. KEEP where rejection is
policy?

**Answer:** Retire all three. Sites that normalize use `S.decodeTo` with the
`effect/String` case helper. Sites where wrong case must be rejected use an
inline `S.String.check(S.isPattern(...))` at the schema, not a brand type.

**Rationale:** A brand carried the rejection policy in the type; a check
carries it in the schema, which is where the repo's laws put invariants. The
inline form is one line and does not need a package. Rejected: KEEP the three
brands (three more concepts to audit each bump for one line of policy);
normalize unconditionally (turns a rejection into a silent rewrite at
boundaries that were validating input).

## 2026-09-14 — Evidence retention

**Question:** `research/` holds 3.7 MB of receipts. Which are committed?

**Answer:** Commit the reports (`*.md`), `tools/*.ts`, `idiom-census.mjs` and
the other generator scripts, `inventory/` (853 KB, the knowledge layer), and
proofs under 50 KB. Delete `idiom-census.json` (1.7 MB),
`retirement-G-Z-searches.json` (476 KB), and `retirement-G-Z-counts-proof.json`
(172 KB); each is regenerated by a committed script. Packet lands at about
1.2 MB.

**Rationale:** The knowledge-layer decision needs the inventory on disk; the
three dropped files are derived from it and from the repo by scripts that are
kept. Rejected: commit everything (3.7 MB against the 512 KiB Yeet capture
cap, so the PR would need the manual path); reports and scripts only (drops
the knowledge layer the packet exists to build).

## 2026-09-14 — Performance acceptance: three-package baseline, ratchet on instantiations

**Question:** What counts as "faster" for the schema-performance goal?

**Answer:** Commit the rc.115 `tsc --extendedDiagnostics` numbers as the
baseline: @beep/schema 1,307,910 instantiations / 0.529 s; repo-cli
7,786,120 / 3.717 s; law-practice-domain 1,289,820 / 0.659 s. Acceptance for
each retirement PR is no regression in instantiations or check time on any
of the three, with a measurable drop expected once LiteralKit and the codec
statics are gone. Mirror one or two upstream typeperf fixtures so the
@beep/schema numbers are comparable to what effect main measures.

**Rationale:** The instantiation load lives in repo-cli and the domain
packages, so a fixture-only gate would miss the regressions that matter.
Rejected: upstream typeperf fixtures only (blind to the consumers); no
numeric gate (a codemod that spreads `S.is(member)` widely could regress
unnoticed).

## 2026-09-14 — Doctrine lands ahead of the goal PRs

**Question:** When does the "Upstream-First Foundation/Modeling" entry land in
`standards/architecture/11-evolution-and-deprecation.md`?

**Answer:** Ahead of the goal, as its own small docs PR. Every retirement PR
cites it; the wording (same intent ⇒ retire, adapt consumers, same PR, no
thin re-export) is reviewed once. The same PR rewrites the AGENTS.md
LiteralKit line so the standing rule stops contradicting the work in flight.

**Rationale:** Reviewers of the LiteralKit codemod should read a rule that
already exists. Rejected: with the first retirement PR (a standards edit
buried in a large codemod); after closeout (interim PRs cite a rule that does
not exist and AGENTS.md contradicts them meanwhile).

## 2026-09-14 — First gate cut: threshold on confidence and reach

**Question:** Of the 21 candidate idiom families, which become schema-first
detectors in the first cut?

**Answer:** A family becomes a detector when its census confidence is at
least 0.70 and it touches at least 100 files. First cut: F01 LiteralKit
wrapper retirement, F03 custom key/default combinator wrappers, F13
schema-derived guards versus duplicated predicates, F24 opaque
defect/equivalence wrappers, plus the F26 correction, which retires the
stale `SFV4-tagged-error-equivalence` rule (`SchemaFirstDetectors.ts:1128`)
and its remediation string. F15 codec statics joins once the
selective-statics goal has merged. F05 throwing decoders, F06 recursion, and
F04 opaque checks (confidence at or below 0.55) are written into the
schema-first skill as idioms, not gated, until a focused probe raises their
confidence. Ranks 10 through 21 are dropped from the gate. New rules extend
`SchemaFirstDetectors.ts` as `SFV4-*` ids with ratchet baselines; there is
no parallel gate.

**Rationale:** The threshold admits exactly the families whose false-positive
rate the census measured as low and whose reach justifies a rule; the rest
would ship as noise the ratchet merely freezes. Rejected: F01 and F26 only
(F03, F13, F24 keep drifting for a release train); all 21 with baselines
(nine families at confidence 0.55 or lower become frozen noise).

## 2026-09-14 — Inventory home: repo-cli fixture per RC, generator with --check

**Question:** Where do the `schema-inventory/v1` rows live once the packet
graduates, and how are they refreshed on each effect bump?

**Answer:** The rows move to
`packages/tooling/tool/cli/test/fixtures/effect-schema-rc115/inventory/*.jsonl`,
one directory per RC, following the `effect-vitest-rc112` and
`effect-vitest-rc115` precedent. The packet's `research/tools/schema-inventory.ts`
and `verify-schema-inventory.ts` move into repo-cli as the generator and
verifier. A bump runs the generator against `.repos/effect` at the new sha and
commits the new directory. Hosted CI verifies row shape and the pinned sha
only; `--check` against the live checkout is local, since hosted runners have
no effect checkout. Row identity stays `(module, symbol, kind)`.

**Rationale:** The gate must not read a path inside an exploration packet,
which the pipeline treats as frozen after graduation, and a fixture plus one
script does not justify the new-package governance gates. Rejected: keep the
inventory in the packet (shipped gate depends on a frozen packet path); a new
workspace package (pays package gates for a fixture and a script).

## 2026-09-14 — PR batching revised: a phase train supersedes one PR

**Question:** The 2026-09-12 entry "PR batching" chose one PR for everything.
The doctrine-ahead and ship-the-statics-goal-first rulings make that
impossible. What replaces it?

**Answer:** A six-phase train, one goal packet: P0 doctrine docs PR; P1
knowledge layer (inventory fixture + generator); P2 LiteralKit codemod; P3
retirement train, grouped by upstream target with consumer migration in each
PR; P4 gate cut; P5 statics retirement and performance close after
`goals/schema-utils-selective-codec-statics` merges. The gate reaches zero in
the last PR. This supersedes the 2026-09-12 "PR batching" entry.

**Rationale:** Sequencing constraints from two later decisions, not a change
of taste; a 600-plus-file PR would also sit on the manual `gh pr` path
behind another goal's merge. Rejected: one PR for everything except doctrine
(long wait, one giant review); two PRs sequenced behind the statics merge
(same wait, no earlier gate).

## 2026-09-14 — Appetite and shape sign-off

**Question:** What bounds the goal, and is `BRIEF.md` shaped?

**Answer:** One packet, six phases, roughly six weeks of part-time attention
plus Codex lane volume, landing before the next effect RC bump forces a
re-audit. If a bump lands mid-train, the bump PR regenerates the inventory
directory and the train continues on the new sha. `BRIEF.md` (drafted
2026-09-14) matches the user's picture; stage advances to decompose.

**Rationale:** The bound keeps the audit fresh against upstream
`51d4a2f08a`. Rejected: tighter (P0–P2 only, leaving a gate with a non-zero
backlog); looser (scope-bound only, so an RC bump could rot the packet).

## 2026-09-15 — LiteralKit reopened at decompose: ADAPT, not RETIRE

**Question:** The 2026-09-14 "LiteralKit retires" ruling judged same-intent
on the schema facet (`S.Literals`) while the F01 research row marked the
static-member consumer census UNVERIFIED. A census run at decompose
(kit-only, excluding the kit's own sources, `rg` over `packages` and
`apps`) shows the statics are the product, not ergonomics:

| Facet | Lines | Files | Upstream covers it |
| --- | --- | --- | --- |
| `LiteralKit(` construction | 1,521 | 587 | yes (`S.Literals`; the kit already calls it) |
| `.Enum.<Key>` | 1,172 | 227 | no |
| `.is.<name>` | 603 | 259 | no (only index-based `S.is(members[i])`) |
| `.Options` | 395 | 212 | yes (`.literals`) |
| `.$match(` | 243 | 143 | no record form for bare literals (`Match` has `valueTags` for tagged values only) |
| `.thunk.<name>` | 65 | 15 | `Function.constant` |
| `.pickOptions` / `.omitOptions` | 52 | 34 | `.pick`; omit is an explicit pick of the complement |
| `.toTaggedUnion(` | 36 | 27 | no: all 27 sites use a custom tag; `S.TaggedUnion` is `_tag`-only |
| `.HashSet` | 15 | small | call-site `HashSet.fromIterable(X.literals)` |
| `enumMapping` | 12 | 4 | two production consumers (`TurboCache.ts`, `Md.semantic-inspector.ts`) |

Which facets retire, which stay, and what the ruling means for the doctrine?

**Answer:** Facet by facet, interviewed 2026-09-15 with `/grill-with-docs`:

- RETIRE `Options` (rename to `.literals`), `pickOptions` / `omitOptions`
  (`.pick(...).literals`; omit becomes an explicit pick of the complement at
  its 13 sites), `HashSet` (call-site derivation; also stops building a
  HashSet for every kit), `thunk` (`F.constant(X.Enum.k)`, native in v4).
- KEEP `Enum`, `is`, `$match`, `toTaggedUnion`, `LiteralToKey`. These are
  the keyed value API; upstream has nothing keyed by literal, no record-form
  match for bare literals, and no custom-tag record form for tagged unions.
- DROP `enumMapping` and with it the `M` type parameter on `LiteralKit`,
  `IsGuards`, `EnumType`, `MatchFn` and the collision/coverage validators.
  The two production consumers move to default `LiteralToKey` keys or a
  local map. This is the one measurable type-check win in the trim.
- FIX the static re-attachment: today `attachHelperDescriptors` wraps only
  `annotate` (`LiteralKit.schema.ts:608`), so `check` and `pipe` silently
  drop the statics. The trim overrides upstream's public `rebuild(ast)` on
  `Bottom`, which every derivation calls.
- `MappedLiteralKit` gets the same ADAPT: its schema facet is already
  `S.Literals(from).transform(to)`; its `From`/`To` kits lose the same four
  facets and keep the keyed directional API. About 14 production files,
  mostly the HttpStatus family.
- Doctrine: the P0 §11 entry judges intent on the consumed surface, facet by
  facet. A concept whose dominant facet upstream does not cover is ADAPT
  (trim the covered facets); otherwise RETIRE as before. Every RETIRE over
  100 consumers (`Number` 361, `Int` 143, `Unknown` 128, `Opaque` 103) runs
  a static-facet census before its PR opens; an uncovered dominant facet
  flips the row to ADAPT in the goal's decision log.
- AGENTS.md Code Laws line: narrow, do not replace. `LiteralKit` stays the
  default for named literal domains; one clause adds `S.Literals` for
  anonymous inline unions never referenced by name. The `as const` note
  stays. The user's global rule needs no change and no flag.
- F01 leaves the gate cut. Once the trim deletes the facets the type checker
  rejects any leftover use, so a detector would be frozen at zero. The cut
  is F03, F13, F24 plus the F26 deletion; `literal-kit-const-assertion`
  stays.
- P2 becomes one trim PR: kit internals and consumer codemod together
  (about 250 files, likely under the Yeet capture cap), done when the type
  check passes and no retired name remains, with a before/after
  `--extendedDiagnostics` number. The ts-morph rewrite engine it builds is
  reused by the P3 numeric and unknown groups.

Audit totals become 50 RETIRE, 6 UNSURE (retire), 4 ADAPT, 77 KEEP.

**Rationale:** Upstream owns the left factor of
`LiteralKit<L> = S.Literals<L> & {Enum, is, $match, toTaggedUnion}` and
nothing in the right factor, and the right factor is where 2,000-plus lines
of consumers live. Retiring it would inline bare strings at 1,172 `Enum`
sites and index lookups at 603 guard sites, a readability regression the
performance decision forbids without a number, and the number was
UNVERIFIED. Rejected: retire as ruled on 09-14 (trades named references for
one fewer concept; the same-intent test was applied to the wrong facet);
keep every facet (four thin aliases over upstream values, each audited every
bump); migrate `$match` to `Match` chains (native and exhaustive, but loses
the record form and splits the key scheme from `Enum` and `is`); retire
`toTaggedUnion` to `S.toTaggedUnion(tag)` over explicit structs (27 sites
hand-write structs and lose literal coverage). Supersedes the 2026-09-14
"LiteralKit retires; its helpers are ergonomics" entry, including its
MappedLiteralKit sentence.
