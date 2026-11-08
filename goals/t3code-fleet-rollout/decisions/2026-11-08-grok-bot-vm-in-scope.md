---
title: "the Grok Bot VM joins the fleet as a credentialed Debian worker, superseding the 2026-11-01 out-of-scope ruling"
date: 2026-11-08
lane: "grok-bot-vm"
reversal: "Remove the host from the fleet: tailscale logout on the box, delete the hub link and desktop pairing, drop the hosts.md row and runbook section; the box keeps only /workspace"
---

The operator asked on 2026-11-07 for the Grok Bot computer (the `grok-bot` host, Debian 13, 8 cores, 15 GiB, Cursor-hosted Firecracker microVM, tini + Cursor pod-daemon as init, no systemd) to be set up like beep-worker: fork T3 build, Claude Code, Codex, Grok, Muse, cursor-agent, the 1Password agent shim, Claude Desktop and ChatGPT desktop, with pam_rssh YubiKey sudo replacing the image's passwordless sudo. This supersedes the exploration ruling that kept grok-bot-box-1 out of scope and credential-free. Known costs: the box reaches the tailnet only through DERP, hibernates when idle, has no systemd (T3 runs under a supervisor loop reconciled from the hub over Tailscale SSH), and anything outside /workspace may be lost on an image rebuild, so every install is re-runnable from /workspace/bootstrap. Provider credentials on it are the operator's accepted risk.
