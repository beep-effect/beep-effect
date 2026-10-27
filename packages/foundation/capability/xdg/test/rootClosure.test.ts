import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { sourceModules } from "./support/rawModules.ts";

// Runtime import specifiers of one module: `import`/`export ... from "x"` and the
// bare side-effect form `import "x"`. `import type` and `export type` statements
// are erased at compile time and never load anything.
const runtimeSpecifier = /^\s*(?:(?:import|export)\s+(?!type\b)[^;"]*?\bfrom\s+|import\s+)"([^"]+)"/gm;

const specifiersOf = (source: string): ReadonlyArray<string> =>
  A.map(A.fromIterable(Str.matchAll(runtimeSpecifier)(source)), (match) => match[1] ?? "");

const isRelative = (specifier: string): boolean => Str.startsWith("./")(specifier) || Str.startsWith("../")(specifier);

/** Resolve a relative specifier against the importing module's directory, keyed below `src/`. */
const resolveRelative = (importer: string, specifier: string): string =>
  pipe(
    Str.split("/")(specifier),
    A.reduce(A.dropRight(Str.split("/")(importer), 1), (segments, part) =>
      Match.value(part).pipe(
        Match.when(".", () => segments),
        Match.when("..", () => A.dropRight(segments, 1)),
        Match.orElse(() => A.append(segments, part))
      )
    ),
    A.join("/")
  );

/** The source of one `src` module; a resolved edge that names no module fails the suite loudly. */
const sourceOf = (key: string): string =>
  R.get(sourceModules, key).pipe(
    O.getOrThrowWith(() => new globalThis.Error(`root closure: no src module "${key}" for a resolved import`))
  );

/** The `src` modules a runtime import of `entry` loads, and the bare packages they reach. */
const closure = (entry: string) => {
  const visit = (
    pending: ReadonlyArray<string>,
    modules: HashSet.HashSet<string>,
    packages: HashSet.HashSet<string>
  ): { readonly modules: HashSet.HashSet<string>; readonly packages: HashSet.HashSet<string> } =>
    A.match(pending, {
      onEmpty: () => ({ modules, packages }),
      onNonEmpty: ([next, ...rest]) => {
        if (HashSet.has(modules, next)) return visit(rest, modules, packages);
        const specifiers = specifiersOf(sourceOf(next));
        const relative = A.filter(specifiers, isRelative);
        const bare = A.filter(specifiers, (specifier) => !isRelative(specifier));
        return visit(
          A.appendAll(
            rest,
            A.map(relative, (specifier) => resolveRelative(next, specifier))
          ),
          HashSet.add(modules, next),
          A.reduce(bare, packages, (set, specifier) => HashSet.add(set, specifier))
        );
      },
    });
  return visit([entry], HashSet.empty<string>(), HashSet.empty<string>());
};

describe("@beep/xdg root closure walker", () => {
  it.effect("follows side-effect imports and parent-relative specifiers", () =>
    Effect.sync(() => {
      const source = 'import "./side.ts";\nimport { a } from "../up.ts";\nimport type { T } from "./typeOnly.ts";\n';
      expect(specifiersOf(source)).toEqual(["./side.ts", "../up.ts"]);
      expect(resolveRelative("internal/x.ts", "../XdgConfig.ts")).toBe("XdgConfig.ts");
      expect(resolveRelative("internal/x.ts", "./y.ts")).toBe("internal/y.ts");
      expect(resolveRelative("Xdg.ts", "./Absolute.ts")).toBe("Absolute.ts");
    })
  );

  it.effect("fails loudly on a resolved edge that names no src module", () =>
    Effect.sync(() => {
      expect(() => sourceOf("missing.ts")).toThrow(/no src module "missing.ts"/);
    })
  );
});

describe("@beep/xdg root closure", () => {
  it.effect("the root barrel never loads XdgConfig, config-file or walker", () =>
    Effect.sync(() => {
      const root = closure("index.ts");
      expect(HashSet.has(root.modules, "XdgBase.ts")).toBe(true);
      expect(HashSet.has(root.modules, "XdgConfig.ts")).toBe(false);
      const packages = pipe(A.fromIterable(root.packages), A.sort(Str.Order));
      expect(A.filter(packages, Str.startsWith("@beep/config-file"))).toEqual([]);
      expect(A.filter(packages, Str.startsWith("@beep/walker"))).toEqual([]);
    })
  );

  it.effect("the XdgConfig subpath is where config-file and walker enter", () =>
    Effect.sync(() => {
      const subpath = closure("XdgConfig.ts");
      expect(HashSet.has(subpath.packages, "@beep/walker/Walker")).toBe(true);
      // XdgConfig imports config-file for types only, so even the subpath does not load it at runtime.
      expect(A.filter(A.fromIterable(subpath.packages), Str.startsWith("@beep/config-file"))).toEqual([]);
    })
  );
});
