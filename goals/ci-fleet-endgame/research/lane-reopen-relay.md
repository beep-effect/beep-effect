# CI lane reopen relay

> Superseded on 2026-08-13 by the CSF-002 remediation. The relay below records
> historical lane state; it no longer authorizes the retired manual launcher.

Lanes were reopened after the GitHub App-driven CI fleet controller became live
on the `beep-ec2-heavy-shadow` label with one ephemeral VM per job. The former
manual `beep-ec2-heavy` burst bridge is no longer available before P2 cutover.

Other sessions only need to rebase onto or merge `origin/main` to pick up the
workflow changes; no runner changes are needed. Report runner anomalies in the
`ci-fleet-endgame` packet ledger at
`goals/ci-fleet-endgame/research/OPPORTUNITIES.md`.
