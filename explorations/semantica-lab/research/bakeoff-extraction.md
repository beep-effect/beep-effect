# Extraction method-contract bake-off

*Candidate screen (B1): this file is slate + probe order, not a family verdict. Current law: DECISIONS.md "Current law" table. The canary is C0-C2 (G1), not the winner line below.*

Date: 2026-08-24. Repo evidence is from beep `9a15d33f` and semantica `add1c006` [M1].
This sheet compares extraction methods behind one schema-first service. A candidate is a method
contract, not a provider or model. Scores are provisional ranges because no `gold/v1`
G-entity/G-relation run exists yet [M1]. `UNKNOWN` is not evidence for or against a method.

## Gate table

Gate numbers are rubric §1 [R]. `PASS (adapt)` means the method can clear the gate only through the
named adapter; the nonconforming incumbent path is excluded. Any `UNKNOWN` becomes an M1 kill
criterion, so this table does not ratify an implementation.

| Candidate | G1 envelope | G2 license | G3 sustainability | G4 no fake success | G5 ceilings | G6 security | G7 determinism | G8 semantic floor |
|---|---|---|---|---|---|---|---|---|
| Pattern rules over tokens | **PASS.** Wink runs in Bun/Node, and the measured local probe needed no service [B6][M1]. | **PASS.** beep NLP packages are Apache-2.0 and `@beep/wink` is MIT [B4]. | **PASS.** The repo owns the adapters; wink is MIT-vendorable and has tagged 2.4.0 [U3]. | **PASS (adapt).** Use token offsets or fail-closed `VerifiedSpan`; reject WinkBackend's fabricated `{start:0}` miss [B3][B6]. | **UNKNOWN.** Probe cleared cold start, peak RSS, and footprint at 0.06-0.08 s, 84,952-87,044 KiB, and 4,480,646 bytes; W1 duration and disk growth are unmeasured [M1]. | **UNKNOWN.** `NLPBackend` accepts unbounded strings; the common request cap is not wired to this lane [B4][B5]. | **UNKNOWN.** Rules can be stable, but Clock timestamps and no report-hash replay fixture remain [B4][B6]. | **UNKNOWN.** Entity spans exist, but the live Wink lane has no relations and no shared-schema event/id lineage [B4][B6]. |
| LLM structured output via agents transport | **PASS, exception lane only.** Generation executes through the Bun `LanguageModel`; network is expressly allowed only for the separately scored LLM lane [W][B2][B7]. | **PASS.** The conveyed beep extraction code is Apache-2.0; this lane bundles no provider weights [B4]. | **PASS.** Provider transport and schema validation are repo-owned and releasable; endpoint continuity affects score, not vendoring [B2][B7]. | **PASS (adapt).** Generation/parse failures are tagged and unaligned output is explicit; silent repair-to-success is forbidden [B1][B2][B3]. | **UNKNOWN.** No W1 latency, request cost, rate-limit, or offline-replay measurement exists; the call timeout is 30 s [B2]. | **PASS.** Request/candidate axes are bounded and remote extraction denies by default without policy [B1][B2]. | **UNKNOWN.** Alignment is deterministic, but the current result omits prompt/response hashes and an immutable provider revision [B2][B3]. | **UNKNOWN.** Grounded spans survive, but the handoff currently emits zero relations and does not materialize mention spans [B1][B3]. |
| Local ML NER through shared ORT | **PASS.** `onnxruntime-node` is already loaded in an Effect service; upstream ships CPU binaries for the target desktop matrix [B8][U1]. | **PASS for probe model.** ORT and representative `dslim/bert-base-NER` weights are MIT [U2][U4]. | **PASS for runtime.** ORT is tagged and buildable; the model and tokenizer can be hash-pinned [U1][U4]. | **UNKNOWN.** There is no NER ORT adapter yet, so typed model/init/inference failure has not been proved [B5][B8]. | **UNKNOWN.** Installed ORT is 270,827,297 bytes and representative ONNX weights are 431 MB; shared-runtime accounting, RSS, and cold inference are unmeasured [M1][U5]. | **UNKNOWN.** No tokenizer-length, tensor-shape, or artifact-acquisition policy exists for NER [B8]. | **UNKNOWN.** A pinned local model is replayable in principle; token aggregation and numerical-drift fixtures do not exist [U4]. | **UNKNOWN.** No adapter maps token labels, offsets, model identity, and provenance into the shared schema [S][B8]. |
| Hybrid evidence pipeline, pattern + LLM; ML optional | **PASS.** The required lanes run from Bun; remote generation remains an explicit exception lane [W][B2][B6]. | **PASS.** The selected in-repo lanes are permissive; any future model must clear its own weight license [B4][U2]. | **PASS (contract).** One tagged service and serializable method config are repo-vendorable; this is not an adapter registry [D][S]. | **PASS (contract).** Each lane returns `EvidenceBatch` or a typed failure/degraded state; fallback never changes method identity [S][A]. | **UNKNOWN.** Pattern cost is measured, but combined W1 cost and any optional ML cost are not [M1]. | **UNKNOWN.** The LLM lane is bounded; equivalent bounds and acquisition checks are not yet common across all lanes [B1][B5]. | **UNKNOWN.** Stable ordering plus capture/replay is specified below, not implemented [W][A]. | **UNKNOWN.** The target contract preserves all fields, but no round-trip EvidenceBatch fixture exists [S][A]. |

