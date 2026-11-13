---
title: "Keep stage finalizers in the request Scope"
date: 2026-11-13
reversal: "Restore per-stage Effect.scoped around prepare(request)."
---

Review round 1 confirms a deliberate Scope lifetime difference from main: metadata stages use the invocation Scope instead of opening a fresh Scope around each prepare call. Per-call native owners therefore register owner finalizers until request end. Physical processes still retire and acknowledge exit per job before returning results; leases, quarantine and limits remain unchanged. The invocation Scope closes before admission releases its permit, retaining the final safety cleanup. This follows design section 3.4; it is an ownership-finalizer timing change, not strict Scope neutrality.
