import { LabsListRow, labsCommand } from "@beep/repo-cli/commands/Labs";
import { CommandJsonOutput } from "@beep/repo-cli/test/Cli";
import { FsUtilsLive } from "@beep/repo-utils";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { expectReportedExit, withTempWorkingDirectory } from "./support/CommandTest.ts";

const LabsTestLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer))
);
const runLabs = Command.runWith(labsCommand, { version: "0.0.0" });
const encodeJson = UnknownFromJsonString.encodeUnknownSync;
const decodeLabsListRows = S.decodeUnknownEffect(S.fromJsonString(S.Array(LabsListRow)));

const withLabsRepo = <A2, E, R>(use: Effect.Effect<A2, E, R>) =>
  withTempWorkingDirectory(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString("bun.lock", "");
      yield* fs.writeFileString(
        "package.json",
        `${encodeJson({
          name: "fixture-root",
          private: true,
          type: "module",
          workspaces: ["apps/labs/*"],
        })}\n`
      );
      return yield* use;
    })
  ).pipe(provideScopedLayer(LabsTestLayer), Effect.orDie);

const writeLab = Effect.fn(function* (labSlug: string, manifestBody: O.Option<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const labDir = path.join("apps", "labs", labSlug);
  yield* fs.makeDirectory(labDir, { recursive: true });
  yield* fs.writeFileString(
    path.join(labDir, "package.json"),
    `${encodeJson({ name: `@beep/${labSlug}`, version: "0.0.0", type: "module" })}\n`
  );
  if (O.isSome(manifestBody)) {
    yield* fs.writeFileString(path.join(labDir, "lab.manifest.json"), manifestBody.value);
  }
});

const activeManifest = (purpose: string): string =>
  `${encodeJson({
    schemaVersion: "lab-manifest/v1",
    purpose,
    created: "2026-08-01",
    disposition: "active",
  })}\n`;

const expiredManifestWithPostgres = `${encodeJson({
  schemaVersion: "lab-manifest/v1",
  purpose: "Expired probe kept for data-drop rehearsal",
  created: "2026-07-04",
  disposition: "expired",
  postgresSchema: "lab_beta_lab",
})}\n`;

describe("beep labs list", { concurrent: false }, () => {
  it("renders one row per lab with disposition, created date, and postgres schema", () =>
    Effect.runPromise(
      withLabsRepo(
        Effect.gen(function* () {
          yield* writeLab("alpha-lab", O.some(activeManifest("Alpha probe")));
          yield* writeLab("beta-lab", O.some(expiredManifestWithPostgres));

          yield* runLabs(["list"]);

          const lines = A.map(yield* TestConsole.logLines, String);
          expect(lines).toContain("@beep/alpha-lab | active | created 2026-08-01 | Alpha probe");
          expect(lines).toContain(
            "@beep/beta-lab | expired | created 2026-07-04 | Expired probe kept for data-drop rehearsal | postgres: lab_beta_lab"
          );
        })
      )
    ));

  it("emits schema-encoded rows under --json that decode back through LabsListRow", () =>
    Effect.runPromise(
      withLabsRepo(
        Effect.gen(function* () {
          yield* writeLab("alpha-lab", O.some(activeManifest("Alpha probe")));
          yield* writeLab("beta-lab", O.some(expiredManifestWithPostgres));

          const chunks: Array<string> = [];
          yield* runLabs(["list", "--json"]).pipe(
            Effect.provideService(CommandJsonOutput, (text) =>
              Effect.sync(() => {
                chunks.push(text);
              })
            )
          );

          const rows = yield* decodeLabsListRows(A.join(chunks, ""));
          expect(A.length(rows)).toBe(2);
          const names = A.map(rows, (row) => row.name);
          expect(names).toEqual(["@beep/alpha-lab", "@beep/beta-lab"]);
          const beta = O.getOrThrow(A.get(rows, 1));
          const manifest = O.getOrThrow(beta.manifest);
          expect(manifest.disposition).toBe("expired");
          expect(O.getOrThrow(manifest.postgresSchema)).toBe("lab_beta_lab");
        })
      )
    ));

  it("renders missing and invalid manifest rows and exits non-zero", () =>
    Effect.runPromise(
      withLabsRepo(
        Effect.gen(function* () {
          yield* writeLab("alpha-lab", O.some(activeManifest("Alpha probe")));
          yield* writeLab("gamma-lab", O.some("{not json\n"));
          yield* writeLab("delta-lab", O.none());

          const exit = yield* Effect.exit(runLabs(["list"]));
          expectReportedExit(exit);

          const lines = A.map(yield* TestConsole.logLines, String);
          expect(lines).toContain("@beep/alpha-lab | active | created 2026-08-01 | Alpha probe");
          const hasRow = (needleA: string, needleB: string) =>
            A.some(lines, (line) => Str.includes(needleA)(line) && Str.includes(needleB)(line));
          expect(hasRow("@beep/delta-lab", "manifest: missing")).toBe(true);
          expect(hasRow("@beep/gamma-lab", "manifest: invalid")).toBe(true);
          const errors = A.map(yield* TestConsole.errorLines, String);
          expect(A.some(errors, Str.includes("2 lab manifest issue(s)"))).toBe(true);
        })
      )
    ));

  it("prints a friendly line and succeeds when apps/labs is empty", () =>
    Effect.runPromise(
      withLabsRepo(
        Effect.gen(function* () {
          yield* runLabs(["list"]);

          const lines = A.map(yield* TestConsole.logLines, String);
          expect(lines).toContain("No labs under apps/labs/.");
        })
      )
    ));
});
