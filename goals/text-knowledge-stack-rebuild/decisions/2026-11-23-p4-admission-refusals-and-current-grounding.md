---
title: "P4: admission returns refusals and authenticates before writing"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Change the refusal vocabulary and port in one breaking consumer migration; never restore decoder authority."
---

admit validates the core hash, nonempty claim-local grounding, all actor/action/revision/scope token bindings, token authenticity and current source receipts before producing Admission. A schema-valid token alone is powerless. The use-case port checks principal independently of caller input and resolves current text under the same scope. Expected missing, stale, ambiguous, denied or mismatched evidence is an AdmissionRefused value. Typed technical port failures remain failures until translated by the use-case; driver detail dies in adapters with boundary logging. No state is appended on refusal. Rehydrating any stored Admission repeats current verification and never grants a proof from decoding. P6 still owns the complete seven-path MatterAuthority deployment.

Independent review correction: membership in supportAtCreation alone cannot bind approval to a claim. Apply p4-trusted-claim-specific-admission-binding: trusted action/revision state must authorize the exact re-minted claim or trusted claim-set membership. The P0 token fields stay unchanged.
