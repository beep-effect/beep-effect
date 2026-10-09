import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import {
	PackageManagerDetectionError,
	PackageManagerDetector,
	PackageManagerEvidence,
	WorkspaceManifestError,
} from "../../effected/workspaces/index.ts";
import type { Tree } from "./fixtures.ts";
import { platform } from "./fixtures.ts";

const detectorOver = (tree: Tree) => PackageManagerDetector.layer.pipe(Layer.provideMerge(platform(tree)));

const corepack = (spec: string) => JSON.stringify({ name: "root", version: "0.0.0", packageManager: spec });

/** A root manifest carrying any combination of the two manager-declaring fields. */
const manifestWith = (fields: Record<string, unknown>) => JSON.stringify({ name: "root", version: "0.0.0", ...fields });

describe("PackageManagerDetector — pnpm", () => {
	layer(
		detectorOver({
			"/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
			"/repo/package.json": corepack("pnpm@10.33.0+sha512.abc"),
		}),
	)((it) => {
		it.effect("a pnpm-workspace.yaml is sufficient, and the corepack version is reported", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				assert.deepStrictEqual(detected.version, Option.some("10.33.0"));
				assert.strictEqual(detected.runtime, "node");
				assert.strictEqual(detected.evidence, "pnpm-workspace.yaml");
			}),
		);
	});
});

describe("PackageManagerDetector — pnpm with no corepack field", () => {
	layer(
		detectorOver({
			"/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
			"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
		}),
	)((it) => {
		it.effect("detects pnpm with no version", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				assert.isTrue(Option.isNone(detected.version));
			}),
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
	)((it) => {
		it.effect("the priority chain puts pnpm first even when yarn's markers are present", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				// The corepack field names YARN, so no pnpm version can be attributed.
				assert.isTrue(Option.isNone(detected.version));
			}),
		);
	});
});

describe("PackageManagerDetector — bun", () => {
	layer(detectorOver({ "/repo/bun.lock": "", "/repo/package.json": corepack("bun@1.2.0") }))((it) => {
		it.effect("a bun lockfile plus a bun corepack field means bun, on the bun runtime", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "bun");
				assert.strictEqual(detected.runtime, "bun");
				assert.deepStrictEqual(detected.version, Option.some("1.2.0"));
				// The conjunction needed the manifest field too, but the lockfile is
				// the recorded signal: the field alone would have resolved in the
				// declaration tier, so the lockfile is what this rung added.
				assert.strictEqual(detected.evidence, "bun.lock");
			}),
		);
	});
});

describe("PackageManagerDetector — a bun lockfile WITHOUT the corepack field", () => {
	layer(
		detectorOver({
			"/repo/bun.lock": "",
			"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0", workspaces: ["packages/*"] }),
		}),
	)((it) => {
		it.effect("falls through to npm — the conjunction is deliberate", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				// A stray lockfile is common; only the corepack field disambiguates.
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "npm");
			}),
		);
	});
});

describe("PackageManagerDetector — yarn", () => {
	layer(detectorOver({ "/repo/yarn.lock": "", "/repo/package.json": corepack("yarn@4.5.0") }))((it) => {
		it.effect("a yarn lockfile plus a yarn corepack field means yarn", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "yarn");
				assert.deepStrictEqual(detected.version, Option.some("4.5.0"));
				assert.strictEqual(detected.evidence, "yarn.lock");
			}),
		);
	});
});

describe("PackageManagerDetector — npm", () => {
	layer(
		detectorOver({
			"/repo/package.json": JSON.stringify({
				name: "root",
				version: "0.0.0",
				workspaces: ["packages/*"],
				packageManager: "npm@11.0.0",
			}),
		}),
	)((it) => {
		it.effect("a workspaces field alone is the npm fallback", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "npm");
				assert.deepStrictEqual(detected.version, Option.some("11.0.0"));
				assert.strictEqual(detected.evidence, "package.json#workspaces");
			}),
		);
	});
});

