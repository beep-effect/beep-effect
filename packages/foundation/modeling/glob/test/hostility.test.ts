// Task 4, the engine compliance gate (part 2): the hostile-input suite.
// Every case asserts a typed guard trip or total boolean AND completes inside
// the default test timeout — the timeout is the hang detector. Malformed or
// hostile input must never surface as a stack overflow, an OOM, or a hang.

import { expand } from "@beep/glob/internal/braceExpansion";
import { GuardExceeded, InvalidCap } from "@beep/glob/internal/limits";
import { braceExpand, Minimatch } from "@beep/glob/internal/minimatch";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import { assert, describe, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const reasonOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    if (S.is(GuardExceeded)(e)) return e.reason;
    throw e;
  }
  throw new Error("expected a GuardExceeded throw");
};

describe("hostility: pattern length", () => {
  it("rejects a pattern past 64KB typed, with limit and actual populated", () => {
    try {
      new Minimatch(Str.repeat(65_537)("a"));
      assert.fail("expected a GuardExceeded throw");
    } catch (e) {
      assertInstanceOf(e, GuardExceeded);
      const g = e;
      assert.strictEqual(g.reason, "PatternTooLong");
      assert.strictEqual(g.limit, 65_536);
      assert.strictEqual(g.actual, 65_537);
    }
  });

  it("compiles a pattern of exactly 64KB", () => {
    const m = new Minimatch(Str.repeat(65_536)("a"));
    assert.isFalse(m.match("b"));
  });

  it("handles a comment pattern with a 64KB body fast", () => {
    assert.isFalse(new Minimatch(`#${Str.repeat(65_000)("a")}`).match("anything"));
  });
});

describe("hostility: brace expansion", () => {
  it("terminates large singletons and non-advancing numeric ranges through Minimatch", () => {
    for (const source of [
      "{9007199254740992..9007199254740992}",
      "{9007199254740991..9007199254740992}",
      "{9007199254740992..9007199254740994}",
    ]) {
      const matcher = new Minimatch(source);
      assert.isTrue(matcher.match("9007199254740992"));
      assert.isFalse(matcher.match("other"));
    }
    assert.strictEqual(
      reasonOf(() => new Minimatch("{9007199254740992..9007199254740994}", { braceExpandMax: 2 })),
      "ExpansionBudgetExceeded"
    );
  });

  it("rejects overflowing endpoint and count arithmetic typed without hanging", () => {
    const huge = Str.repeat(310)("9");
    const finite = `1${Str.repeat(308)("0")}`;
    for (const source of [
      `{${huge}..${huge}}`,
      `{1..${huge}..${huge}}`,
      `{-${finite}..${finite}}`,
      `{-${finite}..${finite}..${huge}}`,
    ]) {
      try {
        new Minimatch(source);
        assert.fail("expected a GuardExceeded throw");
      } catch (error) {
        assertInstanceOf(error, GuardExceeded);
        assert.strictEqual(error.reason, "ExpansionBudgetExceeded");
        assert.strictEqual(error.limit, 100_000);
        assert.strictEqual(error.actual, Number.POSITIVE_INFINITY);
      }
    }
  });

  it("fails typed on an expansion bomb, never truncating silently", () => {
    // 2^17 = 131_072 > 100_000
    assert.strictEqual(
      reasonOf(() => new Minimatch(Str.repeat(17)("{a,b}"))),
      "ExpansionBudgetExceeded"
    );
  });

  it("fails typed on comma-bearing nesting past the depth cap", () => {
    const bomb = `${Str.repeat(300)("{")}a,b${Str.repeat(300)("}")}`;
    assert.strictEqual(
      reasonOf(() => new Minimatch(bomb)),
      "NestingDepthExceeded"
    );
  });

  it("survives the exponential-blowup shape (lazy post preserved)", () => {
    const m = new Minimatch(`a${Str.repeat(60)("{},")}b`);
    assert.isNotNull(m);
  });

  it("fails typed past the sequential comma-group cap, never a stack overflow", () => {
    assert.strictEqual(
      reasonOf(() => expand(`${Str.repeat(5000)("{a},")}b}`)),
      "NestingDepthExceeded"
    );
  });

  it("shortcuts the CVE-2022-3517 non-closing brace prefix fast", () => {
    // No closing brace: the ReDoS-safe pre-check regex must reject expansion
    // in linear time and treat the pattern as literal.
    const p = `${Str.repeat(20_000)("{")}a`;
    assert.deepStrictEqual(braceExpand(p), [p]);
  });
});

describe("hostility: extglobs", () => {
  it("degrades over-nesting to literal at the default cap, never hanging", () => {
    const p = `${Str.repeat(50)("+(")}a${Str.repeat(50)(")")}`;
    const m = new Minimatch(p);
    assert.isBoolean(m.match(p));
    assert.isBoolean(m.match("a"));
  });

  it("fails typed when a raised extglob cap meets deep nesting", () => {
    const deep = `${Str.repeat(300)("!(")}a${Str.repeat(300)(")")}`;
    assert.strictEqual(
      reasonOf(() => new Minimatch(deep, { maxExtglobRecursion: 400 })),
      "NestingDepthExceeded"
    );
  });

  it("fails typed on the adoption chain that stack-overflows upstream", () => {
    const chain = `${Str.repeat(20_000)("@(")}a${Str.repeat(20_000)(")")}`;
    assert.strictEqual(
      reasonOf(() => new Minimatch(chain)),
      "NestingDepthExceeded"
    );
  });
});

