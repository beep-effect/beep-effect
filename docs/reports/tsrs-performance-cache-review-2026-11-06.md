# Cache review for the tsrs performance configuration

Reviewed against main `5e3d6d7a1296` during the performance publication.
The cache audit reports global configuration drift, the root policy-fingerprint
computation, ten repo-cli computations, and the root Turbo source digest.

The root environment hash adds `BEEP_LINT_TSGOLINT` and `TSRS_FAST`. These select
lint backends and compiler modes, so distinct values must invalidate cached
results. This strengthens input identity; neither variable is a secret.

The CLI manifest adds its direct tsrs dependency and gives source and test
checks distinct checker-cost cache files. These files are scheduling history,
are gitignored, and are not build outputs. The measured checks retain their
source/test scope and diagnostics. The manifest bytes are part of all ten CLI
computation identities even though only the owned check command changes.

Root policy-fingerprint inputs now cover the lint program-assignment helper.
The generated CI/lint policy closures also include the GitHub Actions runner
output helpers and move the existing TestDouble dependency to its owning
closure. The input changes follow the imported modules; they do not remove a
required verification command or narrow the checked program.

Record only root (`//`) and `@beep/repo-cli` posture using the baseline command.
Retain the existing four lint computations in qualification scope, the
`local-linux-x64-bun1.4.4` profile, and `qualification-v3` epoch. Carry other
subjects' reviews forward. This review grants no new qualification and changes
no cache writer credentials, artifact outputs, or trust policy.

The separate JSDoc remote-cache change uses the existing protected-main writer
and read-only PR policy. Local full-inventory parity and compiler diagnostic
controls are recorded in the repository performance and toolchain runbooks;
hosted execution evidence is still required before claiming CI savings.