describe("PackageManagerDetector — NO EVIDENCE AT ALL", () => {
	// The genuine no-evidence case: a manifest that declares nothing, and not a
	// single lockfile. Distinct from the standalone-repo cases below, which have
	// evidence but no workspace.
	layer(detectorOver({ "/repo/package.json": JSON.stringify({ name: "solo", version: "1.0.0" }) }))((it) => {
		it.effect("fails typed, listing the markers it probed", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const error = yield* Effect.flip(detector.detect("/repo"));
				assert.instanceOf(error, PackageManagerDetectionError);
				assert.strictEqual(error.root, "/repo");
				assert.include(error.checked, "pnpm-workspace.yaml");
				assert.include(error.checked, "yarn.lock");
				// The standalone probes are part of the contract too, so they belong
				// on the error that reports having tried them.
				assert.include(error.checked, "pnpm-lock.yaml");
				assert.include(error.checked, "package-lock.json");
				// ONE vocabulary serves both halves of the contract: what the error
				// reports as probed is exactly the evidence union a success reports
				// from, member for member and in priority order.
				assert.deepStrictEqual([...error.checked], [...PackageManagerEvidence.literals]);
				// The declaration tier's order is DECISION precedence, positionally:
				// devEngines is authoritative for the name, so it precedes the
				// top-level field (set equality would not catch a swap).
				assert.strictEqual(error.checked[7], "package.json#devEngines.packageManager");
				assert.strictEqual(error.checked[8], "package.json#packageManager");
			}),
		);
	});
});

// ── standalone repos: evidence, but no workspace ──────────────────────────
//
// The chain above answers "which manager runs this WORKSPACE". Most repos are
// not workspaces, and before these tiers existed a single-package repo — a
// pnpm-lock.yaml, no `workspaces` field — was undetectable, which is why one
// consumer carried three competing hand-rolled detections with two different
// silent defaults. The tiers are strictly additive: they run after every
// workspace marker has missed, so no input that previously succeeded can change
// its answer.

describe("PackageManagerDetector — standalone pnpm repo", () => {
	layer(
		detectorOver({
			"/repo/pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
			"/repo/package.json": corepack("pnpm@10.33.0+sha512.abc"),
		}),
	)((it) => {
		it.effect("a pnpm lockfile with no workspace is still pnpm", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				assert.deepStrictEqual(detected.version, Option.some("10.33.0"));
				assert.strictEqual(detected.evidence, "pnpm-lock.yaml");
			}),
		);
	});
});

describe("PackageManagerDetector — standalone pnpm repo with no manifest hint", () => {
	layer(
		detectorOver({
			"/repo/pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
			"/repo/package.json": JSON.stringify({ name: "solo", version: "1.0.0" }),
		}),
	)((it) => {
		it.effect("the lockfile alone is sufficient — this is the case that used to fail", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				// Only pnpm writes a pnpm-lock.yaml, so no manifest conjunction is
				// needed — the same reasoning that makes pnpm-workspace.yaml sufficient.
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				assert.isTrue(Option.isNone(detected.version));
			}),
		);
	});
});

describe("PackageManagerDetector — standalone npm repo", () => {
	layer(
		detectorOver({
			"/repo/package-lock.json": "{}",
			"/repo/package.json": JSON.stringify({ name: "solo", version: "1.0.0" }),
		}),
	)((it) => {
		it.effect("a package-lock.json with no workspace is npm", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "npm");
				assert.strictEqual(detected.evidence, "package-lock.json");
			}),
		);
	});
});

describe("PackageManagerDetector — standalone yarn repo", () => {
	layer(detectorOver({ "/repo/yarn.lock": "", "/repo/package.json": corepack("yarn@4.5.0") }))((it) => {
		it.effect("a yarn lockfile plus a yarn declaration is yarn, workspace or not", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "yarn");
				assert.deepStrictEqual(detected.version, Option.some("4.5.0"));
				// The lockfile, not the corepack field, is the recorded signal.
				assert.strictEqual(detected.evidence, "yarn.lock");
			}),
		);
	});
});

