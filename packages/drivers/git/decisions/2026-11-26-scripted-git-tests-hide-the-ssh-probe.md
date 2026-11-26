---
title: Scripted Git unit tests answer the ssh probe as unset and hide it from the test's own script
date: 2026-11-26
reversal: Remove withoutSshProbe from run and runWith in test/Git.test.ts and make every scripted test answer and count the core.sshCommand and ssh.variant probes itself.
governs:
  - test/Git.test.ts#isSshProbe
  - test/Git.test.ts#withoutSshProbe
enforcedBy: []
---

Every network-touching member spawns a `git config --get core.sshCommand` and `ssh.variant` probe before its own invocation. `run` answers those probes as unset (a silent exit 1, the `quiet` shape) and never passes them to the test's `byArgs`.
Reason: the probe would otherwise trip the argv assertion and skew the spawn count of every test written about a member's own invocation. The probe itself is pinned by the "spawn environment" suite, which does not use this helper, and its NETWORK_MEMBERS table is the only guard that each remote-reaching member still routes through `runForNetwork`.
Rejected: scripting the probes in each test, which ties every argv test to the ssh resolution order.
Accepted limit: the probe is matched by argv alone, so a test that calls `git.configGet(cwd, "core.sshCommand")` or `"ssh.variant"` through `run` gets `{ exit: 1 }` instead of its own answer. Give such a test its own spawner rather than widening the match.
