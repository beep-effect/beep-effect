import {
  PackageManagerDetectionError,
  PackageManagerDetector,
  PackageManagerEvidence,
  WorkspaceManifestError,
} from "@beep/repo-workspaces";
import { assert, describe, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { platform } from "./support/fixtures.ts";
import type { Tree } from "./support/fixtures.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const detectorOver = (tree: Tree) => PackageManagerDetector.layer.pipe(Layer.provideMerge(platform(tree)));

const corepack = (spec: string) =>
  Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0", packageManager: spec }),
    identity
  );

const manifestWith = (fields: Record<string, unknown>) =>
  Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0", ...fields }), identity);

describe("PackageManagerDetector — pnpm", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "/repo/package.json": corepack("pnpm@10.33.0+sha512.abc"),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a pnpm-workspace.yaml is sufficient, and the corepack version is reported", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        assertSome(detected.version, "10.33.0");
        assert.strictEqual(detected.runtime, "node");
        assert.strictEqual(detected.evidence, "pnpm-workspace.yaml");
      })
    );
  });
});

describe("PackageManagerDetector — pnpm with no corepack field", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
        identity
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("detects pnpm with no version", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        assertNone(detected.version);
      })
    );
  });
});

describe("PackageManagerDetector — pnpm wins over a stray lockfile", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "/repo/yarn.lock": "",
      "/repo/package.json": corepack("yarn@4.5.0"),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("the priority chain puts pnpm first even when yarn's markers are present", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        const noPnpmVersionSinceTheCorepackFieldNamesYarn = detected.version;
        assertNone(noPnpmVersionSinceTheCorepackFieldNamesYarn);
      })
    );
  });
});

describe("PackageManagerDetector — bun", () => {
  layer(detectorOver({ "/repo/bun.lock": "", "/repo/package.json": corepack("bun@1.2.0") }), { timeout: "30 seconds" })(
    (it) => {
      it.effect("a bun lockfile plus a bun corepack field means bun, on the bun runtime", () =>
        Effect.gen(function* () {
          const detector = yield* PackageManagerDetector;
          const detected = yield* detector.detect("/repo");
          assert.strictEqual(detected.name, "bun");
          assert.strictEqual(detected.runtime, "bun");
          assertSome(detected.version, "1.2.0");
          assert.strictEqual(
            detected.evidence,
            "bun.lock",
            "the lockfile is the recorded signal: the field alone would have resolved in the declaration tier"
          );
        })
      );
    }
  );
});

describe("PackageManagerDetector — a bun lockfile WITHOUT the corepack field", () => {
  layer(
    detectorOver({
      "/repo/bun.lock": "",
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({
          name: "root",
          version: "0.0.0",
          workspaces: ["packages/*"],
        }),
        identity
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "falls through to npm — the conjunction is deliberate: a stray lockfile is common, only the corepack field disambiguates",
      () =>
        Effect.gen(function* () {
          const detector = yield* PackageManagerDetector;
          const detected = yield* detector.detect("/repo");
          assert.strictEqual(detected.name, "npm");
        })
    );
  });
});

describe("PackageManagerDetector — yarn", () => {
  layer(detectorOver({ "/repo/yarn.lock": "", "/repo/package.json": corepack("yarn@4.5.0") }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("a yarn lockfile plus a yarn corepack field means yarn", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "yarn");
        assertSome(detected.version, "4.5.0");
        assert.strictEqual(detected.evidence, "yarn.lock");
      })
    );
  });
});

describe("PackageManagerDetector — npm", () => {
  layer(
    detectorOver({
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({
          name: "root",
          version: "0.0.0",
          workspaces: ["packages/*"],
          packageManager: "npm@11.0.0",
        }),
        identity
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a workspaces field alone is the npm fallback", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "npm");
        assertSome(detected.version, "11.0.0");
        assert.strictEqual(detected.evidence, "package.json#workspaces");
      })
    );
  });
});

