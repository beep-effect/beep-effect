---
title: "Forward-only migration: legacy Decision Log bodies stay frozen above the block"
date: 2026-11-05
lane: "feat/goal-packet-decision-files"
reversal: "Convert a packet by hand: move each legacy entry into a decision file, delete the legacy text, run decisions write. Nothing in the tool depends on the legacy text being present or absent."
---

Existing packets keep their hand-written Decision Log tables and `###` sections exactly as committed. The generated block is appended at the end of the `## Decision log` section the first time a packet gains a decision file (or inserted where a marker pair already exists), so the authored history sits above the marker and only the block is regenerated. A packet with no `decisions/` directory and no marker is not touched at all, which keeps this change out of the 265 existing packets. Converting history into files is optional per packet and never required by the doctor.
