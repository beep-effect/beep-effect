# Reviewed Docgen launch input change

The only workspace implementation-script change is
`@beep/repo-cli` `beep:docgen`, from
`bunx --bun --no-install docgen` to `bunx --no-install docgen`.
The executable already has a Bun shebang. Remove the forced interpreter
override while retaining the actual documentation compiler and all checks.

The full cache audit reports exactly these ten configuration-drift tasks:

- `@beep/repo-cli#build`
- `@beep/repo-cli#check`
- `@beep/repo-cli#docgen`
- `@beep/repo-cli#doctest`
- `@beep/repo-cli#lint`
- `@beep/repo-cli#lint:deprecated-apis`
- `@beep/repo-cli#lint:jsdoc`
- `@beep/repo-cli#lint:laws`
- `@beep/repo-cli#test`
- `@beep/repo-cli#test:property`

All ten bind the changed workspace manifest bytes through their existing
command/configuration fingerprint. Only the Docgen implementation command
changes; all task-facing wrappers, inputs, outputs, dependencies, flags and
other manifest fields are unchanged. No scope, profile, epoch, qualification
ledger or cache-adoption disposition changes.

Exact manifest bytes:

- Prior SHA-256: `4dc99d9055163269c73b8d96826ab38846e863ce5e3bb82a0f927271ba50fa2d`.
- Reviewed SHA-256: `9f43e6fa5edfd4bea8663b41fb285fbeaac729ec6980b951d416039452bcd42e`.

Full Docgen passed before and after in the repair lane (35.214s/34.818s).
Earlier default producer-lane attempts exited130; direct compilation of all
3560 examples and the complete unforced launch passed. The old launch is
intermittent, so the review does not assert a deterministic compiler failure.

Reversal restores the prior script and re-reviews its changed manifest input.
The baseline update acknowledges only the observed configuration drift and
retains the reviewed legacy posture; it grants no qualification.
