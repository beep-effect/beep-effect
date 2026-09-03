// @vitest-environment node

import { EpistemicServerDrizzleLive } from "@beep/epistemic-server/layer";
import { DbSchema } from "@beep/epistemic-tables";
import {
  ContradictionTriageRepository,
  GetExpandedContradictionCandidate,
  ListContradictionCandidates,
} from "@beep/epistemic-use-cases/server";
import {
  pageSourceTextContainingOffset,
  ResolvedSourceText,
  SOURCE_TEXT_PAGE_CODE_UNITS,
} from "@beep/file-processing/SourceText";
import { makeDrizzleLayer, PostgresDrizzle } from "@beep/postgres";
import { PosInt } from "@beep/schema/Int";
import { NonNegativeInt } from "@beep/schema/Number";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { makePgliteSqlTestLayer, provideScopedLayer } from "@beep/test-utils";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import { WorkspaceVaultRootPath } from "@beep/workspace-domain/entities/Workspace";
import { WorkspaceVaultStoreDrizzleLayer } from "@beep/workspace-server/aggregates/Workspace";
import { Workspace } from "@beep/workspace-use-cases/server";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  CONTRADICTION_QA_ANCHOR_START,
  CONTRADICTION_QA_SEED_ENV,
  CONTRADICTION_QA_SOURCE_LOCATOR,
  CONTRADICTION_QA_SOURCE_TEXT,
  CONTRADICTION_QA_VAULT_ROOT_ENV,
  ContradictionQaSeedError,
  seedContradictionQaFixtures,
} from "@/contradiction/ContradictionQaSeed";
import { migrateOnBoot } from "@/runtime/Migrations";
import type * as Context from "effect/Context";

const desktopWorkspaceId = WorkspaceIdentity.WorkspaceId.make(1);
const instant = flow(S.decodeUnknownResult(S.DateTimeUtcFromMillis), Result.getOrThrow);
const decodeVaultRoot = S.decodeUnknownEffect(WorkspaceVaultRootPath);

const makeInProcessPgliteLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));
const PgliteDrizzleTestLive = makeDrizzleLayer().pipe(
  Layer.tap((context: Context.Context<PostgresDrizzle>) => Effect.provide(migrateOnBoot, context)),
  Layer.provide(makeInProcessPgliteLayer())
);
const SeedServicesLive = Layer.mergeAll(EpistemicServerDrizzleLive, WorkspaceVaultStoreDrizzleLayer).pipe(
  Layer.provideMerge(PgliteDrizzleTestLive)
);
const TestPlatformLive = Layer.mergeAll(NodeCrypto.layer, NodeFileSystem.layer, NodePath.layer);

const databaseSnapshot = Effect.fn("ContradictionQaSeedTest.databaseSnapshot")(function* () {
  const db = yield* PostgresDrizzle;
  const [candidates, dispositions, edges, evidence, receipts, verifications] = yield* Effect.all([
    db.select().from(DbSchema.contradictionCandidate),
    db.select().from(DbSchema.contradictionDisposition),
    db.select().from(DbSchema.edgeVersion),
    db.select().from(DbSchema.evidence),
    db.select().from(DbSchema.contradictionReceipt),
    db.select().from(DbSchema.evidenceVerification),
  ]);
  return {
    candidates: A.length(candidates),
    dispositions: A.length(dispositions),
    edges: A.length(edges),
    evidence: A.length(evidence),
    receipts: A.length(receipts),
    verifications: A.length(verifications),
  };
});

const configureVault = Effect.fn("ContradictionQaSeedTest.configureVault")(function* (root: string) {
  const store = yield* Workspace.WorkspaceVaultStore;
  const vaultRootPath = yield* decodeVaultRoot(root);
  yield* store.setVaultRoot(
    Workspace.SetWorkspaceVaultInput.make({
      vaultRootPath,
      workspaceId: desktopWorkspaceId,
    })
  );
});

const requireSome = <A>(option: O.Option<A>, message: string): Effect.Effect<A> =>
  O.match(option, {
    onNone: () => Effect.die(message),
    onSome: Effect.succeed,
  });

