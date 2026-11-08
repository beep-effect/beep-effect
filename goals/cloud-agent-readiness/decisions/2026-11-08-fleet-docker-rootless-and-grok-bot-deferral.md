---
title: "Fleet Docker is rootless; grok-bot keeps no Docker daemon"
date: 2026-11-08
lane: "goals/cloud-agent-readiness-fleet-toolset"
reversal: "Unmask the root docker units or remove docker-ce on tom-pc-1-wsl; on grok-bot, a later decision can add a daemon to its service script."
---

tom-pc-1-wsl got rootless Docker in the tbk-worker layout: Docker apt repository with rootless extras, root units masked, linger for agent, no docker group membership, so the brief's ask-before-docker-group condition never arose. grok-bot has no systemd and no newuidmap, and its egress proxy blocks the Debian mirror, so it gets no Docker until a decision extends its own service script. Receipt: history/2026-11-08-fleet-dev-toolset.md.
