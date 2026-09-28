# Dock graph, registry and binding ownership

Four graph acquisitions, one registry and two mounted bindings now register
cleanup in the public test scopes. Every explicit release remains in its original
position, including disposing the first graph before booting the second and
clearing stored layout before requesting reload. Mount finalizers run before
their owning graph/registry finalizers.

Reversing only the seven acquisition wrappers reproduces the original source,
ignoring formatting. Assertions, layout operations, UI interactions, reload
callback and debounce delay remain unchanged. The fixed-delay persistence witness
still needs its separate flake-lens remediation.

Corrected separate-process controls injected failures after a graph operation and
after mounting the reset action. Both original tests observed zero cleanup calls;
both repaired tests observed one actual disposal. The first graph probe initially
matched the wrong location after formatting; that run was rejected and the probe
corrected before rerunning both controls. All temporary probes were removed.
All eight ordinary Node tests pass.

The full Desktop package audit, including Bun unit tests, and Docgen pass (14.6
and 12.9 seconds respectively). One enclosing EV009 fingerprint was matched by
its unique test-title prefix and refreshed with its open status preserved. Strict
inventory/census validation and diff checks pass.
