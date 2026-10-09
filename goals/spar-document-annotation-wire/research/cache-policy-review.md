# RDF dependency cache-policy review

D16 authorizes owner-command re-recording for the D11 RDF-to-Md edge. The
cache-policy gate reports configuration drift for exactly six RDF computations:
`build`, `check`, `doctest`, `lint:deprecated-apis`, `test`, and `test:property`.
The manifest adds only `@beep/md: workspace:^`; its lockfile change matches that
edge. Command text, task inputs/outputs, environment keys and cache flags stay
as reviewed on main. The new dependency changes their graph-bound identities.

Re-record only the `@beep/rdf` subject through `beep cache baseline --request`,
using a content-addressed review basis and the prior baseline digest. Preserve
scope, profile and epoch and all other subjects' review records. This records
legacy settings and grants no qualification or new cache reuse. Reject any
changed subject outside RDF rather than absorbing unrelated drift.

Review the generated diff before publication. Reversal: remove D11's adapter
placement and dependency edge, regenerate canonical references/boundaries, and
re-record the resulting RDF baseline through the same owner command.