## Scores

Task quality uses G-entity/G-relation evaluation potential, span fidelity, typed failure, and
replayability. Totals add the four bucket ranges; they are not measurements of extraction
accuracy. A hard-gate `UNKNOWN` remains binding even when a score is high.

| Candidate | Task quality /40 | Operational fit /25 | Integration + migration /20 | Sustainability /15 | Total /100 |
|---|---|---|---|---|---|
| Pattern rules | **19-25.** Gold precision/recall UNKNOWN. Offset-bearing rule output and stable rules help; live Wink has entity-only coverage, and semantica's fixed rule families show narrow relation recall [B6][P2]. | **22-24.** Measured cold/RSS/bytes fit comfortably; full W1 and rebuild cost UNKNOWN [M1]. | **15-17.** Backend port, nodes, and strict span code exist; add bounds, rule identity, provenance events, and relation evidence [B3][B4][B5]. | **11-13.** 283 NLP/NLP-processing/Wink tests passed locally; wink 2.4.0 is MIT-vendorable, but its latest release is 2025-06-30 [M1][U3]. | **67-79.** Derived sum; G scores and replay fixture remain UNKNOWN. |
| LLM structured output | **24-34.** G scores UNKNOWN. Arbitrary targets and few-shot examples cover both gold vocabularies in principle; current flat candidates and fuzzy alignment can lose relation shape or exact evidence [B1][B2]. | **7-15.** No local model bytes, but network latency, rate limits, cost, W1 duration, and capture storage are UNKNOWN [W][B2]. | **15-18.** `LangExtractService`, typed parse errors, policy, and agents transport exist; add relation claims, model/prompt hashes, and exact-span enforcement [B1][B2][B7]. | **10-13.** 64 LangExtract and 6 transport tests passed; provider behavior and model aliases remain external [M1][B7]. | **56-80.** Derived sum; widest uncertainty is task quality and operations. |
| Local ML NER | **19-31.** G scores UNKNOWN. The representative model reports CoNLL F1, but only LOC/ORG/PER/MISC and news-domain training, so it does not evidence works, methods, or G-relation quality [U4]. | **8-17.** ORT import measured 0.01 s/27,888-30,380 KiB, but the unpacked runtime and 431 MB model leave packaging and inference RSS UNKNOWN [M1][U5]. | **10-15.** Reuses ORT loading and `NLPBackend`; tokenizer, IOB aggregation, model identity, acquisition, and evidence mapping are net new [B5][B8][P2]. | **11-14.** ORT is active and MIT; model maintenance is narrower, and the NER adapter has no tests because it does not exist [U2][U4]. | **48-77.** Derived sum; do not activate while G4-G8 remain UNKNOWN. |
| Hybrid evidence pipeline | **32-36.** G scores UNKNOWN. Pattern supplies an offline precision baseline; LLM supplies open-class entity/relation candidates; one claim merge retains conflicts and spans instead of overwriting them [W][S][A]. | **14-18.** Mandatory pattern cost is small; LLM runs only in its exception lane and ML is off by default, but combined W1 cost is UNKNOWN [M1][W]. | **13-15.** Reuses every incumbent brick but needs the common EvidenceBatch schema, deterministic merge, capture/replay, and two adapter repairs [B1][B3][B4]. | **11-13.** Components have live tests and permissive code; the orchestrator and eval fixtures are new [M1]. | **70-82.** Derived sum; midpoint 76 is the provisional winner. |

