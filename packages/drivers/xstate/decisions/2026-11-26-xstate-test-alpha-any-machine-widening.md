---
title: ModelTesting widens the release machine to AnyStateMachine for @xstate/test 2.0.0-alpha.1
date: 2026-11-26
reversal: Pass releaseMachine to testPaths and propertyTest directly and delete releaseModel.
governs:
  - test/ModelTesting.test.ts#releaseModel
enforcedBy: []
---

`@xstate/test` 2.0.0-alpha.1 constrains its source to `ActorLogic<any, any, any>`. A machine that declares `schemas.emitted` narrows `ActorSelf.on` to the emitted union and so does not satisfy that constraint. `releaseModel` re-types `releaseMachine` as `AnyStateMachine` for the two `@xstate/test` calls only; the fixture keeps its precise type everywhere else.
Rejected: dropping `schemas.emitted` from the release fixture, which would remove the emitted-event coverage the fixture exists for.
Accepted limit: transitional. Remove the widening when an `@xstate/test` release accepts machines that declare `schemas.emitted`.
