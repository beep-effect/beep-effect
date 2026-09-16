# @effect/bun-test

A set of helpers for testing [Effect](https://effect.website) programs with
Bun's native [`bun:test`](https://bun.sh/docs/cli/test) runner.

The experimental API follows
[`@effect/vitest`](https://www.npmjs.com/package/@effect/vitest)
(`it.effect`, `it.live`, `layer`, `it.prop`, `flakyTest`, …).
It is not a qualified drop-in replacement. The local schema pilot found missing
within-test module reset and inherited suite-timeout behavior. See
[PILOT-RESULTS.md](PILOT-RESULTS.md) before using it for comparisons or migration.
The package name below is illustrative; this scratchpad has not been promoted
to a canonical workspace package.

## Usage

```ts
import { assert, describe, expect, it, layer } from "@beep/effect-bun-test";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

class Foo extends Context.Service<Foo, "foo">()("Foo") {
  static layer = Layer.succeed(Foo)("foo")
}

it.effect("plain effect test", () => Effect.sync(() => expect(1).toEqual(1)))

layer(Foo.layer)("with a shared layer", (it) => {
  it.effect("has Foo in context", 
    Effect.fnUntraced(function*() {
      const foo = yield* Foo
      assert.strictEqual(foo, "foo")
    }))
})
```

Run the adapter smoke suite from the repository root:

```sh
bun test scratchpad/test/bun-test/index.test.ts
```

The qualification fixtures are isolated subprocess controls, including deliberate
failures. Run them individually using their [expected outcomes](../test/bun-test/qualification/README.md),
not as an ordinary all-green suite.

## Timeouts interrupt fibers

Bun's own test timeout fails the test but cannot stop the Effect running
behind it, so finalizers would never run. The wrapper owns the timeout
instead: when it fires, the test context's `AbortSignal` aborts, the Effect
fiber is interrupted, and its finalizers run — Bun keeps a slightly larger
timeout as a backstop.

## Differences from `@effect/vitest`

- **`addEqualityTesters`** is a no-op — `bun:test`'s `expect` does not expose
  `addEqualityTesters`. Compare `Equal` values with `Equal.equals` or the
  helpers in `@effect/bun-test/utils`.
- **`TestContext`** — Bun doesn't pass a context object to test functions, so
  the wrapper synthesises one (`signal`, `onTestFinished`, `onTestFailed`).
- **`assert`** — Vitest re-exports chai's `assert`; this package ships a small
  subset built on `node:assert`, with `deepInclude` delegated to the installed
  standalone Chai implementation. A future package must declare that dependency.
- **Default timeout** — configure `setDefaultTimeout` from this adapter before
  collection so its abort timer and Bun's timeout agree. Inherited suite
  timeouts are not yet preserved.
- **Module reset** — the exported native `vi` has no `resetModules` method.
- **Completion callbacks** — errors now fail the test and later cleanup still
  runs. Callback ordering is not yet equivalent to Vitest. A completion-hook
  failure after a passing body does not invoke registered failure observers.
- **Unnamed layers** — the lifetime wrapper adds an anonymous suite; full suite
  hierarchy and concurrency parity have not been qualified.
