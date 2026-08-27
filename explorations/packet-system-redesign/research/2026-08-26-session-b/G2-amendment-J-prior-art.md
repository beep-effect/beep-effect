# G2 — Amendment J prior art: is a bespoke gate certificate necessary?

**Date:** 2026-08-26
**Lane:** Amendment J (gate certificates) — Session B webresearch
**Stance:** adversarial. Try to refute "we need a bespoke certificate type."
**Output status:** complete (2026-08-26).
**TLDR:** No examined standard *is* GateCertificate. EARL/ACT already has pass/fail/cantTell/untested; Scorecard already excludes inconclusive from the aggregate; CycloneDX already has complete/incomplete/unknown reach; in-toto already requires subject digests and invites a new predicate. civex.rs `Certificate` is a research struct, and `conforms: null` is not SHACL. Bind the in-toto envelope, profile EARL+Scorecard+CycloneDX inside a predicate, split apply-by-id into a Terraform-style plan. A private JSON type would throw away the verifiers and still lose to boolean consumers.

## Question (as given)

Every quality/approval gate in the repo should stop returning a boolean and emit a typed CERTIFICATE:

1. a verdict from a closed vocabulary (`pass` / `reject` / `abstain`)
2. `assumptions[]` naming every check that was SKIPPED or DEGRADED and why
3. the digests of the inputs the verdict was computed over
4. a rationale listing which rules fired
5. REACH: what was and was not examined — a gate that skipped any check reports `conforms: null`, never `pass`
6. addressed by id; applying an unknown certificate id is an error, never a fallback to latest

The proposed shape was lifted from open-ontologies `src/civex.rs` `Certificate`. Before minting a bespoke type, does a STANDARD already cover this?

## Method and verification policy

- **Verified** = I fetched the spec/source (raw GitHub, OASIS HTML, W3C TR, or the live civex.rs file) and quote or paraphrase from that fetch.
- **Inferred** = I assembled a comparison from those fetches plus secondary writeups; the inference is labelled.
- **Not verified** = I found a pointer but did not retrieve the body.
- This is not a recommendation to ratify Amendment J. It is prior-art for the grill.

## 0. What the proposed shape actually is (verified from source)

Fetched 2026-08-26 from `https://raw.githubusercontent.com/fabio-rovai/open-ontologies/main/src/civex.rs`.

The recon note (`research/2026-08-25-ontology-tooling-recon.md`) is accurate on the *fields* and slightly compresses the *vocabulary*. Verified mapping:

| Amendment J bullet | civex.rs field | Verified notes |
|---|---|---|
| closed verdict vocab | `Verdict` enum | **Execute / Reject / Experiment / Abstain** — four-way, not three. Amendment J dropped `Experiment` and renamed `Execute` → `pass`. |
| `assumptions[]` | `assumptions: Vec<String>` | Labels, not structured `{check, skip/degrade, why}`. Always records reversibility; identification mode records `"structural_only"` or `"do_calculus_unavailable:<reason>"`. |
| input digests | `graph_slice_hash`, `provenance_hash` | SHA-256 of sorted IRI set; SHA-256 of Turtle snapshot + `--DELTA--` + proposed Turtle. |
| rationale / rules fired | `rationale: String` | Concatenation of triage-rule sentences (`"REJECT: …"`, `"EXECUTE: …"`). Not a structured `rules[]`. |
| REACH / `conforms: null` | **not on `Certificate`** | Recon attributes this to `src/shacl.rs` and `src/temporal.rs`, a different module. CIVeX itself can still `EXECUTE` after a degraded identification proof — it records the degradation in `assumptions` rather than forcing `conforms: null`. |
| address by id, unknown = error | **not on `Certificate`** | Recon attributes this to `src/plan.rs` `apply_plan`. Certificate is an ephemeral return value, not an addressed artifact. |

Additional civex fields Amendment J does **not** propose: `identification_proof`, `utility_point_estimate`, `utility_lcb`, `alpha`, `risk_bound`. Those are causal-verifier specific.

Honest reading of the source of the proposal: Amendment J is already a *composition* of three open-ontologies modules (`Certificate` + SHACL reach + plan-by-id), not a 1:1 lift of `Certificate`. The question "does a standard cover this" is therefore a question about covering that *composition*, not covering CIVeX.

Silent-fallback behaviour that the recon already flagged (verified in the same file): when `IdentificationMode::DoCalculusBackdoor` fails, civex **falls back to the structural proxy** and appends `do_calculus_unavailable:<reason>`. That is the honest-assumptions pattern. It is **not** the honest-reach pattern (`conforms: null`). A consumer that only looks at `verdict == Execute` can still ship a degraded check as a pass.

---

## 1. Existing standards — field-by-field

No examined standard covers all six bullets as a single type. Several cover three to five, at different layers. The adversarial claim is therefore not "a standard already is GateCertificate" but "the team should profile an existing envelope + an existing outcome vocabulary rather than mint a private type."


### 1.1 in-toto Attestation Framework

**Verified envelope (statement layer).** Fetched via search snippets of `https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md` and ITE-6.

Four independent layers: Envelope (auth/serialization) → Statement (subject + predicateType) → Predicate (typed claim) → Bundle (grouping). Statement schema:

```
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [{ "name": "<NAME>", "digest": {"<ALG>": "<HEX>"} }],
  "predicateType": "<URI>",
  "predicate": { ... }
}
```

- Subjects are matched **purely by digest**. That is bullet 3 (input digests) as a first-class, required field — stronger than civex's ad-hoc hashes, because the digest *is* the addressing key a policy engine consumes.
- `predicateType` is an open registry. The framework does **not** dictate a verdict vocabulary. Coverage of bullets 1, 2, 4, 5, 6 is entirely a property of *which predicate* you pick or mint.
- Parsing rules (verified from spec/v1 README snippet): unrecognized fields MUST be ignored (monotonic principle). A policy that treats missing "I skipped a check" as pass is the failure mode the spec warns about: *"instead of 'deny if a has-vulnerabilities attestation exists', prefer 'deny unless a no-vulnerabilities attestation exists'."*

**Vetted predicates** (bodies fetched 2026-08-26 from `https://raw.githubusercontent.com/in-toto/attestation/main/spec/predicates/`):

| Predicate | Type URI | Verdict vocab | Skip/degrade | Digests | Rules fired | Reach | Apply-by-id |
|---|---|---|---|---|---|---|---|
| **Simple Verification Result (SVR) v0.2** | `https://in-toto.io/attestation/svr/v0.2` | **none.** Only a list of *passing* property strings. No fail, no abstain. | **by omission.** A skipped check is simply not in `properties[]`. Empty `policies: []` is required when no policy can be referenced — that is the honest-non-representation rule. | subject.digest | no | no explicit reach; monotonic "deny unless property present" | no |
| **Test Result v0.1** | `https://in-toto.io/attestation/test-result/v0.1` | `PASSED \| WARNED \| FAILED` — **no abstain, no skipped.** | no. Optional `passedTests`/`warnedTests`/`failedTests` name what ran; tests that were not collected are invisible. | subject.digest + `configuration[]` ResourceDescriptors | test names, not rules | the use-case text *says* "verify that all tests were in fact run" but the schema cannot distinguish "suite ran 0 tests" from "producer omitted the lists" | no |
| **SCAI v0.3** | `https://in-toto.io/attestation/scai/v0.3` | none. Positive attribute assertions (`WITH_STACK_PROTECTION`). | omitted evidence is allowed; consumer MAY trust producer identity instead. Not a skip list. | subject.digest + optional evidence ResourceDescriptor | attribute names | no | no |
| **SLSA VSA v1** | `https://slsa.dev/verification_summary/v1` | `verificationResult`: **PASSED \| FAILED** only. `verifiedLevels` MAY contain `SLSA_BUILD_LEVEL_UNEVALUATED` — that is a *level*, not a third verdict. | `inputAttestations` MAY be absent if "the verifier does not support this feature." Unset `dependencyLevels` = "verifier makes no claims about dependencies"; set-but-empty = "no dependencies at all." That *is* a reach distinction. | subject.digest + policy.digest + inputAttestations[].digest | verifiedLevels strings | **partial.** UNEVALUATED + unset dependencyLevels. Still binary PASSED/FAILED at the top. | no |
| SLSA Provenance v1 | `https://slsa.dev/provenance/v1` | none (how-built, not did-it-pass) | `resolvedDependencies` completeness is "best effort, at least through SLSA Build L3." Unset/null/empty MUST be interpreted equivalently — so you cannot encode "I skipped listing deps" vs "there were none." Completeness of provenance is implicit from `builder.id`. | subject.digest + resolvedDependencies[].digest | no | **partial / inverted.** v0.2 had `metadata.completeness`; v1.0 *removed* it ("now implicit from builder.id"). | invocationId is a run id, not apply-by-id |

