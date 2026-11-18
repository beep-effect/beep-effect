---
title: "The agent key export holds presence keys; the audience is read once per built step"
date: 2026-11-18
lane: "fix/gate-output-switch-on"
reversal: "Add the three extra variables to the export, or pass the audience in from the task entry point."
---

`AgentEnvKey` in `@beep/runtime-env` exports the agent table's presence keys only. `AI_AGENT`, `AGENT` and `EDITOR` are listed beside it in Turbo's pass-through and in the test that compares the two, because they are not table rows. The task path reads the audience synchronously when it builds a step, as it already does for CI, so a step's arguments and environment always agree. Only steps that run Turbo receive `AGENT=1` and errors-only task logs; other steps keep the shell's environment. The test file for the task path clears agent variables so it gives one answer from any shell. The root cache baseline was re-recorded; its review and request are under `docs/reports`.
