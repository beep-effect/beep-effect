import {
  Fibered,
  IdentityEntry,
  IdentityRegistry,
  IdentityRegistryConflictError,
  make as makeIdentity,
} from "@beep/identity";
import { $IdentityId } from "@beep/identity/packages";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import * as S from "effect/Schema";

const composer = $IdentityId.create("RegistryTest");
const entry = IdentityEntry.fromComposer(composer, { label: "Registry test" });
const layer = IdentityRegistry.layerLocal([entry]);

const resolve = (ref: Parameters<(typeof IdentityRegistry)["Service"]["resolve"]>[0]) =>
  IdentityRegistry.use((registry) => registry.resolve(ref));

const entryWith = (overrides: Partial<IdentityEntry.Encoded>): IdentityEntry =>
  IdentityEntry.make({
    identity: "@beep/identity/First",
    iri: "https://ns.beep.sh/identity/First",
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
        expect(yield* resolve({ _tag: "identity", value: entry.identity })).toBe(entry);
        expect(yield* resolve({ _tag: "iri", value: entry.iri })).toBe(entry);
        expect(yield* resolve({ _tag: "curie", value: entry.curie })).toBe(entry);
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
        iri: "https://ns.beep.sh/identity/Second",
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
        iri: "https://ns.beep.sh/identity/Second",
      });
      const error = yield* layerConflict([first, second]);

      expect(error).toBeInstanceOf(IdentityRegistryConflictError);
      expect(error.encoding).toBe("curie");
      expect(error.key).toBe(first.curie);
    })
  );

  it("copies literal projections from a bound composer", () => {
    const made = IdentityEntry.fromComposer(composer, { label: "Registry test" });

    expect(made.identity).toBe(composer.identifier);
    expect(made.iri).toBe(composer.iri);
    expect(made.curie).toBe(composer.curie);
    expect(made.fibers).toEqual({ label: "Registry test" });
  });

  it("rejects unbound composers at compile time", () => {
    const rejectUnboundComposer = () => {
      const unbound = makeIdentity("identity").$IdentityId.create("Unbound");
      // @ts-expect-error Registry entries require a composer with IRI and CURIE bindings.
      IdentityEntry.fromComposer(unbound, {});
    };

    expectTypeOf(rejectUnboundComposer).toBeFunction();
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
      const bridged = IdentityEntry.fromComposer(composer, family.project("registry", ["label", "route"]));
      const context = yield* Layer.build(IdentityRegistry.layerLocal([bridged]));
      const registry = Context.get(context, IdentityRegistry);
      const resolved = yield* registry.resolve({ _tag: "identity", value: bridged.identity });

      expect(resolved.fibers).toEqual({ label: "Registry", route: "/identity/registry" });
    })
  );
});
