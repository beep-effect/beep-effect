import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { ClaimDecided } from "@proto/party-contract/Facts/ClaimDecided.fact";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const documentOf = (version: 1 | 2) => ClaimDecided.versions[version].pipe(S.toCodecJson, S.toJsonSchemaDocument);

const frozen = Effect.fn("frozen")(function* (version: 1 | 2) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* path.fromFileUrl(new URL(`./snapshots/ClaimDecided.v${version}.schema.json`, import.meta.url));
  return yield* Effect.flatMap(fs.readFileString(file), S.decodeUnknownEffect(S.fromJsonString(S.Unknown)));
});

// Party's private events (ClaimAccepted, ProposalApproved, ...) change shape freely; this pins
// what other contexts read. Phase 3 removed `corroboration` from ClaimAccepted, and this passes.
it.layer(NodeServices.layer)((it) => {
  it.effect("the published fact's shape is pinned by a frozen schema, apart from Party's private events", () =>
    Effect.gen(function* () {
      for (const version of [1, 2] as const) {
        const pinned = yield* frozen(version);
        expect(documentOf(version)).toEqual(pinned);
      }
    }),
  );
});

it("the fact carries no private field: no proposition, evidence, provenance or grant terms", () => {
  const published = ["_tag", "factId", "claim", "org", "outcome", "decision", "basis", "approval", "reviewRuns"];
  for (const version of [1, 2] as const) {
    const definitions = documentOf(version).definitions as Record<string, { readonly properties?: object }>;
    const fields = A.flatMap(R.values(definitions), (definition) => R.keys(definition.properties ?? {}));
    expect(A.difference(fields, published)).toEqual([]);
  }
});
