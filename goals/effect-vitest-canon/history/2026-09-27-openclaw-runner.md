# OpenClaw runner and redacted acquisition context

All nine current test files use the instrumented runner. One workspace dev
 dependency, two generated TypeScript references and two generated Fallow edges
connect it. The cache review changes only nine owned dependency lists and review
metadata; commands, effective configuration and qualification state remain.

Native acquisition messages use the runner's BEEP_TEST_TRACE=1/CI convention.
Messages contain fixed stage labels only: binary staging/install, runtime
resolution/probe/download, and workbench preparation. Tracing-off and tracing-on
runs each pass all four pinned binary acceptance cases. The enabled run records
the stages actually traversed; cold install/download branches were not forced.
No environment values, child output, secret references or paths enter new logs.

The paired recorder scheduling experiment enables concurrent suites and inserts
34 explicit Effect yields after driver calls. With the new independent fixtures,
all 26 cases pass. Reintroducing shared recorders makes eleven original checks
fail. Both phases omit the added empty-recorder preconditions so the failures
exercise the original request assertions. Exact edited bytes are restored.

The full package audit and documentation check pass on final source. The new
native timeout witness adds a real ten-second driver deadline and escalation
grace to integration work; final timing comparisons must disclose this added
coverage instead of attributing the added duration to runner overhead.
