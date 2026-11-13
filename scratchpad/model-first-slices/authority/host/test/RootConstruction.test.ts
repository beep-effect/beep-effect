import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as SourceScan from "@proto/tooling/SourceScan";
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
const boundary = ["authority/host/src/Boundary/Boundary.ts", "authority/host/src/Session.adapter.ts"];

it.effect("only the authority host's boundary builds or provides a root invocation", () =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const root = yield* path.fromFileUrl(new URL("../../../", import.meta.url));
    const everywhere = yield* SourceScan.scan(root, packages, []);
    // The boundary itself is found, so the scan is not vacuous.
    expect(everywhere.map((violation) => violation.file)).toEqual(expect.arrayContaining(boundary));
    expect(yield* SourceScan.scan(root, packages, boundary)).toEqual([]);
  }).pipe(Effect.provide(NodeServices.layer)),
);

it("negative control: the scan flags a forged root and an invocation no re-admission produced", () => {
  const forged = [
    'const root = Root.cases.Human.make({ principal: "p_x" });',
    "effect.pipe(Effect.provideService(CurrentInvocation, someInvocation));",
    "Effect.provideService(effect, CurrentInvocation, { ...invocation, chain: [] });",
  ].join("\n");
  expect(SourceScan.scanText("forged.ts", forged).map((violation) => violation.rule)).toEqual([
    "builds a root",
    "builds an invocation",
    "provides an invocation no re-admission produced",
    "provides an invocation no re-admission produced",
  ]);
  // A file that sends under what its authority port's readmit returned passes.
  const readmitted = "authority.readmit({ provenance, hop }).pipe(Effect.flatMap((invocation) => send.pipe(Effect.provideService(CurrentInvocation, invocation))))";
  expect(SourceScan.scanText("ok.ts", readmitted)).toEqual([]);
});
