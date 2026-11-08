---
title: "Hold desktop API cutover until verified identity hosting exists"
date: 2026-11-07
reversal: "Supply host credential verification, enrollment and live membership adapters, then migrate callers"
---

Live source search found no signed-in principal or bearer/session verifier in the desktop host; RpcSessionAuth verifies only the per-launch token. The new SessionResolver remains a required host service, with no anonymous, uid or launch-token identity fallback. Existing desktop callers have not been switched. PR 3c is not content-final: destination-scoped pass/probe initiators and compatibility mapping also remain. This records an implementation hold, not acceptance or permission to publish a partial cutover.
