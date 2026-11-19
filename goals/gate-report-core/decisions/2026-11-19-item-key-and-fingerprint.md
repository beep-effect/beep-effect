---
title: "The item key is a three-way union with an injective fingerprint and occurrence ordinals"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Change the item key schema and its fingerprint function."
---

An item key is one of test (file and full name), diagnostic (file, code or rule, normalized message shape) or fault (a load, hook or unhandled failure of a unit). Its fingerprint is the tag followed by each field with its length in front, so for any two keys the schema accepts the fingerprints are equal exactly when the keys are equal, whatever characters the fields contain. A diagnostic that repeats a file, code and message shape at another location in the same run gets an occurrence ordinal from the reducer, starting at 2 and absent on the first, so each occurrence is its own item and the key stays free of line numbers. The failure signature hashes with FNV-1a 64 instead of a SHA-256 prefix, which keeps the model synchronous and free of a crypto dependency; the function-boundary line is an optional input an adapter may supply.
