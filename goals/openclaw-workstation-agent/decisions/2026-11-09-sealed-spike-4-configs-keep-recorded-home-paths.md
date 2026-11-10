---
title: "Sealed spike-4 configs keep their recorded encoded home paths"
date: 2026-11-09
lane: "fix/redact-ten-minute-certainty-home-path"
reversal: "Re-run spike-4 with ~-relative state paths, re-record the cfg-sha256 prefixes in logs/v2-setup.log and v3-adjudication-of-v2.md, and delete the two gen-A/gen-B rows from privateHomePathExemptions"
---

The spike-4 archived configs `history/p0/spike-4-upgrade-rollback/configs/gen-A.openclaw.json` and `gen-B.openclaw.json` each record one dash-encoded agent scratchpad path that names the workstation account. Their bytes are pinned by 16-hex sha256 prefixes: `logs/v2-setup.log:13-14` records `gen-A cfg-sha256=a67c3fd70ab4be5b` and `gen-B cfg-sha256=644a12fd8197e09f`, and `v3-adjudication-of-v2.md:120` states that the archived configs hash to those prefixes. The prefixes come from the original run and no repository command regenerates them, so the two configs keep their HEAD bytes. `bun run beep laws private-home-paths --check` holds each to exactly one recorded home path. The spike-2 and spike-4 logs carry no digest pin and were rewritten to the `-home-<user>-` form. Seal census method for every redacted file: its full sha256, git blob hash, 8-hex prefixes of sha256, git blob, md5 and sha1, and a 12-character base64 sha256 prefix, each searched with `git grep -F` across the tracked tree; the gen-A and gen-B prefixes were the only pins found.
