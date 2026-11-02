# P2 first prod deploy — 2026-10-28

Operator: Fable 5.1 orchestrator session. Credentials: `op run` with `CLOUD_CLOUDFLARE_ALCHEMY_TOKEN`
(account-owned token `alchemy-beep-effect-web`, minted by the operator with `ops/mint-alchemy-token.sh`).

## Sequence

1. Probed the old `CLOUD_CLOUDFLARE_ACCOUNT_IAC_TOKEN`: it got `10000` on Secrets Store, Workers domains,
   Durable Objects, and rulesets. The operator minted a dedicated token. The first run orphaned a token
   because the agent `op` shim is read-only; the second run used `op-human`, deleted the orphan, and stored the token.
2. Re-probed with the new token. Every endpoint succeeded except `/workers/subdomain` (`10007`: the account had
   never registered a workers.dev subdomain). Registered it as `beep-effect`
   (`PUT /accounts/<acct>/workers/subdomain`). Alchemy's state store needs it (`StateStore/State.ts:785`).
3. `alchemy state bootstrap --backend cloudflare` created 6 resources: the `alchemy-state-store` Worker
   with its SQLite Durable Object `Store`, the Secrets Store, the auth token, and the encryption key.
4. `alchemy plan --stage prod` showed 1 to create (`Website`).
5. Deleted the apex A records ×2 (registrar parking) and the `www` CNAME. All three are saved in
   `2026-10-28-dns-before-deploy.json`.
6. `alchemy deploy --stage prod --yes` created Worker `beepeffectweb-website-prod-lu7dco5dnf2llcs2` in 9.5s.
   Output: `{ url: 'https://beep-effect.com' }`.
7. Redeployed: `Plan: no changes`, `[Website] noop`.

## Live state after deploy

- Worker custom domains: `beep-effect.com` and `www.beep-effect.com`, both on the Worker above.
- Cloudflare-managed read-only proxied AAAA records for both hostnames. `_dmarc` and `_domainconnect` are untouched.
- Zone `http_request_dynamic_redirect` rule: `http.host eq "www.beep-effect.com"` → 301.
- `alchemy state list BeepEffectWeb -r --backend cloudflare`: `BeepEffectWeb/prod/Website`, `BeepEffectWeb/prod/output`.

## HTTP checks

| Request | Result |
| --- | --- |
| `GET https://beep-effect.com/` | 200 `text/html`, `<h1>beep-effect</h1>`, `server: cloudflare` |
| `GET https://www.beep-effect.com/` | 301 → `https://beep-effect.com/` |
| `GET https://www.beep-effect.com/some/path?q=1` | 301 → `https://beep-effect.com/some/path?q=1` (path and query kept) |
| Browser pane `https://beep-effect.com/` | renders the starter, no console errors (`2026-10-28-prod-browser.jpg`) |

`www` checks pinned `--resolve` to a Cloudflare edge IP. The workstation resolver had cached the NXDOMAIN
from the record-swap window; 1.1.1.1 DoH resolved both hostnames right away.
