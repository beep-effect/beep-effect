---
title: "Restore the PSI sampler at a durable path"
date: 2026-11-08
lane: "t3code-goals-closeout"
reversal: "Restore $HOME/.local/state/beep-psi/99-workstation-light-sampling.conf.bak-20261108 over the drop-in and run systemctl --user daemon-reload"
---

The sampler and its data were retired with $HOME/workstation-diagnostics on 2026-11-02 while the unit still pointed there, so it failed on every tick. The sampler now lives under $HOME/.local/share/beep-psi and writes $HOME/.local/state/beep-psi/safe-pressure.jsonl with a 14-day ring, in the same record format and still without per-process scans. The spec called for read-only analysis; this goes further because a threshold table that must be re-derived needs a live recorder. The baseline itself uses the preserved data.
