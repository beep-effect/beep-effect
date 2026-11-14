---
title: "The ci-runners stack does not adopt the shared state role or the GitHub OIDC provider"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Declare both in the ci-runners stack with adopt(true), listing every deploy environment subject in the role's trust policy."
---

SPEC says `@beep/infra-ci-runners` adopts the GitHub OIDC provider and the shared state role `beep-alchemy-state-rw` (D20, one decision per object). This lane does not declare them. Adopting the state role means declaring its trust policy, and that policy's subjects are added by each stack's bootstrap (`beep-effect-web-prod`, `storybook-prod` and the others as they land); a declaration in this stack would overwrite whichever subjects the declaring lane did not know about, and its `prod` deploy would run with the power to lock every other stack out of the state store. The OIDC provider is an account singleton every deploy role trusts. Both stay bootstrap singletons until one stack owns the list of deploy environments, which is `@beep/infra-github` (D10, it owns the environments) or a small bootstrap stack; the gate decides which. No resource of either kind is in the plan.