describe("PackageManagerDetector — standalone bun repo", () => {
	layer(detectorOver({ "/repo/bun.lockb": "", "/repo/package.json": corepack("bun@1.2.0") }))((it) => {
		it.effect("a bun lockfile plus a bun declaration is bun, on the bun runtime", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "bun");
				assert.strictEqual(detected.runtime, "bun");
				// The binary lockfile is its own evidence spelling — this tree carries
				// bun.lockb, not bun.lock, and the report says which one it saw.
				assert.strictEqual(detected.evidence, "bun.lockb");
			}),
		);
	});
});

describe("PackageManagerDetector — a STRAY yarn.lock in a standalone repo", () => {
	layer(
		detectorOver({
			"/repo/yarn.lock": "",
			"/repo/package.json": JSON.stringify({ name: "solo", version: "1.0.0" }),
		}),
	)((it) => {
		it.effect("the manifest conjunction holds in the standalone tier too", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				// A stray yarn.lock is the classic false signal, and it is exactly as
				// common in a single-package repo as in a workspace. The standalone tier
				// mirrors the workspace tier's conjunction rather than inventing a
				// second, looser rule inside one service.
				const error = yield* Effect.flip(detector.detect("/repo"));
				assert.instanceOf(error, PackageManagerDetectionError);
			}),
		);
	});
});

// ── the manifest-only tier: declared, but not yet installed ────────────────

describe("PackageManagerDetector — declared but never installed", () => {
	layer(detectorOver({ "/repo/package.json": corepack("pnpm@10.33.0") }))((it) => {
		it.effect("a packageManager declaration with no lockfile anywhere is honest evidence", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				// A fresh clone before the first install has no lockfile of its own to
				// read, but the manifest says plainly which manager is meant to run.
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				assert.deepStrictEqual(detected.version, Option.some("10.33.0"));
				assert.strictEqual(detected.evidence, "package.json#packageManager");
			}),
		);
	});
});

describe("PackageManagerDetector — devEngines alone, no lockfile", () => {
	layer(
		detectorOver({
			"/repo/package.json": manifestWith({ devEngines: { packageManager: { name: "bun", version: "1.2.0" } } }),
		}),
	)((it) => {
		it.effect("devEngines is a declaration too, and carries the runtime with it", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "bun");
				assert.strictEqual(detected.runtime, "bun");
				assert.deepStrictEqual(detected.version, Option.some("1.2.0"));
				assert.strictEqual(detected.evidence, "package.json#devEngines.packageManager");
			}),
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
	)((it) => {
		it.effect("the evidence names the field that supplied the NAME — devEngines", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				// devEngines is authoritative for the name, so it is the evidence even
				// though the VERSION came from the top-level field. Version provenance
				// is deliberately not carried: it follows the documented two-field
				// precedence, which is a rule, not a probe.
				assert.strictEqual(detected.evidence, "package.json#devEngines.packageManager");
				assert.deepStrictEqual(detected.version, Option.some("10.33.0"));
			}),
		);
	});
});

describe("PackageManagerDetector — a manifest naming a manager we do not know", () => {
	layer(detectorOver({ "/repo/package.json": corepack("cnpm@9.0.0") }))((it) => {
		it.effect("refuses rather than falling back to npm", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				// THE REFUSAL CONTRACT. Both consumer reimplementations invented a
				// default here and they invented DIFFERENT ones — one "npm", one "pnpm"
				// — which is precisely why a library must not make this call. A caller
				// that wants a default writes `Effect.orElseSucceed` where a reader can
				// see it.
				const error = yield* Effect.flip(detector.detect("/repo"));
				assert.instanceOf(error, PackageManagerDetectionError);
			}),
		);
	});
});

describe("PackageManagerDetector — the workspace tier still wins", () => {
	layer(
		detectorOver({
			"/repo/pnpm-workspace.yaml": "packages: []\n",
			"/repo/package-lock.json": "{}",
			"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
		}),
	)((it) => {
		it.effect("standalone probes run only after every workspace marker has missed", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				// If the standalone tier ran first, this stray package-lock.json would
				// turn a pnpm workspace into an npm repo.
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
			}),
		);
	});
});

