# Pretext instrumented runner phase

All four admitted suites now import it from @beep/test-runner. Their test-body
tokens are unchanged from the completed flake phase. The package declares the
workspace development dependency; frozen graph inputs include the matching lock
entry, two generated TypeScript references and two generated Fallow allowances.

Node and Bun each pass 24 cases with the same single native-browser skip. The
trace-enabled Node run also passes. Whole-command observations are 7.583639,
4.579171 and 6.691275 seconds respectively, with stable source hashes. These
load-dependent timings are observations and do not establish a speedup.

A temporary controlled failing case proves trace-off stays quiet and trace-on
reports the case name, start, failure outcome and duration. The probe was removed.
Full package audit and docgen pass. No shared runner behavior, timeout, property
floor, schema domain or production implementation changed.
