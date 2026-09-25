# Cosmos test dependency review

Accept only Cosmos task dependency changes induced by development dependencies
@beep/test-runner and @beep/fc-runs. Preserve all other computation identities,
commands, configuration, global configuration, profile, epoch and scope.
No production dependency is added.