describe("Professional Desktop contradiction browser-QA seed", { concurrent: false }, () => {
  it.effect(
    "is inert unless the exact opt-in value is present",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-contradiction-qa-disabled-" });
      const qaVaultRoot = path.join(root, "qa-vault");
      const env = {
        CHAT_DB_PATH: path.join(root, "chat-db"),
        [CONTRADICTION_QA_SEED_ENV]: "0",
      };

      yield* Effect.gen(function* () {
        yield* seedContradictionQaFixtures();
        expect(yield* databaseSnapshot()).toStrictEqual({
          candidates: 0,
          dispositions: 0,
          edges: 0,
          evidence: 0,
          receipts: 0,
          verifications: 0,
        });
        const store = yield* Workspace.WorkspaceVaultStore;
        const config = yield* store.getVaultConfig(desktopWorkspaceId);
        expect(O.isNone(config.vaultRootPath)).toBe(true);
        expect(yield* fs.exists(qaVaultRoot)).toBe(false);
      }).pipe(
        provideScopedLayer(SeedServicesLive),
        provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
      );
    }, provideScopedLayer(TestPlatformLive))
  );

  it.effect(
    "seeds two exact open candidates once and proves the shifted anchor opens page one",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-contradiction-qa-idempotent-" });
      const qaVaultRoot = path.join(root, "qa-vault");
      yield* fs.makeDirectory(qaVaultRoot);
      const env = {
        CHAT_DB_PATH: path.join(root, "chat-db"),
        [CONTRADICTION_QA_SEED_ENV]: "1",
        [CONTRADICTION_QA_VAULT_ROOT_ENV]: qaVaultRoot,
      };

      yield* Effect.gen(function* () {
        yield* seedContradictionQaFixtures();
        const first = yield* databaseSnapshot();
        yield* seedContradictionQaFixtures();
        const second = yield* databaseSnapshot();

        expect(first).toStrictEqual({
          candidates: 2,
          dispositions: 0,
          edges: 4,
          evidence: 4,
          receipts: 2,
          verifications: 1,
        });
        expect(second).toStrictEqual(first);
        expect(Str.length(CONTRADICTION_QA_SOURCE_TEXT)).toBeGreaterThan(SOURCE_TEXT_PAGE_CODE_UNITS);
        expect(CONTRADICTION_QA_ANCHOR_START).toBe(SOURCE_TEXT_PAGE_CODE_UNITS - 1);
        expect(yield* fs.readFileString(path.join(qaVaultRoot, CONTRADICTION_QA_SOURCE_LOCATOR))).toBe(
          CONTRADICTION_QA_SOURCE_TEXT
        );

        const repository = yield* ContradictionTriageRepository;
        const page = yield* repository.list(
          ListContradictionCandidates.make({
            disposition: "open",
            knownAt: instant(1_767_225_610_000),
            limit: PosInt.make(10),
            offset: NonNegativeInt.make(0),
            orgId: 1,
            validAt: instant(1_767_225_610_000),
          })
        );
        expect(page.total).toBe(2);
        const deadline = yield* requireSome(
          A.findFirst(
            page.items,
            ({ candidate }) => candidate.detector === "professional-desktop.qa.deadline-conflict"
          ),
          "expected deadline contradiction candidate"
        );
        const expanded = yield* requireSome(
          yield* repository.getExpanded(
            GetExpandedContradictionCandidate.make({
              candidateId: deadline.candidate.id,
              knownAt: instant(1_767_225_610_000),
              orgId: 1,
              sourceScopeRef: "workspace:1",
              validAt: instant(1_767_225_610_000),
            })
          ),
          "expected expanded deadline contradiction candidate"
        );
        const evidence = A.appendAll(expanded.left.evidence, expanded.right.evidence);
        const verified = yield* requireSome(
          A.findFirst(evidence, ({ latestVerification }) => O.isSome(latestVerification)),
          "expected one verified evidence side"
        );
        expect(A.filter(evidence, ({ latestVerification }) => O.isNone(latestVerification))).toHaveLength(1);
        const verification = yield* requireSome(
          verified.latestVerification,
          "expected verified evidence manifestation"
        );
        const sourcePage = yield* pageSourceTextContainingOffset(
          ResolvedSourceText.make({
            identity: verification.verifiedAnchor.source,
            text: CONTRADICTION_QA_SOURCE_TEXT,
          }),
          verification.verifiedAnchor.anchor.startChar
        );
        expect(sourcePage.pageIndex).toBe(1);
        expect(sourcePage.startOffset).toBe(CONTRADICTION_QA_ANCHOR_START);
        expect(Str.startsWith(verification.verifiedAnchor.anchor.quote)(sourcePage.text)).toBe(true);
      }).pipe(
        provideScopedLayer(SeedServicesLive),
        provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
      );
    }, provideScopedLayer(TestPlatformLive))
  );

  it.effect(
    "refuses to replace an existing workspace root",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-contradiction-qa-vault-conflict-" });
      const userRoot = path.join(root, "user-vault");
      const qaVaultRoot = path.join(root, "qa-vault");
      yield* fs.makeDirectory(userRoot);
      yield* fs.makeDirectory(qaVaultRoot);
      const userMarker = path.join(userRoot, "owned.txt");
      yield* fs.writeFileString(userMarker, "user-owned");
      const env = {
        CHAT_DB_PATH: path.join(root, "chat-db"),
        [CONTRADICTION_QA_SEED_ENV]: "1",
        [CONTRADICTION_QA_VAULT_ROOT_ENV]: qaVaultRoot,
      };

      yield* Effect.gen(function* () {
        yield* configureVault(userRoot);
        const result = yield* Effect.result(seedContradictionQaFixtures());
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isFailure(result)) {
          expect(ContradictionQaSeedError.is(result.failure)).toBe(true);
          if (ContradictionQaSeedError.is(result.failure)) {
            expect(result.failure.reason).toBe("vault-root-conflict");
          }
        }

        const store = yield* Workspace.WorkspaceVaultStore;
        const config = yield* store.getVaultConfig(desktopWorkspaceId);
        expect(O.getOrNull(config.vaultRootPath)).toBe(userRoot);
        expect(yield* fs.readFileString(userMarker)).toBe("user-owned");
        expect(yield* fs.exists(path.join(qaVaultRoot, CONTRADICTION_QA_SOURCE_LOCATOR))).toBe(false);
        expect((yield* databaseSnapshot()).candidates).toBe(0);
      }).pipe(
        provideScopedLayer(SeedServicesLive),
        provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
      );
    }, provideScopedLayer(TestPlatformLive))
  );

  it.effect(
    "refuses to overwrite an existing canonical source",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-contradiction-qa-source-conflict-" });
      const qaVaultRoot = path.join(root, "qa-vault");
      const sourcePath = path.join(qaVaultRoot, CONTRADICTION_QA_SOURCE_LOCATOR);
      yield* fs.makeDirectory(path.dirname(sourcePath), { recursive: true });
      yield* fs.writeFileString(sourcePath, "user-owned source");
      const env = {
        CHAT_DB_PATH: path.join(root, "chat-db"),
        [CONTRADICTION_QA_SEED_ENV]: "1",
        [CONTRADICTION_QA_VAULT_ROOT_ENV]: qaVaultRoot,
      };

      yield* Effect.gen(function* () {
        yield* configureVault(qaVaultRoot);
        const result = yield* Effect.result(seedContradictionQaFixtures());
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isFailure(result) && ContradictionQaSeedError.is(result.failure)) {
          expect(result.failure.reason).toBe("source-conflict");
        }
        expect(yield* fs.readFileString(sourcePath)).toBe("user-owned source");
        expect((yield* databaseSnapshot()).candidates).toBe(0);
        expect((yield* databaseSnapshot()).evidence).toBe(0);
      }).pipe(
        provideScopedLayer(SeedServicesLive),
        provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
      );
    }, provideScopedLayer(TestPlatformLive))
  );
});
