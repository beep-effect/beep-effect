---
title: "Sealed archives keep their recorded absolute home paths"
date: 2026-11-09
lane: "fix/redact-ten-minute-certainty-home-path"
reversal: "Re-capture the sealed artifacts with ~-relative paths, update their digest manifests, and delete the matching rows from privateHomePathExemptions"
---

The 2026-11-08 six-form adapter, selection and smoke captures and the re-grounding Grok transcript record the workstation home directory. Their bytes are pinned by `artifact-hashes.json` and `2026-11-08-re-grounding-artifacts.json`, and no repository command regenerates those manifests, so they are not redacted. The other packet evidence (2026-10-28 evidence notes, 2026-11-02 reuse audits, package-verify logs, `regex-compile-survey.json` runtime paths) was rewritten to the `~` form. `bun run beep laws private-home-paths --check` holds each sealed file to its exact recorded count.
