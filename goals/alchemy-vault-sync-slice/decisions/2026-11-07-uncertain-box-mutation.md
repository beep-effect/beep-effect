---
title: "Hold uncertain Box mutations behind durable intent receipts"
date: 2026-11-07
reversal: "Use verified provider idempotency while retaining receipt identities"
---

Commit an operation intent before calling Box and the acknowledgement before returning. An interrupted intent is looked up through BoxMirrorEvidence; insufficient evidence holds the operation without another Box mutation. The existing DmsMirrorBox port has no authoritative version or digest lookup, so the safe production lookup result is absent until that capability is provided. No fixture proves provider idempotency. Runtime composition must scope the existing Box mirror and root configuration to one destination.