describe("PackageManagerDetector — NO EVIDENCE AT ALL: a manifest declaring nothing and no lockfile", () => {
  layer(
    detectorOver({
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "solo", version: "1.0.0" }),
        identity
      ),
    }),
    {
      timeout: "30 seconds",
    }
  )((it) => {
    it.effect("fails typed, listing the markers it probed", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const error = yield* Effect.flip(detector.detect("/repo"));
        assert.instanceOf(
          error,
          PackageManagerDetectionError,
          "unlike a standalone repo, which has evidence but no workspace"
        );
        assert.strictEqual(error.root, "/repo");
        assert.include(error.checked, "pnpm-workspace.yaml");
        assert.include(error.checked, "yarn.lock");
        assert.include(
          error.checked,
          "pnpm-lock.yaml",
          "the standalone probes are part of the contract, so the error reports having tried them"
        );
        assert.include(error.checked, "package-lock.json");
        assert.deepStrictEqual(
          [...error.checked],
          [...PackageManagerEvidence.literals],
          "one vocabulary: the probed list is the success evidence union, member for member, in priority order"
        );
        assert.strictEqual(
          error.checked[7],
          "package.json#devEngines.packageManager",
          "devEngines is authoritative for the name, so it precedes the top-level field; set equality would miss a swap"
        );
        assert.strictEqual(error.checked[8], "package.json#packageManager");
      })
    );
  });
});

describe("PackageManagerDetector — standalone pnpm repo", () => {
  layer(
    detectorOver({
      "/repo/pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "/repo/package.json": corepack("pnpm@10.33.0+sha512.abc"),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a pnpm lockfile with no workspace is still pnpm", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        assertSome(detected.version, "10.33.0");
        assert.strictEqual(detected.evidence, "pnpm-lock.yaml");
      })
    );
  });
});

describe("PackageManagerDetector — standalone pnpm repo with no manifest hint", () => {
  layer(
    detectorOver({
      "/repo/pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "solo", version: "1.0.0" }),
        identity
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("the lockfile alone is sufficient — this is the case that used to fail", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        assertNone(detected.version);
      })
    );
  });
});

describe("PackageManagerDetector — standalone npm repo", () => {
  layer(
    detectorOver({
      "/repo/package-lock.json": "{}",
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "solo", version: "1.0.0" }),
        identity
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a package-lock.json with no workspace is npm", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "npm");
        assert.strictEqual(detected.evidence, "package-lock.json");
      })
    );
  });
});

describe("PackageManagerDetector — standalone yarn repo", () => {
  layer(detectorOver({ "/repo/yarn.lock": "", "/repo/package.json": corepack("yarn@4.5.0") }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("a yarn lockfile plus a yarn declaration is yarn, workspace or not", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "yarn");
        assertSome(detected.version, "4.5.0");
        assert.strictEqual(
          detected.evidence,
          "yarn.lock",
          "the lockfile, not the corepack field, is the recorded signal"
        );
      })
    );
  });
});

describe("PackageManagerDetector — standalone bun repo", () => {
  layer(detectorOver({ "/repo/bun.lockb": "", "/repo/package.json": corepack("bun@1.2.0") }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("a bun lockfile plus a bun declaration is bun, on the bun runtime", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "bun");
        assert.strictEqual(detected.runtime, "bun");
        assert.strictEqual(
          detected.evidence,
          "bun.lockb",
          "the binary lockfile is its own evidence spelling, and the report says which one it saw"
        );
      })
    );
  });
});

describe("PackageManagerDetector — a STRAY yarn.lock in a standalone repo", () => {
  layer(
    detectorOver({
      "/repo/yarn.lock": "",
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "solo", version: "1.0.0" }),
        identity
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("the manifest conjunction holds in the standalone tier too", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const error = yield* Effect.flip(detector.detect("/repo"));
        assert.instanceOf(error, PackageManagerDetectionError);
      })
    );
  });
});

describe("PackageManagerDetector — declared but never installed", () => {
  layer(detectorOver({ "/repo/package.json": corepack("pnpm@10.33.0") }), { timeout: "30 seconds" })((it) => {
    it.effect("a packageManager declaration with no lockfile anywhere is honest evidence", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        assertSome(detected.version, "10.33.0");
        assert.strictEqual(detected.evidence, "package.json#packageManager");
      })
    );
  });
});

describe("PackageManagerDetector — devEngines alone, no lockfile", () => {
  layer(
    detectorOver({
      "/repo/package.json": manifestWith({ devEngines: { packageManager: { name: "bun", version: "1.2.0" } } }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("devEngines is a declaration too, and carries the runtime with it", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "bun");
        assert.strictEqual(detected.runtime, "bun");
        assertSome(detected.version, "1.2.0");
        assert.strictEqual(detected.evidence, "package.json#devEngines.packageManager");
      })
    );
  });
});

