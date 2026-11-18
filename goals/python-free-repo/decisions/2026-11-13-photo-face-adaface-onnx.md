---
title: "Generate fixed AdaFace ONNX graphs from the existing safetensors pins"
date: 2026-11-13
lane: "t3/python-free-photo-face"
reversal: "Restore the prior photo-face implementation from the parent commit."
---

Port the fixed DFA MobileNet and 24-block ViT KP-RPE inference graphs to a typed TypeScript ONNX writer. Retain the exact source SHA-256 pins, generate graphs locally, and key the cache by both source hashes and graph version. Preserve the 25% context crop and 0.20 confidence floor. No remote executable code or separately hosted graph is admitted.
