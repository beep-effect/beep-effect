---
title: "SymbolResolver owns its SCIP index; the store models references and resolutions only"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Restore the index parameter by decision file if a caller must resolve against more than one index in one process"
---

Amends symbol-resolver-port-scip-driver-p3. The port took a decoded SCIP index document on every call and the store carried that document's schema. A SCIP index covers every source file of the repository, decoding it through a store schema per call is waste, and the document shape belongs to the tool that writes it. SymbolResolver.resolve now takes the SymbolReference only; the implementing Layer loads and holds the index, and the index schema arrives with the SCIP driver in P3. The store keeps ScipSymbol, ScipRange, ScipDefinition, SymbolReference and SymbolResolution. Code: packages/tooling/library/agent-memory-store/src/SymbolResolver.service.ts. Rejected: keeping the document schema in the store for the P3 driver to import (a driver would depend on a tooling library for its own wire shape).
