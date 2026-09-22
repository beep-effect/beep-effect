---
{}
---

No release: `yeet status` and the monitor closeout now surface reviewer follow-ups on
resolved review threads, and `yeet reply` posts on them.

A thread the author resolved can receive another reviewer comment afterwards; "unresolved"
accounting never showed it. Status now fetches each thread's newest comment plus the PR
author and lists resolved threads where a reviewer spoke last as `review follow-ups`, and
`yeet reply` treats such a thread as postable instead of stale.
