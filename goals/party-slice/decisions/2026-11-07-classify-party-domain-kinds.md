---
title: "Classify party-domain concepts by domain kind"
date: 2026-11-07
lane: "refactor/party-domain-kinds"
reversal: "Move the concept folders back under values/ and restore the values/ schema identifier paths"
---

Party-domain was laid out with a single --domain-kind values run, so it is the only slice with nothing but values/. The glossary defines an Entity as identity-bearing and a Value Object as having no identity. Concepts with their own ids (Party: Person, Organization, CollectiveAgent; Communication: Voice, CommunicationEvent; Provenance: Activity, ArtifactOccurrence; Claim: SourceAssertion, ClaimVersion; Hierarchy: OperationalAssessment) move to entities/. Admission moves to policies/. Resolution and Projection move out of values/ to the home the architecture planner assigns to read-time views. Identifier, PartyKey, Proposition and the Ids schemas stay in values/. The root barrels keep every published @beep/party-domain subpath. Schema identifier paths change; party has no tables, and review digests must be proven to hash only encoded data before this lands. Immutability does not make a record a value: an append-only ClaimVersion referenced by id is still an entity.