describe("hostility: globstar backtracking", () => {
  it("keeps match total under a long globstar chain (documented false negative)", () => {
    // 500 non-adjacent ** sections exceed maxGlobstarRecursion (200): the
    // engine returns a boolean — upstream's intentional false negative,
    // an acceptable break in correctness for security — and never throws.
    const pattern = A.join(A.replicate("**/x", 500), "/");
    const candidate = A.join(A.replicate("x", 60), "/");
    const m = new Minimatch(pattern);
    assert.isBoolean(m.match(candidate));
  });

  it("matches a 10k-segment path against a simple globstar pattern fast", () => {
    const candidate = A.join(A.replicate("a", 10_000), "/");
    assert.isFalse(new Minimatch("**/x").match(candidate));
    assert.isTrue(new Minimatch("**/a").match(candidate));
  });
});

describe("hostility: optimizer expansion", () => {
  it("rejects the first optimizer-generated alternative above the shared expansion cap", () => {
    try {
      new Minimatch("a/**/../b/c", { optimizationLevel: 2, braceExpandMax: 1 });
      assert.fail("expected a GuardExceeded throw");
    } catch (error) {
      assertInstanceOf(error, GuardExceeded);
      assert.strictEqual(error.reason, "ExpansionBudgetExceeded");
      assert.strictEqual(error.limit, 1);
      assert.strictEqual(error.actual, 2);
    }
    const matcher = new Minimatch("a/**/../b/c", { optimizationLevel: 2, braceExpandMax: 2 });
    assert.strictEqual(matcher.globParts.length, 2);
    assert.isTrue(matcher.match("a/b/c"));
  });

  it("bounds an oversized direct preprocessing input before the pairwise phase", () => {
    const matcher = new Minimatch("*", { braceExpandMax: 1 });
    assert.strictEqual(
      reasonOf(() => matcher.firstPhasePreProcess([["a"], ["b"]])),
      "ExpansionBudgetExceeded"
    );
  });

  it("deduplicates alternatives at the 1,000-pattern ceiling", () => {
    const matcher = new Minimatch("literal");
    assert.deepStrictEqual(matcher.secondPhasePreProcess(A.makeBy(1000, () => ["literal"])), [["literal"]]);
  });

  it("skips every pairwise comparison above the 1,000-pattern ceiling", () => {
    const matcher = new Minimatch("literal");
    matcher.partsMatch = () => assert.fail("large sets must not enter pairwise deduplication");
    const parts = A.makeBy(1001, () => ["literal"]);
    assert.strictEqual(matcher.secondPhasePreProcess(parts), parts);
    assert.strictEqual(parts.length, 1001);
  });
});

describe("hostility: internal cap wiring", () => {
  it("dies on NaN or non-integer caps everywhere they are accepted", () => {
    assert.throws(() => new Minimatch("a", { maxGlobstarRecursion: Number.NaN }), InvalidCap);
    assert.throws(() => new Minimatch("a", { maxGlobstarRecursion: 1.5 }), InvalidCap);
    assert.throws(() => new Minimatch("{a,b}", { braceExpandMax: Number.NaN }), InvalidCap);
    assert.throws(() => new Minimatch("{a,b}", { braceExpandMax: 0 }), InvalidCap);
    assert.throws(() => new Minimatch("+(a)", { maxExtglobRecursion: Number.NaN }), InvalidCap);
    assert.throws(() => new Minimatch("a", { optimizationLevel: 2, braceExpandMax: Number.NaN }), InvalidCap);
  });
});

const underWatchdog = Effect.fnUntraced(
  function* (script: string) {
    const process = yield* ChildProcess.make("bun", ["--eval", script], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "inherit",
    });
    assert.strictEqual(yield* process.exitCode, 0);
  },
  Effect.scoped,
  Effect.timeout("2 seconds")
);

// The watchdog only needs a live ChildProcessSpawner. It spawns without a cwd,
// so the spawner never consults FileSystem; the no-op layer states that the
// subject touches no filesystem, and Path is the pure in-memory service.
const SpawnerLayer = NodeChildProcessSpawner.layer.pipe(Layer.provide([FileSystem.layerNoop({}), Path.layer]));

it.layer(SpawnerLayer, { timeout: "2 seconds" })((it) => {
  it.effect("preserves 4,096 level-two alternatives under a subprocess watchdog", () =>
    underWatchdog(`
      import { Minimatch } from "@beep/glob/internal/minimatch";
      const matcher = new Minimatch("{a,b}".repeat(12), { optimizationLevel: 2 });
      if (matcher.globParts.length !== 4096) throw new Error("alternatives were lost");
      if (!matcher.match("a".repeat(12)) || !matcher.match("b".repeat(12))) throw new Error("missing match");
      if (matcher.match("x".repeat(12))) throw new Error("unexpected match");
    `)
  );

  it.effect("rejects a long ambiguous repetition without exponential backtracking under a subprocess watchdog", () =>
    underWatchdog(`
			import { Minimatch } from "@beep/glob/internal/minimatch";
			const matcher = new Minimatch("*(a|aa)b");
			if (matcher.match("a".repeat(1000) + "c")) throw new Error("unexpected match");
			if (!matcher.match("a".repeat(1000) + "b")) throw new Error("missing match");
		`)
  );

  it.effect("rejects sibling expansion at the first excess member under a subprocess watchdog", () =>
    underWatchdog(`
			import { expand } from "@beep/glob/internal/braceExpansion";
			import { GuardExceeded } from "@beep/glob/internal/limits";
			const source = "{" + Array.from({ length: 128 }, () => "{1..1000}").join(",") + "}";
			try { expand(source, { max: 1000 }); throw new Error("missing guard"); }
			catch (error) {
				if (!(error instanceof GuardExceeded) || error.reason !== "ExpansionBudgetExceeded" || error.actual !== 1001) throw error;
			}
		`)
  );
});
