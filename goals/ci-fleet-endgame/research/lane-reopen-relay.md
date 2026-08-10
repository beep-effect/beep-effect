# CI lane reopen relay

Lanes are open again. The GitHub App-driven CI fleet controller is live on
the `beep-ec2-heavy-shadow` label with one ephemeral VM per job. Heavy lanes
continue to use the manual `beep-ec2-heavy` burst fleet until the P2 cutover
flips that label.

Other sessions only need to rebase onto or merge `origin/main` to pick up the
workflow changes; no runner changes are needed. Report runner anomalies in the
`ci-fleet-endgame` packet ledger at
`goals/ci-fleet-endgame/research/OPPORTUNITIES.md`.
