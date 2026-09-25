# Colors runner and property-policy dependency review

Accept only colors task dependency changes induced by the development dependencies
`@beep/test-runner` and `@beep/fc-runs`. Preserve the computation identities, commands,
configuration, global configuration, profile, epoch, scope and every other package.
These dependencies provide native instrumented property registration and the
repository run-count/seed policy; no production dependency is added.
