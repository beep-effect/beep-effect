import { Lockfile, LockfileFramingError, LockfileParseError } from "@beep/lockfiles/Lockfile";
import { PnpmEnvLockfile } from "@beep/lockfiles/PnpmEnvLockfile";
import { PnpmCatalogPin } from "@beep/lockfiles/PnpmExtension";
import { isUnsupportedLockfileVersion } from "@beep/lockfiles/UnsupportedLockfileVersion";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fixture } from "./support/fixtures.ts";
import type { LockfileFormat } from "@beep/lockfiles/LockfileFormat";

const framingError = Effect.fn("framingError")(function* (content: string, format: LockfileFormat) {
  const error = yield* Effect.flip(Lockfile.parse(content, { format }));
  assert.instanceOf(error, LockfileFramingError);
  assert.strictEqual(error.format, format);
  return error;
});

const configDependenciesPreamble = A.join(
  [
    "---",
    "lockfileVersion: '9.0'",
    "",
    "importers:",
    "",
    "  .:",
    "    configDependencies:",
    "      '@effected/pnpm-plugin-effect':",
    "        specifier: 0.1.0",
    "        version: 0.1.0",
    "",
    "packages:",
    "",
    "  '@effected/pnpm-plugin-effect@0.1.0':",
    "    resolution: {integrity: sha512-abc}",
    "",
    "snapshots:",
    "",
    "  '@effected/pnpm-plugin-effect@0.1.0': {}",
    "",
  ],
  "\n"
);

