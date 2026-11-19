---
title: "The item key is a three-way union and fingerprints with a unit separator"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Change the item key schema and its fingerprint function."
---

An item key is one of test (file and full name), diagnostic (file, code or rule, normalized message shape) or fault (a load, hook or unhandled failure of a unit). Its fingerprint joins the fields with the ASCII unit separator, which cannot appear in a path or a test name. The failure signature hashes with FNV-1a 64 instead of a SHA-256 prefix, which keeps the model synchronous and free of a crypto dependency; the function-boundary line is an optional input an adapter may supply.
