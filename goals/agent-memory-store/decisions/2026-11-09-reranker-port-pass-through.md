---
title: "Reranker is a Context.Service port with a pass-through default; AC-6 is a model-gated recorded measurement"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Make a local reranker a hard dependency by decision file if hosted CI gains a model cache and the operator accepts the install cost"
---

S7 measured the gate with bge-reranker-base on CPU; the SPEC requires keyless, local operation with tests that run without local models. Reranker is a Context.Service port in the Recall pipeline (filters, BM25-leaning convex fusion, Reranker, admissibility gate, budgets); its default Layer preserves fused order, so every test runs keyless. A model-gated test, skipped without a local reranker, records the AC-6 measurement into a committed fixture, which the SPEC admits as a recorded measurement. Rejected: a mandatory ONNX reranker dependency (model download in install and hosted CI) and dropping the cross-encoder (contradicts S7 and fails AC-6).
