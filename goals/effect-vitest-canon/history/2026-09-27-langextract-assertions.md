# Langextract canonical assertions

Twenty-one Option/Result checks use native assertion helpers. Exact payloads and
predicate polarity remain. Requiring the candidate through Array.head retains
the original failed assertion on a missing candidate; the existing length check
remains. The expected zero uses its existing NonNegativeInt schema for the same
value. Unused imports are removed. Full package audit and docgen pass.

The three Handoff Option-to-Option comparisons remain intact: they compare two
independently derived relations, not an Option against a known Some payload.
Replacing either side with an invented constant would change the oracle; the
existing cardinality checks remain. Their explicit detector exceptions will be
recorded at reconciliation. The twenty-history aggregate is retained here and
will gain individual diagnostic labels in the observability step.
