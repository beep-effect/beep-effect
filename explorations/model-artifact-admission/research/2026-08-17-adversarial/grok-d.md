I'll read the MAP packet and the live provider-admission code first, then attack the first-slice digest, role vocabulary, as-of query, and referential integrity claims against what's actually there.Documents are in. Next I’ll pull the live provider, config, and admission-adjacent types so the review can cite actual fields, not the MAP’s paraphrases.Codegraph isn’t indexed here, so I’m grepping the live driver, role kits, and as-of/disposition patterns the MAP claims to reuse.The role kits and component set look underspecified. I’m checking the live Anthropic arrangement, EdgeAuthority as-of storage, and whether the first-slice status can even be expressed.The fixture’s “pinned” ID may just be an alias. I’m checking Anthropic’s live ID rules and whether any role or component kit already exists in the repo.**ARTIFACT D — MAP review.** No material findings only where noted. Citations are to the current checkout.

---

## RATIFIED-CONFLICT

**R1. `admitted` + “scoped to …” contradicts A3.**
MAP first slice: “record an `admitted`-status disposition scoped to non-matter internal tooling” (`MAP.md:29-31`). A3 (ratified): “`restricted` carries explicit eligible roles, modalities, data classes, and operational constraints” (`DECISIONS.md:42-43`). Scope lives on `restricted`. `admitted` is not given a scope payload. The MAP invents scoped-`admitted` without reopening A3.

Consequence if they ship unscoped `admitted` for `claude-opus-4-6`: A1’s matter floor is `provider-resolved-alias`, and `provider-pinned` exceeds it (`DECISIONS.md:20-23`). An unscoped `admitted` of the pinned ID is matter-eligible. The prose “non-matter” is not a constraint.

**R2. The ratified fixture identity is two unequal referents.**
Amendment (ratified): “the repo’s own live pinned arrangement (the Anthropic driver’s pinned default plus its controlled components)” (`DECISIONS.md:7-8`, `BRIEF.md:49-51`). Live code does not have one such thing:

| Referent | What it actually is |
| --- | --- |
| Driver default | `ANTHROPIC_DEFAULT_MODEL = "claude-opus-4-6"` + `maxTokens` (`Anthropic.config.ts:93`, `:115`, `:250-264`) |
| Materialized default layer | `AI_ANTHROPIC_MODEL` override at acquire (`Anthropic.service.ts:113-117`); research 01 already said bind the materialized value, not the constant (`01-hosted-identity-boundary.md:57-59`) |
| Chat path | `SYSTEM_PROMPT` + forced-tool wrapper + `toolChoice: respond` (`AnthropicTurnKernel.ts:47-54`, `:176-184`) |
| Repair path | `ANTHROPIC_REPAIR_MODEL = "claude-haiku-4-5"` (`Anthropic.repair.ts:44`) |
| Filing path | `FILING_DECISION_DEFAULT_MODEL = "claude-haiku-4-5"` (`FilingDecisionLlm.config.ts:112`; wired in `Layer.ts:209-214`) |

MAP then collapses the fixture to “the Anthropic driver’s pinned-default config as the fixture arrangement” (`MAP.md:13`). That drops BRIEF’s “plus its controlled components” and is not the live arrangement. The amendment’s parenthetical is false in this checkout.

---

## 1. Component digests of the live arrangement

**B1. The digested set is not closed.**
BRIEF’s subject is “resolved hosted identity plus every controlled component (prompt, adapter, wrapper, decoding configuration, modality set)” (`BRIEF.md:7-8`). A2’s requal triggers add tokenizer, PEFT, tool-wrapper execution semantics, capability/permission boundary, system policy, output parser, safety guardrail, evaluator/verdict logic (`DECISIONS.md:30-35`). MAP first slice demands “real component digests” (`MAP.md:27-28`) and “canonical ordering” (`MAP.md:33`) and never lists the fields.

