# Exact Phoenix retention identity and assignment — 2026-10-28

The former Ansible reconciliation read `edges[0]` but mutated a configured ID.
A matching unrelated first policy could skip a needed change or falsely verify
it. The replacement uses the exact GraphQL node ID and verifies policy name,
cron schedule and MaxDays rule type. It verifies each declared project's
effective policy before mutation and again on fresh read-back, refusing missing
projects, conflicting assignments and incomplete enumeration. It does not
silently reassign projects or claim to audit unlisted projects.

The owned Python script runs against the host's loopback GraphQL endpoint with
no ambient proxy, redirects or credentials in URLs. Reads are capped at 1 MiB,
project enumeration at 100, requests have socket deadlines and Ansible bounds
the whole command. One mutation attempt is followed by fresh read-back; lost
acknowledgments fail with an unconfirmed outcome, never an automatic replay.
A later read-only --check can reconcile that uncertainty. Error text is fixed
and does not echo backend messages or URLs.

Ten local HTTP/CLI tests pass, covering unrelated first-policy data, exact
mutation identity, idempotence, read-only drift checks, wrong identity/schedule/
rule/assignment, missing or duplicate projects, pagination, GraphQL errors,
oversized responses, stale read-back, lost acknowledgments and malformed replies.
The Phoenix Ansible playbook syntax check passes. A disposable actual Phoenix
20.23.0 instance at the repository's exact OCI digest confirmed the real
schema, mutation, fresh read-back and wrong-project refusal. Its original
synthetic policy was restored and its container removed. Evidence is in
ops/phoenix-retention-backend-verification.json and ops/dankserver-verification.json.

The declared projects are default, harness-otel and beep-agent-effectiveness,
matching existing audit provenance. Deployment must refresh their actual
assignment; missing/changed projects fail closed. The default project's
health producer and Phoenix automatic creation remain reasons not to delete
it merely because the selected time window looks empty.

The weekly cron is deliberately unchanged. The 14-day rule defines eligibility;
a weekly sweep can leave eligible traces until its next run, nearly seven days
later. Changing a rule back cannot recover deleted rows. Production rollout
still requires the protected backup/recovery path and live verification. No
production policy, project, trace archive or held forwarder was changed here.
The full foundation acceptance, end-to-end health route and delivery remain open.
