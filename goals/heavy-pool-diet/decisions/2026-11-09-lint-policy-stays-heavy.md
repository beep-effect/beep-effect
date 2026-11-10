---
title: "Lint Policy stays on the heavy pool; run the diet, order required heavy lanes first, defer capacity"
date: 2026-11-09
reversal: "Supersede with a decision file that moves Lint Policy or opens the capacity question, citing the scorecard's post-diet heavy-queue p95."
---

Heavy / Lint Policy stays on the cap-2 `beep-ec2-heavy` pool. This goal runs the diet (LINT-01 noResolve, LINT-05 drop the duplicate JSDoc chain, LINT-02 knowledge doctor abreast, LINT-04 PR C algorithms) and orders the required heavy lanes (Check, Docgen, Doctest) ahead of Lint Policy with `needs:` plus `if: !cancelled()`, so a Check red still lets Lint Policy run and report. The capacity decision (a cap above 2 or a larger runner class) is money: it goes to the operator only when the certainty scorecard shows the post-diet heavy-queue p95 still binding the required path. Rejected: moving Lint Policy to a standard hosted runner (measured peaks of 32 to 36 GiB against 16 GB), opening the capacity decision now (unmeasured), and stopping Yeet from waiting on Lint Policy (a policy red would no longer hold merges).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D11).
