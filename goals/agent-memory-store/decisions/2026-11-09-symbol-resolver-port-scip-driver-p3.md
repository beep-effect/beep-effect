---
title: "SymbolResolver is a port over a decoded SCIP index; drivers/scip arrives in P3"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Collapse the port into the P3 implementation by decision file if no second resolver backend appears"
---

S35: SCIP resolves identity (372/373 real imports, re-exports included) and the normalized span hash is a re-verify signal, never a staleness verdict (109/129 flags on intact claims). P0 defines SymbolResolver taking a decoded SCIP index document (schema in the store) and returning symbol identity plus a re-verify flag; P3 adds packages/drivers/scip wrapping @sourcegraph/scip-typescript (external tool, drivers family) with its own routing decision file. Rejected: shelling out from repo-cli (an engine wrapper inside the CLI) and deferring the contract (breaks the schema, contract, implementation order).
