---
title: "P1: versioned contract and predicate-type IRIs are declared terms with multi-segment locals and keep their bytes"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Re-declare the versioned contract IRIs as instances minted under their namespace by a decision file; their snapshot rows then leave only through deprecation rows naming the instance form."
---

P1 ruling 4. The versioned contract and predicate-type IRIs under https://beep-effect.com/ns/ are declared terms in the snapshot: qa evidence/{cited-event-id-exists, declared-round-coherent, evidence-cross-check, judge-output-inventory, cited-artifact-exists}/v2, qa receipts/{accepted, delivered, persisted, recovery-attempt, semantically-applied}/v2, qa verifiers/judge-settlement/v1, skill-contract evidence/failure/v2, evidence/gate-summary/v2 and evidence/gate-certificate/v1, contracts qa-inventory/v1, and schemas qa-judge-input/v1 and qa-judge-settlement/v1. A TermLocal schema admits slash-separated segments for them. They keep their bytes because evidence receipts carry them and cli/skills/qa-inventory-judge/SKILL.md commits them (read sites JudgeContract.ts:64-72,770-773,841-855,942, CitedArtifactExistsGate.ts:30-32, Recovery.ts:340, EvidenceReceipt.ts:385, GateCertificate.ts:335-336). The canonical CURIE keeps the raw slash (qa:receipts/accepted/v2); Turtle writers escape it at the boundary with the existing prefixedNameOrIri (PnLocal.ts:480), because a bare slash is not a legal PN_LOCAL. Golden tests read the expected values from the frozen pre-P1 base fixture.
