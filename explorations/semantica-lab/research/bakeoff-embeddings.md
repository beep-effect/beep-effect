# Embeddings bake-off

*Candidate screen (B1): this file is slate + probe order, not a family verdict. Current law: DECISIONS.md "Current law" table. The canary is C0-C2 (G1), not the winner line below.*

Status: evidence screen, 2026-08-24. Verdicts are provisional until the W1 retrieval set and the
same-model runtime probe close the `UNKNOWN` gates. Where a `PASS` names a wrapper condition, the
pass is conditional on that policy. `UNKNOWN` is not a soft pass.

The model comparison uses English retrieval as a proxy for the 25-paper academic W1 slice. MTEB's
English retrieval inventory contains SciDocs and SciFact, but W1 currently specifies no embedding
queries or relevance judgments [W, MTEB]. Therefore every task-quality range includes explicit W1
uncertainty; no model-card number is presented as a W1 result.

## Gate table

Gates are G1 envelope, G2 code and weights license, G3 releasable/vendorable, G4 no success-shaped
fallback, G5 resource ceilings, G6 secure pinned acquisition, G7 replayability, and G8
`ModelIdentity` plus typed `DegradedEmbedding` [R, S].

### Decision 1: model

Runtime-specific cold start, RSS, and numerical drift are held for decision 2. Model G5 covers the
artifact ceiling; model G7 covers whether immutable model identity is possible.

| Candidate | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `BAAI/bge-small-en-v1.5` | PASS: official ONNX is Bun-loadable [BGE-S, ORT] | PASS: weights MIT [BGE, C] | PASS: fixed ONNX is vendorable [BGE-S] | PASS: artifact has no fallback; wrapper must emit `DegradedEmbedding` [S] | PASS: 133 MB ONNX <600 MB [BGE-S, W] | UNKNOWN: opened tree gives bytes, but this pass did not capture the main-branch file hash [BGE-S] | UNKNOWN: full revision/hash manifest and replay test absent | PASS: 384-d identity fits; degradation wrapper is NET-NEW [BGE, S] |
| `BAAI/bge-base-en-v1.5` | PASS: official ONNX is Bun-loadable [BGE-B, ORT] | PASS: weights MIT [BGE, C] | PASS: fixed ONNX is vendorable [BGE-B] | PASS: same typed wrapper requirement [S] | PASS: 436 MB ONNX <600 MB, with 164 MB headroom [BGE-B, W] | UNKNOWN: opened tree gives bytes, but this pass did not capture a pinned file hash [BGE-B] | UNKNOWN: full revision/hash manifest and replay test absent | PASS: 768-d identity fits; degradation wrapper is NET-NEW [BGE, S] |
| `sentence-transformers/all-MiniLM-L6-v2` | PASS: official ONNX is sidecar-compatible [MINI, ORT] | PASS: weights Apache-2.0 [MINI, C] | PASS: fixed ONNX is vendorable [MINI-O] | PASS: same typed wrapper requirement [S] | PASS: 90.4 MB F32 or 23 MB quantized <600 MB [MINI-O, W] | UNKNOWN: this pass did not capture the chosen quantized file's revision+hash | UNKNOWN: chosen artifact and runtime replay remain unpinned | PASS: 384-d identity fits; degradation wrapper is NET-NEW [MINI, S] |
| `nomic-ai/nomic-embed-text-v1.5` | PASS: official ONNX supports local runtimes [NOMIC, NOMIC-O] | PASS: weights Apache-2.0 [NOMIC] | PASS: fixed ONNX is vendorable [NOMIC-O] | PASS: same typed wrapper requirement [S] | PASS: 137 MB int8 <600 MB [NOMIC-O, W] | PASS: int8 file publishes SHA-256; freeze full revision and remote-off policy [NOMIC-O] | PASS: revision+hash+768 dim can key rebuilds; runtime drift remains decision 2 [NOMIC] | PASS: identity fits; task prefix and truncation contract must also be frozen [NOMIC, S] |
| `Alibaba-NLP/gte-base-en-v1.5` | PASS: official ONNX and Transformers.js paths exist [GTE, GTE-O] | PASS: weights Apache-2.0 [GTE] | PASS: fixed ONNX is vendorable [GTE-O] | PASS: same typed wrapper requirement [S] | PASS: 147 MB int8 <600 MB [GTE-O, W] | UNKNOWN: revision was visible, but this pass did not capture the file SHA-256 [GTE-O] | UNKNOWN: artifact manifest and exact-runtime replay test absent | PASS: 768-d identity fits; degradation wrapper is NET-NEW [GTE, S] |
| `Snowflake/snowflake-arctic-embed-m-v1.5` | PASS: official ONNX, Transformers.js, and GGUF paths exist [SNOW, SNOW-O] | PASS: weights Apache-2.0 [SNOW] | PASS: fixed ONNX/GGUF is vendorable [SNOW-O, SNOW-G] | PASS: same typed wrapper requirement [S] | PASS: 110 MB int8 <600 MB; 109M params [SNOW-O, SNOW] | PASS: int8 file publishes SHA-256 `a18f...f6e`; freeze full revision and remote-off policy [SNOW-O] | PASS: revision+artifact hash+dim can key rebuilds; runtime drift remains decision 2 [SNOW, S] | PASS: 768 or MRL-256 dim is explicit; degradation wrapper is NET-NEW [SNOW, S] |

