# Graph3D runner dependency review

Accept only graph-3d task dependency changes induced by the @beep/test-runner
development dependency. The pure equivalence test adopts the runner; Chromium
instrumentation remains an explicitly open compatibility prerequisite. Preserve
all computation identities, commands, configuration, profile, epoch, scope and
other packages. No production dependency is added.

## Main qualification integration

The merge of main at `5201b02fe5` preserves its reviewed AI-sync dependency
removals and D1 repo-cli fixture inputs. The resulting projection adds only
the seven Graph3D test-runner dependency edges to that baseline; every other
node and configuration is retained from main. No cache eligibility is widened.
