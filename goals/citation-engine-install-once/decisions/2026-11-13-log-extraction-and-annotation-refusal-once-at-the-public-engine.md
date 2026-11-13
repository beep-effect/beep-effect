---
title: "Log extraction and annotation refusal once at the public engine"
date: 2026-11-13
reversal: "Restore logging to the inner boundary normalizers"
---

The engine normalizes and logs every typed extract or annotate refusal after the invocation timer and admission boundary, so deadlines, admission refusals and stage refusals each emit exactly one fixed boundary-refused debug message. Inner normalizers remain silent and idempotent. Manual-clock tests on both runtime configurations count one deadline log and one subsequent source-stage refusal log, with zero native children.
