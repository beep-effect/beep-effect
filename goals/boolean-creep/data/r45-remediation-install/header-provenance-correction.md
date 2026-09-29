# R45 design header provenance correction

PR #1328 review thread `PRRT_kwDOPbO_N86m_2DD` identified stale source
SHAs in the `r2-foundation-unique-match-search` design header. The R45
correction section already cites the right source and main; the two header
fields now match it. No evidence, design, inventory or contract changed.

The original reviewed install remains historical evidence. Its design bytes
are preserved at
`goals/boolean-creep/history/designs/2026-09-29-pre-r45-header-correction/r2-foundation-unique-match-search.md`
with sha256 `58e3513ccfce49ab34e46c4b80f5aa75348e201fbd828964ea72fe1c3b04abd8`.
The corrected live design has sha256
`eb55906d53ff2e754ce6c6d7e394488060b4431f357b9ac128d734373b224dae`.
Existing install receipts and their bindings are unchanged.

The R46 input candidate bound to `47feefa76b` predates this correction.
Its source identity and this design binding require refresh before admission.
This correction grants no census, dry-round, P3 or implementation credit.
