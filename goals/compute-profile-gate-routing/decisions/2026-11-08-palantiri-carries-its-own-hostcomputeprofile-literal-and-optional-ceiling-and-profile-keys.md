---
title: "Palantiri carries its own HostComputeProfile literal and optional ceiling and profile keys"
date: 2026-11-08
lane: "goals/compute-profile-gate-routing-p2"
reversal: "Make the keys required, or move the literal domain into a shared package both import"
---

`@beep/palantiri` is a library that `@beep/repo-cli` depends on, so it cannot import repo-cli's `ComputeProfile`. A two-value `LiteralKit` in the library keeps the dependency direction; the repo-cli value is assignable to it. Both keys are optional with a `None` default so recorded parcel envelopes without them still decode.