describe("PackageManagerDetector — both declaration fields, no lockfile", () => {
  layer(
    detectorOver({
      "/repo/package.json": manifestWith({
        packageManager: "pnpm@10.33.0",
        devEngines: { packageManager: { name: "pnpm" } },
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("the evidence names the field that supplied the NAME — devEngines", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        assert.strictEqual(
          detected.evidence,
          "package.json#devEngines.packageManager",
          "devEngines names the manager, so it is the evidence though the version came from the top-level field; version provenance follows the two-field rule and is not carried"
        );
        assertSome(detected.version, "10.33.0");
      })
    );
  });
});

describe("PackageManagerDetector — a manifest naming a manager we do not know", () => {
  layer(detectorOver({ "/repo/package.json": corepack("cnpm@9.0.0") }), { timeout: "30 seconds" })((it) => {
    it.effect("refuses rather than falling back to npm", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const error = yield* Effect.flip(detector.detect("/repo"));
        assert.instanceOf(error, PackageManagerDetectionError);
      })
    );
  });
});

describe("PackageManagerDetector — the workspace tier still wins", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages: []\n",
      "/repo/package-lock.json": "{}",
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
        identity
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("standalone probes run only after every workspace marker has missed", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(
          detected.name,
          "pnpm",
          "if the standalone tier ran first, the stray package-lock.json would turn this pnpm workspace into npm"
        );
      })
    );
  });
});

describe("PackageManagerDetector — a corrupt root package.json", () => {
  layer(detectorOver({ "/repo/package.json": "{ not json", "/repo/pnpm-workspace.yaml": "packages: []\n" }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("fails typed rather than degrading to 'no manager declared'", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const error = yield* Effect.flip(detector.detect("/repo"));
        assert.instanceOf(
          error,
          WorkspaceManifestError,
          "a present but unparseable manifest is corrupt, not a missing hint; swallowing it would hide it behind a versionless pnpm"
        );
        assert.strictEqual(error.kind, "decode");
        assert.strictEqual(error.packageJsonPath, "/repo/package.json");
      })
    );
  });
});

describe("PackageManagerDetector — a root package.json that is not an object", () => {
  layer(detectorOver({ "/repo/package.json": "[1, 2, 3]", "/repo/pnpm-workspace.yaml": "packages: []\n" }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("valid JSON that is not an object is still a decode failure", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const error = yield* Effect.flip(detector.detect("/repo"));
        assert.instanceOf(error, WorkspaceManifestError);
        assert.strictEqual(error.kind, "decode");
      })
    );
  });
});

describe("PackageManagerDetector — no root package.json at all", () => {
  layer(detectorOver({ "/repo/pnpm-workspace.yaml": "packages: []\n" }), { timeout: "30 seconds" })((it) => {
    it.effect("an ABSENT manifest is not an error — it is simply no hint", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        assertNone(detected.version);
      })
    );
  });
});

describe("PackageManagerDetector — a malformed corepack field", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages: []\n",
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0", packageManager: "pnpm" }),
        identity
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("an unparseable packageManager spec is simply no version", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        assertNone(detected.version);
      })
    );
  });
});

describe("PackageManagerDetector — devEngines alone, with a +sha512 version", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages: []\n",
      // The version carries the +sha512 hash, exactly as this repo's own
      // devEngines does. With no top-level packageManager to fall back on, this
      // is the ONLY place the devEngines version is normalized — so it is the
      // test that pins the hash stripping.
      "/repo/package.json": manifestWith({
        devEngines: {
          packageManager: { name: "pnpm", version: "11.11.0+sha512.4463f65fd80ed80d69bc1", onFail: "error" },
        },
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a devEngines-only manifest is visible to the version half of detection", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        const devEnginesOnlyVersion = detected.version;
        assertSome(devEnginesOnlyVersion, "11.11.0");
      })
    );
  });
});

describe("PackageManagerDetector — both fields, the effected repo's own shape", () => {
  const verbatimRootSpecWithTheHashInBothFields =
    "11.11.0+sha512.4463f65fd80ed80d69bc1d4bf163ee94f605c7380fc318bb5b2ebe15f8cd12d49c";
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages: []\n",
      "/repo/package.json": manifestWith({
        packageManager: `pnpm@${verbatimRootSpecWithTheHashInBothFields}`,
        devEngines: {
          packageManager: { name: "pnpm", version: verbatimRootSpecWithTheHashInBothFields, onFail: "ignore" },
        },
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("agreeing fields report the version once, with the hash stripped", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        const bothFieldsVersion = detected.version;
        assertSome(bothFieldsVersion, "11.11.0");
      })
    );
  });
});

describe("PackageManagerDetector — both fields, different versions", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages: []\n",
      "/repo/package.json": manifestWith({
        packageManager: "pnpm@10.1.0+sha512.deadbeef",
        devEngines: { packageManager: { name: "pnpm", version: "10.2.0" } },
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("the top-level packageManager wins the version — it carries the hash", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assertSome(detected.version, "10.1.0");
      })
    );
  });
});

