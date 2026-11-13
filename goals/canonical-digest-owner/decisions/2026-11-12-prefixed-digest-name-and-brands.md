---
title: "The shared grammar is Sha256PrefixedDigest; a domain digest keeps both brands"
date: 2026-11-12
lane: "feat/canonical-digest-owner-surface"
reversal: "Rename the export in @beep/schema and its two importers; the encoded string does not change, so nothing stored is affected."
---

Slice B call. @beep/schema exports Sha256PrefixedDigest beside Sha256Hex, with Sha256PrefixedDigestFromHex as the codec between the bare and the prefixed form. The name Sha256Digest was not used: @beep/sbom already exports a schema of that name for the bare 64-character form (it strips an optional prefix while parsing), and two modeling packages exporting one name for opposite grammars would invite the mix-up this goal removes. ContentDigest and SourceTextDigest are now that schema with their own brand added, so each keeps its encoded string and its existing brand, and gains the shared brand. A domain digest is therefore assignable to the shared type, and a function that only needs the grammar can take any of them; two domain digests stay distinct from each other. Rejected: an unbranded shared grammar, which would make every prefixed string a digest of every kind once decoded. Found while surveying and left for slice C because both sit in @beep/repo-cli, which slice C already changes: the cache workflow schema and the files media schema each spell the same grammar as a regular expression.
