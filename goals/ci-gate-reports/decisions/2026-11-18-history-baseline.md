---
title: "Hosted runs upload their gate reports as the main baseline feed"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Stop the upload and the lookup; history labels then compare against lane runs only"
---

Operator ruling in `explorations/agent-verification-output/DECISIONS.md`, entry `history-baseline`: a history label compares against the lane's own earlier runs plus main's latest hosted results, so output distinguishes a failure introduced on the lane from one already red on main. This goal supplies the hosted half: every hosted gate job uploads its reports, red or green, and a lookup returns main's newest reports for a given merge base. `goals/gate-run-history` consumes the lookup in its hosted-main phase. The carrier (workflow artifacts, the per-task outcome record, or the Turbo remote cache) is chosen in P0 against the criteria in `SPEC.md`; a carrier that drops red runs fails the first criterion.