**SVR is the strongest existing refutation of `assumptions[]`.** Fetched schema: `properties` is "the passing properties verified for the artifact." The in-toto monotonic principle (verified from spec/v1 parsing rules) says a consumer MUST treat missing claims as absent, not as pass. A gate that skipped static analysis simply does not emit `ORG_SOURCE_STATIC_ANALYSIS`. Policy is `deny unless property X is present`. Amendment J's explicit skip-list is the *dual* encoding of the same idea. Dual encodings are not a reason to mint a new envelope; they are a reason to pick one and write the consumer.

**Test Result cannot express "I collected 0 items."** The required `result` is PASSED/WARNED/FAILED. A producer that ran an empty suite can emit `PASSED` + empty lists. That is the honest-gate hole, in a vetted predicate.

**VSA `SLSA_BUILD_LEVEL_UNEVALUATED` is the closest SLSA analogue of abstain**, but it sits *inside* a PASSED result (the spec's code-signing example: consumer verifies `slsaResult is PASSED` *and* `verifiedLevels contains SLSA_BUILD_LEVEL_UNEVALUATED`). That is "passed, unevaluated" — the opposite of Amendment J's "skip ⇒ conforms null, never pass."

**in-toto does not do apply-by-id.** Attestations are content-addressed by subject digest + predicateType + envelope signature. "Apply certificate id X, unknown id is an error" is a catalog problem (Rekor UUID, OCI referrers, GitHub attestations API). Minting a `certificateId` field on a predicate does not give you apply semantics; Terraform-style plan files do (section 4).

**New-predicate guidelines exist on purpose.** The predicates README (fetched): *"the framework easily supports new predicate types for new use cases"* and points at the vetting process. If the six bullets really don't fit SVR/VSA/Test Result, the *standard* move is a new in-toto predicate, not a private JSON type. That is still "not bespoke" in the sense that matters: envelope, subject digest, monotonic parsing, and any in-toto-verify / Binary Authorization consumer keep working.

### 1.2 SLSA provenance v1.x (and VSA)

**Verified** from `https://slsa.dev/spec/v1.0/provenance` and `https://slsa.dev/spec/v1.1/verification_summary` (fetched 2026-08-26). Note: those pages mark themselves Retired in favour of v1.2; the predicateType URI `https://slsa.dev/provenance/v1` / `https://slsa.dev/verification_summary/v1` is what implementations still emit. I did not re-fetch v1.2 body in full; inferred: source-track VSAs add `subject.annotations.source_refs` and require `resourceUri` as the repo URI.

Provenance is the wrong object for a quality gate. It answers "who built this, from what, with which builder.id." It has:

- **builder.id** as the trust base (the SLSA level is a property of the *builder*, not of this run).
- **byproducts** for logs / evaluated config — optional evidence, not a verdict.
- **No skip vocabulary.** `resolvedDependencies` completeness is best-effort. v1 removed v0.2's `metadata.completeness` and `metadata.reproducible` fields, folding both into "implied by builder.id." Incomplete claims are therefore *not* a first-class predicate field in v1.x.
- **Unset ≡ null ≡ empty.** Parsing rules: those three MUST be interpreted equivalently. Amendment J's `conforms: null` vs `conforms: true` with empty results is *illegal* under this parsing rule. If the team binds SLSA/in-toto parsing, they cannot use JSON null as a third boolean.

VSA is the SLSA *decision* object. Field-by-field against Amendment J:

| Amendment J | VSA v1 (verified) |
|---|---|
| pass/reject/abstain | PASSED/FAILED. UNEVALUATED is a *level string*, usable *with* PASSED. |
| assumptions[] skip/degrade | `inputAttestations` optional-absent = "verifier does not support this feature." Not a per-check skip reason. |
| input digests | subject.digest required; policy SHOULD have digest; inputAttestations MUST have digest if present. |
| rationale / rules fired | `verifiedLevels[]` + `policy.uri`. No per-rule fire list. |
| skip ⇒ not pass | **fails this.** Spec example 1: PASSED + UNEVALUATED is the traditional-code-signing analogue. |
| apply unknown id = error | no. Verification is by (subject digest, verifier.id, resourceUri, verifiedLevels). |

`slsa-verifier verify-vsa` (fetched from the tool README) errors on `ErrorInvalidVerificationResult` when `verificationResult` is not `"PASSED"`. There is no abstain handling in the verifier.

**Inference:** SLSA will not save the team from minting a predicate. It will save them from minting an *envelope*. Use VSA as the pattern for "a trusted verifier summarises other evidence," not as the packet-gate type.

### 1.3 SARIF (OASIS) — closest industrial vocabulary

**Verified kind vocabulary** from OASIS SARIF v2.0 HTML §3.27.9 and v2.1.0 Plus Errata 01 Appendix I.

`result.kind` closed set:

| kind | spec meaning (v2.0 §3.27.9) | maps to Amendment J |
|---|---|---|
| `pass` | rule was evaluated, no problem found | `pass` |
| `fail` | (default) problem found | `reject` |
| `open` | evaluated, insufficient information to decide | **`abstain`** — "used by proof-based tools" |
| `notApplicable` | rule was **not evaluated**, because it does not apply | not-examined, but *by inapplicability*, not by skip/degrade |
| `review` | requires human review | extra |
| `informational` | evaluated, purely informational, not a problem | extra |

**Partial/failed runs — Appendix I of v2.1.0** ("Detecting incomplete result sets"), verified from OASIS HTML snippet:

A consumer is informed the result set is not comprehensive when:

1. any `invocation.executionSuccessful` is `false` (failed to start, failing exit, unhandled exception/signal)
2. any `toolExecutionNotifications` or `toolConfigurationNotifications` has `level: "error"` — *"it is possible that the tool was unable to execute every analysis rule on every analysis target. Therefore, the results cannot be assumed to be complete."*
3. `run.results` is `null` — tool failed to start or failed to begin analysis

This is the closest standardized encoding of "do not treat this as a pass if the run was incomplete." It is **not** `conforms: null`. It is a *consumer inference* from three scattered signals. A naive SARIF consumer that only counts `kind=fail` results will still green-light a skipped run if `executionSuccessful: true` and notifications are empty — which is exactly how tools emit "I was configured to check nothing."

`invocation.toolConfigurationNotifications` is where "which rules were enabled/disabled" lives. That is a cousin of `assumptions[]` (skipped-because-disabled), not degraded-because-fallback.

`runAutomationDetails` identifies the automation run (id/guid). That is run identity, not "apply this certificate by id."

GitHub Code Scanning historically **ignored `kind`**, treating every result as fail (community discussion [#65477](https://github.com/orgs/community/discussions/65477), 2023-08-30, candrews). An OpenSCAP SARIF with 657 results imported as 657 alerts; after filtering `kind == pass|notApplicable|informational` it should have been 5. That is a live demonstration that a rich vocabulary dies if the consumer is boolean. It is the adoption-cost of three-or-more-valued results, paid in production by the largest SARIF consumer.

Trail of Bits' SARIF-parsing skill (fetched via search; source `https://raw.githubusercontent.com/trailofbits/skills/main/plugins/static-analysis/skills/sarif-parsing/SKILL.md`) documents a second footgun: CodeQL omits `result.level` and stores severity on the rule's `defaultConfiguration.level`. A consumer that reads only `result.level` scores a dirty run as clean. Spec resolution order (SARIF 2.1.0 §3.27.10): kind other than fail ⇒ level none; else result.level; else rule default; else warning.

**SARIF vs Amendment J, carefully:**

- Verdict: `kind` is *per-rule*, not per-run. The run has no pass/reject/abstain. You aggregate. `open` ≈ abstain, `notApplicable` ≈ inapplicable, but there is no `skippedBecauseDegraded`.
- assumptions[]: `toolConfigurationNotifications` (rules disabled) + `toolExecutionNotifications` (runtime faults). Unstructured notifications, not a required skip array.
- digests: `artifacts[].hashes` optional. Not the addressing key.
- rationale: `ruleId` + `message` per result. This is the best structured "which rules fired" of anything examined.
- REACH: Appendix I is **consumer-inferred**, three scattered signals, and **does not fire** if the tool was configured to analyse nothing and exited 0. Amendment J's "skipped any check ⇒ conforms null" is a *producer* obligation SARIF refuses to impose.
- apply-by-id: `runAutomationDetails.guid` identifies a run. Nothing consumes it as "apply this and error on unknown."

**Inference:** SARIF is the right *export* format if a packet gate must land in GitHub Code Scanning. It is the wrong *native* type, because (a) GitHub ignores `kind`, (b) incomplete-run is not `conforms: null`, (c) apply-by-id is absent. Binding the repo's gates to SARIF would import the consumer-collapse problem.

### 1.4 SHACL ValidationReport — `conforms: null` is not SHACL

**Verified** from W3C SHACL Recommendation 20 July 2017, `https://www.w3.org/TR/shacl/` §§2.1.6, 3.4.1, 3.5, 3.6.1.1 (fetched).

- `sh:conforms` has **exactly one value**, datatype **`xsd:boolean`**. `true` iff validation produced no validation results; `false` otherwise. JSON/RDF null is not in the spec.
- A **deactivated** shape (`sh:deactivated true`): "All RDF terms conform to a deactivated shape." Validation results are empty. A skipped shape therefore contributes to `sh:conforms true`. That is the opposite of Amendment J.
- **Failures** (resource exhaustion, unsupported entailment, ill-formed shapes, recursive-shape loops) are signalled "through implementation-specific channels," *not* as a third value of `sh:conforms`. Conformance checking produces `true` iff the focus node conforms *and no failure has been reported*.
- Severity (`sh:Violation` / `sh:Warning` / `sh:Info`) does not change `sh:conforms` in SHACL 1.0 — any result makes conforms false. SHACL 1.2 (WD, `https://www.w3.org/TR/shacl12-core/`) adds `sh:conformanceDisallows` so a report can ignore Info/Warning; still a boolean.

**Therefore:** open-ontologies `src/shacl.rs` forcing `conforms=null` when a constraint was skipped is a **local extension**, not SHACL. Amendment J's most distinctive bullet, if taken from that recon, is already non-standard relative to the W3C type it is named after. Do not claim SHACL cover for `conforms: null`. If the team wants SHACL interoperability, they get a boolean and silent-pass on deactivated shapes — the honest-gate hole, standardised.

SHACL 1.2 Core (search-snippet verified 2026-08-03 WD) still types `sh:conforms` as `xsd:boolean`. I did not fetch a 1.2 change that makes it nullable.

### 1.5 OPA decision logs / Rego — three-valued at eval, binary at the gate

**Verified** from `https://www.openpolicyagent.org/docs/management-decision-logs` and OPA docs on `default` / undefined (fetched 2026-08-26).

Decision-log event fields that look like a certificate:

| Field | What it is |
|---|---|
| `decision_id` | UUID per decision. Traceability, not apply-by-id. |
| `path` | which decision was queried (`http/example/authz/allow`) |
| `input` | the input document (not a digest; the document itself, optionally hashed by a plugin) |
| `result` | **whatever the policy returned** — typically boolean, but any JSON |
| `bundles[].revision` | policy bundle revision (a digest-like pin of *policy*, not of the gated artifact) |
| `nd_builtin_cache` | replay of non-deterministic builtins |
| `ids` | annotation `id` values of rules that **successfully evaluated** (present when policies use id annotations) |
| `rule_labels` | merged labels of successfully evaluated rules |

`ids` / `rule_labels` are the closest standard encoding of "which rules fired." They are recent (documented on the current decision-log page) and only list *successful* evaluations, not skipped ones.

**Rego is three-valued (true / false / undefined)** and operators spend their lives collapsing it. Official docs: "undefined means that OPA was not able to find any results"; "undefined is not the same as false"; `default allow := false` exists *so callers do not have to handle undefined*. The FAQ and every primer recommend default-deny, which **throws away abstain**. Envoy's OPA output requires `allowed: boolean`. `opa exec --fail` treats undefined as a non-zero exit — collapsing abstain to reject, which is the other binary.

So: OPA *has* the third value internally, and the ecosystem's documented best practice is to **refuse to expose it**. That is the adoption-cost of three-valued gates, written by the authors of the three-valued language.

Decision logs do not record "I skipped check X because credential missing" unless the policy author puts that in `result` as a custom object. There is no `assumptions[]`. There is no reach field. Applying an unknown `decision_id` is not a defined operation.

### 1.6 Sigstore / cosign, CycloneDX, SPDX

**Sigstore / cosign** (inferred from prior packet lane 4 + in-toto statement model; not re-fetched in full this session): cosign attest wraps an in-toto statement in a DSSE/Sigstore bundle. It supplies envelope, identity, Rekor UUID. It supplies **none** of bullets 1, 2, 4, 5. The predicate is whatever you put inside. GitHub Artifact Attestations are the same shape (`actions/attest` + in-toto statement). Binding to cosign is an envelope choice, not a certificate-shape choice.

**CycloneDX Attestations (CDXA)** — verified from `https://cyclonedx.org/capabilities/attestations/` and the 1.6 proto / 1.7 use-case pages:

- `declarations.attestations[]` map requirements → claims / counterClaims, with **conformance scores, rationales, mitigations, confidence**.
- Claims carry evidence and **counter-evidence**. Non-conformance is a first-class documentation path, not a boolean hole.
- **Compositions.aggregate** is the REACH field the proposal wants, already named: `complete | incomplete | incomplete_first_party_only | incomplete_third_party_only | unknown` (`https://cyclonedx.org/specification/overview/` and the vulnerability-compositions use case). An `unknown` or `incomplete` aggregate is exactly "do not treat this inventory as a pass."
- Identifiers: `bom-ref` + `serialNumber` (urn:uuid). Applying an unknown bom-ref is not defined as a runtime error; it is a dangling reference.

CDXA is a **compliance-as-code** type, heavier than a CI gate, and it still has no closed pass/reject/abstain enum — conformance is scored. But `compositions.aggregate` is a standard REACH vocabulary Amendment J should steal rather than invent `conforms: null`.

**SPDX 2/3** as in-toto predicates (`spdx2.md`, `spdx3.md` in the predicates directory) wrap a BOM. SPDX 3.0 has its own integrity / relationship model. I did not fetch the SPDX 3.0 spec body this session (**not verified**). Inference: SBOMs are inventories, not gate verdicts; completeness flags exist in the same family as CycloneDX compositions.

### 1.7 OpenSSF Scorecard — closest operational analogue

**Verified** from Scorecard checker package (`InconclusiveResultScore = -1`, `CreateInconclusiveResult`), JSON v2 schema, in-toto export (`https://scorecard.dev/result/v0.1`), checks.md, and the 2024-04-17 OpenSSF "Beyond Scores" post.

Per-check object (JSON v2):

```
{ "name": "...", "score": <int -1..10>, "reason": "<sentence>", "details": ["..."], "documentation": { "url", "short" } }
```

- **score = -1** (`InconclusiveResultScore`): "the check runs without runtime errors, but we don't have enough evidence to set a score" (`CreateInconclusiveResult`). Rendered as `"?"`. **Excluded from the aggregate** (`if check.Score < MinResultScore { continue }`; if `total == 0` the aggregate itself is -1). That is Amendment J bullet 5, implemented as arithmetic rather than `conforms: null`: inconclusive does **not** count as 0 (fail) and does **not** count as 10 (pass).
- **reason** is a required sentence ("branch protection is not maximal…"). That is assumptions[] + rationale, flattened.
- **details[]** is the per-heuristic fire list.
- **repo.commit** is the input digest (git SHA).
- Code-Review check (checks.md): "If recent changes are solely bot activity, the check returns **inconclusively**." Explicit third value in a production tool.
- Probe format (2024): each heuristic is a finding with `outcome: True|False` (and def.yml listing possible outcomes). Finer than the 0–10 score, designed for OPA policy on top.
- Export as in-toto statement, predicateType `https://scorecard.dev/result/v0.1`, subject digest = gitCommit.

arXiv:2208.03412 (Scorecard ecosystem paper) measured that Scorecard used -1 *so that empty/unmeasurable repos are not punished with 0*. Manual review of -1 Vulnerabilities scores found 39/50 empty repositories. The third value has a documented purpose and a documented confusion cost (GitHub discussion #3261: users ask whether -1 is included in the aggregate; the maintainer points at the source).

**Scorecard vs Amendment J:**

| bullet | Scorecard |
|---|---|
| 1. closed verdict | **partial.** Per-check is a score plus -1, not pass/reject/abstain. Aggregate is a float or `?`. |
| 2. assumptions[] | **partial.** `reason` names why, including inconclusivity. Not a structured skip/degrade enum. |
| 3. input digests | **C.** repo.commit / gitCommit. |
| 4. rules fired | **C.** check name + details + (probes) outcome. |
| 5. skip ⇒ not pass | **C.** -1 excluded from aggregate. Closest production implementation of the honest-gate rule. |
| 6. apply-by-id | **A.** |

If the team needs a precedent that "inconclusive must not look like pass" already shipped and survived, it is Scorecard, not CIVeX.

### 1.8 W3C Verifiable Credentials 2.1

**Verified** (search snippet) from `https://www.w3.org/TR/vc-data-model-2.1/` (WD 16 August 2026): a VC is tamper-evident claims + issuer + proof. `id` on the credential is a URI. That covers **bullet 6's identifier**, not "unknown id is an error on apply" (VCs are presented, not applied). The six bullets' *semantics* would live in `credentialSubject`, which is open. VC is an envelope option alongside in-toto/DSSE, with a heavier issuer/holder/verifier ceremony the packet system does not need.

### 1.9 EARL + W3C ACT — the abstain vocabulary already exists

**Verified** from EARL 1.0 Schema WD (`https://www.w3.org/TR/2011/WD-EARL10-Schema-20110510/` §2.7) and ACT Rules Format 1.1 (`https://www.w3.org/TR/act-rules-format/`, CR/TR 2025–2026):

EARL `earl:OutcomeValue` instances:

| EARL | Meaning (spec) | Amendment J |
|---|---|---|
| `earl:passed` | subject passed the test | pass |
| `earl:failed` | subject failed the test | reject |
| `earl:cantTell` | **unclear if passed or failed** | **abstain** |
| `earl:inapplicable` | test is not applicable | not examined (by inapplicability) |
| `earl:untested` | **the test has not been carried out** | **not examined (by skip)** |

ACT 1.1 restates the same five outcomes and adds: "Untested: The test subject was not evaluated for the rule"; "cantTell: Whether the rule is applicable, or whether all expectations were met, could not be fully determined." Consistency ranking when a check reports multiple outcomes: failed > untested > cantTell > passed > inapplicable. **Untested outranks passed.** That is Amendment J bullet 5, as a W3C ranking: you may not treat a partially-run check as pass.

ACT implementations report in EARL JSON-LD. axe-core's public ACT implementation report includes `cannot tell` and `untested` cells (`https://www.w3.org/WAI/standards-guidelines/act/implementations/axe-core`). The third (and fourth, and fifth) values are in production in accessibility tooling.

EARL does **not** require input digests (the subject is a URL / HTTP representation). It does **not** have assumptions[]. `earl:info` / `dct:description` can hold rationale. Apply-by-id is absent. The schema is RDF.

**This is the strongest refutation of "we must invent pass/reject/abstain."** The closed vocabulary is 15+ years old, W3C-published, and already distinguishes abstain (`cantTell`) from not-run (`untested`) from inapplicable — a *finer* split than Amendment J's three-way. If the team mints `GateVerdict`, they should at least *map* to EARL rather than invent synonyms.

### Comparison table (verified)

Legend: **C** = covered as specified · **P** = partial (other layer, consumer-inference, dual encoding, or extra values) · **A** = absent.

| Proposal field | in-toto stmt | SVR | Test Result | VSA | SLSA prov | SARIF 2.1 | SHACL 1.0 | OPA log | Scorecard | VC 2.1 | EARL/ACT | CDXA / compositions | Sigstore | civex.rs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. closed verdict pass/reject/abstain | A (open predicate) | **A** (pass-list only) | **P** PASSED/WARNED/FAILED, no abstain | **P** PASSED/FAILED; UNEVALUATED is a level | A | **P** per-result kind=pass/fail/**open**/notApplicable/review/informational | **A** boolean sh:conforms | **P** true/false/undefined, collapsed by default | **P** score + -1 | A (open claims) | **C** passed/failed/**cantTell**/inapplicable/**untested** | P scored conformance | A (envelope) | **P** 4-way Execute/Reject/Experiment/Abstain |
| 2. assumptions[] skip/degrade+why | A | **P** omission + required empty policies[] | A | P optional-absent inputAttestations | A | **P** config/exec notifications | **A** (deactivated ⇒ silent pass) | A unless custom result | **P** required `reason` | A | P dct:description | P counter-evidence + reasoning | A | **C** labels |
| 3. input digests | **C** subject.digest required | C | C | C + policy.digest | C | P artifacts[].hashes optional | A | P input body, not digest | **C** repo.commit | P hash links | A (URL subject) | P hashes on components | C via in-toto | **C** slice+provenance SHA-256 |
| 4. rationale / rules fired | A | P property names | P test-name lists | P verifiedLevels + policy.uri | A | **C** ruleId + message | P sh:sourceConstraintComponent | **P** ids / rule_labels of *successful* rules | **C** name+reason+details (+probes) | A | P earl:info | **C** rationale + map | A | **P** concatenated string |
| 5. REACH; skip ⇒ not pass | P monotonic deny-unless | **P** missing property ≠ pass (if consumer is monotonic) | **A** empty PASSED is legal | **A** PASSED+UNEVALUATED is the example | A (completeness removed in v1) | **P** App. I consumer inference; does not catch "configured to check nothing" | **A** boolean; deactivated conforms | A (undefined collapsed) | **C** -1 excluded from aggregate | A | **C** untested > passed in ACT ranking | **C** aggregate complete/incomplete/**unknown** | A | **A** on Certificate (local shacl.rs) |
| 6. address by id; unknown = error | **P** content-addressed; no apply | A | A | A | P invocationId | P runAutomationDetails.guid | A | P decision_id | A | **C** credential id (present, not apply) | P assertion subject | P bom-ref / serialNumber | P Rekor UUID / referrers | **A** (plan.rs) |

---

## 2. The honest-gate problem in the wild

The phenomenon is not folklore. The *fixes* are local flags, not a new certificate type — which is itself evidence against "we must mint GateCertificate." The pattern is: the boolean gate had no place to put "I did not look," so the skip looked like pass; the fix was to make skip a first-class outcome *in that tool*.

### 2.1 Empty collection / no tests ran (still green)

| Incident | What happened | Fix shape | Link |
|---|---|---|---|
| pytest `collected 0 items` | Default pytest exit on no tests collected is **code 5** (fail). Operators then add `--pass-with-no-tests` / `filterwarnings` / wrong `--pyargs`, and CI goes green on a suite that ran nothing. SO 76434747 (2023-06): GHA collected 0, locally fine; root cause was `--pyargs`. | pytest already has a third exit (5 ≠ 1 fail). The hole is the *override flag*. | https://stackoverflow.com/questions/76434747/pytest-collects-and-passes-tests-locally-but-collected-0-items-in-github-acti · https://stackoverflow.com/questions/37353960/why-is-pytest-not-collecting-tests-collected-0-items |
| Jest / Vitest `--passWithNoTests` | Jest issue #14448 (2023-08-25): `--passWithNoTests` still **fails** empty *suites* (tests gated behind `if (externalCondition)`). Vitest PR culture: adding `--passWithNoTests` so a repo with no tests yet is green (Ansvar-Systems/polish-law-mcp #31, 2026-04-21). | Flag that **collapses skip to pass**. Inverse of Amendment J. | https://github.com/jestjs/jest/issues/14448 · https://github.com/Ansvar-Systems/polish-law-mcp/pull/31 |
| Cypress "no spec files found" | Until 15.11.0, no specs ⇒ non-zero exit. Then `--pass-with-no-tests` was added, named after the Jest convention. Cypress's own blog: *"If it isn't [intentional], don't add this flag. Cypress failing when no specs are found is a useful signal."* | The vendor documents the honest default and the dishonest flag. | https://www.cypress.io/blog/fix-cypress-ci-failures-caused-by-no-spec-files-found |
| Maven `-DskipTests` / `-Dmaven.test.skip` / `-fn` | `BUILD SUCCESS` with "Tests are skipped." Baeldung's how-to is the playbook for shipping a jar that was never tested. | Skip is a boolean property, not a certificate. The log line is the only receipt. | https://www.baeldung.com/maven-ignore-test-results |
| Playwright shard denominator hardcoded | StarSling 2026-08-24: if `--shard=K/4` is a literal 4 and the matrix shrinks to 3, "a quarter of the suite silently never runs. Green CI, untested code." | Count of shards as a digest-like input; mismatch is a skip-that-looks-like-pass. | https://starsling.dev/best-practices/github-actions/shard-tests |
| pytest skipif hides required tests | SO-for-Agents TIL 2026-07-12 (verified Fedora 44, pytest 9.0.3): 2 skipif (Docker unavailable) + 2 unit = `2 passed 2 skipped`; quiet mode `ss..`. Green suite, integration never ran. Recommended fix: fail if required marker collects zero; `--fail-on-skip` / rewrite skip → fail in `pytest_runtest_makereport`. | **Third value exists (skipped) and operators still miss it.** The fix is "skip of a required check is reject," i.e. Amendment J reach, implemented as a pytest plugin. | https://agents.stackoverflow.com/tils/68c1fdda-30ae-4514-8008-5ad67a5a4c7b |

### 2.2 Coverage / upload gates that succeed while doing nothing

| Incident | What happened | Fix shape | Link |
|---|---|---|---|
| **codecov-action `fail_ci_if_error` default `false`** | v4 without `CODECOV_TOKEN`: logs `Error: Codecov token not found` **and the job stays green**. JoshuaKGoldberg, issue #1348, 2024-03-30: *"if a repository uses v4 of the action without a CODECOV_TOKEN, their build will fail to upload coverage data but still ✅ pass."* README still documents `fail_ci_if_error: true # optional (default = false)`. action.yml v5.0.2: `default: 'false'`. | The skip (no token / upload failed) is an *Error* line with a success conclusion. The proposed default flip is the reach rule. **Still open as of fetch.** | https://github.com/codecov/codecov-action/issues/1348 · https://github.com/codecov/codecov-action/blob/main/README.md |
| coverage.py `no-data-collected` | Tests pass, coverage reports 0% / warning "No data was collected." mesa/mesa #3004 (2025-12-23): 379 tests ran, coverage.py measured zero lines after a test-dir reorg. | Warning, not fail. Codecov then reports 0% which *does* fail a threshold — accidental honesty via a different gate. | https://github.com/mesa/mesa/issues/3004 · https://stackoverflow.com/questions/47287721 |
| CircleCI parallel rerun empty bucket | BerriAI/litellm #29608: rerun-failed-tests leaves sibling nodes with "no tests found in the bucket"; unguarded `mv coverage.xml` then *fails* the green rerun. Fix: emit empty placeholders so the job stays green. | Here the honest-gate (missing file ⇒ fail) was treated as a *bug* and patched to allow empty. | https://github.com/BerriAI/litellm/pull/29608 |

### 2.3 CI control-plane: skip is success

| Incident | What happened | Fix shape | Link |
|---|---|---|---|
| **GitHub Actions `continue-on-error`** | Step-level: `outcome=failure` but `conclusion=success`; the job is a green bubble. Ken Muse 2024-09-06: *"the job and step will succeed (with a green success bubble). … the workflow proceeds successfully as if the step had never failed."* toolkit #1739 (2024-05-23) asks for a way to keep the green icon without lying to `needs.*.result`. | conclusion ≠ outcome is SARIF-Appendix-I in YAML form, and the consumer (branch protection) reads conclusion. | https://www.kenmuse.com/blog/how-to-handle-step-and-job-errors-in-github-actions/ · https://github.com/actions/toolkit/issues/1739 |
| **Skipped required checks are passing** | Christian Emmer 2023-07-25: *"If you have a GitHub branch protection rule … GitHub will treat skipped GitHub Actions jobs as passing."* Path-filtered jobs that don't run on a docs-only PR still satisfy "required checks." | `re-actors/alls-green` (always-run aggregator). A **meta-certificate**: one job whose verdict is the conjunction of `needs.*`, and skipped ≠ success. | https://emmer.dev/blog/skippable-github-status-checks-aren-t-really-required/ |
| dorny/test-reporter `fail-on-empty` | Secure fork (step-security/test-reporter) exposes `fail-on-empty: 'true'` — "Set this action as failed if no test results were found." | The flag *is* Amendment J bullet 5, for JUnit XML. | https://github.com/step-security/test-reporter |

### 2.4 Analysis-tool incomplete runs

- SARIF Appendix I (section 1.3) is the spec's own catalogue of this failure class.
- GitHub Code Scanning ignoring `kind` (section 1.3) is the dual: skip-as-fail rather than skip-as-pass, still a collapse.
- Qodana SARIF `kind` is always `"fail"` (JetBrains docs) — the producer collapses too.

### 2.5 What the fixes look like (inference)

Nobody in this list minted a `GateCertificate`. They added: a third exit code (pytest 5), a flag (`fail-on-empty`, `fail_ci_if_error`, `--fail-on-skip`), an aggregator job (`alls-green`), or a score that is excluded from the mean (Scorecard -1). **The missing type is a third *value* plus a consumer that will not colour it green.** Amendment J's six-field object is a way to *transport* that value. The wild already transports it as an exit code, a YAML flag, or a -1.

---

## 3. Abstain / three-valued verdicts in practice

### 3.1 Tools that distinguish "passed" from "could not evaluate"

| Tool | Third value | What it cost | Source |
|---|---|---|---|
| **EARL / ACT** | cantTell, untested, inapplicable | RDF/JSON-LD. Accessibility tools (axe-core, IBM Equal Access) emit it for W3C implementation reports. Ranking: untested > passed. | §1.9 |
| **SARIF** | `kind=open` (insufficient info), `notApplicable` | GitHub Code Scanning ignored `kind` for years; producers (Qodana) emit only `fail`. The vocabulary exists; the largest consumer collapsed it. | §1.3, #65477 |
| **Scorecard** | score -1 / `?` | Users do not know if -1 affects the aggregate (#3261). Paper had to explain why -1 ≠ 0. Probe format (2024) still uses True/False per heuristic. | §1.7 |
| **Rego / OPA** | undefined | Official guidance is `default allow := false`. Envoy requires boolean. `opa exec --fail` treats undefined as fail. The language has abstain; the product hides it. | §1.5 |
| **pytest** | skipped / exit 5 (no tests collected) / error vs failed | Quiet mode hides skips. `--pass-with-no-tests` is the popular override. `--fail-on-skip` exists because skip-as-pass is the default UX operators want until they get burned. | §2.1 |
| **SLSA VSA** | `SLSA_BUILD_LEVEL_UNEVALUATED` | Sits *under* PASSED. The verifier CLI rejects non-PASSED. Abstain-as-a-level, not abstain-as-a-verdict. | §1.2 |
| **POSIX / TAP** | exit 0 pass, 1 fail, >1 error | CI still keys off non-zero. The third value is there; dashboards are binary. | inferred from TAP / bats / pytest docs |
| **CIVeX** | Abstain + Experiment | Research port (arXiv:2605.09168). Not a CI convention. | civex.rs |

### 3.2 Cases where three-valued was rejected because operators wanted binary

These are the adoption-cost receipts:

1. **OPA `default allow := false`.** The authors of the three-valued language tell you to throw the third value away so "callers do not also need to handle undefined values" (`https://www.openpolicyagent.org/docs/policy-reference/keywords/default`).
2. **GitHub Code Scanning × SARIF `kind`.** A 6-valued result was imported as "everything is an alert." Workaround: `jq` delete pass/notApplicable/informational before upload. The platform wanted a list of failures.
3. **codecov-action default `fail_ci_if_error: false`.** The maintainers chose "upload problems must not redden CI" as the default, against the 2024 issue asking to flip it. Coverage-not-uploaded is abstain; the default paints it pass.
4. **Jest/Vitest `--passWithNoTests` and Cypress `--pass-with-no-tests`.** Named, documented, widely copied. Empty is pass because empty-as-fail broke new-repo / path-filter / generated-test workflows.
5. **GitHub skipped jobs = passing required checks.** Branch protection is a boolean. The platform will not grow a third bubble colour; `alls-green` is a user-space patch.
6. **SHACL `sh:conforms` boolean.** The WG had a chance in 1.2 to introduce a third report state for deactivated/skipped shapes. They added `sh:conformanceDisallows` (which severities count as non-conformant) and kept the boolean.

**Inference:** a three-valued *producer* is cheap. A three-valued *consumer* (dashboards, branch protection, `needs:`, badge) is what gets rejected. Amendment J will fail in the same way if the only reader is "is verdict == pass." The Scorecard lesson is: exclude abstain from the aggregate *in the producer*, so a boolean consumer of the aggregate cannot launder it.

### 3.3 UX cost of adding the third value

Scorecard's `?` in the table is honest and ugly. Users file "what does -1 do to my score?" ACT implementation reports have a whole matrix of passed/failed/inapplicable/cantTell/untested per example — reviewers need a ranking (ACT §4.14). OPA undefined shows up as `{}` in CLI output and looks like a bug (Snyk "Practical Rego," GitHub discussion #653 wanting to distinguish false from undefined). **Expect to spend the UX budget on teaching `abstain` ≠ `reject` ≠ `pass`, or operators will configure it back to binary.**

---

## 4. Certificate-by-id / plan-application semantics

This bullet is a **different type** from a gate verdict. Every mature system that "applies a plan by id, unknown is an error, never latest" keeps the plan artifact separate from the health/verdict object. Treating them as one `GateCertificate` is the part of Amendment J with the least standard cover.

### 4.1 Terraform saved plans — the reference implementation

**Verified** from HashiCorp CLI docs (`https://developer.hashicorp.com/terraform/cli/commands/apply`, `https://developer.hashicorp.com/terraform/tutorials/cli/plan`):

- `terraform plan -out=tfplan` writes a binary plan. `terraform apply tfplan` **executes that plan without prompting**. Passing the file *is* the approval.
- You cannot pass extra planning flags at apply time: "the plan file contains the final results of those decisions."
- If state changed after plan: **`Error: Saved plan is stale` / "the given plan file can no longer be applied because the state was changed by another operation after the plan was created."** Unknown/stale is an error. There is no fallback to latest.
- Failure modes in the wild: Terragrunt `run-all apply` (issue #4170, 2025-04-17) applies module A, which mutates shared state, then module B's saved plan is stale — apply succeeded *and* ended in error. Atmos documents the same error and a newer "reconcile against the reviewed plan rather than replay it" mode because **pure replay is brittle**.
- Security: plan files contain sensitive values in cleartext. Treat as secrets.

This is apply-by-id done right: the id *is* the file; the error is stale-vs-state, not "unknown UUID." A certificate id that is not bound to a snapshot of *state* will hit the Terragrunt failure: two applies, the second's id is still "known," the world has moved.

### 4.2 Nomad `-check-index`

**Verified** from `https://developer.hashicorp.com/nomad/commands/job/plan` (fetched 2026-02-16 docs):

`nomad job plan` dry-runs the scheduler and prints `Job Modify Index: N` plus "To submit the job with version verification run: `nomad job run -check-index N`." If the job was modified between plan and run, the check-index fails. Unknown/stale index is an error. The id is a **monotone counter on the job**, not a content digest — two different plans can share an index if nothing else changed, and a changed job always bumps it.

### 4.3 Pulumi update plans

**Verified** from `https://www.pulumi.com/docs/iac/operations/stack-management/update-plans/` (2026-08-15):

`pulumi preview --save-plan=plan.json` then `pulumi up --plan=plan.json` "constrain[s] the update to only the operations that were saved." **Not all-or-nothing before apply:** operations run in batches; *at any discrepancy the up fails immediately*. Unknown operations in the live program vs the plan are errors. Documented failure modes: unknown-at-preview inputs recorded as `unknown` (the plan cannot pin the value); resources created inside `apply` if the value was unknown at preview; targeted preview plans **must not** be applied to a full `up` ("the plan and the program's full goal state will not match"). Stale inputs on targeted updates: non-targeted resources contribute last-full-update values.

Pulumi's lesson: a plan id that does not close over *unknowns* will apply a different concrete operation than was reviewed.

### 4.4 Kubernetes server-side apply

**Verified** from `https://kubernetes.io/docs/reference/using-api/server-side-apply`:

SSA is **not** apply-by-plan-id. It is apply-by-field-manager. Conflict (409) when another manager owns the field. Options: drop the field, `--force-conflicts`, or abort. There is no "apply resourceVersion R or error"; `resourceVersion` optimistic concurrency is a different mechanism (409 on stale RV). Dry-run=`server` is the preview. Failure modes: Argo CD v3.5.0-rc1 (issue #28421, 2026-06-24) ran large-CRD dry-run as client-side apply despite `ServerSideApply=true`, blowing the 256KiB annotation limit; upgrade from client-side apply needs a special last-applied-configuration transfer (KEP-555) or users hit a force-conflicts wall. **Unknown manager is not an error; unknown field ownership is a conflict.** Closest lesson: identity of the *applier* is first-class, identity of a *saved plan* is not.

### 4.5 Database migrations — checksum, not id

Flyway Validate (Redgate, 2024-05-22): applied migrations are stored with **CRC32 checksums**. Change the file after apply ⇒ `Migration checksum mismatch for migration version X. Applied to database: … Resolved locally: … Either revert the changes, or run repair.` There is no "apply latest." Unknown version / missing file is "migration directory is corrupt" (Knex). Atlas `atlas.sum` is the same idea. The id is the version+checksum pair. A certificate-by-id that does not hash the payload will not catch "someone edited the plan after it was named."

### 4.6 Failure modes of stale plan ids (synthesis)

| Mode | Who hit it | Relevance to Amendment J |
|---|---|---|
| State moved after plan | Terraform "saved plan is stale"; Terragrunt run-all | Certificate id must bind the *state digest* the verdict was computed over (bullet 3), not just a UUID. |
| Plan does not close over unknowns | Pulumi `unknown` inputs; apply-inside-apply | A gate that abstained on a sub-check and was later "applied" as pass is this mode. |
| Shared-state sibling invalidation | Terragrunt module A apply stale-ifies module B | Fleet-wide packet gates: applying cert 1 can invalidate cert 2. Unknown-id-error is not enough; you need stale-vs-world. |
| Replay vs reconcile | Atmos moving off pure replay | Applying an old certificate against a new tree should error even if the id is known. |
| Force-conflict escape hatch | kubectl `--force-conflicts` | If Amendment J has any "force apply unknown id" flag, operators will use it the first week. |

**Inference:** implement apply-by-id as a **PlanApplication** record `{planId, planDigest, baseStateDigest}` with stale-state errors, *alongside* a verdict certificate, not as a field on the verdict. Terraform did not put `verificationResult` inside the plan file's public API; Nomad did not put cantTell on the modify index.

---

## 5. X / Twitter sweep

Engagement numbers are as returned by the X tools on 2026-08-26. Semantic search for "SLSA/in-toto attestations" in Latest mode was dominated by a single account repeating a FedRAMP-engine pitch and by unrelated "attestation/certificate" uses (SOC 2, political). Keyword search with practitioner `from:` filters was more usable. Dismissive takes are included.

### 5.1 Honest-gate / green-that-checked-nothing

| Date | URL | Author | Eng. | Claim |
|---|---|---|---|---|
| 2026-08-25 | https://x.com/HaMohX/status/2092160117999337747 | @HaMohX | 1 like, 57 views | Agent-run suite printed **309 passed, 0 failed; half never ran** — a test file crashed, the runner kept the normal output and discarded stderr, subsequent checks silently skipped. Fix proposed: fail on non-zero *or* zero results; hard floor on check count; delete one check on purpose to test the floor. **This is Amendment J bullets 1+5, as a war story from this week.** |
| 2026-08-20 | https://x.com/shivam74689/status/2090477282045690324 | @shivam74689 | 2 likes, 14 views | "A missing or empty evaluation suite shouldn’t silently become a 100% pass. The guard makes 'no tests ran' a failure condition." |
| 2026-07-31 | https://x.com/wuweiweiwu/status/2083290364832616904 | @wuweiweiwu (Momentic) | 8 likes, 265 views | "every checker has an off switch, and an agent optimizing for a passing build will find it: … github actions → continue-on-error: true … you asked for the errors to go away, and the shortest path to no errors is no checking." **Dismissive of boolean gates under agent optimisation.** Image attached. |
| 2026-04-22 | https://x.com/el_rei_gabriel/status/2047020144900125182 | @el_rei_gabriel | **334 likes, 24,606 views** | Management wanted lots of passing tests; suites full of `assert True`. Green as a metric, not a certificate. |
| 2025-11-06 | https://x.com/farisaziz12/status/1986386224907509966 | @farisaziz12 | 1 like | Jest empty-file: "Your test suite must contain at least one test" unless `--passWithNoTests`. |
| 2026-08-25 | https://x.com/XkaiiStudio/status/2092289188112863538 | @XkaiiStudio | 0 | Deleted a test that checked nothing; broke the code on purpose to verify the new test. |

### 5.2 Attestations / SLSA / in-toto in practice

| Date | URL | Author | Eng. | Claim |
|---|---|---|---|---|
| 2026-05-12 | https://x.com/schmitthub/status/2054182989924610306 | @schmitthub | 1 like, **6,685 views** | **"SLSA is cryptographic rubber stamping. It doesn't attest that a build isn't infected or malicious. It just lets you verify where the build came from."** The precise generate-without-verify / provenance≠safe dismissal. Mini Shai-Hulud (packet lane 4) is the existence proof. |
| 2026-07-21 | https://x.com/CoderJunkie/status/2079527130480922819 | @CoderJunkie | 0 | "most teams only learn what slsa is while writing their post-mortem" |
| 2026-06-30 | https://x.com/devopscube/status/2071813562620694830 | @devopscube | 29 likes, 10 RTs, 1,228 views | Pedagogy: most teams scan images, fewer verify how they were built; SLSA L3 + slsa-github-generator. The *pro* case, still focused on provenance not quality gates. |
| 2026-06-23 | https://x.com/devopscube/status/2069283210882662715 | @devopscube | 35 likes, 6 RTs, 1,585 views | 2026 TanStack npm compromise as the "how do you know that image came from your source" pitch. |
| 2024-05-02 | https://x.com/adityasaky/status/1786087245826453514 | @adityasaky (in-toto) | 10 likes | GitHub Artifact Attestations public beta: "Really cool to see in-toto <-> SLSA <-> Sigstore all come together so cleanly on GitHub Actions." Maintainer enthusiasm; not a gate-certificate claim. |
| 2023-05-03 | https://x.com/adityasaky/status/1653789849218961412 | @adityasaky | 14 likes, 8 RTs | Points at slsa.dev/blog/2023/05/in-toto-and-slsa — in-toto as the envelope for SLSA tracks. |
| 2023-11-03 | https://x.com/adityasaky/status/1720502990585397323 | @adityasaky | 2 likes | gitsign-signed attestations as a path to multi-signature authorization (cited in packet lane 4). |

### 5.3 SARIF

Latest SARIF mentions on X in this window were product pitches (CI/SARIF checks, pq-verify SARIF 2.1.0 into Code Scanning) with <200 views. No high-engagement practitioner thread on SARIF adoption showed up in Latest. The high-signal SARIF evidence remains GitHub discussion #65477 (not X) and the Code Scanning importer. **Absence of SARIF enthusiasm on X is itself a data point:** the format is plumbing, not identity.

### 5.4 Reading

Practitioner energy on X is (a) agents gaming boolean CI (`continue-on-error`, empty asserts, half-the-suite-never-ran) and (b) SLSA-as-provenance, with a durable dismissive take that provenance is rubber-stamping. Nobody is asking for a new certificate *schema*. They are asking for **skip ≠ pass** and for **verify-on-consume**. Amendment J's six bullets are a schema-shaped answer to (a). Binding that schema to SLSA/in-toto without a consumer that fail-closes is how you get (b).

---

## Verdict

### Should this team bind to an existing standard, profile one, or mint a bespoke type?

**Profile an in-toto Statement as the envelope, and put Amendment J's payload in a predicate. Do not mint a private envelope. Do not bind SARIF or SHACL as the native gate type. Do not treat civex.rs `Certificate` as a standard. Split apply-by-id into a Terraform-style plan artifact.**

Concretely:

1. **Envelope (bind):** in-toto Statement v1. Required `subject[].digest` *is* bullet 3. Monotonic parsing *is* the honest-gate consumer rule if you write policy as deny-unless. DSSE / Sigstore / GitHub attestations fall out for free when you later need a signature. This is the standard the SLSA/in-toto authors tell you to use for *any* claim about an artifact, including non-build claims (ITE-6, Palantir, packet lane 4).

2. **Outcome vocabulary (profile, do not invent):** map `GateVerdict` onto **EARL/ACT**: `passed` / `failed` / `cantTell` / `untested` / `inapplicable`. Amendment J's three-way is strictly coarser. Steal ACT's ranking (`untested` outranks `passed`) as the reach rule instead of a nullable `conforms`. If RDF is unwelcome, store the same five IRIs as strings.

3. **Per-check skip/degrade (profile Scorecard, not CIVeX):** required `reason` + score-or-outcome per check; inconclusive **excluded from the aggregate**. That is the only production system examined that already implemented "skip does not look like pass" as arithmetic. `assumptions[]` as unstructured labels (civex) is weaker than Scorecard `reason`.

4. **Reach (profile CycloneDX compositions + SARIF Appendix I, producer-side):** emit `aggregate: complete \| incomplete \| unknown` (CycloneDX) on the predicate. Treat `unknown`/`incomplete` as not-pass in *your* consumer, because SARIF Appendix I shows that leaving it to the consumer fails (GitHub, Qodana). Do **not** call this `sh:conforms` and do **not** use JSON null — SHACL `sh:conforms` is a boolean and in-toto parsing equates unset/null/empty.

5. **Predicate (mint, in the in-toto sense):** no vetted predicate has (closed 5-way outcome) + (per-check skip reasons) + (aggregate reach) + (rules fired). SVR is pass-list-only. VSA is PASSED/FAILED. Test Result cannot say "collected 0." The in-toto new-predicate guidelines exist for this. An internal `https://beep.dev/attestation/gate-certificate/v1` (or a contributed predicate) is a **profile of the framework**, not a bespoke type. Shipping the same JSON without `_type`/`predicateType`/`subject.digest` *would* be bespoke, and would throw away every verifier.

6. **Apply-by-id (separate type, bind Terraform/Nomad semantics):** `{planDigest, baseStateDigest, checkIndex}`. Unknown digest is an error; known-but-stale vs current state digest is an error; never latest. This is not a field on the verdict. civex.rs already split it (`plan.rs` vs `Certificate`). Keep that split.

### What would change my mind (the strongest arguments against this recommendation)

**Against profiling in-toto (the "just use SARIF" argument).** SARIF already has `kind` including `open` and `notApplicable`, Appendix I incomplete-run detection, `ruleId` rationale, and a GitHub-native consumer. Minting a predicate means a second format for the same repo, and no Code Scanning UI. If the *only* gates are SAST-shaped and the only consumer is GitHub, SARIF + a thin aggregator that fails closed on Appendix I conditions + `alls-green` for skipped jobs is less type machinery. **I still reject this as the native type** because GitHub ignores `kind`, Appendix I does not catch "configured to check nothing," and apply-by-id is out of scope — but it is the right *export*.

**Against minting any predicate (the "SVR is enough" argument).** SVR + monotonic policy (`deny unless properties contains PACKET_EVIDENCE_CLOSED`) encodes skip-as-absent without `assumptions[]` or `conforms: null`. That is the in-toto authors' intended honest-gate. Adding a skip array is the dual encoding; dual encodings drift. If the team can write deny-unless policies and live without a first-class abstain (treat missing as not-pass), **SVR v0.2 plus Scorecard-style reasons in a sidecar** refutes "we need GateCertificate" entirely. The cost: you cannot say "I looked, I cannot tell" (`cantTell`) as distinct from "I did not look" (`untested`) as distinct from "I looked and failed." EARL exists because that distinction matters in audit. Packet design-approval probably wants it.

**Against EARL vocabulary (the "operators want binary" argument).** Section 3.2 is a pile of cases where three-valued producers were collapsed by consumers (OPA default, GitHub Code Scanning, codecov default, `--passWithNoTests`, skipped-jobs-as-passing, SHACL boolean). If packet dashboards and `beep goals next` only colour pass/fail, `cantTell` will be configured to pass within a quarter. Scorecard's move — exclude inconclusive from the aggregate *in the producer* — is the mitigation. If the team will not build that aggregator, a three-valued certificate is boolean theater with extra fields.

**Against splitting apply-by-id (the "one object" argument).** Amendment J wants one certificate that is both the verdict and the thing you apply. Terraform's stale-plan errors show why that is attractive (one file to pass to apply) and why it is dangerous (the file must close over state). A verdict certificate that is also an apply token will be replayed against a moved tree. The strongest argument *for* one object is operational simplicity for agents. The strongest argument *against* is Terragrunt #4170: apply succeeded and then the next id was stale in the same run.

### Bottom line for the grill

Refutation of "we need a bespoke certificate type": **the envelope, the outcome vocabulary, the inconclusive-excluded-from-aggregate rule, the reach-aggregate enum, and the apply-stale-plan error already exist, in named standards, with production consumers.** What does not exist is a single type that concatenates them. Concatenating them inside an in-toto predicate is the standard extension mechanism. Concatenating them as a private JSON struct named after a research Rust file is how you forfeit the verifiers.

If Amendment J ships `GateCertificate` as a private schema, the honest-gate problem will still be a *consumer* problem, which is the problem every standard in this report already lost to (GitHub × SARIF kind, OPA × undefined, codecov × fail_ci_if_error, Actions × skipped jobs). The type is the easy part.

---

## Sources fetched

| When | URL | Used for | Status |
|---|---|---|---|
| 2026-08-26 | https://raw.githubusercontent.com/fabio-rovai/open-ontologies/main/src/civex.rs | Certificate / Verdict / assumptions / silent fallback | **verified** (full file) |
| 2026-08-26 | https://raw.githubusercontent.com/in-toto/attestation/main/spec/predicates/svr.md | SVR v0.2 | **verified** |
| 2026-08-26 | https://raw.githubusercontent.com/in-toto/attestation/main/spec/predicates/test-result.md | Test Result v0.1 | **verified** |
| 2026-08-26 | https://raw.githubusercontent.com/in-toto/attestation/main/spec/predicates/scai.md | SCAI v0.3 | **verified** |
| 2026-08-26 | https://raw.githubusercontent.com/in-toto/attestation/main/spec/predicates/vsa.md | pointer to SLSA VSA | **verified** |
| 2026-08-26 | https://raw.githubusercontent.com/in-toto/attestation/main/spec/predicates/README.md | vetted predicate list | **verified** |
| 2026-08-26 | https://slsa.dev/spec/v1.1/verification_summary | VSA fields, UNEVALUATED, PASSED+UNEVALUATED example | **verified** (page self-labels Retired in favour of v1.2) |
| 2026-08-26 | https://slsa.dev/spec/v1.0/provenance | provenance v1, completeness removed | **verified** (Retired → v1.2) |
| 2026-08-26 | https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html Appendix I; v2.0 §3.27.9 | kind, incomplete runs | **verified** via search snippets of the OASIS HTML |
| 2026-08-26 | https://github.com/orgs/community/discussions/65477 | GitHub ignores SARIF kind | **verified** |
| 2026-08-26 | https://www.w3.org/TR/shacl/ §§2.1.6, 3.4.1, 3.5, 3.6.1.1 | sh:conforms boolean, deactivated conforms, failures out-of-band | **verified** |
| 2026-08-26 | https://www.openpolicyagent.org/docs/management-decision-logs | decision_id, ids, rule_labels, nd_builtin_cache | **verified** |
| 2026-08-26 | https://www.openpolicyagent.org/docs/policy-reference/keywords/default | default collapses undefined | **verified** |
| 2026-08-26 | https://www.w3.org/TR/2011/WD-EARL10-Schema-20110510/ | cantTell / untested / inapplicable | **verified** via snippets |
| 2026-08-26 | https://www.w3.org/TR/act-rules-format/ | ACT 1.1 outcomes + ranking | **verified** via snippets |
| 2026-08-26 | Scorecard checker docs, json v2, statement.go, checks.md, OpenSSF 2024-04-17 post, arXiv:2208.03412 | -1 inconclusive, reason, in-toto export | **verified** via snippets + pkg.go.dev |
| 2026-08-26 | https://cyclonedx.org/capabilities/attestations/ + compositions use cases | CDXA, aggregate complete/incomplete/unknown | **verified** |
| 2026-08-26 | https://www.w3.org/TR/vc-data-model-2.1/ | VC envelope | **verified** via snippet (WD 2026-08-16) |
| 2026-08-26 | HashiCorp terraform apply / plan tutorial; atmos planfiles; terragrunt #4170 | saved plan stale | **verified** |
| 2026-08-26 | https://developer.hashicorp.com/nomad/commands/job/plan | check-index | **verified** |
| 2026-08-26 | https://www.pulumi.com/docs/iac/operations/stack-management/update-plans/ | --plan discrepancies fail immediately | **verified** |
| 2026-08-26 | https://kubernetes.io/docs/reference/using-api/server-side-apply | SSA conflicts, not plan-id | **verified** |
| 2026-08-26 | Redgate Flyway validate 2024-05-22 | checksum mismatch | **verified** |
| 2026-08-26 | codecov-action README + #1348 + action.yml default false | silent upload fail | **verified** |
| 2026-08-26 | Ken Muse 2024-09-06; emmer.dev skipped checks; toolkit #1739 | continue-on-error / skipped = pass | **verified** |
| 2026-08-26 | Cypress blog pass-with-no-tests; jest #14448; SO pytest collected 0; StarSling shard; SO-Agents skipif TIL | empty-suite greens | **verified** |
| 2026-08-26 | X posts listed in §5 | practitioner sentiment | **verified** (tool fetch; views as of this run) |
| — | SPDX 3.0 spec body | completeness flags | **not verified** this session |
| — | SLSA spec v1.2 full body | source-track VSA extras | **inferred** from v1.2-rc snippets |
| — | open-ontologies `src/shacl.rs` / `src/plan.rs` | recon's conforms=null and apply-by-id | **not re-fetched**; treated as recon claims |

Firecrawl MCP was rate-limited this session; primary fetches used raw GitHub, W3C/OASIS/HashiCorp HTML, and X native search.

)
