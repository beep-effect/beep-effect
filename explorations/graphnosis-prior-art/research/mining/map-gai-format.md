# Mapping — Graphnosis `.gai` format / integrity / conformance → beep-effect

Checkout mapped: `/home/elpresidank/YeeBois/projects/beep-effect15` (branch `main`, clean at `d1dfc4b3c1`).
Source survey: `scratchpad/graphnosis/survey-gai-format.md`. Source repo: `~/YeeBois/dev/Graphnosis`.

Rule followed throughout: **no `gap` claim without a search command that returned nothing**, and no
`already-have` without a concrete path/symbol read in this session.

---

## 0. Orientation facts established first

- Landing packet **exists and is live**: `explorations/graphnosis-prior-art`, stage `research`,
  status `active` (`ops/manifest.json:6-8`). `CAPTURE.md` already names `maxAutonomy` and the
  determinism-tiered tool taxonomy as "the two that look least like anything we already have" —
  this mapping tests that guess.
- **beep-effect owns no binary container format.** Verified:
  `rg -n 'timingSafeEqual|createHmac|hmac|Hmac|HMAC' --glob '!node_modules' -g '!**/dist/**' -g '!*.md' -g '!*.json'`
  → **zero hits**. `rg -n -i 'msgpack|magic bytes|magicBytes'` → only IANA media-type data tables and
  the graphnosis CAPTURE. So every finding about *bytes* maps by analogy onto beep's **versioned JSON
  artifact envelopes** and its **schema-decode boundary**, not onto a real container.
- **beep-effect's versioned-artifact surface is large.** `rg -no '"[a-z-]+/v[0-9]"'` returns 40+
  distinct `"<family>/vN"` envelope ids (`fallow-report-envelope/v1`, `yeet-verdict/v2`,
  `qa-inventory/v1`, `hook-pulse/v1` **and** `hook-pulse/v2`, `initiative-manifest/v1` **and** `/v2`,
  `epistemic-grant-set/v1`, `architecture-fixture-manifest/v1`, …). These are declared as
  `schemaVersion: S.Literal("<family>/vN")` (e.g. `Sweep.schemas.ts:182,349`, `Verdict.ts:385`,
  `AttemptJournal.ts:41,72`, `goals/fallow-*/ops/validate-packet.ts`). So the family/revision split
  Graphnosis argues for **already exists textually** — the question is what readers *do* with it.

---

## 1. Per-finding reasoning

### gai-01 — "one break, once" + must-understand `requires[]` instead of version bumps → PARTIAL

Searches:
- `rg -n 'schemaVersion: S\.|S.Literal\("[a-z-]*/v'` → 30+ sites, all hard `S.Literal` pins.
- `rg -n 'provides|requires' packages/tooling/tool/cli/src/commands/Goals/*.ts` →
  `Goals.schemas.ts:404-405` — a real `{ provides: ReadonlyArray<CapabilitySlug>, requires: ReadonlyArray<CapabilitySlug> }`
  model with a disjointness law.
- `goals/knowledge-surface-automation/research/p1-manifest-capability-extension-design.md:220-236`
  spells out full capability-negotiation semantics: AND over requires, OR over providers,
  *"An empty requires set is vacuously satisfied"*, orphan `fog:<capability>` nodes, fail-closed
  frontier.

**Verdict.** beep already *speaks* must-understand capability negotiation — but only for **goal
packets** (what work can start), never for **data artifacts** (what a reader can open). Every
artifact envelope extends by version bump; a `/v2` producer breaks every `/v1` consumer hard, with
no way to add a field that old readers may ignore or a feature tag they must refuse on. And the repo
has already spent one break (`yeet-verdict/v2`, `hook-pulse/v2`, `initiative-manifest/v2`) without a
written doctrine bounding the next.

