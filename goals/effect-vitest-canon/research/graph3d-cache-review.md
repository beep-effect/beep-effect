# Graph3D runner dependency review

Accept only graph-3d task dependency changes induced by the @beep/test-runner
development dependency. The pure equivalence test adopts the runner; Chromium
instrumentation remains an explicitly open compatibility prerequisite. Preserve
all computation identities, commands, configuration, profile, epoch, scope and
other packages. No production dependency is added.
