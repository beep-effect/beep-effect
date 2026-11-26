---
title: "P6: the distinction ground is the statute section and the law principal codec is rebuilt from the user id value"
date: 2026-11-24
lane: "p6"
reversal: "Put RejectionGround back as DistinctionProposition.ground and Shared.UserId as the core principal once EntityId's declared make type satisfies IdCodec; bump law-distinction to v2"
---

The design names the proposition ground `RejectionGround`, but that union carries fixture keys: the 102 case has `referenceFixtureKey` and the 103 case has `referenceFixtureKeys` (`entities/Rejection/Rejection.values.ts`). The same design says the proposition carries no fixture key, so that it is stable across runs. `DistinctionProposition.ground` is therefore the statute section alone, `RejectionStatute`, which `Rejection.values.ts` now exports. The cited reference is already named by `referenceDocument`, the document number.

The design also names the principal `Shared.UserId` and asks row 7 to check it against the factory's `IdCodec` bound. The check fails: `EntityId` declares its schema as `S.Codec<…, number>`, whose `~type.make` is `unknown`, so `makeClaimCore` refuses it. `LawPrincipalId` rebuilds the codec from `EntityIdValue` with the same `SharedUserId` brand. Its decoded type is `Shared.UserId`'s, and `LawClaim.identity.test.ts` assigns one to the other. `MatterGrant.principal` keeps `Shared.UserId` itself, because no factory bound applies there.
