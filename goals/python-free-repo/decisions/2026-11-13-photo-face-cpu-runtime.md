---
title: "Run photo-face on CPU with onnxruntime-node and sharp"
date: 2026-11-13
lane: "t3/python-free-photo-face"
reversal: "Revert this lane and restore its Python environment and CLI flags."
---

Add onnxruntime-node 1.31.1 through the root catalog and use the existing sharp catalog dependency. CPUExecutionProvider is the sole provider. Delete compute and devices CLI flags and the ROCm/uv environment machinery; retain actual CPU provenance in reports. Buffalo uses the unchanged det_10g and w600k_r50 ONNX pins with SCRFD decoding, NMS, similarity alignment and normalized embeddings.

The fixed CPU graphs execute one face per call. Remove the batch-size flag as well, and report the actual batch size of one rather than retain a no-op batch control. Historical report schemas remain readable.
