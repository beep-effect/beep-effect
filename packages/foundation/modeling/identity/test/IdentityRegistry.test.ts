import { Fibered, IdentityEntry, IdentityRegistry, IdentityRegistryConflictError } from "@beep/identity";
import { iri } from "@beep/identity/Registry";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

// An identity entry is built only from a registry binding, never from a composer path.
const boundCode = "@beep/test-runner/Vitest/TestHang";
const boundTerm = { curie: "vitest:TestHang", iri: iri("vitest:TestHang") } as const;
const entry = IdentityEntry.fromBinding(boundCode, boundTerm, { label: "Registry test" });
const layer = IdentityRegistry.layerLocal([entry]);

const resolve = (ref: Parameters<(typeof IdentityRegistry)["Service"]["resolve"]>[0]) =>
  IdentityRegistry.use((registry) => registry.resolve(ref));

const entryWith = (overrides: Partial<IdentityEntry.Encoded>): IdentityEntry =>
  IdentityEntry.make({
    identity: "@beep/identity/First",
    iri: "https://beep-effect.com/ns/identity/First",
    curie: "beep:identity/First",
    fibers: {},
    ...overrides,
  });

const layerConflict = (entries: ReadonlyArray<IdentityEntry>) =>
  Layer.build(IdentityRegistry.layerLocal(entries)).pipe(Effect.flip);

describe("IdentityRegistry", () => {
  it.layer(layer, { timeout: "5 seconds" })("registry lookups", (it) => {
    it.effect(
      "resolves all three exact encodings to the same entry",
      Effect.fnUntraced(function* () {
        const resolved1 = yield* resolve({ _tag: "identity", value: entry.identity });
        expect(resolved1).toBe(entry);
        const resolved2 = yield* resolve({ _tag: "iri", value: entry.iri });
        expect(resolved2).toBe(entry);
        const resolved3 = yield* resolve({ _tag: "curie", value: entry.curie });
        expect(resolved3).toBe(entry);
      })
    );

    it.effect(
      "returns IdentityNotFoundError with the original reference",
      Effect.fnUntraced(function* () {
        const ref = { _tag: "curie", value: "beep:identity/Missing" } as const;
        const error = yield* resolve(ref).pipe(Effect.flip);

        expect(error._tag).toBe("IdentityNotFoundError");
        expect(error.ref).toEqual(ref);
      })
    );
  });

  it.effect(
    "fails layer construction on a duplicate identity",
    Effect.fnUntraced(function* () {
      const first = entryWith({});
      const second = entryWith({
        iri: "https://beep-effect.com/ns/identity/Second",
        curie: "beep:identity/Second",
      });
      const error = yield* layerConflict([first, second]);

      expect(error).toBeInstanceOf(IdentityRegistryConflictError);
      expect(error.encoding).toBe("identity");
      expect(error.key).toBe(first.identity);
    })
  );

  it.effect(
    "fails layer construction on a duplicate IRI",
    Effect.fnUntraced(function* () {
      const first = entryWith({});
      const second = entryWith({ identity: "@beep/identity/Second", curie: "beep:identity/Second" });
      const error = yield* layerConflict([first, second]);

      expect(error).toBeInstanceOf(IdentityRegistryConflictError);
      expect(error.encoding).toBe("iri");
      expect(error.key).toBe(first.iri);
    })
  );

  it.effect(
    "fails layer construction on a duplicate CURIE",
    Effect.fnUntraced(function* () {
      const first = entryWith({});
      const second = entryWith({
        identity: "@beep/identity/Second",
        iri: "https://beep-effect.com/ns/identity/Second",
      });
      const error = yield* layerConflict([first, second]);

      expect(error).toBeInstanceOf(IdentityRegistryConflictError);
      expect(error.encoding).toBe("curie");
      expect(error.key).toBe(first.curie);
    })
  );

  it("copies the binding row and the fibers into the entry", () => {
    expect(entry.identity).toBe(boundCode);
    expect(entry.iri).toBe("https://beep-effect.com/ns/vitest/TestHang");
    expect(entry.curie).toBe(boundTerm.curie);
    expect(entry.fibers).toEqual({ label: "Registry test" });
  });

  it.effect(
    "bridges a Fibered section projection into registry fibers",
    Effect.fnUntraced(function* () {
      const family = Fibered.make({
        base: S.Literals(["registry"]),
        fibers: { registry: S.String },
        section: {
          schema: S.Struct({ label: S.String, route: S.String, internal: S.String }),
          values: {
            registry: { label: "Registry", route: "/identity/registry", internal: "not projected" },
          },
        },
      });
      const bridged = IdentityEntry.fromBinding(boundCode, boundTerm, family.project("registry", ["label", "route"]));
      const context = yield* Layer.build(IdentityRegistry.layerLocal([bridged]));
      const registry = Context.get(context, IdentityRegistry);
      const resolved = yield* registry.resolve({ _tag: "identity", value: bridged.identity });

      expect(resolved.fibers).toEqual({ label: "Registry", route: "/identity/registry" });
    })
  );
});

describe("IdentityRegistry over binding rows", () => {
  const hang = {
    curie: "vitest:TestHang",
    iri: "https://beep-effect.com/ns/vitest/TestHang",
  } as const;

  it("builds an entry from a binding row with no fibers", () => {
    const made = IdentityEntry.fromBinding("@beep/test-runner/Vitest/TestHang", hang);
    expect(made).toStrictEqual(
      IdentityEntry.make({
        identity: "@beep/test-runner/Vitest/TestHang",
        iri: hang.iri,
        curie: hang.curie,
        fibers: {},
      })
    );
  });

  it.effect(
    "resolves a bound code identity in all three encodings",
    Effect.fnUntraced(function* () {
      const layer = IdentityRegistry.layerFromBindings({ "@beep/test-runner/Vitest/TestHang": hang });
      const context = yield* Layer.build(layer);
      const registry = Context.get(context, IdentityRegistry);
      const byCurie = yield* registry.resolve({ _tag: "curie", value: hang.curie });
      expect(byCurie.identity).toBe("@beep/test-runner/Vitest/TestHang");
      const byIri = yield* registry.resolve({ _tag: "iri", value: hang.iri });
      expect(byIri).toBe(byCurie);
    })
  );

  it.effect(
    "resolves a test-runner binding of the generated registry and refuses an unbound identity",
    Effect.fnUntraced(function* () {
      const context = yield* Layer.build(IdentityRegistry.layer);
      const registry = Context.get(context, IdentityRegistry);
      const resolved = yield* registry.resolve({ _tag: "identity", value: "@beep/test-runner/Vitest/TestHang" });
      expect(resolved.curie).toBe(hang.curie);
      expect(resolved.iri).toBe(hang.iri);
      const error = yield* registry
        .resolve({ _tag: "identity", value: "@beep/identity/Term/TermIri" })
        .pipe(Effect.flip);
      expect(error._tag).toBe("IdentityNotFoundError");
    })
  );
});
