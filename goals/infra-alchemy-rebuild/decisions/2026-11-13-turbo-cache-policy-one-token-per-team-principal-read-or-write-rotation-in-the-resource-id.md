---
title: "Turbo cache policy: one token per team principal, read or write, rotation in the resource id"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-turbo-cache"
reversal: "Collapse cachePolicy to one write principal per team and drop the access check in Protocol.ts; tokens of removed principals stop working on the next deploy."
---

The signed-policy semantics of the AWS cache (authorizer plus HMAC-signed writer) and the R2 pilot (separate read and read-write grants) become data in `CachePolicy`: a team (`beep`) owns `<team>/<hash>` keys, and each principal of a team holds its own `Random` token of access class `read` or `write`. The Worker is the only holder of bucket access, so the token class it checks is the whole write boundary: a `read` token may query, download, read status and report events, and its upload is `403 read_only` before the bucket is touched. Principals: `ci-main` (write; only in the `turbo-cache-write` environment, which only protected `main` pushes enter), `ci-pr` (read; a repository secret, which GitHub never passes to fork pull requests, so forks stay local-only), `dankstation` and `beep-worker` (write; the named trusted workstations). One token per holder replaces the AWS cache's one shared write token, so revoking a workstation does not rotate CI. `rotation` is part of each token's resource id (`TurboCacheToken-<team>-<principal>-r<n>`): raising it replaces exactly that token on the next `main` deploy.
