import { pathToFileURL } from "node:url";
import { validateConformanceLedgerArtifacts } from "@beep/test-utils/ConformanceLedger";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";

const encodeJson = S.encodeUnknownSync(S.fromJsonString(S.Unknown));
const packageName = "@beep/example";
const profileId = "example-profile";
const sourceId = "example-source";
const invariantId = "example.invariant";

const source = {
  id: sourceId,
  title: "Example Specification",
  role: "primarySpecification",
  canonicalUrl: "https://example.com/spec",
  revision: { kind: "release", version: "1.0" },
  contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
};

const profile = {
  id: profileId,
  title: "Example Profile",
  version: "1.0",
  description: "Minimal conformance-ledger test profile.",
  sourceIds: [sourceId],
  invariantIds: [invariantId],
};

const enforcement = [{ kind: "runtime", validator: "Example.validate" }];

const invariant = {
  id: invariantId,
  title: "Example invariant",
  statement: "The example value satisfies its local runtime rule.",
  strength: "must",
  scope: "value",
  decidability: "localRuntime",
  enforcement,
  references: [{ sourceId }],
  testIds: [],
};

const validateFixture = Effect.fn("ConformanceLedgerTest.validateFixture")(function* (options: {
  readonly coverageStatus: string;
  readonly inventorySourceId: string;
}) {
  const fileSystem = yield* FileSystem.FileSystem;
  const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-conformance-ledger-" });
  const dataRoot = `${root}/data/conformance`;
  yield* fileSystem.makeDirectory(dataRoot, { recursive: true });
  yield* Effect.all(
    [
      fileSystem.writeFileString(
        `${dataRoot}/sources.json`,
        encodeJson({
          schemaVersion: 1,
          packageName,
          profileIds: [profileId],
          sources: [source],
          profiles: [profile],
        })
      ),
      fileSystem.writeFileString(
        `${dataRoot}/inventory.json`,
        encodeJson({
          schemaVersion: 1,
          packageName,
          profileIds: [profileId],
          items: [
            {
              id: "example.member",
              symbol: "Example",
              tag: "example",
              kind: "ast-member",
              existingDiscriminator: "_tag",
              currentEnforcementLayers: ["type", "decode"],
              sources: [options.inventorySourceId],
              candidateDisposition: "retain-existing-tagged-member",
              candidateReason: "The example member already has a stable literal discriminator.",
            },
          ],
        })
      ),
      fileSystem.writeFileString(
        `${dataRoot}/invariants.json`,
        encodeJson({
          schemaVersion: 1,
          packageName,
          profileIds: [profileId],
          invariants: [invariant],
        })
      ),
      fileSystem.writeFileString(
        `${dataRoot}/coverage.json`,
        encodeJson({
          schemaVersion: 1,
          packageName,
          profileIds: [profileId],
          coverage: [
            {
              invariantId,
              profileIds: [profileId],
              currentEnforcement: enforcement,
              targetEnforcement: enforcement,
              positiveTestIds: [],
              negativeTestIds: [],
              status: options.coverageStatus,
            },
          ],
        })
      ),
      fileSystem.writeFileString(`${dataRoot}/SOURCES.md`, "# Example conformance sources\n"),
    ],
    { concurrency: "unbounded" }
  );

  return yield* validateConformanceLedgerArtifacts(pathToFileURL(`${root}/`), packageName);
});

const runFixture = (options: { readonly coverageStatus: string; readonly inventorySourceId: string }) =>
  Effect.scoped(validateFixture(options)).pipe(Effect.provide(BunFileSystem.layer));

describe("conformance-ledger validation", () => {
  it.effect("rejects coverage statuses outside the closed artifact domain", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(runFixture({ coverageStatus: "invented-status", inventorySourceId: sourceId }));

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("reports inventory source-reference drift", () =>
    Effect.gen(function* () {
      const issues = yield* runFixture({ coverageStatus: "covered", inventorySourceId: "missing-source" });

      expect(issues).toEqual(["inventory.json items references unknown id missing-source"]);
    })
  );
});
