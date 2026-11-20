---
title: "Chars-per-token samples are API calls inside the window"
date: 2026-11-19
lane: "goals/agent-output-census-library"
reversal: "Sample every call in each scanned file up to the window end and accept a sample count that depends on file history."
---

The reference run fitted 9,038 samples because it sampled every call in its modification-time file set, including 2,316 calls from before the window start. The census samples calls inside the window only: 6,704 on the reproduction run. It also treats a user message whose content is a plain string as a text entry that breaks a sample, as the reference did. The fitted density is 2.297 chars per token against the reference's 2.281, inside the 0.05 tolerance, and the binned medians agree (2.22 to 2.27). The sample count is therefore not compared against the reference.
