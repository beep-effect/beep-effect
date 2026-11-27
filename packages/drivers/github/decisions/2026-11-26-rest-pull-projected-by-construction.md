---
title: A REST pull request becomes PullRequestInfo by construction, not through a wire codec
date: 2026-11-26
reversal: Give PullRequestInfo a codec from GitHub's wire shape (nullable ISO merged_at to Option<DateTime.Utc>) and decode RawPull through it.
governs:
  - src/PullRequest.ts#project
enforcedBy: []
---

`project` builds `PullRequestInfo` with `make` from the raw REST answer, converting `merged_at` (a nullable ISO string) into `Option<DateTime.Utc>` itself.
Reason: the Type side of `Schema.Option(DateTimeUtcFromString)` is an `Option<DateTime.Utc>` and GitHub's wire form is a nullable string, two different shapes. A codec bridging them would describe GitHub's encoding as if it were this package's own.
Rejected: a domain codec over GitHub's wire encoding.
