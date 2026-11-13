---
title: "The cache and files sha256 schemas are the shared grammar"
date: 2026-11-13
lane: "refactor/canonical-digest-owner-swaps"
reversal: "Restore the two regular expressions; nothing stored changes."
---

The cache workflow's GitHub artifact digest and FileSha256Hash in the files media schemas each spelled the sha256: grammar as a regular expression. Both accepted exactly what Sha256PrefixedDigest accepts: the prefix, 64 characters, lowercase hex only, with uppercase digits, a longer tail and an uppercase prefix refused by both. So both are now that schema, and FileSha256Hash keeps its identity annotation. Encoded strings are unchanged and the decoded type gains the shared brand. One visible difference is accepted: a rejected value reports the template-literal message instead of the old pattern message. Rejected: a filter over the shared guard that keeps the old message, which would leave FileSha256Hash unbranded and outside the shared type.
