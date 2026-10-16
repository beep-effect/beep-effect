# Worker cloud CLI authentication — 2026-10-14

## Scope

The operator requested completing Azure, Vercel and Cloudflare sign-ins on
beep-worker. Each installed CLI initially reported logged out. Started native
device authorization flows over SSH; the operator approves the account in their
browser. No workstation token or human password was copied into this workflow.

## Verified account access

- Azure CLI 2.90.0: device login completed. `az account show` reports an enabled
  subscription and user authentication. `az group list --query 'length(@)'`
  successfully returned zero resource groups. This proves the read operation
  succeeds; it does not imply deployment permissions or provision resources.
- Vercel CLI 62.7.0: device login completed. `vercel whoami` reports kriegcloud;
  `vercel teams ls` successfully lists the existing teams. No deployment,
  project linking or AI Gateway configuration was performed.
- Cloudflare Wrangler 4.151.0: the first device request expired after five
  minutes, matching the browser's rejected-code result. A fresh request was
  approved, the CLI reported successful login, and `wrangler whoami` verified
  OAuth authentication and listed the existing account and granted scopes.
  This used Wrangler's native login scope set. No Worker, Pages project,
  tunnel or other resource was created or changed.

## Friction and verification boundaries

Use device login for remote SSH hosts where browser callback ports are not
reachable. Request short-lived codes close to the operator's approval action;
if the CLI confirms expiry, replace that request rather than retrying its code.
Device codes and access/refresh credentials are excluded from this receipt.

Azure's successful resource-group read emitted an installed SDK Python 3.14
SyntaxWarning for an invalid escape sequence. The operation exited zero; record
this as warning-only compatibility friction, not an authentication failure.

CLI OAuth state is separate from browser profiles, cloudflared tunnel
certificates, workload identities and agent connectors. These read-only checks
do not qualify deployment, infrastructure changes or cloud billing operations.
