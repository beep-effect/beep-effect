---
title: "Sealed archives keep their recorded absolute home paths"
date: 2026-11-09
lane: "fix/redact-ten-minute-certainty-home-path"
reversal: "Re-capture the sealed artifacts with ~-relative paths, update their digest manifests, and delete the matching rows from privateHomePathExemptions"
---

`composition-candidate-measurement-001.json` (pinned by `composition-candidate-review-locations-001.json`, which already supplies the `~` aliases) and the seven `implementation-runtime-*` freezes (self-sealed by `implementationDigest`, chained through `baselineFreezeSha256` and the accepted-main metadata, and checked against the executing bun path by `freeze-runtime-closure.py verify`) record the workstation home directory and are not redacted. `census-components-summary-001.json` was rewritten to the `~` form because no digest pins it. `bun run beep laws private-home-paths --check` holds each sealed file to its exact recorded count.
