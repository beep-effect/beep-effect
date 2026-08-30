# PROMPT — 2026-08-30

Ready-to-fire kickoffs. Paste into a coding agent after admitting the packet.

## P1 — Intrinsic-record citation duty (OED Mitchell × verified-span)

```
Read research/2026-08-30/REPORT.md claims f-law-04 and f-law-01, plus merged beep #871 (citation verified-span).
Write a one-page threat note (chat only, no repo writes): how a patent-drafting agent can hallucinate spec/figure/prosecution-history cites the way In re Mitchell (D2026-16) did, and which existing beep surfaces (citation-extraction-engine, citation-verified-span-substrate, patent-document-schema) would have to refuse that output.
Do not implement. Stop at the note.
```

## P2 — Skills-over-MCP v1 wire vs skill-contract-kernel

```
Read f-agents-01, f-agents-02, f-agents-06 (SEP-2640 still draft; Rayrun skills/list+get + SHA-256 digests; experimental-ext-skills#132 accepted v1).
Draft the invariant for beep skill-contract-kernel / mcp-kit: disk Agent Plugins remain a host snapshot; wire v1 is list+get+digest-addressed files; allowed-tools frontmatter is not authorization.
List three beep surfaces that would consume the wire vs ship a disk plugin. No code.
```

## P3 — Do not pin unpublished rc.113

```
Given Effect #7446 (staged rc.113, unmerged) and standing effect@4.0.0-rc.112, list beep packages that currently pin or assume rc.112.
Flag any kit that would break if #7524 (Net Schema codecs) or #7514 (in-place TLS upgrade) landed in the next RC.
Report file:line only. Do not bump versions until asked.
```
