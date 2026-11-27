---
title: The production config names the bootstrap state-only deploy role
date: 2026-11-26
reversal: Drop stateRoleVariable from the production config and give the deploy workflows their state role another way.
governs:
  - src/Production.ts#sharedAlchemyStateRoleArn
enforcedBy: []
---

Anchor for `goals/infra-alchemy-rebuild/decisions/2026-11-09-github-oidc-state-role-bootstrap.md`, which records the bootstrap OIDC provider and the state-only role this ARN names.
