---
title: Restoration streams SHA-256 through the runtime's native hasher, with a pure-JS fallback
date: 2026-11-26
reversal: Hash every chunk with the pure-JS sha256.create() hasher and drop the Bun.CryptoHasher branch.
governs:
  - src/commands/Corpus/internal/Restoration.ts#createStreamingSha256
enforcedBy: []
---

Archive objects are hashed in bounded chunks, which Effect's `Crypto` service cannot do: it only offers one-shot digests. Under Bun the native `CryptoHasher` measured 1.68 GB/s against 187 MB/s for the pure-JS hasher on the 147 GB root archive (2026-10-06), so the CLI uses it whenever the hasher surface exists. The probe checks `Bun.CryptoHasher` itself, not the `Bun` global, since a partial `Bun` global such as a test shim may lack it. Any other runtime uses the pure-JS hasher; digests are identical either way.

Rejected: the pure-JS hasher everywhere (about nine times slower on the archive); Effect `Crypto` (one-shot digests only).
