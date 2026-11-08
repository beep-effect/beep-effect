# IPRally non-US, non-gold smoke

Pinned the official `iprally/invention_graph_eval` development revision `51ba1e69b471021f225fe6787100b0f69d78da24` and its MIT license. The training archive contains 5,000 metadata rows. Raw data and upstream code remain in the external cache; no upstream code was executed or installed.

Before checker execution, selected the minimum SHA-256 of `claim-antecedent-iprally-smoke-v1:<ucid>` among the 111 rows with country other than US and first listed IPC class starting with F. This chose **KR-100380121-B1**, country KR, class F15, with 523 target tokens. Selection did not use normalization or checking outcomes, and there was no retry with a different example.

The complete token list was joined with single spaces, retaining the two initial padding tokens and all punctuation. The stream was supplied as one smoke-local claim through the existing normalizer and ClaimSelfCheck service. The source was not repaired, translated, relabelled or adapted into the IPRally graph model.

Result: normalization and checking accepted one claim, returned one element tree and 61 unreviewed advisory findings, with zero undecomposed claims and zero pattern-not-covered findings. This is a coverage smoke only. It establishes neither correct decomposition nor an antecedent false-positive rate, and it supplies no structural score against the teacher graph. The explicit basis is **non-US, non-gold**.

The receipt in `2026-10-28-iprally-smoke.json` binds repository revision, license, archive, metadata and reconstructed text checksums. The public runner accepts an external JSON file matching SmokeInput; its input includes the selected id/country/IPC, token count, pinned revision/archive hash and reconstructed input text. Run it with `IPRALLY_SMOKE_INPUT=external-smoke-input.json bun packages/law-practice/server/test/evaluation/iprally-smoke.main.ts`. It performs no source fetching or persistence.

Sources: [official repository](https://github.com/iprally/invention_graph_eval), [pinned license](https://github.com/iprally/invention_graph_eval/blob/51ba1e69b471021f225fe6787100b0f69d78da24/LICENSE). These derived counts and source identifiers are retained; the raw dataset is not committed.
