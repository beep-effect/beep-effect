---
title: "Filter habits are read from the whole command, not its first 600 characters"
date: 2026-11-19
lane: "goals/agent-output-census-library"
reversal: "Truncate each verification command to 600 characters before matching the tail, head and grep pipes."
---

The reference measured filter habits on its verification capture, which stored each command cut to its first 600 characters; 2,009 of the 4,404 Yeet commands and 2,013 of the 4,162 test commands reached the cut. Re-running the reference's pipe patterns over that capture reproduces the audit's shares exactly (Yeet: tail 42.3%, head 22.1%, grep 45.0%). The census reads the whole command, so the tail, head and grep shares rise: Yeet 56.2%, 32.8% and 54.9%. Run counts per kind and the unfiltered share, which the reference already computed on the whole command, match (Yeet 4,404 runs, 3.7% unfiltered against 4%). The census numbers are the corrected baseline; the audit's pipe shares undercount.