The transferable rule for beep is a small one: split `schemaVersion` into a stable family id plus an
additive `requires: ReadonlyArray<FeatureTag>` on the envelope, and write the all-or-nothing /
admissible-reasons discipline into `standards/`. Not a gap (the vocabulary exists), not
already-have (it is applied to the wrong noun).

### gai-02 — magic identifies family, version identifies revision → PARTIAL

The three-layer split (family / revision / capability) is **half-present**: `"<family>/vN"` is
literally a family+revision string. What is missing is the *failure-message* consequence Graphnosis
argues from, and this is verifiable in beep:

- `packages/foundation/ui-system/dock/test/DockEngine.test.ts:129-156` — a **legacy** snapshot and a
  `version: 2` (newer) snapshot both fail with the byte-identical
  `{ _tag: "DockInputError", boundary: "snapshot" }`.
- `DockEngine.service.ts:47-57` — `DockInputError` carries only `boundary` + the raw Effect
  `cause.message`. A UI consumer cannot distinguish "layout saved by a newer build" from "layout is
  garbage", and the destructive default for a UI is to reset the layout.
- `Pandoc.model.ts:36` — `PandocApiVersion = S.NonEmptyArray(S.Int.check(isGreaterThanOrEqualTo(0)))`.
  `Pandoc.codec.ts:1035` reads `wire["pandoc-api-version"]` straight into the model; grep for any
  comparison against `DEFAULT_PANDOC_API_VERSION` (`Pandoc.model.ts:71`) in codec/mapping → **none**.
  A future Pandoc AST is accepted and read as if it were 1.23.1 — antipattern A3, live in beep.

So the beep analogue of "version skew reported as wrong-format" is "version skew reported as
undecodable", and it is real in at least two shipped readers.

### gai-03 — error taxonomy keyed on consumer ACTION, version-skew carved out → PARTIAL

What beep already has, better than Graphnosis:
- Every typed error is a `TaggedErrorClass`/`S.TaggedErrorClass` from `@beep/schema`
  (`standards/effect-laws-v1.md:18` makes native `Error` illegal in production source). The
  discriminator is the **string `_tag`**, so Graphnosis's whole `instanceof`-does-not-survive-bundlers
  argument is already answered by construction.
- Per-error action hints exist in places: `OntologyToolkit.ts:142,163,187,207` carry
  `guidance: S.NonEmptyString` + `recoverable: S.Literal(true)`; `DmsMirrorDisconnected.ts:26`
  carries `retryable: false`; `packages/drivers/xai` maps transport failures to
  `error.reason.isRetryable`.

What is missing — searched and absent:
- `rg -n 'codeClass|isCorruption|isVersionSkew|errorClass|ErrorClass'` → only `TaggedErrorClass` /
  `StatusCauseTaggedErrorClass` name matches, **no action-axis classifier anywhere**.
- `rg -n -i 'unsupported version|version skew|VersionUnsupported'` → no typed error in
  `packages/**` distinguishes version skew from malformed input.
- `explorations/effect-orchestration-patterns/RESEARCH.md:132-133` already routes a shared
  `isDefect`/`isRetryable` foundation helper to `@beep/schema`, and `RESEARCH.md:137` records an
  adversarial finding that the naive parse-is-defect rule is **wrong** for LLM output. That packet
  is the right home; today it plans a *retryability* axis, not a *what-should-the-consumer-do* axis
  with version-skew carved out.

Two concrete beep misroutes verified this session:
1. `DockEngine` (above) — newer snapshot ≡ corrupt snapshot.
2. `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:539-542` —
   `Effect.orElseSucceed(() => unreadableArtifact(path, "verdict artifact could not be decoded"))`.
   A `yeet-verdict/v1` file left by an older repo-cli, a `/v3` from a newer one, and a truncated
   file all collapse to one state. Given the auto-memory entry "stale artifact false greens", this
   is the exact class the repo already bleeds from.

### gai-04 — frozen messages + source scan with a negative and a non-vacuity check → PARTIAL