### Decision 2: runtime, Snowflake model held constant

| Candidate | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Native `onnxruntime-node` in Bun | PASS: already loads in the Bun sidecar [L-ORT, P] | PASS: MIT [ORT-PKG] | PASS: locked 1.27.0 package and buildable upstream [L-ORT, ORT-PKG] | PASS: existing Effect adapter maps load/run failures to typed errors; embedding degradation is NET-NEW [L-ORT, S] | UNKNOWN: module-only 0.03 s/27,284 KiB; installed all-target package 259 MB, Linux x64 payload 38.4 MB; full model cold/RSS/W1 absent [P] | PASS: lock integrity + local model path + published model SHA permit offline inference [L-ORT, SNOW-O] | UNKNOWN: no same-input CPU-EP replay/drift run across restarts and versions | PASS: existing `Context.Service`/Layer shape fits; `EmbeddingOutcome` and `ModelIdentity` remain NET-NEW [L-ORT, S] |
| `@huggingface/transformers` using ORT-web/WASM/WebGPU | PASS: Node-side inference is documented; keep it out of the webview [TJS-N] | PASS: Apache-2.0 [TJS-R] | PASS: maintained tagged releases [TJS-R] | PASS: pipeline exceptions must map to typed degradation, never vectors [S] | UNKNOWN: exact Snowflake Bun/WASM/WebGPU cold, RSS, throughput, and W1 run absent; WebGPU is experimental [TJS, TJS-G] | PASS: `localModelPath` plus `allowRemoteModels=false` supports explicit offline operation [TJS-N] | UNKNOWN: CPU/WASM/WebGPU numerical drift and ordering were not measured | PASS: high-level tokenizer/pooling helps, but Effect schema/error adapter is NET-NEW [SNOW-O, S] |
| `fastembed` JS class | PASS: native ORT runs locally [FAST-R] | PASS: JS package MIT; weights Apache-2.0 [FAST-P, SNOW] | PASS: v2.1.0 is releasable/vendorable, though repo archived 2026-01-15 [FAST-R] | UNKNOWN: no Effect-level typed-degradation adapter was inspected | UNKNOWN: no Snowflake same-model support/resource run; package is absent locally [FAST-R, P] | FAIL: source downloads a GCS tar and extracts it without checksum verification [FAST-S] | UNKNOWN: no pinned Snowflake replay or drift evidence | UNKNOWN: custom-output identity/degradation round trip was not demonstrated [S] |
| Spawned `llama.cpp` embedding runtime | PASS: bundle-and-spawn local binary [LLAMA-E, LLAMA-R] | PASS: runtime MIT; weights Apache-2.0 [LLAMA-L, SNOW] | PASS: source builds and prebuilt releases with SHA-256 exist [LLAMA-R] | PASS: nonzero exit/invalid JSON must become typed degradation [LLAMA-E, S] | UNKNOWN: 118 MB Q8 GGUF fits download cap, but cold/RSS/throughput and binary footprint on W1 are unmeasured [SNOW-G] | PASS: pin release asset and GGUF hashes; run with local paths only [LLAMA-R, SNOW-G] | UNKNOWN: exact-model drift vs ONNX is unmeasured; a prior CLI/server embedding-drift defect shows the probe matters [LLAMA-D] | PASS: JSON vector can be wrapped with identity; process protocol and typed health state are NET-NEW [LLAMA-E, S] |
| API-backed through agents/Venice | PASS: task addendum declares this remote lane envelope-legal; transport already exists [A, L-API] | UNKNOWN: provider/model terms were not analyzed; census marks OpenAI weights proprietary [C] | PASS: current typed transport is releasable [L-API] | PASS: transport uses typed errors and no vector fallback; `DegradedEmbedding` mapping is NET-NEW [L-API, S] | FAIL: cannot satisfy the named post-acquisition network-disabled loop; latency/p95 also UNKNOWN [W] | PASS: network is explicit/authenticated rather than silent [L-API] | FAIL: provider response gives model name, not immutable revision/artifact hash [L-API] | FAIL: current response cannot truthfully populate required revision and artifactHash [L-API, S] |

