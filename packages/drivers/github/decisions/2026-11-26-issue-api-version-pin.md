---
title: GitHubIssue requests pin REST calendar version 2026-03-10
date: 2026-11-26
reversal: Drop API_VERSION_HEADERS from GitHubIssue's requests so GitHub serves its default calendar version.
governs:
  - src/GitHubIssue.ts#API_VERSION_HEADERS
enforcedBy: []
---

Every GitHubIssue request sends `x-github-api-version: 2026-03-10`.
Reason: without the header GitHub serves 2022-11-28, deprecated when 2026-03-10 shipped and sunset on 2028-03-10. A response from an endpoint the new version changed then carries a `Deprecation` header that `@octokit/request` prints to the consumer's console; the constructor's `log` option cannot silence it, because the fetch wrapper resolves `request.log ?? console`. `PATCH /repos/{owner}/{repo}/issues/{issue_number}` is on that list (the singular `assignee` was removed), so every `close` warned once per issue.
Nothing this module sends or reads changed in 2026-03-10: `state` and `state_reason` are untouched and the projections read fields both versions carry.
Rejected: the default version, which warns; suppressing the warning, which would also hide the next deprecation. When GitHub deprecates 2026-03-10, octokit warns again by design.
