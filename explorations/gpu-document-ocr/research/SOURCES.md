# GPU Document OCR — Sources & Provenance

- **Cluster / origin:** one research pass on 2026-10-06: a web check of
  current open-weight OCR models, a static inventory of one workstation, and a
  58-page benchmark over a private corpus.
- **Provenance:** benchmark inputs, outputs and scripts live outside the repo
  in a private operations folder. Only metrics are reproduced in this packet.

## 2. Upstream repositories & licenses

Model weights fetched for the benchmark. Nothing is vendored into the repo.
Hashes are the SHA-256 of the downloaded file, checked against the Hugging
Face LFS object id.

| Model file | Source | Revision | License | SHA-256 |
| --- | --- | --- | --- | --- |
| `GLM-OCR-Q8_0.gguf` | <https://huggingface.co/ggml-org/GLM-OCR-GGUF> | `65a42de1148dbed2297e922b5dbc7d9b70c36578` | MIT (base <https://huggingface.co/zai-org/GLM-OCR>; the GGUF repo declares none) | `45bc244a6446aff850521dc41f18bc8d7105ad5f0c2c8c28af04e7cc4f4d50b1` |
| `mmproj-GLM-OCR-Q8_0.gguf` | same | same | same | `9c4b58e33e316ed142eb5dcb41abec3844d3e6e5dc361ffb782c3fa9d175141f` |
| `dots.ocr-Q8_0.gguf` | <https://huggingface.co/ggml-org/dots.ocr-GGUF> | `2c093a32ca360a396bc6d87d60408636130b9d9b` | MIT as declared on the GGUF repo; base repo not confirmed | `6f2db1a75215893760b7c7185d52f11715d2e0cb7bff9cefd3f6d409fa1de7e9` |
| `mmproj-dots.ocr-Q8_0.gguf` | same | same | same | `20d3d35bea3a64ead0b4b213f8db0de136e174bb5b75b8e85786c51e8e822423` |
| `model.safetensors` (PaddleOCR-VL-1.6) | <https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6> | `c5630abae1d940eafe0697512a0325494b02ab42` | Apache-2.0 | `85a479d506a11e724e7285d395c551be69f41dbc16b6342d3cacfb189aed71db` |

Port discipline: reference only. The repo calls these models through a local
server; no upstream code is copied.

## 3. External research sources

- Using OCR models with llama.cpp (ggml-org, 2026-04-10):
  <https://huggingface.co/blog/ggml-org/using-ocr-models-with-llama-cpp>
- Best Open-Source OCR Models in 2026, Ranked by Benchmark (Roboflow,
  2026-08-03): <https://roboflow.com/blog/best-open-source-ocr-models>
- The best OCR models in 2026 (Docsumo):
  <https://www.docsumo.com/blog/best-ocr-models>
- Model cards: <https://huggingface.co/zai-org/GLM-OCR>,
  <https://huggingface.co/ggml-org/GLM-OCR-GGUF>,
  <https://huggingface.co/ggml-org/dots.ocr-GGUF>,
  <https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6>,
  <https://huggingface.co/allenai/olmOCR-2-7B-1025>,
  <https://huggingface.co/deepseek-ai/DeepSeek-OCR>,
  <https://huggingface.co/datalab-to/chandra>

## 4. In-repo capability references

| Brick | Path | Disposition |
| --- | --- | --- |
| `@beep/file-processing` Service, Artifact, Strategy, Extraction | `packages/foundation/capability/file-processing/src` | reuse |
| `@beep/file-processing/PageOcr` | `packages/foundation/capability/file-processing/src/PageOcr` | NET-NEW (this packet) |
| `@beep/tika` tika-app engine | `packages/drivers/tika/src/Tika.tikaapp.ts` | reuse, unchanged |
| `@beep/openai-compat` | `packages/drivers/openai-compat/src` | reuse (planned) |
| `@beep/provenance` `SourceTextExtractor` | `packages/foundation/modeling/provenance` | reuse (mapping target) |
| corpus extract | `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts` | extend later; untouched by the first PR |

## 5. Cross-links & provenance

- This packet: [`../RESEARCH.md`](../RESEARCH.md),
  [`GPU-STACK.md`](./GPU-STACK.md), [`BENCHMARK.md`](./BENCHMARK.md),
  [`SEAM-DESIGN.md`](./SEAM-DESIGN.md),
  [`OPPORTUNITIES.md`](./OPPORTUNITIES.md).
- Sibling: [`../../oppold-corpus-overhaul`](../../oppold-corpus-overhaul)
  owns the corpus pipeline this packet would extend.
