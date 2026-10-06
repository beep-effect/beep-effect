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

Which vision OCR engine beats Tesseract on the scan sample? The CPU half of
the benchmark is done and says where Tesseract fails (a low-confidence
quarter of scanned pages, tables, reading order). The GPU half has not run.
Run it from the private runbook, fill the `GPU-RESULTS` blocks in
[`research/BENCHMARK.md`](./research/BENCHMARK.md) and
[`research/GPU-STACK.md`](./research/GPU-STACK.md), then move to align.

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
  landed with tests. GPU runs held until the long extraction finished.
