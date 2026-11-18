---
title: "Preserve Buffalo preprocessing and pinned artifact provenance"
date: 2026-11-13
lane: "t3/python-free-photo-face"
reversal: "Restore the prior Buffalo worker from the parent commit and its retained external parity reference."
---

Run the original det_10g.onnx and w600k_r50.onnx pins with CPUExecutionProvider. Port SCRFD decoding and NMS, five-point similarity alignment, OpenCV-compatible bilinear resampling, embedding normalization, quality flags and aggregate scoring. Keep existing report schemas and failure reasons, extending AdaFace runtime provenance to admit ONNX while retaining decoding of historical PyTorch reports. Photo-face parity evidence is in research/photo-face-parity.md.
