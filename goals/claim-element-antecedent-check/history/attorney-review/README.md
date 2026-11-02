# Attorney reference spot-check

Open `index.html` in a browser. The page is self-contained and sends no data to a server. It contains the frozen six-family sample (50 claims), selected without predictions, and seven additional bounded representation questions.

Select the actual reviewer role and an anonymous reference such as R1. For each claim compare Terms, Clauses and References with the exact source wording, then choose Agree as annotated, Needs revision or Uncertain. Record corrections where needed. Review the additional reciprocal-language question and six head-wording decisions separately; those decisions do not overwrite the original agreement answers.

Export review decisions when finished and return the JSON file through the normal task workflow. Browser progress is saved locally and bound to this exact annotation bundle. No actual attorney decision is prefilled. Only a completed export from an actual attorney can satisfy the mandated spot-check; interface-preview exports cannot do so.

The export binds the source selection and exact reference versions by SHA-256. Preserve this HTML and reviewed versions if annotations change after review. Do not put reviewer names or private matter information in this public packet.

One subsequently identified round-limited head question is retained in `addendum.html` (claim 13, “each edge”). Review and export it separately. It does not change the original 50 claims, seven questions, packet hashes or agreement denominator. The original packet is immutable.
