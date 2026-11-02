# Installed worker credential isolation

The new deployment plan no longer accepts a shared environment file. It names
one dedicated hash-salt file and, optionally, one Phoenix query-key file. Source
paths are private provisioning inputs, not telemetry. Systemd loads the named
credentials; the worker validates the private directory and bounded files before
opening the journal. Values must be nonempty strict UTF-8, at most 4096 bytes,
without NUL or newline. An invalid credential source never falls back to an
ambient value. Provision real files through the existing approved secret route;
all files used in this proof contain synthetic values only.

Both ExecStart commands clear their inherited environment. The worker receives
only PATH and CREDENTIALS_DIRECTORY; the intake frontend receives only PATH,
GOMEMLIMIT, GOMAXPROCS, XDG_CONFIG_HOME and XDG_DATA_HOME. Values do not appear in
argv or health. Direct worker-process fixtures retain their older explicitly
provided environment route; this change qualifies the generated installation,
not every process launcher on the workstation.

The final installed proof is `ops/history/credential-health-installed-verification.json`.
It injected unrelated synthetic secret variables into both owned units and
verified their absence from the actual processes. It exercised the optional query
credential, rejected empty/oversized/invalid-UTF8/newline credentials before any
journal mutation, proved private controls stay off the frontend, and refreshed
the independent worker-health scrape/stopped-worker alert. All owned units and
monitor processes were cleaned up. The source-bound scoped CLI compiler/test
receipt is `ops/credential-cli-verification.json`; it includes the dedicated
entrypoint that had previously been omitted from that scoped compiler input.
The full CLI package/repository gates remain open.

Systemd's installed user manager rejected a whitespace-containing credential
source in an isolated capability probe. The plan therefore rejects whitespace
in those two paths, while artifact paths with spaces remain tested. The
LoadCredential directive uses its native unquoted value syntax; ExecStart path
arguments still receive their appropriate quoting. No user-manager restart,
privilege escalation or authentication weakening was used.
