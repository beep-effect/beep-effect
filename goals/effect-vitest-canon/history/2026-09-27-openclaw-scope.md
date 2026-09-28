# OpenClaw fixture ownership

Ten CLI recorder cases and three systemd recorder cases now acquire independent
recorders through separate named it.layer fixtures. Each asserts an empty initial
request list; the stdin recorder is also allocated by its layer instead of a
module-global array reset. Remaining pure unit layers have descriptive names.

Tokenized assertion comparison retains all 94 original CLI assertions and all
33 systemd assertions, adding eleven and three empty-recorder preconditions.
Deliberately sharing each recorder again makes the corresponding empty-state
checks fail; both controls restore the exact original edited bytes afterward.
These controls demonstrate fixture isolation, not a reproduced historical
production failure or an absence of all possible races.

The full package audit and documentation check pass. The pinned binary's native
process, executable-file and scoped-workbench boundary remains unchanged.
Assertion, property, live deadline, observability and runner work remain open.
