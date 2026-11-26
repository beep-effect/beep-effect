---
title: Git unit tests build Git.layer over an empty ConfigProvider, not the ambient one
date: 2026-11-26
reversal: Drop the ConfigProvider.fromEnvRecord({}) default from provideGit in test/Git.test.ts so the suite reads the host environment again.
governs:
  - test/Git.test.ts#provideGit
enforcedBy: []
---

`provideGit` defaults to an empty ConfigProvider. `Git.layer` reads `GIT_SSH_COMMAND` from the ambient provider, and the default provider resolves the host's real environment.
Reason: a stray `GIT_SSH_COMMAND` on a dev machine or a CI runner would otherwise change the spawn environment of every test in the file, and only on that host.
Rejected: the ambient default provider, which makes each spawn-environment assertion depend on the machine that runs it.
