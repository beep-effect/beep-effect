---
title: "Package homes: drivers/github for transport, tooling for worker and readers"
date: 2026-11-09
reversal: "Move the code to the agreed package and record a superseding decision"
---

Answer: rate-limit handling and transport helpers stay in packages/drivers/github (GitHubApp.ts reused unchanged); the worker, its deployment and credential wiring, the monitor change and the rerun classifier live in packages/tooling/tool/cli, with systemd units through packages/tooling/library/repo-cli-kit. Rationale: standards/architecture/03-driver-boundaries.md:54 and 07-non-slice-families.md:42. Source: exploration `explorations/github-api-quota/DECISIONS.md`, entry 'package homes'.
