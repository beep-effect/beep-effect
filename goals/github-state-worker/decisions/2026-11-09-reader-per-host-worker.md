---
title: "Reader: a dedicated per-host systemd GitHub-state worker"
date: 2026-11-09
reversal: "Stop and disable the worker unit; readers already fall back to direct reads, restoring today's per-consumer polling."
---

A systemd user service built from the `ObservationWorker` template: flock singleton, unix socket at 0600, token through `LoadCredential=`. It reads every tracked PR in batched GraphQL plus ETag-revalidated REST and publishes PR-keyed snapshots that monitor, ready, merge-gate, watch, gate-table and the orchestrator scripts read, with a direct-read fallback. A monitor-held lease was rejected because merge-gate, gate-table and watchers run without a monitor.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.
