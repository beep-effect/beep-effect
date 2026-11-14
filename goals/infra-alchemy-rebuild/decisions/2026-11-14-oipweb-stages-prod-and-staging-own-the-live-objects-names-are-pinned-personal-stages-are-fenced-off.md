---
title: "OipWeb stages: prod and staging own the live objects, names are pinned, personal stages are fenced off"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p4-oip-web"
reversal: "Collapse liveStageConfig into the Pulumi-style config file per stage and drop the schema fences; no live object depends on the shape."
---

`prod` and `staging` map to the Pulumi stacks `production` and `staging` and refuse to run without `CI=true`. Every physical name (project, bucket, hostnames, zone ids) is pinned in `apps/oip-web/stack/OipWebConfig.ts`; none is derived from a state-held instance id (the #3133 lesson). A personal stage (`dev_$USER`) gets `oip-web-<stage>` and `oip-law-web-assets-<stage>`, the two public variables, no domain, no DNS and no secret, and the `OipWebStackConfig` schema rejects a personal configuration that names a live project, a live or retiring bucket, a domain or the HubSpot secret source.