- beep **has** source-scanning gates: `packages/tooling/tool/cli/src/commands/Laws/{EffectFn,EffectImports,NoNativeRuntime,SchemaDiagnostics,TerseEffect,FrozenGrantSet,AllowlistCheck}.ts`.
  `FrozenGrantSet.ts:270` is a repo-local construction law — a source scan enforcing a domain
  invariant that types cannot.
- beep is **fluent about vacuity**: `goals/agent-execution-authority/README.md:178,325`
  ("Non-vacuity was demonstrated by breaking things, not argued"),
  `goals/jsdoc-carrier-migration/SPEC.md:272` and `GOAL.md:54` (a zero-legacy check that "would pass
  vacuously" without a generated-inclusive mode), `standards/schema-first.inventory.jsonc:326,346,366`
  (three schemas excepted from property tests *because* the property would be vacuous),
  `goals/standards-remediation/ops/reports/FINAL/final-a.md:34` ("5/10 failed, confirming the
  fixtures are not vacuous").
- What is absent: `rg -n -i 'do not reword|never reword|frozen.*message|message.*frozen'` → **zero
  hits in `packages/**`**. No message string is declared a compatibility surface, and no *law scanner
  asserts its own regex still matches anything*. The scanners are the thing at risk, not the tests.

Live exposure: `AGENTS.md:57` instructs every agent to poll until `bun run beep yeet monitor` reports
the literal `merge-ready: yes`. That prose string is a machine contract with no freeze policy and no
test pinning it. Same shape as the Graphnosis incident, just with agents as the shipped consumer.

### gai-05 — authenticate before parse, framing from caller intent → PARTIAL (low value)

No MAC exists (search above). But the *ordering discipline* does, in the one place it matters:
`packages/workspace/server/src/SourceText/WorkspaceSourceTextResolver.ts:70-90` — `verifyDigest`
against the pinned `SourceTextDigest` and `verifyExtractor` against the pinned
`SourceTextExtractor{name,version}` both run **before** extraction, fail-closed with typed reasons
(`source-digest-mismatch`, `text-digest-mismatch`, `extractor-unavailable`).
`GrantSet.model.ts:1-20` says the frozen set is "re-verifiable at any read"
(`verifyFrozenGrantSetDigest`), and `ExecutionRecord.model.ts:567,788` re-derive record hashes.

What is missing is the general statement — no law says "integrity check over raw bytes precedes
deserialization" — and the specific trick (derive framing from the caller's intent, never from the
untrusted self-description) has nowhere to land because there is no self-describing container.
Cheap to record as doctrine; nothing to build today.

### gai-06 — derived state out of the artifact, deriver identity in, fail closed → PARTIAL (high value)

**Already have, at the document layer.** This is the strongest already-have in the set:
- `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts` defines `SourceTextExtractor`
  and `SourceTextDigest` as first-class provenance values.
- `WorkspaceSourceTextResolver.ts:80-90`: `verifyExtractor` decodes `{name, version}`, compares by
  `S.toEquivalence(SourceTextExtractor)`, and on mismatch fails
  `"Pinned extractor ${expected.name}@${expected.version} is unavailable."` — Graphnosis's
  `AnalyzerMismatchError`, already shipped.
- `WorkspaceSourceTextResolver.ts:128-134`: an extraction whose engine reports **no** version fails
  `extractor-unavailable`. Absence is not permission.
- `goals/citation-verified-span-substrate/SPEC.md:75-76,88-89,132` makes digest/version retention
  and fail-closed drift an acceptance criterion, with `normalization/engine version` persisted.
- `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:449` renders
  `detector@detectorVersion` — the deriver's identity is surfaced to the human.

**Missing, at the retrieval layer.** `@beep/wink` is beep's TF-IDF/BM25 analogue:
`WinkCorpus.service.ts:243,431,519-543` builds a corpus session around a `BM25Config{b,k,k1,norm}`
and `normalizeTokenText` — the config lives in **session state only**, nothing persists it and
nothing pins it to a stored corpus. `goals/hybrid-retrieval-fusion-core/SPEC.md` promises
deterministic tie-breaking (`:14,82,119`) but never mentions analyzer identity —
`rg -n -i 'analyzer|tokeniz|idf|embedding' goals/hybrid-retrieval-fusion-core/SPEC.md` returns one
incidental line (`:108`). `rg -n 'embeddingModel|analyzerId|tokenizerVersion|indexVersion'` over
`packages/**` → nothing.

`explorations/model-artifact-admission` (stage `capture`) is the *same rule generalized to models*:
"bind qualification to the exact model, adapter, modality, prompt, wrapper, decoding configuration,
and artifact digest," with an open question about hosted mutable models. Graphnosis's measured
consequence — every A/B retrieval number was a measurement of which loader ran — is the argument that
packet is missing and the reason to extend it to analyzers/indexes, not just models.

### gai-07 — validate at the deserialization funnel, bound from the proof → PARTIAL

Part (a) is already-have: schema decode *is* the funnel
(`standards/effect-laws-v1.md:24` law 13; the repo-wide `S.decodeUnknownEffect` boundary-decoder
convention; the auto-memory "schema-is-truth" doctrine), and the `crispen` skill exists specifically
to absorb invariants **into** schemas.

Part (b)/(c) is the gap and it has a verified beep instance — see the "single funnel" antipattern
below (`gai-ap-invariant-door`). Searches: `rg -n -i 'tighten|retroactiv|existing rows'` over
`standards/**` and `packages/**` → nothing about a schema tightening bricking already-persisted data;
`rg -n 'between\(0, ?1\)|UnitInterval'` shows `UnitInterval` used for weights/scores without any
recorded derivation of *why* that bound rather than the downstream algorithm's requirement. The
transferable law: **an acceptance bound is chosen from what downstream consumers require, not from
what upstream writers happen to emit, and refusing to open existing data is a bug of equal severity
to accepting bad data.** `explorations/domain-layer-hardening` (stage `graduate`, "end on an approved
plan, not code") is the packet that audits every slice's domain/schema layer — this is one rubric row.

### gai-08 — conformance declared per layer → ALREADY-HAVE (of the transferable half)

The format-conformance framing is moot: beep publishes no format for third parties
(no `spec/` dir, no shipped fixture bytes, no external implementer).

But the *move* — refusing one undifferentiated claim, splitting it into independent layered claims,
and stating that a lower claim is complete rather than partial — is already repo doctrine:
`goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md:34-38` — **"seven
independent typed verdicts (shape validity, anchor fidelity, semantic stance, source
authority/currentness, human disposition, action authorization, release); none implies another."**
That is a stronger statement than L1/L2/L3, because it is a lattice rather than a ladder and so
cannot become the shaming device §8.3 had to defend against. Also
`goals/agent-execution-authority/README.md:51-58` ("chain verification says nothing about outcome
completeness") and `goals/oip-web-launch/SPEC.md:17` ("merge-ready does not mean approved for public
launch"). Nothing to build; worth citing as prior art when someone proposes a level ladder.

### gai-09 — `maxAutonomy`: authority ceiling stored in the artifact, min-composed, fail-closed → PARTIAL (highest value)

Brick that exists (`goals/agent-execution-authority`, lifecycle `completed-retained`):
- `packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts` — `DraftGrantSet` /
  `FrozenGrantSet` with the freeze expressed in **types** (`addGrant` takes only Draft, evaluation
  takes only Frozen), sealed by `GrantSetDigest` (SHA-256 over the versioned canonical encoding) and
  by a repo law banning `FrozenGrantSet.make` outside its module
  (`packages/tooling/tool/cli/src/commands/Laws/FrozenGrantSet.ts:270`).
- `ExecutionVerdict`, `ExecutionGrant`, `PolicyRevision`, `ExecutionRecord` hash chain; default-deny
  at the MCP boundary (`apps/professional-desktop/server/OntologyMcpTransport.ts:136,200`),
  `OntologyTierGateRefusal` fail-closed refusals.

Why it does **not** cover the finding, from the module's own words
(`GrantSet.model.ts:14-18`): *"Grants derive only from session-static inputs (config, policy
revision, caller identity), **never from tool output**. That is what makes the freeze sound."*
The ceiling is therefore a property of the **session**, not of the **artifact**. Consequences:
- A skill/procedure moved between hosts arrives with its steps and without its limit — precisely
  Graphnosis's motivating case. beep already moves such artifacts:
  `packages/tooling/tool/cli/src/commands/Skills/Skills.schemas.ts` ships a skill lockfile with
  `SkillSnapshotAlgorithm` content hashes and GitHub source provenance
  (`schema-catalog.generated.jsonc:28269-28285`), and `infra/src/OpenClawArtifacts.ts:35,69-94`
  ships an instruction-only proof skill with a SHA-256 integrity value. **Neither carries an
  authority ceiling.** `rg -l -i 'maxAutonomy|autonomyLevel|autonomy'` over `packages/**` → **zero
  source files**; every hit is docs/packets/corpus.
- No min-composition rule anywhere: `rg -n 'AuthorityCeiling|ceiling'` over `packages/**` returns
  only `schema-catalog.generated.jsonc:20482` ("Server-owned static ceilings for ontology tools") —
  server-owned, i.e. the opposite of travelling with the data.
- `goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md:56-80` sets a global v1
  policy ("all agent-produced claims remain candidate state") and says autonomy "should be
  policy-scoped by organization, workspace, role, and action type" — again a policy axis, never an
  artifact-carried maximum.

Landing: `explorations/agent-governance-control-plane` (stage `capture`, active) whose spark is
"explicit agent-role authority, gated work lifecycle, decision-complete handoff artifacts" and whose
open question is exactly which parts belong in repo-wide law vs a separate capability. The five
rules (ceiling never a grant; min under composition; survives transport; absence = most restrictive;
a node cannot raise its own ceiling) drop into that packet unmodified.

### gai-10 — `(id, rev)` as merge's carrier + ids from position + `buildInstant` → PARTIAL

**Carrier: already have, and stronger.**
- `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:117,141,163` —
  `logicalKey` (stable id) + `version: PosInt` ("Monotonic version number within the logical edge") +
  `supersedesId` self-FK. That is `(id, rev)` with lineage.
- `packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:1-35` — the
  id is a *total canonical encoding* digest precisely because "SQL treats NULL components as distinct
  under `=`, so optional scopes would silently split one logical edge into several", with
  `absentScopeMarker = "<none>"` so absence cannot collide with a real value. Graphnosis's `(id,rev)`
  has no equivalent care here.
- `EdgeVersion.table.ts:1-10` — the **open-head partial unique index** enforces exactly one head per
  `logical_key` in SQL, and `Contradiction` is a first-class entity
  (`packages/epistemic/{domain,tables,ui}/**/Contradiction*`) rather than a `contradicts` self-loop.
  beep resolved the three-wrong-moves problem by *forbidding* multiple heads and giving conflict its
  own table; Graphnosis resolves it by *permitting* multiple heads. Different, defensible, already
  decided.

**Reproducibility: gap.** Searches:
- `rg -n -i 'buildInstant|deterministicId'` → zero.
- `standards/effect-first-development.md:235` is the entire law: *"Avoid direct `Date.now()` and
  `Math.random()` in domain logic."* An "avoid" with no injected build instant is exactly the half
  Graphnosis names as most easily forgotten.
- One place already does it right for a different reason:
  `packages/drivers/uspto-mcp/src/UsptoHandlers.ts:52-66` resolves `handleId`/`expiresAt` via
  `Random`/`DateTime` "Effect-injected, testable ... rather than calling `crypto.randomUUID()`/
  `Date.now()` directly." And `packages/law-practice/server/src/PracticeKg.schemas.ts:231` claims a
  stable sort "that makes a rebuild byte-identical", proved at
  `PracticeKg.projections.test.ts:430`. So byte-reproducible rebuild is a live beep goal — with no
  repo-wide id-allocation or build-instant contract under it.
- No position-derived id scheme: `rg -n -i 'ordinal|sectionPath'` over
  `explorations/deterministic-doc-structure-extraction/*.md` → zero.

`goals/identity-iri-core` is `completed-retained`, so the landing is `explorations/identity-as-iri`
(the live packet on identity) for the `id = H(graphId ‖ sourceFile ‖ sectionPath ‖ ordinal)` +
`buildInstant` half.

### gai-11 — conformance fixtures shipped as bytes, majority malformed, in the publish gate → PARTIAL (low value)

- The "third implementation" motivation does not transfer: beep ships no format.
- The rejection-first discipline **does** exist as tests:
  `rg -c 'it\(.{0,4}(rejects|refuses)'` — `Pandoc.codec.test.ts` **19**, `files-command.test.ts` 12,
  `FilePath.test.ts` 8, `Rdf.test.ts` 7, `Contradiction.test.ts` / `ExecutionAuthority.test.ts` /
  `EdgeAuthorityCommands.test.ts` 5-6 each.
- Fixtures as data exist but thinly: `packages/tooling/tool/cli/test/fixtures/` holds only
  `agent-effectiveness`, `architecture-operation-plan`, `skills-provenance`; the
  architecture-operation-plan dir has exactly one file (`accepted-work-item-manifest.json`) and it is
  a **positive** fixture.
- The publish-gate wiring is already stronger than Graphnosis's: `bun run beep yeet verify` runs the
  full proof before publish, and hosted required checks gate the merge (`AGENTS.md:40-58`).

Net: the wiring is solved, the negative-fixtures-as-data half is thin. Low value because the payoff
(a third-party implementer) does not exist for beep.

### gai-12 — corrupt a good fixture, then RE-FRAME it so one gate can fail → PARTIAL

The literal technique (recompute headerLen/checksum after mutating) has no target — no checksummed
envelope. The *principle* — a negative fixture must fail at the gate under test, not at an earlier
one — is live wherever beep stacks gates: schema decode → domain invariant → policy gate
(`ClaimGate`, `TierGate`, `ExecutionAuthority`), and DB CHECK constraints behind all of them.

beep already practises it in one place, in impressive detail:
`goals/jsdoc-carrier-migration/tasks/tasks.jsonc:72` designs anchor-collision and anchor-drift
fixtures where each mutation (reorder / add-ahead / remove / edit-in-place) must produce a *specific*
distinct failure (sourceHash mismatch, bijection failure, orphan record, re-title). That is exactly
single-defect isolation. It is packet-local craft, not a repo convention, and the ratchet/law
scanners (`Laws/*.ts`) have no negative fixtures of this shape.

### gai-13 — normative Known Weaknesses + postmortems promoted into spec text → ALREADY-HAVE

- Weaknesses stated normatively, in the artifact that would otherwise overclaim:
  `goals/agent-execution-authority/README.md:51-58` — *"Two limits on the audit guarantee, stated
  because they are easy to overclaim… a resealed tail or a deleted suffix still verifies intact,
  because nothing anchors the chain tip… outcome rows are not part of the decision chain."*
  Also `README.md:152` ("recorded as a follow-up, not claimed here"),
  `goals/voice-composer-slice/SPEC.md:72`, `goals/oip-web-launch/SPEC.md:17`,
  `goals/effect-jsdoc-quality/research/P0-baseline-check.md:118`,
  `goals/yeet-agent-ergonomics/research/grounding.md:44` + its reflection.
- Postmortem promotion is **law**, not habit: `AGENTS.md` — *"Friction is a first-class output: when
  work is slower, harder, or riskier than it should be, record a receipt … in the active packet's
  ledger (`research/OPPORTUNITIES.md`) at the moment it happens, never saved for closeout."*
  Plus `goals/*/history/reflections/` (schema-enforced by `bun run beep lint reflection-artifacts`)
  and `~/.claude/memory/beep-effect/` as the cross-session promotion target.

beep does this better than Graphnosis: the receipt is mandatory and timestamped at the moment of
friction, rather than being a section someone remembers to write.

### gai-14 — one canonical hash frozen by the format; refuting the reader's wrong inference → ALREADY-HAVE (and beep's version is better)

(a) `packages/epistemic/domain/src/values/internal/CanonicalJson.ts:1-12` carries the *identical*
argument, unprompted: *"One implementation on purpose — `canonicalJson` feeds both the grant-set seal
and the ledger record seals, so a second private copy could drift and silently split the digests
those seals are supposed to share."* It is package-private (the `values` barrel never re-exports it;
the exports map nulls `./values/internal/*`).

But beep does **not** freeze the algorithm — it versions the digest input, which is strictly better:
- `GrantSet.model.ts:40-43` — *"Digest version prefix. Bump whenever the canonical encoding changes
  so old and new digests can never collide in a table that holds both."* (`epistemic-grant-set/v1`)
- `ExecutionRecord.model.ts:40-44,446-447` — `digestOf(version, canonical) = sha256(version ‖ "\n" ‖ canonical)`
  over `epistemic-execution-decision/v1` / `…-outcome/v1`.
- `LogicalEdgeIdentity.model.ts:26-30`, `EvidenceVerification.model.ts:20,117` — same pattern.
Graphnosis's DJB2 is frozen forever because a change silently rewrites every `contentHash`; beep's
prefix makes the change *loud and non-colliding*. Worth writing down as the counter-recommendation.

(b) The anti-inference documentation pattern is repo-wide:
`standards/architecture/04-rich-domain-model.md:97` (a section literally titled *"Pure Does Not Mean
Effect-Free"*), `approval-and-autonomy-policy.md:34-38` ("none implies another"),
`agent-execution-authority/README.md:58` ("says nothing about outcome completeness"),
`goals/fallow-advisory-ratchets/PLAN.md:26`, `explorations/docx-roundtrip-interop/BRIEF.md:76`.
And the confidentiality instance Graphnosis writes about has a beep counterpart in the standing OIP
rule (pre-publication patent text never leaves the device) — a policy, not a doc pattern, but the
same "the artifact being easy to move is what makes it easy to exfiltrate" logic.

---

## 2. Antipatterns mapped (only where beep risks the same mistake)

### `gai-ap-version-gate` (Graphnosis A3) — a version field with no gate → PARTIAL

`PandocApiVersion` (`Pandoc.model.ts:36`) accepts any non-negative int tuple.
`Pandoc.codec.ts:1035` assigns `wire["pandoc-api-version"]` into the document and
`Pandoc.codec.ts:1573` writes it back out; **no comparison against `DEFAULT_PANDOC_API_VERSION`
exists** (grep of codec + mapping for `apiVersion` returns only those two sites plus the model
declaration and the `pandocToDocument` default at `Pandoc.mapping.ts:1282`). A future Pandoc AST
whose block shapes changed meaning is accepted and read as if it were 1.23.1 — the reader "produces
a graph that is wrong rather than absent". Same shape in `DockEngine` (version accepted only for
`version: 1`, but the failure is indistinguishable from corruption) — see gai-02/gai-03.

Contrast the one place beep gets this exactly right: the OpenClaw applicator's future-version guard,
which refuses an older binary against newer state with a distinct message
(`infra/src/OpenClaw.ts:1739`; proof logs at
`goals/openclaw-workstation-agent/history/p0/spike-4-upgrade-rollback/logs/v2-sequence.log:31`).

### `gai-ap-invariant-door` (Graphnosis A5) — the funnel enforces one invariant and not the other → PARTIAL, high confidence

`packages/epistemic/tables/src/entities/EdgeVersion/EdgeVersion.table.ts:1-10` states it plainly:
*"The bitemporal constraints that make this table trustworthy — the ordered interval CHECK
constraints, the endpoint-kind CHECK constraints, the `logical_key` exclusion constraint, and the
open-head partial unique index — are owned by the raw-SQL migration rather than by Drizzle metadata,
because Drizzle cannot express them. This projection publishes the columns; the migration publishes
the invariants."*

Verified consequence: `rg -n 'S\.check|\.check\(|refine|filter'` over
`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts` → **zero hits**.
`validFrom` / `validTo` (`:157-162`) carry no ordering check and `version: PosInt` (`:163`) is
monotonic only by convention. So an `EdgeVersion` decoded from a fixture, a wire payload, an
in-memory test, or any future export path is accepted with `validTo < validFrom` or a duplicate open
head; the same value refused by Postgres. "What counts as a valid edge" depends on which door it came
through — and the domain model's own doc comments (`:56,296,392`) *describe* the CHECK constraints,
which makes the gap harder to notice, exactly as Graphnosis observed.

### `gai-ap-atomic-write-durability` (Graphnosis A6) — half already better, half a known gap → PARTIAL

Triplication half: **beep is already right**. There is exactly one primitive,
`writeFileWithinCanonicalRootAtomically` (`packages/foundation/capability/file-processing/src/PathSafety/index.ts:591`,
internals at `:493-540`): containment-check → mkdir → re-check → unpredictable temp dir beside the
destination → `writeFile(flag: "wx", mode: 0o600)` → atomic rename, with fail-closed cleanup before
promotion and best-effort after. Consumers go through it (`Session.file-store.ts:242`), and it is
documented with the adversary model.

Durability half: `rg -n 'fsync|fdatasync'` over `packages/**` → **no fsync anywhere**, and the gap is
already captured honestly at `goals/legal-document-intake/research/sync-state-model.md:149-151`
("does not currently expose a first-class fsync helper in the cited file-system surface … should
therefore add fsync-capable filesystem behavior at the app/server [layer]") with a phase model at
`:122` that names `temp_fsynced` as a state. Because there is one primitive, the fix is one edit —
which is the whole point Graphnosis's A6 makes in the negative.

### `gai-ap-stale-agent-doc` (Graphnosis A7) — a stale third truth surface → noted, not ranked

`find packages -name AGENTS.md` → **68 files**; `rg -rn 'AGENTS\.md'` over non-markdown sources
finds only the root symlink-drift guard (`package.json` `instructions:drift`, `lefthook.yml`). So the
root instruction file is machine-checked and the 68 per-package ones are not checked against
anything. Graphnosis's A7 (an agent-facing doc asserting behavior the code removed two versions ago)
is structurally available here. Kept as a note rather than a ranked mapping: the repo's laws are
already generated/verified from source (`standards/schema-catalog.generated.jsonc`,
`standards/jsdoc-documentation.inventory.md`), which bounds the blast radius.

---

## 3. What the CAPTURE guessed vs what the mapping found

`explorations/graphnosis-prior-art/CAPTURE.md:118` guessed that `maxAutonomy` and the
determinism-tiered tool taxonomy "look least like anything we already have." Confirmed for
`maxAutonomy` (gai-09, zero source hits, value 5). But two more scored high that the capture did not
flag: **gai-06's analyzer-identity rule at the retrieval layer** (beep has it for documents and not
for indexes) and **gai-03's action-axis error class** (beep has the tag mechanism and not the axis,
with two verified live misroutes). Conversely, the capture underrated how much beep already answers:
`(id, rev)` (gai-10 carrier), canonical-hash singularity (gai-14a, done better via version prefixes),
layered claims (gai-08), and known-weaknesses discipline (gai-13) are all already-have.
