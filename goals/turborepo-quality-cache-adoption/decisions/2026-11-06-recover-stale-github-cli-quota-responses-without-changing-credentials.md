---
title: "Recover stale GitHub CLI quota responses without changing credentials"
date: 2026-11-06
reversal: "Restore the two preserved response entries only if no newer entry exists; leave fresh responses, credentials and all other cache entries untouched."
---

GitHub CLI 2.102.1 caches the pull-request feature probe for 24 hours. Two exact local HTTP 200 response-cache entries contained GraphQL RATE_LIMIT errors from the earlier exhausted window. Live REST and direct GraphQL quota reads had already recovered. Preserve byte-exact copies and digests privately, verify absence of authorization/cookie headers and error-only JSON bodies, then remove only those two verified entries. The unchanged check-list command succeeds immediately afterward; native Yeet remote status also reads complete required and optional check counts. Keep the existing monitor jobs instead of restarting them. No credential, quota, configuration or unrelated cache changes are involved. The private rollback restores an entry only if no fresh entry has replaced it.
