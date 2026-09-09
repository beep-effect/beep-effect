# Turborepo cache trust and observability plan

## Status

Status: `pending`
Lifecycle: `paused`

Authored but not started. An explicit launch begins P0 and uses
`bun run beep goals set-status turborepo-cache-trust-observability active`.
The user approved the program scope on 2026-09-08; no repeated shape approval
is needed.

## Phases

| Phase | Status | Work | Exit criteria |
| --- | --- | --- | --- |
| P0 Threat and receipt contracts | pending | Refresh actor/credential/namespace topology and agree typed outcomes with conformance and qualification. | Versioned contracts and explicit secret-safe configuration; no source-as-deployment claims. |
| P1 Posture and safe events | pending | Implement fail-closed client posture, bounded result/producer receipts and redaction fixtures. | Missing-key and synthetic-secret negative tests pass; metrics labels are bounded. |
| P2 Adapter and epoch remediation | pending | Implement opaque tags, independent method/storage policy, tenant binding and namespace rotation in the lab adapter. | Conformance negatives pass without distributing the artifact key to the backend. |
| P3 Production hardening and observation | pending | Prepare and execute scoped incumbent hardening after concrete rollout gates; coordinate cohort wiring with adoption. | Seven-day nonprod, seven-day cohort and fourteen-day broader evidence plus rollback, where production hardening is deployed. |
| P4 Verify and hand off | pending | Run package/Lambda/contract tests, direct fault attribution and key/epoch rollback drills. | Trust-readiness receipts are reproducible and available to adoption. |
| P5 Yeet: PR to mergeable | pending | Publish through Yeet and close reviews/hosted failures. | Yeet monitor reports merge-ready: yes on final head. |
| P6 Close | pending | Land trust evidence, reflection and lifecycle with final implementation work. | Same-PR closeout; deployed limitations remain explicit. |

## First action

Refresh the checked-in and applicable deployed trust boundary, then define the cache-result and protected-producer receipt contract with the conformance owner.

## Dependency gates

Receipt schemas can be authored alongside qualification's early policy
contract. Conformance consumes those schemas and supplies direct negative-case
results. Apply adapter fixes in its lab before production. Coordinate the named
hosted cohort with adoption, without waiting for adoption's entire program to
finish. If replacement is selected, cutover belongs to the reopened migration
packet; incumbent hardening remains this goal's responsibility otherwise.

[SPEC.md](./SPEC.md) governs authority and the [program map](../../explorations/turborepo-quality-cache/MAP.md)
governs handoffs. A sibling's accepted milestone can unblock work before its
whole goal closes.

## Evidence to produce

typed receipt schema/version; actor/capability and tenant matrix; signed and
corrupt artifact receipts; synthetic-secret captures; epoch/rollback drill;
scoped deployment and seven/seven/fourteen-day observation; package/Lambda
verification and Yeet proof.

Store compact receipts in research/history and large raw evidence in bounded
artifacts. Record source/tool/profile/epoch identity, command/case, result and
retention. Register new reports in the manifest. Record friction immediately
in [OPPORTUNITIES.md](./research/OPPORTUNITIES.md). Missing evidence is unfinished
work, not an implied pass.

## Verification and attribution

Apply the SPEC matrix to actual changes. Package editors run package-verify
before handoff. Attribute failures as introduced, inherited, unrelated or
environment-only before repair. Preserve dirty work and use canonical
admission/worktree workflows for heavy experiments.

## P6 closeout checklist

P6 preparation can occur during P5 so final reflection/lifecycle land with the
final implementation. Acceptance still requires final Yeet proof. Do not defer
closeout to an unrelated state-only PR.

1. Confirm every SPEC criterion and applicable representative observation.
2. Use the reflect skill and copied reflection template to record tooling
   friction, implementation opportunities and prompt critique.
3. Run `bun run beep lint reflection-artifacts`.
4. Update phase evidence and use
   `bun run beep goals set-status turborepo-cache-trust-observability completed-retained` only once
   completion conditions hold, in the final implementation PR.
5. Regenerate/check the goal index and preserve exploration links. Completion
   of this goal alone does not establish the whole cache program's completion.

## Rollback and resume

Use SPEC's rollback at the affected boundary. Record the failed gate, remaining
work and safe resume action. Retain paused state with explicit conditions when
external evidence/authority is missing; do not label that pause complete.
