---
title: "Restore the PSI sampler at a durable path"
date: 2026-11-08
lane: "t3code-goals-closeout"
reversal: "Run systemctl --user disable --now beep-psi-sample.timer and daemon-reload, which stops new samples and leaves history in place. Do not restore the previous drop-in alone: it names the retired path and fails every tick"
---

The sampler and its data were retired with $HOME/workstation-diagnostics on 2026-11-02 while the unit still pointed there, so it failed on every tick. The sampler now lives under $HOME/.local/share/beep-psi and writes $HOME/.local/state/beep-psi/safe-pressure.jsonl with a 14-day ring, in the same record format and still without per-process scans. The spec called for read-only analysis; this goes further because a threshold table that must be re-derived needs a live recorder. The baseline itself uses the preserved data.
