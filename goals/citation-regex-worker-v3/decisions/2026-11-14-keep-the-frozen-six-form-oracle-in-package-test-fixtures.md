---
title: "Keep the frozen six-form oracle in package test fixtures"
date: 2026-11-14
reversal: "Restore the old consumer only if tests are again permitted to depend on goal-packet paths."
---

The required Node-parent provider audit exposed Bun.version assumptions in extractor fixture identities. Reuse the existing explicit fixture build identity instead of reading the parent runtime version. Touching the six-form test also exposed its inherited direct goal-packet data dependency, forbidden by the B1 test rules. Keep the original goal artifact, copy its JSON data unchanged into server/test/fixtures/citation-six-form-profile.json, format it with Biome and record the packaged bytes as SHA-256 304bc99c9219c1887ab6d9e2058010a00d8f950f6cf40c02e86a0f095c9cc3e2. The original bytes hash to 3cc6263c77bdb1f9d7b546b97dc0f503faf8644fcc2136ac5a1cbbebd4c8e65b; decoded data equality was checked independently. No expected output or child count changes.
