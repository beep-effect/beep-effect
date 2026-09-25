# Ontology configuration runner dependency review

PR #1235 adds @beep/test-runner as a development dependency of
@beep/ontology-config. The runner depends on fc-runs, so the edge remains
acyclic. Successful configuration tests import the runner directly.

The reviewed configuration projection predates that edge. Cache policy reports
four configuration-drift findings: ontology-config build, check,
lint:deprecated-apis and test. The new dependency must participate in their
transitive input hashing. Commands, cache flags, output declarations and global
configuration remain unchanged.

Accept only the ontology-config dependency projection change. Preserve the
identity/types scope, existing profile and qualification-v2 epoch. This is a
configuration review, not runtime qualification; leave the qualification ledger
untouched. Verify the generated projection against the prior baseline before
publishing.
