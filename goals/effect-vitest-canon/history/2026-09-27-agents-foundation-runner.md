# Agents foundation instrumented runner phase

All three admitted suites now import it from @beep/test-runner. Both packages
declare the workspace development dependency, with generated TypeScript and
Fallow references and matching lock entries. No global runner configuration or
production implementation changes.

The completion scan caught two compound Result assertions not covered by the
first assertion pass. Their complete success-guard-and-schema predicates now
pass to assertTrue. Neither predicate, operand, short-circuit condition nor
expected polarity changed. Preservation checks allow only these two reviewed
outer helper changes plus runner imports; all other test-body tokens remain.

Domain Node/Bun pass 22 cases (4.021232/1.767016 seconds). Tables Node/Bun pass
six cases (5.939568/2.317619 seconds). Trace-enabled Node runs pass both packages.
Controlled diagnostic failure probes prove trace-off stays quiet and trace-on
includes start, case name, failure outcome and duration. The probes are removed.
Full package audit and docgen pass for both packages, including a fresh domain
proof after the compound follow-up. Timings are single load-dependent observations.

The initial completion scan included a remaining native-platform finding because
the repository parity subject reads real source files. Preserve that subject and
record a reasoned exception during reconciliation. A scan overlapping a temporary
diagnostic probe is not accepted as final evidence; a separate stable-source scan
runs after both probes are removed.