describe("document framing: a pnpm lockfile is the last document of its YAML stream", () => {
  describe("pnpm: a two-document lockfile parses the lockfile, not the preamble", () => {
    it.effect("reads the real workspace out of the second document", () =>
      Effect.gen(function* () {
        const lockfile = yield* Lockfile.parse(fixture("pnpm/multidoc/pnpm-lock.yaml"), { format: "pnpm" });

        assert.deepStrictEqual(
          A.map(lockfile.workspacePackages, (p) => p.name),
          ["packages/core", "packages/utils"],
          "the preamble also declares lockfileVersion, importers and packages; only their contents differ"
        );
        assert.strictEqual(lockfile.packages.length, 5);

        assert.deepStrictEqual(
          lockfile.packagesNamed("@effected/pnpm-plugin-effect"),
          [],
          "parsing the validating preamble instead would yield its config dependency as the only package"
        );

        const chalk = lockfile.packagesNamed("chalk");
        assert.strictEqual(chalk.length, 1);
        assert.strictEqual(chalk[0]?.version, "5.6.2");
      })
    );

    it.effect("carries the second document's catalogs, overrides and settings", () =>
      Effect.gen(function* () {
        const lockfile = yield* Lockfile.parse(fixture("pnpm/multidoc/pnpm-lock.yaml"), { format: "pnpm" });

        assert.strictEqual(lockfile.extension?._tag, "pnpm");
        if (lockfile.extension?._tag === "pnpm") {
          assert.deepStrictEqual(
            lockfile.extension.catalogs?.effect,
            { effect: PnpmCatalogPin.make({ specifier: "4.0.0-beta.94", version: "4.0.0-beta.94" }) },
            "the preamble declares no catalogs, so zero catalogs means the preamble was read"
          );
          assert.deepStrictEqual(lockfile.extension.overrides, { lodash: "4.17.21" });
          assert.strictEqual(lockfile.extension.settings?.autoInstallPeers, true);
        }
      })
    );

    it.effect("resolves workspace dependency edges from the second document", () =>
      Effect.gen(function* () {
        const lockfile = yield* Lockfile.parse(fixture("pnpm/multidoc/pnpm-lock.yaml"), { format: "pnpm" });

        assert.strictEqual(lockfile.workspaceDependencies.length, 1);
        const edge = lockfile.workspaceDependencies[0];
        assert.strictEqual(edge?.from, "packages/core");
        assert.strictEqual(edge?.to, "@test-monorepo/utils");
        assert.strictEqual(edge?.constraint, "workspace:*");
      })
    );
  });

  describe("pnpm: single-document lockfiles are unaffected", () => {
    it.effect("v1 still parses (no regression from stream parsing)", () =>
      Effect.gen(function* () {
        const lockfile = yield* Lockfile.parse(fixture("pnpm/v1/pnpm-lock.yaml"), { format: "pnpm" });

        assert.strictEqual(lockfile.packages.length, 5);
        assert.deepStrictEqual(
          A.map(lockfile.workspacePackages, (p) => p.name),
          ["packages/core", "packages/utils"]
        );
      })
    );

    it.effect("a lone document carrying a leading '---' marker is still the lockfile", () =>
      Effect.gen(function* () {
        const content = `---\n${fixture("pnpm/v1/pnpm-lock.yaml")}`;
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });

        assert.strictEqual(
          lockfile.packages.length,
          5,
          "selection by document position, not pnpm's leading '---' byte check, keeps a lone document the lockfile"
        );
      })
    );
  });

  describe("pnpm: a preamble followed by an empty main document is ambiguous, so it fails closed unless configOnly", () => {
    const configOnly = { format: "pnpm", configOnly: true } as const;

    it("the interrupted-install capture is byte-identical to the config-only capture", () => {
      assert.strictEqual(
        fixture("pnpm/unsupported-interrupted-pnpm12/pnpm-lock.yaml"),
        fixture("pnpm/env-configonly-pnpm12/pnpm-lock.yaml"),
        "were these bytes to differ, the parser could decide by content and configOnly would be unnecessary"
      );
    });

    for (const name of ["env-configonly-pnpm11", "env-configonly-pnpm12", "unsupported-interrupted-pnpm12"]) {
      it.effect(`${name}, by default: fails 'noLockfileDocument', never an empty model`, () =>
        Effect.gen(function* () {
          const error = yield* framingError(fixture(`pnpm/${name}/pnpm-lock.yaml`), "pnpm");

          assert.strictEqual(error.reason, "noLockfileDocument");
          assert.strictEqual(error.documents, 2);
        })
      );

      it.effect(`${name}, configOnly: false is the default, not a different mode`, () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            Lockfile.parse(fixture(`pnpm/${name}/pnpm-lock.yaml`), { format: "pnpm", configOnly: false })
          );

          assert.instanceOf(error, LockfileFramingError);
          assert.strictEqual(error.reason, "noLockfileDocument");
        })
      );
    }

    for (const major of ["pnpm11", "pnpm12"]) {
      it.effect(`${major} real output, configOnly: no packages, no importers, the preamble's version`, () =>
        Effect.gen(function* () {
          const lockfile = yield* Lockfile.parse(fixture(`pnpm/env-configonly-${major}/pnpm-lock.yaml`), configOnly);

          assert.strictEqual(lockfile.format, "pnpm");
          assert.strictEqual(lockfile.lockfileVersion, "9.0");
          assert.deepStrictEqual(lockfile.packages, []);
          assert.deepStrictEqual(lockfile.importers, []);
          assert.deepStrictEqual(lockfile.workspaceDependencies, []);
          assert.deepStrictEqual(lockfile.workspacePackages, []);
          assert.deepStrictEqual(
            lockfile.packagesNamed("@effected/pnpm-plugin-effect"),
            [],
            "the preamble's config dependency must not surface as a workspace package"
          );
          assert.strictEqual(lockfile.extension?._tag, "pnpm");
        })
      );
    }

    it.effect("configOnly: the version is the preamble's, not a constant", () =>
      Effect.gen(function* () {
        const lockfile = yield* Lockfile.parse(
          `${Str.replace("'9.0'", "'9.5'")(configDependenciesPreamble)}\n---\n`,
          configOnly
        );

        assert.strictEqual(lockfile.lockfileVersion, "9.5");
        assert.deepStrictEqual(lockfile.packages, []);
      })
    );

    it.effect("configOnly: a preamble below the supported version still fails the gate", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          Lockfile.parse(`${Str.replace("'9.0'", "'6.0'")(configDependenciesPreamble)}\n---\n`, configOnly)
        );

        assert.instanceOf(error, LockfileParseError);
        assert.strictEqual(error.stage, "validation");
        assert.isTrue(isUnsupportedLockfileVersion(error.cause));
      })
    );

    it.effect("configOnly: a preamble that is not a mapping fails validation, not as an empty lockfile", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(Lockfile.parse("--- 42\n---\n", configOnly));

        assert.instanceOf(error, LockfileParseError);
        assert.strictEqual(error.stage, "validation");
      })
    );

    describe("configOnly loosens nothing else", () => {
      it.effect("no preamble (two empty documents) still fails 'noLockfileDocument'", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(Lockfile.parse("---\n---\n", configOnly));

          assert.instanceOf(error, LockfileFramingError);
          assert.strictEqual(error.reason, "noLockfileDocument");
          assert.strictEqual(error.documents, 2);
        })
      );

      it.effect("a lone empty document still fails 'noLockfileDocument'", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(Lockfile.parse("---\n", configOnly));

          assert.instanceOf(error, LockfileFramingError);
          assert.strictEqual(error.reason, "noLockfileDocument");
          assert.strictEqual(error.documents, 1);
        })
      );

      it.effect("more than two documents still fail 'unexpectedDocuments'", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(Lockfile.parse(`${configDependenciesPreamble}\n---\n---\n`, configOnly));

          assert.instanceOf(error, LockfileFramingError);
          assert.strictEqual(error.reason, "unexpectedDocuments");
          assert.strictEqual(
            error.documents,
            3,
            "a preamble, an empty document and a third is outside pnpm's writer contract"
          );
        })
      );

      it.effect("a non-empty main document declaring no importers still fails 'noImporters'", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            Lockfile.parse(`${configDependenciesPreamble}\n---\nlockfileVersion: '9.0'\nimporters: {}\n`, configOnly)
          );

          assert.instanceOf(error, LockfileFramingError);
          assert.strictEqual(error.reason, "noImporters");
        })
      );

      it.effect("a populated two-document stream parses exactly as it does without the flag", () =>
        Effect.gen(function* () {
          const content = fixture("pnpm/multidoc/pnpm-lock.yaml");
          const flagged = yield* Lockfile.parse(content, configOnly);
          const plain = yield* Lockfile.parse(content, { format: "pnpm" });

          assert.isAbove(flagged.packages.length, 0);
          assert.deepStrictEqual(flagged, plain);
        })
      );

      it.effect("ignored for a non-pnpm format: an empty yarn.lock still fails 'noLockfileDocument'", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(Lockfile.parse("", { format: "yarn", configOnly: true }));

          assert.instanceOf(error, LockfileFramingError);
          assert.strictEqual(error.reason, "noLockfileDocument");
        })
      );
    });
  });

  describe("pnpm: an unlocatable lockfile fails typed, never as an empty model", () => {
    it.effect("two empty documents (no preamble to vouch for the stream) fail 'noLockfileDocument'", () =>
      Effect.gen(function* () {
        const error = yield* framingError("---\n---\n", "pnpm");

        assert.strictEqual(error.reason, "noLockfileDocument");
        assert.strictEqual(error.documents, 2);
      })
    );

    it.effect("a lone empty document fails 'noLockfileDocument'", () =>
      Effect.gen(function* () {
        const error = yield* framingError("---\n", "pnpm");

        assert.strictEqual(error.reason, "noLockfileDocument");
        assert.strictEqual(error.documents, 1);
      })
    );

    it.effect("more than two documents fail 'unexpectedDocuments', the same limit the env reader holds", () =>
      Effect.gen(function* () {
        const v1 = fixture("pnpm/v1/pnpm-lock.yaml");
        const content = `${configDependenciesPreamble}\n---\n${v1}---\n${v1}`;
        const error = yield* framingError(content, "pnpm");

        assert.strictEqual(
          error.reason,
          "unexpectedDocuments",
          "outside pnpm's writer contract no document position identifies the lockfile"
        );
        assert.strictEqual(error.documents, 3);
        const envError = yield* Effect.flip(PnpmEnvLockfile.configDependencies(content));
        assert.instanceOf(envError, LockfileFramingError);
        assert.strictEqual(
          envError.reason,
          "unexpectedDocuments",
          "one splitter serves Lockfile.parse and PnpmEnvLockfile, so both refuse this stream alike"
        );
        assert.strictEqual(envError.documents, 3);
      })
    );

    it.effect("empty content fails 'noLockfileDocument'", () =>
      Effect.gen(function* () {
        const error = yield* framingError("", "pnpm");
        assert.strictEqual(error.reason, "noLockfileDocument");
      })
    );

    it.effect("a lockfile document declaring no importers fails 'noImporters'", () =>
      Effect.gen(function* () {
        const error = yield* framingError("lockfileVersion: '9.0'\nimporters: {}\n", "pnpm");

        assert.strictEqual(
          error.reason,
          "noImporters",
          "pnpm always records the root importer '.', so an empty importers map describes no workspace"
        );
      })
    );

    it.effect("the framing failure is not reported as a LockfileParseError", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(Lockfile.parse("---\n---\n", { format: "pnpm" }));

        assert.instanceOf(error, LockfileFramingError);
        assert.isFalse(S.is(LockfileParseError)(error));
        assert.strictEqual(error._tag, "LockfileFramingError");
      })
    );
  });

  describe("yarn: no document framing means multi-document input is refused, not truncated", () => {
    const berry = A.join(["__metadata:\n  version: 8\n", '"a@npm:^1.0.0":\n  version: 1.0.0\n  linkType: hard\n'], "");

    it.effect("a multi-document yarn.lock fails 'unexpectedDocuments'", () =>
      Effect.gen(function* () {
        const error = yield* framingError(`${berry}---\n${berry}`, "yarn");

        assert.strictEqual(error.reason, "unexpectedDocuments");
        assert.strictEqual(error.documents, 2);
      })
    );

    it.effect("a single-document yarn.lock still parses", () =>
      Effect.gen(function* () {
        const lockfile = yield* Lockfile.parse(berry, { format: "yarn" });

        assert.strictEqual(lockfile.format, "yarn");
        assert.strictEqual(lockfile.lockfileVersion, "8");
      })
    );
  });

  describe("npm and bun define no document framing and never shared the assumption", () => {
    it.effect("npm: a second JSON value is a syntax error", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(Lockfile.parse('{"lockfileVersion":3}\n{"a":1}', { format: "npm" }));

        assert.instanceOf(error, LockfileParseError);
        assert.strictEqual(
          error.stage,
          "syntax",
          "JSON is single-value: a second top-level value is not an ignored document"
        );
      })
    );

    it.effect("bun: a second JSONC value is a syntax error", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(Lockfile.parse('{"lockfileVersion":1}\n{"a":1}', { format: "bun" }));

        assert.instanceOf(error, LockfileParseError);
        assert.strictEqual(
          error.stage,
          "syntax",
          "JSONC is single-value: a second top-level value is not an ignored document"
        );
      })
    );
  });
});
