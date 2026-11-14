---
title: "OipWeb adopts the live Vercel projects in place (recommended; cutover awaits a ruling)"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p4-oip-web"
reversal: "Declare a new project per stage (projectName oip-web-<stage>-new), add moveFrom with the live project id to each Vercel.Domain, edit the two projectId values in vercel-deploy.yml VERCEL_APPS, and forget the adopted project rows with alchemy state delete."
---

The 2026-11-14 census found the live projects `oip-web` (prj_J5xqp5jg7POGvoIwOj7e1axpoPxb) and `oip-web-staging` (prj_orJn2nvxflBiJqPF0VWLOD0RFAzE) with settings identical to `infra/src/OipWeb.ts` and linked to `beep-effect/beep-effect` (Pulumi state still records the pre-transfer `kriegcloud/beep-effect`). A new project beside each (D12) would need a READY production build before the domain move, would put previews and history on new hostnames, and would force an edit of `vercel-deploy.yml`, whose `VERCEL_APPS` env names both project ids and which runs pull-request jobs. Adopting in place (`adopt(true)` on `Vercel.Project`, a per-object exception to D12 in the spirit of D20) plans as `adopted` with no setting change, keeps ids, previews, history and the git link, and leaves that workflow unedited. The stack is built for adoption, with `RemovalPolicy.protect()` on both live projects because destroying an adopted stage would delete the live project. Neither option costs anything on the Hobby team. The cutover does not run until the orchestrating session rules on this.
