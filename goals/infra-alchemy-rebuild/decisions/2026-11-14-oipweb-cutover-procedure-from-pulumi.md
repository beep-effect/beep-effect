---
title: "OipWeb cutover procedure from Pulumi"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p4-oip-web"
reversal: "Before step 6: unset OIP_WEB_INFRA_DEPLOY and keep Pulumi as owner. After step 6: pulumi stack import --file <archive> per stack."
---

The procedure is the runbook's "Cutover from Pulumi" (`docs/runbooks/alchemy-infra.md`), executed by the orchestrating session after the project ruling: (1) read-only preconditions, the HubSpot token proven live by a read that returns portal 246203876 and the Cloudflare token's DNS edit scope verified; (2) `pulumi stack export` of both stacks archived under `~/.local/state/beep/infra-archives/pulumi-exports/` with size and sha256 in a decision file; (3) deploy role and environment bootstrapped; (4) Pulumi frozen; (5) arm and dispatch, plans must match the expected-plan decision, smoke checks pass, a second dispatch plans no changes, drift exits 0; (6) `pulumi state delete` for every adopted object, then `pulumi state unprotect` and a targeted destroy of the empty old buckets, then `pulumi stack rm`. Expected visitor effect: none; adoption rewrites settings that already hold, DNS records change only their comment, variable writes reach new deployments only. Each step names its check and rollback in the runbook. The one live risk is a wrong HubSpot token, which would surface on the next production deployment as a failing contact form; step 1 removes it.