## Scores

Ranges reflect missing W1 qrels and runtime measurements. Totals are arithmetic range sums, not
false-precision point estimates. Only candidates with no `FAIL` are scored; their gate
`UNKNOWN`s remain adoption blockers.

### Model survivors

| Candidate | Task quality /40 | Operational fit /25 | Integration + migration /20 | Sustainability /15 | Total /100 |
| --- | --- | --- | --- | --- | --- |
| BGE small v1.5 | **28-34**: MTEB retrieval 51.68; academic W1 UNKNOWN [BGE, MTEB] | **21-24**: 133 MB, 384-d; cold/RSS runtime-held [BGE-S] | **17-19**: official ONNX and semantica incumbent reduce migration; typed identity/degradation still new [SEM, S] | **11-14**: MIT and FlagEmbedding project; issue latency/test depth UNKNOWN [C, BGE] | **77-91** (sum) |
| BGE base v1.5 | **30-36**: MTEB retrieval 53.25; academic W1 UNKNOWN [BGE, MTEB] | **18-22**: 436 MB and 768-d; limited artifact headroom [BGE-B] | **17-19**: same BGE contract, but full re-embed required [BGE, S] | **11-14**: MIT and FlagEmbedding project; issue latency/test depth UNKNOWN [C, BGE] | **76-91** (sum) |
| all-MiniLM-L6-v2 | **23-29**: MTEB retrieval 41.95 and >256 wordpieces truncate; W1 UNKNOWN [MINI, MTEB-M] | **23-25**: 90.4 MB F32/23 MB quantized, 384-d; runtime-held [MINI-O] | **17-19**: broad ONNX support; truncation and full re-embed must be explicit [MINI, S] | **12-14**: Apache-2.0 sentence-transformers lineage; issue latency UNKNOWN [MINI, C] | **75-87** (sum) |
| Nomic v1.5 | **31-37**: MTEB retrieval 53.01, 8192-token context; W1 UNKNOWN [NOMIC, MTEB-M] | **18-22**: 137 MB int8, 137M params/768-d; full RSS UNKNOWN [NOMIC-O] | **14-18**: query/document prefixes and preprocessing identity add migration risk [NOMIC, S] | **10-13**: Apache-2.0 official model; custom-code and issue-latency evidence UNKNOWN [NOMIC] | **73-90** (sum) |
| GTE base en v1.5 | **33-39**: MTEB retrieval 54.09 and LoCo 87.44 support long-text case; W1 UNKNOWN [GTE] | **18-22**: 147 MB int8, 137M params/768-d; full RSS UNKNOWN [GTE, GTE-O] | **16-19**: official ONNX/Transformers.js and 8192 context; exact preprocessing + re-embed required [GTE, S] | **11-14**: Apache-2.0 official Alibaba model; issue latency/test depth UNKNOWN [GTE] | **78-94** (sum) |
| Snowflake Arctic m v1.5 | **34-38**: MTEB retrieval 55.14; MRL-256 retains 54.2; combined int8-weight+256-d path and W1 UNKNOWN [SNOW] | **21-24**: 110 MB int8, 109M params; 256-d storage option; full RSS UNKNOWN [SNOW, SNOW-O] | **17-19**: official ONNX/JS/GGUF, explicit dim; typed degradation + full re-embed remain [SNOW, S] | **12-14**: Apache-2.0 official model/repo; issue latency/test depth UNKNOWN [SNOW] | **84-95** (sum) |

### Runtime survivors with Snowflake held constant

