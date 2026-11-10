---
title: "Create a run's test shards before its non-test lanes and cap shard timeouts at 20 minutes"
date: 2026-11-10
lane: "perf/ci-shards-before-lanes"
reversal: "In check.yml restore needs: [change-profile] and the bare docs_only condition on the eleven lanes, and restore the 60, 30 and 60 minute shard timeouts. One commit, no state."
---

A full Check run asks for about 75 hosted jobs against a 60-job concurrency cap, so a run queues on itself even when the pool is free. GitHub creates a job when its `needs` finish and hands out runners roughly in creation order (about 90 percent of job pairs created more than a minute apart are admitted in order). The test shards wait on Change Profile and Test Plan, while eleven non-test lanes waited on Change Profile alone, so they were created first: on quiet main run 42726850927 eight test shards waited 0.4 to 1.3 min while twelve of that run's own non-test jobs took runners.

- Repo Sanity, Ecosystem Contracts, Shadcn Lint, Codegen Drift, Labs, the Lint shards, Professional Desktop IPC Stdio, the Property Laws shards, Fallow Advisory Envelopes, JSDoc Ratchet and Nix Shell now also wait on Test Plan and Heavy Admission, so they are created no earlier than the Test Unit and Test Integration shards.
- The lanes depend on neither job's result. Each condition is `!cancelled()`, an explicit check that Change Profile succeeded, and the lane's former condition: a failed Test Plan or Heavy Admission still lets the lane run, and a failed Change Profile skips it as before.
- The jobs with no `needs` (Commitlint, Secret Scanning, Security, SAST, PR Size Label) are unchanged, as are check names, required contexts and the planned-partition logic.
- Shard timeouts drop to 20 min (Test Unit and Property Laws from 60, Test Integration from 30); the slowest measured shard ran 11.2 min. Rerun Runner Loss re-runs only jobs annotated as having lost communication with the server, so a timeout is not re-run.
- Expected effect: up to 1.2 min less shard queue on a quiet run, 0 to 0.4 min on a busy one. The non-test required checks report about 1.3 to 1.5 min later. This does not bring busy-period verdicts under ten minutes.