describe("PackageManagerDetector — the two fields disagree on the NAME", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages: []\n",
      "/repo/package.json": manifestWith({
        packageManager: "yarn@4.5.0",
        devEngines: { packageManager: { name: "pnpm" } },
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("devEngines is believed, so yarn's version is not attributed to pnpm", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        const devEnginesPnpmVersion = detected.version;
        assertNone(devEnginesPnpmVersion);
      })
    );
  });
});

describe("PackageManagerDetector — devEngines overrides the name disambiguator", () => {
  layer(
    detectorOver({
      "/repo/yarn.lock": "",
      "/repo/package.json": manifestWith({
        workspaces: ["packages/*"],
        packageManager: "yarn@4.5.0",
        devEngines: { packageManager: { name: "pnpm", version: "10.0.0" } },
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a yarn.lock plus a yarn corepack field is NOT yarn when devEngines says pnpm", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(
          detected.name,
          "npm",
          "devEngines' name wins, so the yarn conjunction does not fire and npm's workspaces fallback answers; corepack would have errored"
        );
        assertNone(detected.version);
      })
    );
  });
});

describe("PackageManagerDetector — devEngines disambiguates bun with no version", () => {
  layer(
    detectorOver({
      "/repo/bun.lock": "",
      "/repo/package.json": manifestWith({
        workspaces: ["packages/*"],
        devEngines: { packageManager: { name: "bun" } },
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("the conjunction needs a NAME, not a version", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "bun");
        assert.strictEqual(detected.runtime, "bun");
        assertNone(detected.version);
      })
    );
  });
});

describe("PackageManagerDetector — devEngines names a manager we did not detect", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages: []\n",
      "/repo/package.json": manifestWith({
        devEngines: { packageManager: { name: "yarn", version: "4.5.0" } },
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("no version is reported — the field does not name the detected manager", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        const aYarnVersionSaysNothingAboutPnpm = detected.version;
        assertNone(aYarnVersionSaysNothingAboutPnpm);
      })
    );
  });
});

describe("PackageManagerDetector — devEngines is not an object", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages: []\n",
      "/repo/package.json": manifestWith({ packageManager: "pnpm@10.33.0", devEngines: "pnpm" }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("the bad field is ignored and packageManager still supplies the version", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        assertSome(detected.version, "10.33.0");
      })
    );
  });
});

describe("PackageManagerDetector — devEngines.packageManager is an ARRAY and the only version source", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages: []\n",
      "/repo/package.json": manifestWith({
        devEngines: { packageManager: [{ name: "pnpm", version: "9.9.9" }] },
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("arrays are unsupported in this slot — corepack falls back, so do we", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(
          detected.name,
          "pnpm",
          "the array's element names the detected manager, since one naming another manager would be ignored anyway"
        );
        // Taking the array's first element would report 9.9.9 here.
        const arraySlotVersion = detected.version;
        assertNone(arraySlotVersion);
      })
    );
  });
});

describe("PackageManagerDetector — devEngines name contains @", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages: []\n",
      "/repo/package.json": manifestWith({
        packageManager: "pnpm@10.33.0",
        devEngines: { packageManager: { name: "pnpm@10.33.0" } },
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a name carrying @ is invalid — the field is ignored, not fatal", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        assertSome(detected.version, "10.33.0");
      })
    );
  });
});

describe("PackageManagerDetector — devEngines version is a RANGE", () => {
  layer(
    detectorOver({
      "/repo/pnpm-workspace.yaml": "packages: []\n",
      "/repo/package.json": manifestWith({
        devEngines: { packageManager: { name: "pnpm", version: "^11.0.0" } },
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("the name is kept and only the unusable version is dropped", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "pnpm");
        const aRangeIsNoVersionCorepackWouldRun = detected.version;
        assertNone(aRangeIsNoVersionCorepackWouldRun);
      })
    );
  });
});

describe("PackageManagerDetector — a malformed devEngines cannot break detection", () => {
  layer(
    detectorOver({
      "/repo/bun.lock": "",
      "/repo/package.json": manifestWith({
        devEngines: { packageManager: { name: 42 } },
        packageManager: "bun@1.2.0",
      }),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a non-string name falls back to packageManager, keeping bun detectable", () =>
      Effect.gen(function* () {
        const detector = yield* PackageManagerDetector;
        const detected = yield* detector.detect("/repo");
        assert.strictEqual(detected.name, "bun");
        assertSome(detected.version, "1.2.0");
      })
    );
  });
});