## Verdict (historical screen; superseded by B1)

**Already-have.** Keep provider transport in the agents/Effect AI path, `@beep/langextract`'s
bounded request, typed parse errors, alignment, remote-policy guard, and strict `VerifiedSpan`;
keep `@beep/nlp` branded handoff ids/spans/provenance and `@beep/nlp-processing`'s typed backend
port. Keep Wink tokenization, NER, and custom pattern machinery. None receives a quality bye:
the current LangExtract handoff drops relations, while WinkBackend can fabricate a first-position
span on a miss [B1][B2][B3][B4][B5][B6][B7].

**Pick-one, M1: hybrid EvidenceBatch method contract.** One `ExtractionMethod` tagged config
(`Pattern | LlmStructured | LocalNer | Hybrid`) is pipeline data, interpreted by one service.
Every execution emits either a schema-validated `EvidenceBatch` or a typed error/degraded state.
Each entity/relation claim carries source span(s), branded confidence, method tag, rule or
model+revision+artifact hash, prompt/config hash where applicable, input chunk and provenance-event
refs, and transformation lineage. Claims retain disagreements as separate evidence nodes [S][A].

M1 runs deterministic pattern rules as the offline baseline, then runs LLM structured extraction
as a separately reported augmenter. It never substitutes LLM output when the baseline fails.
Local ML remains a dormant tag until its park criteria clear. The **runner-up is pattern-only**:
it is cheaper and replayable, but it cannot credibly target G-relation breadth by itself [B6][P2].

Before accepting the winner, run the same W1/F1 slices through both winner and runner-up. Report
exact-span and overlap entity precision/recall/F1, endpoint+predicate relation F1, unaligned/typed
failure counts, claim-batch hash equality across two replays, and the workload budgets. This is the
missing falsifier, not optional polish [W].

**Sensitivity.** Yes, narrowly, on bucket midpoints. Hybrid scores 76 versus pattern 73. The
worst single five-point transfer, task quality → operational fit, leaves 74.95 versus 74.85.
Evidence ranges still overlap, so the gold probe can overturn the pick without amending weights.

## Park list

- **Local ML activation:** park until one named model beats the pattern G-entity baseline and the shared ORT package plus weights clear acquisition, footprint, cold-start, and RSS budgets.
- **LLM-only primary method:** park; it cannot satisfy the named offline lane and lacks immutable provider/model replay evidence. Keep it only inside the hybrid exception lane.
- **Current WinkBackend span adapter:** park `findSpan`; direct token offsets or fail-closed `VerifiedSpan` must replace its `{start:0}` success-shaped miss [B6].
- **Current LangExtract handoff as KG output:** park; it makes entities from every aligned extraction, emits `relations: []`, and omits materialized mention spans [B3].
- **Porting semantica `semantic_extract`:** park the runtime and provider layer; salvage only tests, patterns, and prompt ideas after they pass the common contract.

## Parked-SOTA appendix

The strongest gate-parked reference inspected is semantica 0.6.6's full Python hybrid. It has
pattern, spaCy/Hugging Face, typed LLM entity/relation/triplet paths and a provider instance pool
[P1][P2][P3][P4]. It fails G4 because ML silently becomes pattern output and unmatched LLM relation
endpoints become synthetic entities. It fails G8 because triplets are plain strings, LLM offsets
default to zero, and provenance can silently disable [P1][P2][P3][P4][P5].

