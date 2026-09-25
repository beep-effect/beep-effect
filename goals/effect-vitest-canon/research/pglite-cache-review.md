# PGlite runner dependency cache review

Add @beep/test-runner as a test development dependency. Accept only PGlite
computation dependency-list changes; preserve all other nodes, commands, global
inputs, cache policy, scope, epoch and profile. Compare against the saved prior
baseline before accepting the projection.
