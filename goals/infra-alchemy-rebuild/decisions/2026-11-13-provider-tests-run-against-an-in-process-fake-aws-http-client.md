---
title: "Provider tests run against an in-process fake AWS HTTP client"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-aws-extras"
reversal: "Replace test/fixtures/FakeAws.ts with live tests under the alchemy-test runner against a dedicated test account."
---

The `@alchemy.run/test` suites for `@beep/alchemy-aws-extras` run in hosted CI with no AWS credentials. `test/fixtures/FakeAws.ts` is an in-memory account behind an effect `HttpClient`: distilled still signs, serializes (awsJson 1.1 and the EC2 query protocol) and parses every call, and only the transport is fake. Each test covers create, update, delete, read and adopt through `test.provider` and `stack.deploy` / `destroy` with `inMemoryState()`. A live mutation suite is out: the singletons are live settings in account 832907639880 and there is no separate test account. `test/integration/LiveRead.test.ts` runs only with `BEEP_ALCHEMY_AWS_EXTRAS_LIVE=1` and calls `read` only; on 2026-11-13 it read all six cost allocation tags and both enrollments as Active.