| Candidate | Task quality /40 | Operational fit /25 | Integration + migration /20 | Sustainability /15 | Total /100 |
| --- | --- | --- | --- | --- | --- |
| Native ORT in Bun | **24-36**: CPU EP exists; model-held throughput, full cold/RSS, drift, and W1 all UNKNOWN [ORT, P] | **17-22**: module probe 0.03 s/27,284 KiB; 38.4 MB target payload but 259 MB unpruned install; model 110 MB [P, SNOW-O] | **15-18**: existing Effect Layer/typed ORT errors; tokenizer, pooling, identity, degradation are new [L-ORT, S] | **13-15**: MIT, buildable, versioned Microsoft runtime [ORT-PKG] | **69-91** (sum) |
| Transformers.js | **22-34**: exact model is supported and CPU WASM fallback exists; same-model Bun throughput/drift UNKNOWN [SNOW-O, TJS] | **15-22**: local-only cache controls exist; exact package/RSS/cold UNKNOWN, WebGPU experimental [TJS-N, TJS-G] | **16-19**: tokenizer/pooling pipeline reduces code; package is only in scratchpad today and typed adapter is new [L-TJS, S] | **12-14**: Apache-2.0, 87 tagged releases; issue latency UNKNOWN [TJS-R] | **65-89** (sum) |
| Spawned llama.cpp | **20-33**: CPU embedding path exists; ONNX-vs-GGUF drift/throughput/W1 UNKNOWN [LLAMA-E, LLAMA-D] | **13-20**: Q8 GGUF 118 MB; process cold/RSS and packaged binary size UNKNOWN [SNOW-G, LLAMA-R] | **10-15**: new binary lifecycle, IPC, JSON validation, identity and typed degradation [LLAMA-E, S] | **12-14**: MIT, source builds and frequent hashed binaries; issue latency UNKNOWN [LLAMA-L, LLAMA-R] | **55-82** (sum) |

## Verdict (historical screen; superseded by B1)

**pick-one (provisional): `Snowflake/snowflake-arctic-embed-m-v1.5` + native
`onnxruntime-node` in the Bun sidecar.** Use the 110 MB int8 ONNX artifact, freeze the full HF
revision and published SHA-256, freeze tokenizer/pooling/query conventions, and emit normalized
MRL-256 vectors as `ModelIdentity { name, revision, artifactHash, dim: 256 }`. Any acquisition,
load, inference, or identity failure returns a typed `DegradedEmbedding`; never port semantica's
hash-seeded random vector [SEM, S]. The runtime is an adaptation of an existing ORT/Effect pattern,
not an `already-have`: there is no embedding service or identity schema in live packages [D, L-ORT].

**Runner-up:** `gte-base-en-v1.5` + Transformers.js. GTE is the stronger long-context challenge
candidate, while Transformers.js owns tokenizer/pooling and explicit offline controls. Promote it
only if W1 favors its long-text behavior or native tokenization/pooling cost breaks the two-week
appetite.

**Kill probes before adoption:** create W1 query/qrel labels; pin a complete artifact manifest;
run identical chunks through native ORT and Transformers.js over three cold restarts; record
throughput, ready time, peak RSS, package-pruned bytes, cosine/max-absolute drift, stable ordering,
and network-disabled reinstall. Required: every gate PASS, <5 s cold, <2 GB RSS, <250 MB added
dependencies, and byte-stable report identity [W, R].

**Sensitivity:** using each range midpoint, Snowflake (89.5) stays ahead of GTE (86.0), and native
ORT (80.0) stays ahead of Transformers.js (77.0), when any one bucket weight moves by ±5 points
and the other weights are proportionally renormalized. The ranges overlap, so missing W1 and
same-model measurements can still overturn both picks; that is evidence uncertainty, not a
weighting tie.

## Park list

- `gte-base-en-v1.5` + Transformers.js: reserve runner-up; close hash/replay and W1 evidence first.
- BGE small v1.5: park as the low-risk incumbent baseline; lower proxy retrieval than the pick.
- BGE base v1.5: park; less artifact headroom and lower proxy retrieval than Snowflake.
- all-MiniLM-L6-v2: park as a tiny-device baseline; 256-token truncation and proxy retrieval trail.
- Nomic v1.5: park; prefixes/preprocessing add contract risk without a proxy-quality win.
- Transformers.js with Snowflake: park as runtime runner-up pending same-model measurements.
- llama.cpp with Snowflake: park; process and GGUF drift costs have no measured upside here.
- fastembed JS: gate-park on G6; archive status and checksum-free downloader compound the risk.
- API-backed embeddings: gate-park on G5/G7/G8; not offline or artifact-identifiable.

## Parked-SOTA appendix

The strongest evidenced gate-parked model opened in this pass is
`Alibaba-NLP/gte-Qwen1.5-7B-instruct`. This is not a shipping recommendation.

| Candidate/state | Task /40 | Operational /25 | Integration /20 | Sustainability /15 | Informal total | Park reason |
| --- | --- | --- | --- | --- | --- | --- |
| Snowflake m-v1.5 winner | **34-38** [SNOW] | **21-24** [SNOW-O] | **17-19** [SNOW, S] | **12-14** [SNOW] | **84-95** | Provisional only: runtime G5/G7 UNKNOWN |
| GTE-Qwen1.5-7B, parked | **30-40**: MTEB overall 67.34, but retrieval-specific and W1 quality are UNKNOWN [GTE-Q] | **0-3**: 8B F32 is orders beyond 600 MB/2 GB ceilings [GTE-Q, W] | **8-13**: new large-model runtime and full re-embed; typed fit possible but unproved [GTE-Q, S] | **11-14**: Apache-2.0 model; issue/test evidence UNKNOWN [GTE-Q] | **49-70** | FAIL G5; no desktop-local path within the ratified envelope |