| Candidate | Gate state | Task /40 | Ops /25 | Integration /20 | Sustainability /15 | Total |
|---|---|---|---|---|---|---|
| Hybrid EvidenceBatch winner | G4 PASS by contract; G5-G8 include UNKNOWNs above | **32-36** [S][A] | **14-18** [M1][W] | **13-15** [B1][B2][B3][B4][B5][B6][B7] | **11-13** [M1] | **70-82** |
| semantica Python hybrid | **PARK: G4, G8 FAIL; G5 UNKNOWN** [P1][P2][P3][P4][P5] | **20-29.** No G eval; broad methods, but false spans/synthetic endpoints [P1][P2][P3]. | **3-8.** W1 UNKNOWN; Python core pulls spaCy, Torch, Transformers and ORT [P6]. | **4-8.** Separate Python runtime, duplicate providers, three output idioms [P1][P4][P6]. | **10-13.** MIT 0.6.6 and source-owned, but no release/test-depth evidence opened [P6]. | **37-58** |

## Sources appendix

- **[R]** `explorations/semantica-lab/research/criteria-rubric.md` §§1-4; **[W]** `explorations/semantica-lab/research/workload-contract.md`; **[S]** `explorations/semantica-lab/research/shared-schema.md`; **[C]** `explorations/semantica-lab/research/docs-url-census.md`; **[D]** `explorations/semantica-lab/DECISIONS.md` D7-D10, D16 and A4/A7-A9; **[A]** `explorations/semantica-lab/research/adhd-reasoning.md:108-123`.
- **[B1]** `packages/foundation/capability/langextract/src/Extraction/Extraction.model.ts:139-248,293-316,386-397`; `Extraction.behavior.ts:23-120`.
- **[B2]** `packages/foundation/capability/langextract/src/Service/Service.layer.ts:44-107`; `Service.policy.ts:61-142`; `Extraction.config.ts:9-92`.
- **[B3]** `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.errors.ts:28-95`; `VerifiedSpan.behavior.ts:400-475`; `Handoff/Handoff.behavior.ts:24-85`.
- **[B4]** `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:213-326,351-511`; package manifests for `@beep/langextract`, `@beep/nlp`, and `@beep/nlp-processing`.
- **[B5]** `packages/foundation/capability/nlp-processing/src/Backend/NLPBackend.ts:64-204,248-355`; `packages/foundation/modeling/nlp/src/Graph/Schema.ts:343-383,490-530`.
- **[B6]** `packages/drivers/wink/src/WinkBackend.service.ts:37-52,110-138`; `packages/drivers/wink/package.json:1-72`.
- **[B7]** `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:61-72,168-188,247-259`; `packages/agents/use-cases/src/processes/AssistantTurn/AssistantTurn.contracts.ts:179-200`.
- **[B8]** `packages/drivers/face-detection/src/FaceDetection.service.ts:337-358,802-839`; root `package.json:182`; installed `node_modules/onnxruntime-node/package.json:1-54`.
- **[P1]** `~/YeeBois/workstation-apps/semantica/semantica/semantic_extract/types.py:12-44`; `schemas.py:4-127`.
- **[P2]** semantica `methods.py:615-772,775-926,1238-1344,1545-1704`; **[P3]** `methods.py:929-1124,1707-2148`.
- **[P4]** semantica `providers.py:94-230,232-561,1458-1543`; **[P5]** `extraction_validator.py:61-184,200-284`; `semantic_extract_provenance.py:60-110`.
- **[P6]** semantica `pyproject.toml:5-15,45-89,101-115`.
- **[M1]** Local 2026-08-24 measurements: source commits and `gold/v1` census; `du -sb`; five fresh Bun imports/runs; Vitest single-worker results: LangExtract 64, NLP 166, NLP-processing 71, Wink 46, agents transport 6 tests, all passed. The first default-pool attempt ran no tests because fork workers timed out and is excluded.
- **[U1]** <https://onnxruntime.ai/docs/get-started/with-javascript/node.html> (opened 2026-08-24).
- **[U2]** <https://github.com/Microsoft/onnxruntime/blob/main/LICENSE> (opened 2026-08-24).
- **[U3]** <https://github.com/winkjs/wink-nlp/releases> (opened 2026-08-24).
- **[U4]** <https://huggingface.co/dslim/bert-base-NER> (opened 2026-08-24).
- **[U5]** <https://huggingface.co/dslim/bert-base-NER/tree/main/onnx> (opened 2026-08-24).
