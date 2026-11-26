---
title: "The closeout rides the P6 Retire PR"
date: 2026-11-26
lane: "chore/infra-alchemy-p6-retire"
pullRequest: 3567
reversal: "Revert the closeout commit on main: goals set-status infra-alchemy-rebuild active, phases P6-P8 back to pending, and open a separate closeout PR."
---

P7 and P8 need a final PR that carries the reflection and writes `closeout` naming itself. #3567 (P6 Retire) is that PR. It deletes the last repository surface the goal owns: `infra/`, the Pulumi catalog entries, the postinstall step and the destroyed AWS cache's credential census. Every phase's exit is met before it merges:

- P4: AI metrics deploys through `@beep/infra-hosts` (#3560).
- P5: the whole `beep-ci-runners` stack was destroyed and its export archived (`2026-11-26-ci-runners-6d-whole-stack-destroy`).
- P6: `infra/` and Pulumi are gone with this PR.

A separate closeout PR after #3567 would carry only these status edits. It would cost another review window and another merge in a window the CI goals driver keeps clear (the binary pin PR follows #3567 on 2026-11-27).

**Steps after the merge.** They change no repository file, so they do not hold the closeout:

1. Delete the five live credentials of the destroyed AWS cache right before the operator's hand merge, with a names-only list read. The repository side already left the census in this PR.
2. Run `pulumi stack rm production` on its own word, once nothing in the repository names the stack.
3. Make the cutover's step 6 (f) operator choices: the old SSM App parameters, the KMS key, the permissions boundary, and whether to retire the `beep-ci-fleet-controller` App.

If a 6 (f) choice ever needs a repository change, it ships as its own small PR.
