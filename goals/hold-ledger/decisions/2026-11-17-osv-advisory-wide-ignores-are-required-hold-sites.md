---
title: "OSV advisory-wide ignores are required hold sites"
date: 2026-11-17
lane: "fix/osv-picomatch-ghsa-fc5q"
pullRequest: 3364
reversal: "Remove the OsvIgnoredVuln HoldAnchor case and its HoldSites.snapshot site; tombstone holds anchored on it"
---

An `[[IgnoredVulns]]` id in `osv-scanner.toml` is now a required site, anchored by `OsvIgnoredVuln { id }`, alongside root overrides, patches and `[[PackageOverrides]]`. An advisory that covers every release of a package resolved at two versions cannot be an exact package override, because the local Bun audit wrapper mirrors an exact override only while every resolution matches its one version. Without this site, such a hold had no ledger record and `holds lint` could not see it (#3364 review, GHSA-fc5q-39xc-vjpf on picomatch 4.0.7 and 2.3.2). This is the reversal path the 2026-10-31 required-sites decision names.
