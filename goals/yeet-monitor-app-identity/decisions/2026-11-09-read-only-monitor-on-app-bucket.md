---
title: "Identity: read-only monitor on the App bucket, after the reader"
date: 2026-11-09
reversal: "Restore the monitor's rerunJob write path and keep the worker on the user token"
---

Answer: widen .github/workflows/rerun-runner-loss.yml to the monitor's environment-only rerun signatures so reruns spend GITHUB_TOKEN and the monitor never writes; then the per-host worker reads on the beep-fleet-orchestrator App installation token delivered by LoadCredential=. This doubles headroom without new Apps. Rejected: keeping the user identity (leaves a free bucket unused) and deciding only after measuring (measurement sets timing, not direction). Source: exploration `explorations/github-api-quota/DECISIONS.md`, entry 'identity: read-only monitor on the App bucket, after the reader'.