`AnthropicLanguageModelOptions` has two keys: `model`, `maxTokens` (`Anthropic.config.ts:250-264`). `model` is identity-envelope, not a component. If the fixture digests the driver config, the only component is `maxTokens`. Then “a mutated component digest yields a NEW revision” (`MAP.md:34-35`) is “change `maxTokens`” and never exercises prompt/wrapper/parser — the components the corpus said must be bound (`02-admission-evidence-and-change-policy.md:26-30`).

If instead they digest the chat path, the closed set is still unstated, and at least these live, digest-relevant pieces exist and are unnamed:

- system prompt (`AnthropicTurnKernel.ts:47-54`)
- wrapper / tool-choice (`AnthropicTurnKernel.ts:65-70`, `:176-184`)
- output parser (`AnthropicTurnCodec` via `assistantBlockOutput`)
- retry plan (`ANTHROPIC_DEFAULT_RETRY_*`, `Anthropic.service.ts:144-149`)
- repair model + repair token budget (second arrangement)
- stream-observed `part.modelId` (`AnthropicTurnKernel.ts:126-127`) — research 01 puts resolved ID in the envelope, not in a component digest (`01-hosted-identity-boundary.md:15-18`)

Omission vs empty digest of an absent adapter/prompt/modality is unspecified. Two implementers will hash different tuples; “stable across rebuilds” is untestable until the tuple is closed.

**B2. Identity-envelope fields are not on the live config.**
Research 01 envelope: provider, service, deployment, requested ID, resolved ID, alias-resolution class, assurance tag (`01-hosted-identity-boundary.md:15-21`). Live options have a string `model` and `maxTokens`. No service, no deployment, no resolution class, no assurance tag, no Get-Model call anywhere in `packages/drivers/anthropic`. First-slice “identity-assurance evidence” (`MAP.md:29-30`) will be an operator assertion that `claude-opus-4-6` is pinned (docs say 4.6 dateless IDs are snapshots — that is a *policy* rule the MAP never records), not a provider attestation.

**B3. `ProviderInstance` is the wrong subject.**
MAP composition: “Reuse `ProviderInstance` (public identity fields; no-token law)” + “Anthropic driver’s pinned-default config as the fixture arrangement” (`MAP.md:13`). `ProviderInstance` is a CLI instance: `binaryPath`, `envVars`, `homePath`, `kind`, `label`, `lastProbe` (`ProviderInstance.model.ts:39-67`). `ProviderKind = ["claude", "codex"]` (`ProviderInstance.values.ts:46-50`). The fixture path is the HTTP Anthropic client (`Anthropic.service.ts:44-47`). There is no public-identity field on `ProviderInstance` that is the API model arrangement. “Which fields get digested” is unanswerable because the cited entity is not the arrangement.

Which of `binaryPath` / `envVars` / `homePath` / `label` / `lastProbe` are “public identity”? Unstated. Digesting `lastProbe` would mint revisions from auth observations, which research 01 forbids (`01-hosted-identity-boundary.md:24-28`).

**M1. Domain cannot import the driver.**
`ProviderKind` docs: “the domain must not import drivers” (`ProviderInstance.values.ts:32-33`). A `ModelArrangementRevision` in `agents-domain` cannot import `@beep/anthropic` to read the pinned default. MAP never says which package owns the digest builder or the fixture. That is a topology decision the first slice cannot dodge.

**M2. Digest payload vs `ProductEntity`.**
“Content-addressed” (`MAP.md:13`) + “stable across rebuilds” (`MAP.md:33`) with no payload type. If they hash an entity that includes `createdAt` / `id` / `orgId` (the `ClaimDisposition` shape they cite includes those via `identityFields`, `ClaimDisposition.model.ts:91`), rebuilds are unstable by construction. Research 01 already limited the digest to envelope + component digests (`01-hosted-identity-boundary.md:23-24`). MAP does not name that payload or a hash (`logicalEdgeKey` is sha256 of a canonical encoding, `LogicalEdgeIdentity.model.ts:421-422` — unused).

---

## 2. Role vocabulary for “non-matter internal tooling”

