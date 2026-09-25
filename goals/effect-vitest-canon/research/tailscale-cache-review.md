# Tailscale test dependency cache review

Accept only Tailscale computation dependency-list changes for the instrumented
test runner and shared property floors. Preserve all other nodes, configuration,
sources, scope, profile and epoch; compare against the saved prior baseline.