## Sources appendix

Only opened sources used above are listed.

- [A] The embeddings-family addendum in the task prompt (candidate roster and API-envelope exception).
- [R] `explorations/semantica-lab/research/criteria-rubric.md:25-68,87-93`; [W] `explorations/semantica-lab/research/workload-contract.md:6-17,31-59`; [S] `explorations/semantica-lab/research/shared-schema.md:25-28,42-50`; [D] `explorations/semantica-lab/DECISIONS.md:47-65,99-104,112-118,145-169`.
- [C] `explorations/semantica-lab/research/docs-url-census.md:38-45,65-70` (fetch-verified docs/repo/license census).
- [SEM] `~/YeeBois/workstation-apps/semantica/semantica/embeddings/text_embedder.py:73-187,249-268,329-365,398-417`.
- [L-ORT] `package.json:182`; `bun.lock:6872`; `packages/drivers/face-detection/src/FaceDetection.service.ts:313-365,782-807`.
- [L-TJS] `scratchpad/package.json:54`; `bun.lock:5356`; [L-API] `packages/drivers/venice-ai/src/VeniceAI.service.ts:1143-1150,1977-1985` and `packages/drivers/venice-ai/swagger.yaml:2776-2874,9452-9562`.
- [P] Local 2026-08-24 probes: Bun 1.4.0 `require("onnxruntime-node")` = 0.03 s, 27,284 KiB max RSS; `du` = 259 MB package, 38,413,200-byte Linux x64 native payload; no local Snowflake artifact, `fastembed`, or `llama-embedding`.
- [MTEB] https://github.com/embeddings-benchmark/leaderboard/blob/main/config.yaml ; [MTEB-M] https://github.com/embeddings-benchmark/arena/blob/main/model_meta.yml
- [BGE] https://huggingface.co/BAAI/bge-base-en-v1.5 ; [BGE-S] https://huggingface.co/BAAI/bge-small-en-v1.5/tree/main/onnx ; [BGE-B] https://huggingface.co/BAAI/bge-base-en-v1.5/tree/main/onnx
- [MINI] https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2 ; [MINI-O] https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/tree/main/onnx
- [NOMIC] https://huggingface.co/nomic-ai/nomic-embed-text-v1.5 ; [NOMIC-O] https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/blob/main/onnx/model_int8.onnx
- [GTE] https://huggingface.co/Alibaba-NLP/gte-base-en-v1.5 ; [GTE-O] https://huggingface.co/Alibaba-NLP/gte-base-en-v1.5/tree/aed4f757b1f39a2e85e2ecf24727a1f29dbafe92/onnx ; [GTE-Q] https://huggingface.co/Alibaba-NLP/gte-Qwen1.5-7B-instruct
- [SNOW] https://huggingface.co/Snowflake/snowflake-arctic-embed-m-v1.5 ; [SNOW-O] https://huggingface.co/Snowflake/snowflake-arctic-embed-m-v1.5/blob/main/onnx/model_int8.onnx ; [SNOW-G] https://huggingface.co/Snowflake/snowflake-arctic-embed-m-v1.5/tree/main/gguf
- [ORT] https://onnxruntime.ai/docs/get-started/with-javascript/node.html ; [ORT-PKG] https://github.com/microsoft/onnxruntime/blob/main/js/node/package.json
- [TJS] https://huggingface.co/docs/transformers.js/en/index ; [TJS-N] https://huggingface.co/docs/transformers.js/main/tutorials/node ; [TJS-G] https://huggingface.co/docs/transformers.js/en/guides/webgpu ; [TJS-R] https://github.com/huggingface/transformers.js
- [FAST-R] https://github.com/Anush008/fastembed-js ; [FAST-P] https://raw.githubusercontent.com/Anush008/fastembed-js/main/package.json ; [FAST-S] https://raw.githubusercontent.com/Anush008/fastembed-js/main/src/fastembed.ts
- [LLAMA-E] https://github.com/ggml-org/llama.cpp/blob/master/examples/embedding/README.md?plain=1 ; [LLAMA-L] https://github.com/ggml-org/llama.cpp/blob/master/LICENSE ; [LLAMA-R] https://github.com/ggml-org/llama.cpp/releases ; [LLAMA-D] https://github.com/ggml-org/llama.cpp/discussions/10885
