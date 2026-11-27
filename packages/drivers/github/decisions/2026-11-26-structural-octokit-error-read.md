---
title: Octokit throwables are read by shape, not by instanceof RequestError
date: 2026-11-26
reversal: Import RequestError from @octokit/request-error, declare it as a dependency, and narrow throwables with instanceof.
governs:
  - src/GitHubError.ts#readThrowable
  - src/internal/octokit.ts#readThrownHeaders
enforcedBy: []
---

Classification reads an unknown throwable through its public shape, `{ status, message, response: { headers, data } }`, with predicates.
Reason: `@octokit/request-error` is a transitive dependency this package does not declare, and importing an undeclared package is how a peer closure rots. The thrown shape is stable and public.
Rejected: `instanceof RequestError`, which needs that undeclared import.