**B4. No kit members. The phrase is not a value.**
BRIEF amendment (ratified): role/modality/data-class kits are admission-local net-new LiteralKits; “no reusable role taxonomy exists in the agents domain” (`BRIEF.md:63-66`, `DECISIONS.md:9-10`). Live agents-domain LiteralKits are `ProviderKind`, `TokenSource`, `AgentMode` (`deterministic_fixture` only), heading/list tags. There is no role kit, no data-class kit, no modality kit in agents. `OpenclawModelInputKind` (`["text","image"]`) exists in a driver and is off-limits by the same amendment.

A1’s three buckets — “Matter/client-data roles”, “Non-matter internal tooling”, “Lab/experimental” (`DECISIONS.md:20-27`) — mix role, data class, and status policy. A3 requires *three* collections on `restricted` (`DECISIONS.md:42-43`). MAP first slice treats “non-matter internal tooling” as one scope token (`MAP.md:31`). That token cannot be encoded until someone invents the literals, and A1 is not a two-axis matrix: lab is “always `restricted`, never eligible for matter data” — a cross-axis exclusion, not a kit member.

MAP candidate 1 composition lists “assurance/status/role kits” (`MAP.md:13`) and drops modality and data-class from the composition line while inherited constraints still require them (`MAP.md:49`).

**B5. First consumer and first fixture do not share a subject.**
Ratified purpose: name consumer + fixture “so the schemas bind to a real consumer and real record from day one” (`DECISIONS.md:5-8`). Named consumer: professional-runtime approval gate references an admission-disposition id (`BRIEF.md:46-49`). Live gates are law-patent-intake / wealth-cash-request — attorney/advisor review of legal-context and client-intent work (`ProfessionalRuntime.fixtures.ts:282-289`; `approval-and-autonomy-policy.md:15-19`). That is A1 matter/client-data, not “non-matter internal tooling”.

`RuntimeApprovalGate` has no disposition field (`ProfessionalRuntime.contracts.ts:482-499`). `RuntimeUsageRecord` on those fixtures is `provider: "fixture"`, `model: "none"` (`ProfessionalRuntime.contracts.ts:646-651`). The Anthropic arrangement is not “the arrangement in use.”

So day-one binding is: a matter-path DTO that does not exist yet, pointing at a non-matter admission of a driver config the professional-runtime fixtures do not run. The field, if added, is unused or lies.

**M3. Human-only supersession is unenforceable in the stated proofs.**
A3: human-only supersession (`DECISIONS.md:46-47`). First slice must flip eligibility with a superseding disposition (`MAP.md:36-38`). `Principal` is `User | System`; `SystemComponent` includes `Runtime`, `Migration`, `Policy` (`Principal.ts:14`, `:78-80`). MAP specifies no write-path guard. The proof will be written by a test `System` principal and will not implement the ratified rule.

---

## 3. As-of eligibility: storage vs derivation

**B6. Two cited precedents are incompatible. MAP is silent on which columns exist.**
Reuse line: `ClaimDisposition` as record-shape precedent **and** `EdgeAuthority` half-open two-axis predicate (`MAP.md:13`). A3: “as-of queries use the epistemic core’s two-axis half-open semantics” (`DECISIONS.md:50-51`).

`ClaimDisposition` is a point: `resolvedAt`, no `validFrom`/`validTo`/`recordedAt`/`expiredAt` (`ClaimDisposition.model.ts:77-79`). `EdgeVersion` is two half-open intervals: `[validFrom, validTo)`, `[recordedAt, expiredAt)` (`EdgeVersion.model.ts:3-8`, `:112-116`, `:129-131`, `:170-175`). The predicate is not reusable without those four columns:

```138:145:packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts
const asOfWhere = (logicalKey: LogicalEdgeKey, validAt: number, knownAt: number) =>
  and(
    eq(edgeTable.logicalKey, logicalKey),
    lte(edgeTable.validFrom, validAt),
    or(isNull(edgeTable.validTo), gt(edgeTable.validTo, validAt)),
    lte(edgeTable.recordedAt, knownAt),
    or(isNull(edgeTable.expiredAt), gt(edgeTable.expiredAt, knownAt))
  );
```

