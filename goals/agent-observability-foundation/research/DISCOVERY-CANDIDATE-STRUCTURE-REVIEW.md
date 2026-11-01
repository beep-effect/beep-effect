# Discovery candidate extraction review

The file-candidate checks and private identifier construction now have a private
helper, leaving the bounded traversal loop responsible for cursor and budget
handling. Root escape is still rejected before filename filtering. Candidate
count increments before hashing; cycle capture and observation/source append
order remain unchanged. No traversal, cursor, privacy, or record-read policy is
changed.

The independent Astra review in this session accepted source SHA-256
`60f2cbc1b43099cb40f602fe91023ebab5be91eea1a55f4eff06df07d2938c5d` against
pre-extraction SHA-256
`a36be4d37f9859a5094d18cdbcb2695f3a4ca9dac9c9bb520689c31cf7f1ad3f`.
The full AI-metrics package audit (134.1 seconds) and documentation generation
(11.7 seconds) passed after that review. The guard observed a 5.23 GiB peak,
at least 25.61 GiB host available memory, 144 tasks, zero process-limit events,
and no guard stop. The proof did not invoke the deliberate OOM exercise.

Static-analysis results and archived artifact hashes are recorded in the
associated verification receipt. Package proof does not replace full delivery,
installed readback, or review gates; the recovery hold remains active.

Fallow v16 still reports 26 introduced complexity findings, zero introduced
duplication and zero dead-code issues. The traversal operation improved from
cyclomatic14/cognitive13 to11/9; its finding remains. This is a verified structural
improvement, not a passing static-analysis gate. No baseline or threshold was
changed. CRAP uses estimated reachability here, not measured branch coverage.
