---
title: "P4: the np NamespacePin records an unstated license instead of holding the adapter"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "When upstream publishes a license for nschema.ttl, or the operator rules that the nschema.html notice covers the TTL, replace LicenseRef-nanopub-nschema-unstated with that SPDX id and regenerate the pin."
---

Parent ruling 2026-11-23, amending the hold in 2026-11-23-p4-nanopub-restricted-profile. A NamespacePin vendors no artifact bytes: it records the source location, revision and digests and projects only the curated term names, the np: IRIs needed to speak the vocabulary. The np pin therefore needs no granted license to exist, and it must not claim one. Its license is the SPDX LicenseRef leaf LicenseRef-nanopub-nschema-unstated, not an invented license. Its attribution states that no license is given at commit 8388dd90795b of Nanopublication/Guidelines, that the companion nschema.html grants CC BY-SA 3.0 for that document, and that only term IRIs are projected. nschema.ttl is never copied into the repo; adapter fixtures are minimal synthetic profile data written for this repo.

Superseded by 2026-11-23-p4-nanopub-vendored-under-cc-by-sa: the operator ruled that the nschema.html CC BY-SA 3.0 notice covers the TTL, so nschema.ttl is now vendored with attribution and the license text and the np pin records CC-BY-SA-3.0. This record is kept as history; do not apply its licensing policy.
