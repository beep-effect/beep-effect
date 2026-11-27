import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CacheKey, CacheKeyBadPatternError, CacheKeyReadError } from "@beep/github-actions";
import { InvalidDigestLengthError } from "@beep/github-actions/CacheKey";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { systemError } from "effect/PlatformError";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { MemoryFileSystemSeedEntry } from "@beep/memfs";

const ALPHA_BETA = "24d116e0411b3a4a8d3d5c9c88c150bc4d4603a490294bd4b23d3ef549e1f1a0";

const FILES: Record<string, string> = {
  "/w/alpha.txt": "alpha\n",
  "/w/beta.txt": "beta\n",
};

const files = MemoryFileSystem.layerWith(FILES);

describe("CacheKey", () => {
  describe("the key and its ladder", () => {
    it("joins the segments", () => {
      assert.strictEqual(CacheKey.of("Linux", "pnpm-store", "abc123").key, "Linux-pnpm-store-abc123");
    });

    it("derives the restore keys most specific first, each ending in the separator", () => {
      assert.deepStrictEqual(
        CacheKey.of("Linux", "pnpm-store", "abc123").restoreKeys,
        ["Linux-pnpm-store-", "Linux-"],
        "GitHub prefix-matches restore keys, so without the separator Linux-pnpm would match Linux-pnpmx-"
      );
    });

    it("gives a single-segment key no ladder at all", () => {
      assert.deepStrictEqual(
        CacheKey.of("Linux").restoreKeys,
        [],
        "an empty-prefix rung would match every cache in the repository"
      );
    });

    it("refuses a segment containing a comma, which the runner reads as a delimiter", () => {
      assert.throws(() => CacheKey.of("Linux", "a,b"));
    });

    it("refuses a segment containing a newline", () => {
      assert.throws(() => CacheKey.of("Linux", "a\nb"));
    });

    it("refuses a key longer than GitHub accepts", () => {
      assert.throws(() => CacheKey.of("Linux", Str.repeat(512)("x")));
    });

    it("accepts a key exactly at the limit", () => {
      const key = CacheKey.of(Str.repeat(512)("x"));
      assert.lengthOf(key.key, 512);
    });
  });

  describe("an explicit ladder policy", () => {
    it("answers exactly the depths given, in the order given", () => {
      const key = CacheKey.of("Linux", "X64", "v1hash", "main", "lockhash").withRestoreDepths([4, 3]);
      assert.deepStrictEqual(
        key.restoreKeys,
        ["Linux-X64-v1hash-main-", "Linux-X64-v1hash-"],
        "an ignored policy yields four all-prefix rungs, two of them matching stale cross-version caches"
      );
    });

    it("preserves a non-descending order verbatim — the order IS the policy", () => {
      const key = CacheKey.of("a", "b", "c").withRestoreDepths([1, 2]);
      assert.deepStrictEqual(
        key.restoreKeys,
        ["a-", "a-b-"],
        "GitHub tries restore keys in order; descending is advised, not enforced"
      );
    });

    it("leaves the primary key alone", () => {
      const key = CacheKey.of("Linux", "pnpm-store", "abc123").withRestoreDepths([1]);
      assert.strictEqual(key.key, "Linux-pnpm-store-abc123");
    });

    it("does not change the default ladder of a key without a policy", () => {
      assert.deepStrictEqual(
        CacheKey.of("Linux", "pnpm-store", "abc123").restoreKeys,
        ["Linux-pnpm-store-", "Linux-"],
        "byte-compatible for every existing consumer"
      );
    });

    it("refuses a depth that keeps every segment — that rung would repeat the primary key", () => {
      assert.throws(() => CacheKey.of("a", "b", "c").withRestoreDepths([3]));
    });

    it("refuses a depth of zero — that rung would match every cache in the repository", () => {
      assert.throws(() => CacheKey.of("a", "b", "c").withRestoreDepths([0]));
    });

    it("refuses a negative or fractional depth", () => {
      assert.throws(() => CacheKey.of("a", "b", "c").withRestoreDepths([-1]));
      assert.throws(() => CacheKey.of("a", "b", "c").withRestoreDepths([1.5]));
    });
  });

  describe("no ladder at all — exact-match-only", () => {
    it("answers zero rungs", () => {
      assert.deepStrictEqual(
        CacheKey.of("Linux", "pnpm-store", "abc123").withoutRestoreKeys().restoreKeys,
        [],
        "an empty policy means no ladder; read as no policy it would regenerate the default rungs"
      );
    });

    it("leaves the primary key alone", () => {
      assert.strictEqual(
        CacheKey.of("Linux", "pnpm-store", "abc123").withoutRestoreKeys().key,
        "Linux-pnpm-store-abc123"
      );
    });

    it("survives a schema round-trip without regaining a ladder", () => {
      const encoded = flow(
        S.encodeResult(CacheKey),
        Result.getOrThrowWith((error) => error)
      )(CacheKey.of("Linux", "pnpm-store").withoutRestoreKeys());
      const decoded = flow(
        S.decodeResult(CacheKey),
        Result.getOrThrowWith((error) => error)
      )(encoded);
      assert.deepStrictEqual(
        decoded.restoreKeys,
        [],
        "the policy is a plain field, so a key from state or JSON stays exact-match"
      );
      assert.strictEqual(decoded.key, "Linux-pnpm-store");
    });

    it("does not change a key without a policy — absent still means the default ladder", () => {
      assert.deepStrictEqual(CacheKey.of("Linux", "pnpm-store", "abc123").restoreKeys, ["Linux-pnpm-store-", "Linux-"]);
    });
  });

  describe("namespacing a whole key — the cache-bust case", () => {
    it("prepends the segment, so the busted key shares no prefix with an unbusted one", () => {
      const busted = CacheKey.of("Linux", "pnpm-store", "abc123").withNamespace("bust7");
      assert.strictEqual(
        busted.key,
        "bust7-Linux-pnpm-store-abc123",
        "a busted run must not read or write an unbusted entry"
      );
    });

    it("drops the ladder, so no rung can prefix-match outside the namespace", () => {
      assert.deepStrictEqual(
        CacheKey.of("Linux", "pnpm-store", "abc123").withNamespace("bust7").restoreKeys,
        [],
        "a bust folded in after the retained prefix leaves ordinary rungs prefix-matching busted entries"
      );
    });

    it("leaves an unbusted key's rungs unable to reach a busted entry", () => {
      const ordinary = CacheKey.of("Linux", "pnpm-store", "abc123");
      const busted = ordinary.withNamespace("bust7");
      for (const rung of ordinary.restoreKeys) {
        assert.isFalse(Str.startsWith(rung)(busted.key), `"${rung}" must not match "${busted.key}"`);
      }
    });

    it("is safe even when the namespace collides with an ordinary leading segment", () => {
      assert.deepStrictEqual(
        CacheKey.of("Linux", "pnpm-store", "abc123").withNamespace("Linux").restoreKeys,
        [],
        "a kept ladder's Linux- rung would match every ordinary Linux entry, whatever the namespace"
      );
    });

    it("still allows an explicit in-namespace ladder for a caller who wants one", () => {
      const key = CacheKey.of("Linux", "pnpm-store", "abc123").withNamespace("bust7").withRestoreDepths([3, 2]);
      assert.deepStrictEqual(
        key.restoreKeys,
        ["bust7-Linux-pnpm-store-", "bust7-Linux-"],
        "dropping the ladder is the default, not a prohibition: one busted run can warm another"
      );
    });

    it("refuses a segment carrying a restore-key delimiter", () => {
      assert.throws(() => CacheKey.of("Linux", "pnpm-store").withNamespace("a,b"));
    });
  });

  describe("branch-aware derivation", () => {
    it("orders the segments so the first fallback stays on the branch", () => {
      const key = CacheKey.forBranch({ os: "Linux", scope: "pnpm-store", branch: "feature/x", hash: "abc123" });
      assert.strictEqual(key.key, "Linux-pnpm-store-feature/x-abc123");
      assert.deepStrictEqual(
        key.restoreKeys,
        ["Linux-pnpm-store-feature/x-", "Linux-pnpm-store-", "Linux-"],
        "rung one stays on the branch; scope after branch would warm a feature branch from main first"
      );
    });

    it("omits the os and hash when they are not supplied", () => {
      const key = CacheKey.forBranch({ scope: "pnpm-store", branch: "main" });
      assert.strictEqual(key.key, "pnpm-store-main");
      assert.deepStrictEqual(key.restoreKeys, ["pnpm-store-"]);
    });
  });

  describe("digest — the string-segment digest", () => {
    it("is sha256, lowercase hex, truncated to eight characters by default", () => {
      assert.strictEqual(
        CacheKey.digest(""),
        "e3b0c442",
        "the empty-string sha256 vector catches a swapped algorithm or uppercase hex"
      );
      assert.strictEqual(CacheKey.digest("main"), CacheKey.digest("main"));
    });

    it("takes an explicit length, up to the whole digest", () => {
      assert.strictEqual(CacheKey.digest("", 12), "e3b0c44298fc");
      const full = CacheKey.digest("", 64);
      assert.strictEqual(full, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
      assert.strictEqual(CacheKey.digest("main", 64).length, 64);
    });

    it("distinguishes the two call sites it exists for", () => {
      assert.notStrictEqual(
        CacheKey.digest("node:24.4.0,pnpm:10.13.1"),
        CacheKey.digest("feat/topic"),
        "a version list and a branch name must never collide into one segment"
      );
    });

    it("always satisfies the segment grammar, even for hostile input", () => {
      for (const hostile of ["", "a,b", "line\nbreak", "\r\n", "-", ","]) {
        const key = CacheKey.of("Linux", CacheKey.digest(hostile));
        assert.match(
          key.key,
          /^Linux-[0-9a-f]{8}$/,
          "lowercase hex is nonempty with no comma or newline, so it needs no check"
        );
      }
    });

    it("throws InvalidDigestLengthError outside 1..64 or on a fraction, never answering a shorter digest", () => {
      for (const bad of [0, -1, 1.5, 65, Number.NaN]) {
        assert.throws(() => CacheKey.digest("main", bad), InvalidDigestLengthError);
      }
    });
  });

  describe("hashFiles", () => {
    it.layer(files, { timeout: "30 seconds" })((it) => {
      it.effect("hashes files the way @actions/glob does: per-file digests folded as binary, not hex", () =>
        Effect.gen(function* () {
          const digest = yield* CacheKey.hashFiles(["/w/alpha.txt", "/w/beta.txt"]);
          assertSome(digest, ALPHA_BETA);
        })
      );
    });

    it.layer(files, { timeout: "30 seconds" })((it) => {
      it.effect("does not depend on the order the caller discovered files in", () =>
        Effect.gen(function* () {
          const digest = yield* CacheKey.hashFiles(["/w/beta.txt", "/w/alpha.txt"]);
          assertSome(digest, ALPHA_BETA);
        })
      );
    });

    it.layer(files, { timeout: "30 seconds" })((it) => {
      it.effect("counts a repeated path once", () =>
        Effect.gen(function* () {
          const digest = yield* CacheKey.hashFiles(["/w/alpha.txt", "/w/beta.txt", "/w/alpha.txt"]);
          assertSome(digest, ALPHA_BETA);
        })
      );
    });

    it.layer(files, { timeout: "30 seconds" })((it) => {
      it.effect("distinguishes different content", () =>
        Effect.gen(function* () {
          const both = yield* CacheKey.hashFiles(["/w/alpha.txt", "/w/beta.txt"]);
          const one = yield* CacheKey.hashFiles(["/w/alpha.txt"]);
          assert.notDeepEqual(both, one);
        })
      );
    });

    it.layer(files, { timeout: "30 seconds" })((it) => {
      it.effect("reports nothing when no file matched: a constant digest would always hit wrong contents", () =>
        Effect.gen(function* () {
          const hashFiles1 = yield* CacheKey.hashFiles([]);
          assertNone(hashFiles1);
        })
      );
    });

    {
      let active = 0;
      let overlapped = false;
      const observed = MemoryFileSystem.layerWith(FILES, {
        faults: (base) => ({
          readFile: Effect.fn("readFile")(function* (path) {
            active += 1;
            if (active > 1) {
              overlapped = true;
            }
            yield* Effect.yieldNow;
            yield* Effect.yieldNow;
            const bytes = yield* base.readFile(path);
            active -= 1;
            return bytes;
          }),
        }),
      });

      it.layer(observed, { timeout: "30 seconds" })((it) => {
        it.effect("reads the files concurrently, still folding digests in sorted, not completion, order", () =>
          Effect.gen(function* () {
            const digest = yield* CacheKey.hashFiles(["/w/alpha.txt", "/w/beta.txt"]);
            assert.isTrue(
              overlapped,
              "reads never overlapped: Effect.all defaults to concurrency 1 (a latch, not yields, would hang)"
            );
            assertSome(digest, ALPHA_BETA);
          })
        );
      });
    }

    it.layer(files, { timeout: "30 seconds" })((it) => {
      it.effect("fails typed, naming the file, when one cannot be read", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(CacheKey.hashFiles(["/w/alpha.txt", "/w/gone.txt"]));
          assert.instanceOf(error, CacheKeyReadError);
          assert.strictEqual(error.path, "/w/gone.txt");
        })
      );
    });
  });

  describe("hashing what a pattern set matches", () => {
    const WORKSPACE = "/ws";
    const SEALED = "/ws/sealed/pnpm-lock.yaml";
    const TREE: Record<string, MemoryFileSystemSeedEntry> = {
      "/ws/pnpm-lock.yaml": "lock\n",
      "/ws/packages/a/pnpm-lock.yaml": "inner\n",
      "/ws/node_modules/dep/pnpm-lock.yaml": "vendored\n",
      "/ws/readme.md": "docs\n",
    };

    it.layer(Layer.mergeAll(MemoryFileSystem.layerWith(TREE), Path.layer), { timeout: "30 seconds" })((it) => {
      it.effect("matches relative to the workspace, and honours an exclusion", () =>
        Effect.gen(function* () {
          const root = WORKSPACE;
          const matched = yield* CacheKey.matchingFiles({
            workspace: root,
            patterns: ["**/pnpm-lock.yaml", "!**/node_modules/**"],
          });
          assert.deepStrictEqual(
            A.map(matched, (file) => Str.slice(root.length + 1)(file)),
            ["packages/a/pnpm-lock.yaml", "pnpm-lock.yaml"],
            "relative matching keeps patterns inside the workspace and independent of the checkout path"
          );
        })
      );
    });

    it.layer(
      Layer.mergeAll(MemoryFileSystem.layerWith({ ...TREE, ...{ "/ws/notes.txt/inner.txt": "inner\n" } }), Path.layer),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("excludes a directory whose name matches the pattern", () =>
        Effect.gen(function* () {
          const root = WORKSPACE;
          const matched = yield* CacheKey.matchingFiles({ workspace: root, patterns: ["*.txt", "**/*.txt"] });
          assert.deepStrictEqual(
            A.map(matched, (file) => Str.slice(root.length + 1)(file)),
            ["notes.txt/inner.txt"],
            "the notes.txt directory is not a file; passed to hashFiles, its read fails the action"
          );
        })
      );
    });

    it.layer(Layer.mergeAll(MemoryFileSystem.layerWith(TREE), Path.layer), { timeout: "30 seconds" })((it) => {
      it.effect("is exactly hashFiles over what it matched", () =>
        Effect.gen(function* () {
          const root = WORKSPACE;
          const matched = yield* CacheKey.matchingFiles({ workspace: root, patterns: ["**/pnpm-lock.yaml"] });
          const hashMatching2 = yield* CacheKey.hashMatching({ workspace: root, patterns: ["**/pnpm-lock.yaml"] });
          const hashFiles7 = yield* CacheKey.hashFiles(matched);
          assert.deepStrictEqual(hashMatching2, hashFiles7);
        })
      );
    });

    it.layer(Layer.mergeAll(MemoryFileSystem.layerWith(TREE), Path.layer), { timeout: "30 seconds" })((it) => {
      it.effect("reports nothing rather than a digest when the patterns match nothing", () =>
        Effect.gen(function* () {
          const root = WORKSPACE;
          const hashMatching3 = yield* CacheKey.hashMatching({ workspace: root, patterns: ["**/*.absent"] });
          assertNone(hashMatching3);
        })
      );
    });

    it.layer(Layer.mergeAll(MemoryFileSystem.layerWith(TREE), Path.layer), { timeout: "30 seconds" })((it) => {
      it.effect("fails typed, naming the pattern, when one will not compile", () =>
        Effect.gen(function* () {
          const root = WORKSPACE;
          const hostile = Str.repeat(70_000)("x");
          const error = yield* Effect.flip(CacheKey.matchingFiles({ workspace: root, patterns: [hostile] }));
          assert.instanceOf(error, CacheKeyBadPatternError);
          assert.strictEqual(error.pattern, hostile);
        })
      );
    });

    it.layer(Layer.mergeAll(MemoryFileSystem.layerWith({ ...TREE, ...{ "/ws/..lock": "two dots\n" } }), Path.layer), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("matches two-dot filenames consistently as literals and wildcards", () =>
        Effect.gen(function* () {
          const root = WORKSPACE;
          const literal = yield* CacheKey.matchingFiles({ workspace: root, patterns: ["..lock"] });
          const wildcard = yield* CacheKey.matchingFiles({ workspace: root, patterns: ["..*"] });
          assert.deepStrictEqual(literal, ["/ws/..lock"]);
          assert.deepStrictEqual(wildcard, literal);
          const literalHash = yield* CacheKey.hashMatching({ workspace: root, patterns: ["..lock"] });
          assertSome(literalHash, O.getOrThrow(literalHash));
          const hashMatching4 = yield* CacheKey.hashMatching({ workspace: root, patterns: ["..*"] });
          assert.deepStrictEqual(literalHash, hashMatching4);
        })
      );
    });

    it.layer(
      Layer.mergeAll(
        MemoryFileSystem.layerWith({
          ...TREE,
          ...{ "/ws/ä.order": "last", "/ws/a.order": "middle", "/ws/Z.order": "first" },
        }),
        Path.layer
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("keeps deterministic code-unit order for mixed-case and Unicode matches", () =>
        Effect.gen(function* () {
          const root = WORKSPACE;
          const matched = yield* CacheKey.matchingFiles({ workspace: root, patterns: ["*.order"] });
          assert.deepStrictEqual(matched, ["/ws/Z.order", "/ws/a.order", "/ws/ä.order"]);
          const hashFiles5 = yield* CacheKey.hashFiles(matched);
          const hashFiles8 = yield* CacheKey.hashFiles(["/ws/ä.order", "/ws/a.order", "/ws/Z.order"]);
          assert.deepStrictEqual(hashFiles5, hashFiles8);
        })
      );
    });

    it.layer(
      Layer.mergeAll(MemoryFileSystem.layerWith({ ...TREE, ...{ "/ws-outside.lock": "outside\n" } }), Path.layer),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("drops a literal that climbs above the workspace, even when the file exists", () =>
        Effect.gen(function* () {
          const root = WORKSPACE;
          const matched = yield* CacheKey.matchingFiles({
            workspace: root,
            patterns: ["../ws-outside.lock", "pnpm-lock.yaml"],
          });
          assert.deepStrictEqual(
            A.map(matched, (file) => Str.slice(root.length + 1)(file)),
            ["pnpm-lock.yaml"],
            "a per-literal stat can reach a sibling beside the workspace, so containment is explicit"
          );
        })
      );
    });

    it.layer(
      Layer.mergeAll(
        MemoryFileSystem.layerWith(
          { ...TREE, ...{ [SEALED]: "hidden\n" } },
          {
            faults: {
              stat: (path) =>
                path === SEALED
                  ? Effect.fail(
                      systemError({
                        _tag: "PermissionDenied",
                        module: "FileSystem",
                        method: "stat",
                        pathOrDescriptor: path,
                      })
                    )
                  : undefined,
            },
          }
        ),
        Path.layer
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("reads an absent literal as a miss but an unreadable one as a typed failure", () =>
        Effect.gen(function* () {
          const root = WORKSPACE;
          const absent = yield* CacheKey.matchingFiles({ workspace: root, patterns: ["not-here.lock"] });
          assert.deepStrictEqual(absent, [], "an absent literal is a miss, as the walk never reported it");
          const error = yield* Effect.flip(
            CacheKey.matchingFiles({ workspace: root, patterns: ["sealed/pnpm-lock.yaml"] })
          );
          assert.instanceOf(
            error,
            CacheKeyReadError,
            "a requested file that cannot be stat'ed fails; a key without it restores the wrong cache"
          );
          assert.strictEqual(error.path, SEALED);
        })
      );
    });

    it.layer(Layer.mergeAll(MemoryFileSystem.layerWith(TREE), Path.layer), { timeout: "30 seconds" })((it) => {
      it.effect("fails typed, naming the workspace, when it cannot be walked", () =>
        Effect.gen(function* () {
          const root = WORKSPACE;
          const absent = `${root}/not-here`;
          const error = yield* Effect.flip(CacheKey.matchingFiles({ workspace: absent, patterns: ["**"] }));
          assert.instanceOf(error, CacheKeyReadError);
          assert.strictEqual(error.path, absent);
        })
      );
    });
  });

  describe("followSymlinks semantics on a pure virtual POSIX volume, byte-identical across platforms", () => {
    const seed: Record<string, MemoryFileSystemSeedEntry> = {
      "/repo/src/a.ts": "alpha\n",
      "/repo/shared/inner.ts": "inner\n",
      "/repo/src/one": MemoryFileSystem.symlink("/repo/shared"),
      "/repo/src/two": MemoryFileSystem.symlink("/repo/shared"),
      "/repo/src/out": MemoryFileSystem.symlink("/outside"),
      "/outside/secret.ts": "secret\n",
    };
    const symlinkPlatform = Layer.mergeAll(MemoryFileSystem.layerWith(seed), Path.layer);

    it.layer(symlinkPlatform, { timeout: "30 seconds" })((it) => {
      it.effect("files reachable only through a symlinked directory contribute to the key", () =>
        Effect.gen(function* () {
          const matched = yield* CacheKey.matchingFiles({ workspace: "/repo", patterns: ["src/**/*.ts"] });
          assert.deepStrictEqual(
            matched,
            ["/repo/src/a.ts", "/repo/src/one/inner.ts", "/repo/src/out/secret.ts", "/repo/src/two/inner.ts"],
            "@actions/glob's per-branch traversalChain lists both sibling links and follows the link out of the tree"
          );
        })
      );
    });
  });

  describe("JSON Schema export", () => {
    it("annotates every reusable cache-key check", () => {
      for (const { schema, path, name, message, description } of [
        {
          schema: CacheKey.fields.segments,
          path: "ast.elements.0.checks.0.annotations",
          name: "SegmentPattern",
          message: "Cache key segment pattern",
          description: "A nonempty cache-key segment without commas or newline delimiters.",
        },
        {
          schema: CacheKey.fields.segments,
          path: "ast.checks.0.annotations",
          name: "SegmentsLength",
          message: "a cache key of at most 512 characters",
          description: "The complete cache key, including segment separators, fits GitHub's 512-character limit.",
        },
        {
          schema: CacheKey.fields.restoreDepths,
          path: "ast.rest.0.checks.1.annotations",
          name: "RestoreDepthInteger",
          message: "Integer restore depth",
          description: "A restore-key rung keeps a whole number of leading segments.",
        },
        {
          schema: CacheKey.fields.restoreDepths,
          path: "ast.rest.0.checks.2.annotations",
          name: "RestoreDepthRange",
          message: "Positive safe restore depth",
          description: "A restore depth is between one and the maximum safe integer, inclusive.",
        },
        {
          schema: CacheKey,
          path: "ast.typeParameters.0.checks.0.annotations",
          name: "RestoreDepthWithinSegments",
          message:
            "every restore depth must be between 1 and segments.length - 1 — a rung keeping every segment would just repeat the primary key",
          description: "Each explicit restore depth keeps fewer segments than the primary cache key.",
        },
      ]) {
        assert.nestedPropertyVal(schema, `${path}.identifier`, `@beep/github-actions/CacheKey/${name}`);
        assert.nestedPropertyVal(schema, `${path}.title`, name);
        assert.nestedPropertyVal(schema, `${path}.message`, message);
        assert.nestedPropertyVal(schema, `${path}.description`, description);
      }
    });

    it("each segment exports its pattern", () => {
      const document = S.toJsonSchemaDocument(CacheKey);
      assert.nestedPropertyVal(
        document,
        "definitions.@beep/github-actions/CacheKey/SegmentPattern.pattern",
        String.raw`^[^,\n\r]+$`
      );
      assert.nestedPropertyVal(
        document,
        "definitions.@beep/github-actions/CacheKey/RestoreDepthWithinSegments.properties.segments.$ref",
        "#/$defs/@beep~1github-actions~1CacheKey~1SegmentsLength"
      );
      for (const path of ["prefixItems.0.$ref", "items.$ref"]) {
        assert.nestedPropertyVal(
          document,
          `definitions.@beep/github-actions/CacheKey/SegmentsLength.${path}`,
          "#/$defs/@beep~1github-actions~1CacheKey~1SegmentPattern"
        );
      }
    });

    it("keeps the restore-depth bounds and rejection message", () => {
      const document = S.toJsonSchemaDocument(CacheKey);
      const range = "definitions.@beep/github-actions/CacheKey/RestoreDepthRange";
      assert.nestedPropertyVal(document, `${range}.type`, "integer");
      assert.nestedPropertyVal(document, `${range}.allOf.0.minimum`, 1);
      assert.nestedPropertyVal(document, `${range}.allOf.0.maximum`, Number.MAX_SAFE_INTEGER);
      const error = flow(
        S.decodeResult(CacheKey),
        Result.flip,
        Result.getOrThrow
      )({
        segments: ["a", "b", "c"],
        restoreDepths: [3],
      });
      assert.strictEqual(
        error.message,
        "every restore depth must be between 1 and segments.length - 1 — a rung keeping every segment would just repeat the primary key"
      );
    });
  });
});

describe("CacheKey codec property", () => {
  it.effect.prop(
    "CacheKey round-trips through its codec",
    [Arbitrary.schema(CacheKey)],
    ([value]) =>
      Effect.gen(function* () {
        const argument = S.decodeEffect(CacheKey);
        const value1 = yield* S.encodeEffect(CacheKey)(value);
        const value6 = yield* argument(value1);
        assert.deepStrictEqual(value6, value);
      }),
    { arbitrary: fcRuns(100) }
  );
});
