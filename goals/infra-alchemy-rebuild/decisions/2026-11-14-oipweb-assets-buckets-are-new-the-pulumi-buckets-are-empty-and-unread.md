---
title: "OipWeb assets buckets are new; the Pulumi buckets are empty and unread"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p4-oip-web"
reversal: "Set assetsBucketName to assets.oip.law / staging-assets.oip.law in liveStageConfig (the S3 provider adopts silently by name), skip the Pulumi bucket destroy and pulumi state delete the five bucket resources instead."
---

`assets.oip.law` and `staging-assets.oip.law` hold 0 objects, 0 versions and 0 delete markers (census 2026-11-14), and no app, package or workflow reads or writes them. A new bucket therefore needs no copy and no reader switch, so D12's greenfield default applies at no cost: `oip-law-web-assets-prod` and `oip-law-web-assets-staging` (HeadBucket 404 on both names, so unclaimed), with the Pulumi baseline restated (versioning, AES256 with SSE-C blocked, full public-access block, BucketOwnerEnforced, DenyInsecureTransport policy) and `RemovalPolicy.protect()` on live stages. S3 bills storage and requests only, so an empty bucket costs nothing. The Pulumi buckets are deleted empty at cutover after `pulumi state unprotect` on their five protected resources each.
