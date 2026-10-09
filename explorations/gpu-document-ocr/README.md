# GPU Document OCR

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `align`
Status: `killed`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Corpus extraction reads scanned pages with Tesseract on the CPU, through
Tika, while two 32 GB GPUs sit idle. Find out whether a local vision OCR
model reads the hard pages better, and give extraction a seam where such an
engine can plug in without overwriting what was read before.

## Next Open Question

None: align is closed by the 2026-10-09 NO-SHIP ruling in
[`DECISIONS.md`](./DECISIONS.md). Keep the delivered CPU-first path from
#1481. The GPU second reader does not ship and adds no prerequisite before
pipeline-v2 scaffolding. CPU selection, language and tuning follow-ups are
listed in the lane handoff for the orchestrator to route.

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
- 2026-10-06 (later): operator ruled to run at stock with a 98 C kill line.
  Runner rebuilt with a 1 Hz sampler. dots.ocr and PaddleOCR-VL attempted
  (too hot and too slow; too slow). GLM-OCR and Tesseract compared on 200
  low-text pages from the October run with a duty cycle. Recommendation
  revised: fix the CPU path first.

- 2026-10-09: research -> align loop refreshed #1470/#1481 and P9-P11
  evidence; all seven questions closed. CPU first confirmed as delivered.
  Epitaph: GPU second-reader OCR killed because measured gains do not justify
  omissions, attended duty-cycled passes, and a maintained driver before
  cheaper CPU gaps are measured. Status `killed`, stage `align`; reversal
  measurement and CPU follow-ups recorded in DECISIONS and the handoff.
