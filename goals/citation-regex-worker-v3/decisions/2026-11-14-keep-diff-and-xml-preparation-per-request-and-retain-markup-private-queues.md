---
title: "Keep Diff and Xml preparation per request and retain Markup private queues"
date: 2026-11-14
reversal: "Hoist these objects only with an explicit replacement for their per-owner lifecycle and queue state."
---

B1 does not require hoisting Diff or Xml to engine construction. Their preparation and per-job diagnostics remain per request. Markup private semaphores and queue/deadline guards remain: the default HTML cleaner serves the closed standalone port, whose callers need that queue. Xml passes lane.start explicitly. Diff receives both the starter and text reservation explicitly and performs no Invocation or native-admission lookup. No installed-stage, tokenizer, evaluator or detach count is moved.
