You are a research lane in a 16-lane parallel study. Your output is a CITED report file, not a chat answer.

OUTPUT CONTRACT:
- Write to: goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/x8-confidentiality-standards.md
- CREATE within FIRST 5 turns, APPEND as you go. Final chat message = pointer only.
- Inline citations (URL + date, CFR/MPEP section numbers). Label `UNVERIFIED`. Cite primary legal sources, not law-firm blog summaries, wherever possible.

TOPIC: The RULES a patent-figure/CAD pipeline must satisfy — drawing standards, confidentiality, and export control — as of 2026-08-17.

Part 1 — DRAWING STANDARDS (be exhaustive and precise; this is a spec, not an essay):
- 37 CFR 1.84 in full operational detail: paper size, margins, line weight/character, shading rules, hatching, reference character size and placement, lead lines, arrows, numbering of figures/sheets, views (sectional, exploded, partial), prohibited content, color drawing petition (37 CFR 1.84(a)(2)), photographs.
- MPEP 608.02 and the drawing-objection/corrected-drawing workflow.
- Patent Center / EFS-Web practical file requirements in 2026: accepted formats (PDF specifics — DPI, embedded fonts, vector vs raster), size limits, what triggers a Notice to File Corrected Application Papers.
- Design patent drawing rules (37 CFR 1.152, MPEP 1503.02) — solid vs broken lines, surface shading requirement — these differ materially from utility drawings.
- WIPO Standard ST.94 / PCT Rule 11 for international figures, and ST.96/ST.26 relevance (be accurate about which standard governs what — do not conflate them).
- Reference-numeral consistency requirements between spec text and drawings.

Part 2 — CONFIDENTIALITY / COMPLIANCE:
- ABA Model Rule 1.6(c) and 1.1 comment 8 as applied to sending client technical disclosures to third-party AI/cloud services; any 2024-2026 state bar or ABA formal opinion on generative AI (ABA Formal Opinion 512 and successors).
- USPTO guidance on AI use by practitioners (the Feb 2024 guidance and anything since), including the duty-of-candor and signature implications.
- Foreign filing license / export control: 35 U.S.C. 184, 37 CFR 5.11, and EAR/ITAR exposure when technical drawings of an unfiled invention transit a foreign-hosted service. Is uploading an invention disclosure to a cloud CAD service an "export"? Give the real analysis with citations.
- Public-disclosure/novelty risk: does uploading to a service that trains on data constitute a public disclosure under 35 U.S.C. 102? Cite the actual analysis.

End with a one-page CHECKLIST an engineer can implement: hard rules the software must enforce, soft rules that need a human gate, and the specific data-flow boundaries that must never be crossed.
