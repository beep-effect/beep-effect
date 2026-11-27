---
title: A policy whose token ids collide is refused instead of changing the id format
date: 2026-11-26
reversal: Change the token resource id to a separator neither a team slug nor a principal name may contain, rotating every token, and drop the tokenKeyCollisions filter.
governs:
  - src/CachePolicy.ts#tokenKeyCollisions
enforcedBy: []
---

A token's resource id joins the team slug and the principal name with `-`, and both allow `-`, so `beep-x`/`ci` and `beep`/`x-ci` name one token. Alchemy registers a repeated logical id once, so both holders would share one secret and the Worker would apply the first holder's team and access. The policy schema refuses such a policy at decode.
Rejected: an unambiguous id format, which renames every token resource and so rotates every issued token.
