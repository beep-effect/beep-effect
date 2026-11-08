---
title: "The profile probe subcommand is beep compute profile"
date: 2026-11-08
reversal: "Rename the compute command group and update the dispatch manifest and Root registration"
---

New command group compute with subcommand profile: prints the profile, --is <profile> exits 0 or 1 silently through the CliReportedExit path, --json prints the encoded ComputeProfileResolution (Options as null). An invalid BEEP_COMPUTE_PROFILE exits 2 with ComputeProfileError. No repo scan or git; measured about 0.5 s wall.