describe("PackageManagerDetector — a corrupt root package.json", () => {
	layer(detectorOver({ "/repo/package.json": "{ not json", "/repo/pnpm-workspace.yaml": "packages: []\n" }))((it) => {
		it.effect("fails typed rather than degrading to 'no manager declared'", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				// A manifest that is PRESENT but unparseable is a corrupt-manifest
				// condition, not a missing hint. Swallowing it would report a pnpm
				// workspace with no version and hide a genuinely broken manifest — the
				// same silent-degradation shape the multi-document lockfile bug had.
				const error = yield* Effect.flip(detector.detect("/repo"));
				assert.instanceOf(error, WorkspaceManifestError);
				assert.strictEqual(error.kind, "decode");
				assert.strictEqual(error.packageJsonPath, "/repo/package.json");
			}),
		);
	});
});

describe("PackageManagerDetector — a root package.json that is not an object", () => {
	layer(detectorOver({ "/repo/package.json": "[1, 2, 3]", "/repo/pnpm-workspace.yaml": "packages: []\n" }))((it) => {
		it.effect("valid JSON that is not an object is still a decode failure", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const error = yield* Effect.flip(detector.detect("/repo"));
				assert.instanceOf(error, WorkspaceManifestError);
				assert.strictEqual(error.kind, "decode");
			}),
		);
	});
});

describe("PackageManagerDetector — no root package.json at all", () => {
	layer(detectorOver({ "/repo/pnpm-workspace.yaml": "packages: []\n" }))((it) => {
		it.effect("an ABSENT manifest is not an error — it is simply no hint", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				assert.isTrue(Option.isNone(detected.version));
			}),
		);
	});
});

describe("PackageManagerDetector — a malformed corepack field", () => {
	layer(
		detectorOver({
			"/repo/pnpm-workspace.yaml": "packages: []\n",
			"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0", packageManager: "pnpm" }),
		}),
	)((it) => {
		it.effect("an unparseable packageManager spec is simply no version", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				assert.isTrue(Option.isNone(detected.version));
			}),
		);
	});
});

// ── devEngines.packageManager ──────────────────────────────────────────────
//
// Corepack reads BOTH the top-level `packageManager` and `devEngines.packageManager`,
// and they are not interchangeable:
//
//   * `devEngines.packageManager.name` is authoritative for the NAME — corepack
//     errors (per `onFail`) when the top-level field disagrees with it.
//   * the top-level `packageManager` is authoritative for the exact VERSION — it
//     is the field that carries the integrity hash.
//
// Lockfile evidence remains the primary signal for which manager actually ran;
// these fields only disambiguate the name and supply the version.

describe("PackageManagerDetector — devEngines alone", () => {
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
	)((it) => {
		it.effect("a devEngines-only manifest is visible to the version half of detection", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				// Before devEngines support this was Option.none() — the whole point.
				// And the hash is `integrity`, not part of the version.
				assert.deepStrictEqual(detected.version, Option.some("11.11.0"));
			}),
		);
	});
});

