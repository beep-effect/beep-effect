# GPU Document OCR

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `research`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Corpus extraction reads scanned pages with Tesseract on the CPU, through
Tika, while two 32 GB GPUs sit idle. Find out whether a local vision OCR
model reads the hard pages better, and give extraction a seam where such an
engine can plug in without overwriting what was read before.

## Next Open Question

Can the free GPU run OCR for more than a few pages without crossing 90 C? One
engine (GLM-OCR) was measured: it reads faxed and thermal-printed pages that
Tesseract garbles, loses to Tesseract on clean pages, and heated the card to
94 C in a 58-page run, so GPU work stopped. Until the card has a fan curve or
a power cap, the other two candidates stay unmeasured and no GPU pass over
the corpus is possible. The software question after that: route only
low-confidence pages to the vision engine, and decide how its reading is
accepted.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - candidates, capability inventory, constraints (stage 1).
4. [`research/BENCHMARK.md`](./research/BENCHMARK.md) - method and results, metrics only.
5. [`research/SEAM-DESIGN.md`](./research/SEAM-DESIGN.md) - schema, service contract, drivers, storage, selection.
6. [`research/GPU-STACK.md`](./research/GPU-STACK.md) - what is installed and the safety gates.

## Trail

- 2026-10-06: packet opened. Stack inventoried, three engines chosen and
  their weights fetched, 58-page sample built, CPU baselines measured, seam
  designed, `@beep/file-processing/PageOcr` schema and service contract
  landed with tests. After the long extraction finished: ROCm PyTorch and
  the HIP llama.cpp build proven on one card, GLM-OCR measured on the sample,
  then GPU work stopped at a 94 C junction peak.
