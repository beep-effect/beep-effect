---
title: npm launchers refuse installs and end their own flags with `--`
date: 2026-11-26
reversal: Drop "--no" and "--" from the npm prefixes and "--no-install" from bun's in LocalExec's PREFIXES.
governs:
  - src/LocalExec.ts#PREFIXES
enforcedBy: []
---

The npm exec prefix is `npx --no --`, the npm script prefix is `npm run --`, and bun's exec prefix is `bun x --no-install`.
Reason: without `--no` (bun: `--no-install`) a missing binary is silently installed and run. Without `--`, npx claims the tool's own flags, and npm silently claims flag arguments after the script name; probed live at npm 11, `npm run args --flag` delivers nothing to the script while `npm run -- args --flag` delivers `--flag`. pnpm and yarn forward post-script arguments without a separator.
Rejected: the bare `npx` / `npm run` / `bun x` forms, which install on demand and swallow forwarded flags.
