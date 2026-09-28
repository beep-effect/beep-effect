# Provider-driver preparation

This wave starts from main at 7581ead6c833ea0c935ae5afc98cc0636d3b3886
and uses the existing twelve recorded files for Anthropic (3), OpenAI (3),
OpenAI compatibility (1), Venice (3), and xAI (2). Eight files changed since
the frozen census at 662823dd960367046ba7d73dd8fd25d15782865a. Their
current contents and frozen diffs must be reviewed before remediation. This
is not a new repository-wide inventory or a package-completion claim.

OpenAI compatibility precedes Venice and xAI. Identity, Schema, Utils, and
the instrumented runner are already on main. All five packages are drivers;
no modeling or tooling package is mixed into this wave.

## Before timings

Configured Vitest runs from each package directory, using the JSON reporter:

```sh
bunx vitest run --reporter=json --outputFile=<private-report>
bunx --bun vitest run --reporter=json --outputFile=<private-report>
```

| Package | Node | Bun |
| --- | --- | --- |
| @beep/anthropic | 6.865 s / 9 passed | 2.623 s / 9 passed |
| @beep/openai | 4.942 s / 12 passed | 2.439 s / 12 passed |
| @beep/openai-compat | 4.925 s / 19 passed | 2.872 s / 19 passed |
| @beep/venice-ai | 5.497 s / 17 passed | 3.051 s / 17 passed |
| @beep/xai | 5.148 s / 14 passed | 3.120 s / 14 passed |

Every run exited zero with unchanged package source, test, manifest and
lockfile hashes. Private receipts include runtime versions, resource limits,
load averages and CPU/memory/I/O pressure before and after each command.
These are shared-workstation measurements, not controlled performance claims.
The default configured suites do not establish live integration coverage;
integration gating must remain unchanged and be reported separately.

Scope, assertions, properties, flakes, then observability remain the required
remediation order. Production defects stop the affected path for attribution
and any required operator decision.
