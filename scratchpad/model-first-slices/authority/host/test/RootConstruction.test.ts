import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as SourceScan from "@proto/tooling/SourceScan";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";

// Every package's source, and the only files allowed to build or provide a root invocation.
const packages = [
  "shared/kernel",
  "shared/contract-kit",
  "shared/tooling",
  "party/contract",
  "party/model",
  "party/host",
  "authority/contract",
  "authority/model",
  "authority/host",
  "runs/contract",
  "runs/model",
  "runs/host",
  "apps/practice",
];
const boundary = [
  "authority/host/src/Boundary/Boundary.ts",
  "authority/host/src/Session.adapter.ts",
  // Named exception: the conformance-only control route (phase 5), which issues grants as an
  // org's owner at bootstrap on a deployed stack. Never mounted by a production front.
  "authority/host/src/Control.route.ts",
];

it.layer(NodeServices.layer)((it) => {
  it.effect("only the authority host's boundary builds or provides a root invocation", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const root = yield* path.fromFileUrl(new URL("../../../", import.meta.url));
      const everywhere = yield* SourceScan.scan(root, { packageDirs: packages, allowed: [] });
      // The boundary itself is found, so the scan is not vacuous.
      expect(A.map(everywhere, (violation) => violation.file)).toEqual(expect.arrayContaining(boundary));
      const outside = yield* SourceScan.scan(root, { packageDirs: packages, allowed: boundary });
      expect(outside).toEqual([]);
    }),
  );
});

it("negative control: the scan flags a forged root and an invocation no re-admission produced", () => {
  const forged = [
    'const root = Root.cases.Human.make({ principal: "p_x" });',
    "effect.pipe(Effect.provideService(CurrentInvocation, someInvocation));",
    "Effect.provideService(effect, CurrentInvocation, { ...invocation, chain: [] });",
  ];
  expect(A.map(SourceScan.scanText(A.join(forged, "\n"), { file: "forged.ts" }), (violation) => violation.rule)).toEqual([
    "builds a root",
    "builds an invocation",
    "provides an invocation no re-admission produced",
    "provides an invocation no re-admission produced",
  ]);
  // A file that sends under what its authority port's readmit returned passes.
  const readmitted = "authority.readmit({ provenance, hop }).pipe(Effect.flatMap((invocation) => send.pipe(Effect.provideService(CurrentInvocation, invocation))))";
  expect(SourceScan.scanText(readmitted, { file: "ok.ts" })).toEqual([]);
});
