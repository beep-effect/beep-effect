---
title: "Hash destination names in reservation keys"
date: 2026-11-07
lane: "goals/vault-sync-domain"
pullRequest: 2886
reversal: "Restore the orgId:normalizedName key in Values.ts reservationKey and widen the ReservationKey schema back to NonEmptyString; replay any stored reservation streams under the old ids"
---

PII audit F2: the kernel always records aggregate ids and streams on spans, so an orgId:name key leaked destination names into domain.id, domain.stream, driver spans and SyncRuleViolation evidence. ReservationKey is now orgId:sha256hex(trimmed, lowercased name), built only by reservationKey in aggregates/VaultSync/Values.ts with a synchronous @noble/hashes SHA-256 (the PartyKey precedent), so pure decide and policy code hash in place. The schema admits only an integer, a colon and a 64-character lowercase hex digest. The name stays in reservation state and event payloads, which the kernel never puts on spans.