`EdgeAsOfQuery` is `(logicalKey, validAt, knownAt)` (`EdgeAuthority.commands.ts:276-291`). Not “fold the log of statuses.”

**B7. Not derivable from `{status, resolvedAt, supersedesDispositionId}`.**
A3: expiry is a *new* maintenance record “when the recheck trigger fires” (`DECISIONS.md:47-49`). Trigger due-time (valid) and job write-time (known) are different instants. `EdgeAsOfQuery` docs say the axes are independent on purpose (`EdgeAuthority.commands.ts:254-257`). A single `resolvedAt` cannot answer “was it eligible at validAt=T1 given what we knew at knownAt=T2” for a late-written expiry.

Derivation of `validTo(D_n) = resolvedAt(D_{n+1})` also fails if:

- two dispositions can be open for different scopes on one arrangement (A3 `restricted` is scoped; nothing says one open head per arrangement);
- `supersedesDispositionId` can point across arrangement revisions (see §4);
- out-of-order arrival (EdgeAuthority closes a late older fact at the standing head’s `validFrom`, `EdgeAuthority.repo.ts:187-193`) — MAP has no rule.

So: either admission records carry their own four interval columns (and a logical subject + open-head uniqueness), or the “same semantics” claim is false. “Pattern reuse” without those columns is a comment.

**B8. Query arity is missing. First-slice proof is underspecified.**
“The as-of query answers eligibility at (`validAt`, `knownAt`)” (`MAP.md:36-37`). Eligibility of what, for which role, data class, modality? Production eligibility is at least `(arrangementRevisionKey, role, dataClass, modality?, validAt, knownAt) → status + scope`. A boolean over an implicit fixture subject does not deliver “the two-axis as-of eligibility query” in the goal-1 mission (`MAP.md:13`).

Logical key for exclusion/open-head is unstated: arrangement? arrangement+scope? disposition lineage? If two scoped dispositions can be concurrently open, the key cannot be arrangement alone.

**M4. No persistence home.**
First slice must persist enough to prove as-of and non-mutation (`MAP.md:36-38`). No tables package, no `orgId`/tenant, no “admission-local tables vs epistemic tables.” Putting this in `@beep/epistemic-*` violates “model-admission-local” (`BRIEF.md:44-45`, `03-epistemic-lineage-and-drift.md:6-8`). Putting it in agents-domain requires a new tables/server slice the MAP does not name.

---

## 4. Referential integrity (disposition → qualification → arrangement)

**B9. Cross-revision references are legal because nothing forbids them.**
Stated: disposition references a completed qualification (`DECISIONS.md:45-46`; `02-admission-evidence-and-change-policy.md:48-50`). Qualification carries “arrangement revision key” (`02-admission-evidence-and-change-policy.md:35-36`). MAP never says:

- disposition also stores `arrangementRevisionKey`;
- `disposition.qualification.arrangementKey` must equal any denormalized arrangement field;
- `supersedesDispositionId` must point at a disposition whose qualification is the same arrangement (or the same scope);
- a write is rejected if those disagree.

So yes: a disposition can reference qualification Q2 (arrangement A2) and `supersedesDispositionId` of D1 (qualification Q1, arrangement A1). A3 says supersession “closes a prior *scoped* admission” (`DECISIONS.md:46-47`) — not “the same arrangement.” That close would yank A1’s eligibility because A2 was admitted.

Consumer contract is a bare disposition id (`BRIEF.md:46-48`). `RuntimeApprovalGate` would not carry an arrangement key. A reviewer can attach a disposition whose qualification is a different revision than “the arrangement in use.” First slice’s “old disposition does not transfer” (`MAP.md:34-36`) is a query anecdote, not a schema invariant.