describe("PackageManagerDetector — both fields, the effected repo's own shape", () => {
	// Verbatim from this repository's root package.json: both fields present, the
	// same version, and BOTH carrying the +sha512 hash.
	const spec = "11.11.0+sha512.4463f65fd80ed80d69bc1d4bf163ee94f605c7380fc318bb5b2ebe15f8cd12d49c";
	layer(
		detectorOver({
			"/repo/pnpm-workspace.yaml": "packages: []\n",
			"/repo/package.json": manifestWith({
				packageManager: `pnpm@${spec}`,
				devEngines: { packageManager: { name: "pnpm", version: spec, onFail: "ignore" } },
			}),
		}),
	)((it) => {
		it.effect("agreeing fields report the version once, with the hash stripped", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				// The hash is `integrity`, not part of the version — a devEngines version
				// carrying one must normalize exactly as the top-level field's does, or
				// the two disagree on a repo where they are literally identical.
				assert.deepStrictEqual(detected.version, Option.some("11.11.0"));
			}),
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
	)((it) => {
		it.effect("the top-level packageManager wins the version — it carries the hash", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.deepStrictEqual(detected.version, Option.some("10.1.0"));
			}),
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
	)((it) => {
		it.effect("devEngines is believed, so yarn's version is not attributed to pnpm", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				// devEngines names pnpm but carries no version, and the packageManager
				// field names a DIFFERENT manager — so there is no pnpm version to report.
				assert.isTrue(Option.isNone(detected.version));
			}),
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
	)((it) => {
		it.effect("a yarn.lock plus a yarn corepack field is NOT yarn when devEngines says pnpm", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				// devEngines.packageManager.name is authoritative for the name, so the
				// yarn conjunction does not fire and detection falls through to the npm
				// `workspaces` fallback. Corepack would have ERRORED on this manifest.
				assert.strictEqual(detected.name, "npm");
				assert.isTrue(Option.isNone(detected.version));
			}),
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
	)((it) => {
		it.effect("the conjunction needs a NAME, not a version", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				// The old code keyed the bun/yarn conjunction off `Option.isSome(version)`,
				// which conflated "the manifest names bun" with "the manifest gives bun's
				// version". A devEngines entry with no version names bun perfectly well.
				assert.strictEqual(detected.name, "bun");
				assert.strictEqual(detected.runtime, "bun");
				assert.isTrue(Option.isNone(detected.version));
			}),
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
	)((it) => {
		it.effect("no version is reported — the field does not name the detected manager", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				// The same discipline the packageManager field already had: a yarn version
				// in a pnpm workspace tells us nothing about pnpm.
				assert.isTrue(Option.isNone(detected.version));
			}),
		);
	});
});

// ── malformed devEngines: ignore the field, never fail detection ───────────

describe("PackageManagerDetector — devEngines is not an object", () => {
	layer(
		detectorOver({
			"/repo/pnpm-workspace.yaml": "packages: []\n",
			"/repo/package.json": manifestWith({ packageManager: "pnpm@10.33.0", devEngines: "pnpm" }),
		}),
	)((it) => {
		it.effect("the bad field is ignored and packageManager still supplies the version", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				assert.deepStrictEqual(detected.version, Option.some("10.33.0"));
			}),
		);
	});
});

describe("PackageManagerDetector — devEngines.packageManager is an ARRAY", () => {
	layer(
		detectorOver({
			"/repo/pnpm-workspace.yaml": "packages: []\n",
			// NO top-level packageManager: the array is the only version source, so if
			// it were honoured the version WOULD be reported. That is what makes this
			// test discriminating — the obvious wrong implementation is
			// `Array.isArray(slot) ? slot[0] : slot`, and an array whose element names
			// a manager we do not detect would be silently ignored anyway.
			"/repo/package.json": manifestWith({
				devEngines: { packageManager: [{ name: "pnpm", version: "9.9.9" }] },
			}),
		}),
	)((it) => {
		it.effect("arrays are unsupported in this slot — corepack falls back, so do we", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				// Taking the array's first element would report 9.9.9 here.
				assert.isTrue(Option.isNone(detected.version));
			}),
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
	)((it) => {
		it.effect("a name carrying @ is invalid — the field is ignored, not fatal", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				assert.deepStrictEqual(detected.version, Option.some("10.33.0"));
			}),
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
	)((it) => {
		it.effect("the name is kept and only the unusable version is dropped", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "pnpm");
				// A range is not a version — corepack will not run one either — but it
				// does not invalidate the NAME, which is still a good disambiguator.
				assert.isTrue(Option.isNone(detected.version));
			}),
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
	)((it) => {
		it.effect("a non-string name falls back to packageManager, keeping bun detectable", () =>
			Effect.gen(function* () {
				const detector = yield* PackageManagerDetector;
				// The invariant: a malformed manifest HINT must never turn a detectable
				// workspace into a detection error.
				const detected = yield* detector.detect("/repo");
				assert.strictEqual(detected.name, "bun");
				assert.deepStrictEqual(detected.version, Option.some("1.2.0"));
			}),
		);
	});
});