**M5. “Completed qualification” vs first-slice minimal envelope.**
A3: disposition references a *completed* qualification (`DECISIONS.md:45-46`). Research 02’s envelope has eight required sections including frozen eval-plan and per-case results (`02-admission-evidence-and-change-policy.md:34-45`). MAP first slice: “minimal `ModelArrangementQualification` (identity-assurance evidence + deterministic invariant checks only)” (`MAP.md:29-30`). Eval-harness is gated out (`MAP.md:39`, `:20-22`).

Either the fixture disposition violates A3, or “completed” is redefined to “whatever subset we recorded,” which makes A3 unenforceable. Goal 1 still ships the full qualification schema (`MAP.md:13`); required vs optional fields for the eight sections are unstated. If required, the fixture cannot construct. If optional, “completed” is a comment.

Invariant checks themselves are unnamed (`MAP.md:30`).

---

## 5. Other MAP / BRIEF / DECISIONS contradictions

**B10. Goal 1 says “no external gates” and also delivers a professional-runtime contract.**
`MAP.md:13`: “Agents + epistemic-pattern reuse; no external gates.” Same cell: “First consumer contract (ratified): the professional runtime approval gate references an admission-disposition id.” That contract lives in `ProfessionalRuntime.contracts.ts`, a different process surface. First slice then says “Not in the slice: … runtime enforcement” (`MAP.md:39-40`). BRIEF: “wiring may land later; the reference contract is named now” (`BRIEF.md:47-49`). The MAP cannot decide whether goal 1 touches the live DTO. If it does, “no external gates” is false. If it does not, the ratified “bind to a real consumer from day one” is a comment.

**M6. `RuntimeUsageRecord` as “linked execution evidence” is a no-op without a new foreign key.**
MAP composition (`MAP.md:13`). Live record is `{mode, model, provider, usageRecordId}` (`ProfessionalRuntime.contracts.ts:659-668`). Research 01 already said it cannot serve as admission identity (`01-hosted-identity-boundary.md:68-72`). Linking it requires `arrangementRevisionKey` (or disposition id) on that DTO — a professional-runtime schema change not in the slice and not listed as NET-NEW.

**M7. Candidate 3 has no slug.**
`MAP.md:16-17`: “Runtime enforcement wiring (described, not a slug).” Re-entry is “reopen this packet at decompose” (`MAP.md:52-53`). Graduation contract expects slugs as re-entry handles. Compare sibling MAP, which slugs the gated follow-on (`explorations/epistemic-belief-view-revision/MAP.md:15`).

**m8. Packet hygiene, not MAP-blocking.**
`README.md:27-30` still says “Align pending” after align closed (`DECISIONS.md:14-17`). `keyVersion`-style re-entry (`MAP.md:54-55`) is copied from the sibling belief-view MAP (`epistemic-belief-view-revision/MAP.md:51-52`) and is undefined in this domain.

**m9. No residual-risk / expiry on the fixture.**
Research 01: unobservable provider change is residual risk *on the disposition* (`01-hosted-identity-boundary.md:85-86`). A3: expiry is a recorded maintenance disposition (`DECISIONS.md:47-49`). First slice admits the live hosted ID with neither residual-risk field nor recheck trigger. A hosted pin with no expiry is the false precision the packet exists to refuse.

---

## Verdict on the five attacks

| Attack | Result |
| --- | --- |
| Component digest set | Not well-defined. Not closed. Live subject ≠ driver config. |
| Role vocabulary | Does not exist. “Non-matter internal tooling” is unencodable and the wrong scope for the named consumer. |
| As-of storage | Not derivable from immutable point-records. Needs subject-keyed bitemporal intervals. MAP silent; two precedents conflict. |
| Cross-revision refs | Allowed. Unstated. Consumer is a bare id. |
| MAP/BRIEF/DECISIONS | Scoped-`admitted` vs A3; fixture identity vs live code; completed qualification vs minimal fixture; consumer/fixture subject split vs the amendment’s “bind from day one.” |

Do not graduate this MAP. The first slice will either admit the wrong subject, or admit the right subject under a status that opens matter eligibility, or implement an as-of query that cannot do what `asOfWhere` does.
