import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SchemaDeclarationByName, SchemaDeclarationInvalidError, SchemaDeclarationMissingError, SchemaNameUnknownError, SchemaResolver, SchemaVersionUnresolvableError } from "../../effected/markdown/FrontmatterResolver.ts";

it.effect("declaration failures explain missing, invalid, unknown and unsatisfied versions", () => Effect.sync(() => {
  assert.strictEqual(SchemaDeclarationInvalidError.make({ reason: "bad", value: [] }).message, "invalid $schema declaration: bad");
  assert.strictEqual(SchemaDeclarationMissingError.make().message, "the frontmatter data carries no $schema declaration");
  assert.strictEqual(SchemaNameUnknownError.make({}).message, "the $schema declaration names no registered schema");
  assert.strictEqual(SchemaVersionUnresolvableError.make({ name: "skill" }).message,
    'schema "skill" is registered only with versions; the declaration carries none');
  assert.strictEqual(SchemaVersionUnresolvableError.make({ name: "skill", version: "2" }).message,
    'schema "skill" has no registration matching version "2" exactly');
  assertFailure(SchemaResolver.classify([]), SchemaDeclarationInvalidError.make({
    reason: "the declaration is neither a string nor a mapping", value: []
  }));
}));
it.effect("a hand-built declaration with an illegal version cannot resolve", () => Effect.gen(function* () {
  const resolver = SchemaResolver.fromRegistry({ "skill@2": S.String });
  const error = yield* Effect.flip(resolver.resolve(SchemaDeclarationByName.make({ name: "skill", version: "bad" }), {}));
  assert.strictEqual(error._tag, "SchemaVersionUnresolvableError");
}));
it.effect("canonical version collisions reject the registry while distinct arities stay distinct", () => Effect.gen(function* () {
  assert.throws(() => SchemaResolver.fromRegistry({ "skill@02": S.String, "skill@2": S.Finite }), /collide on version 2/);
  const resolver = SchemaResolver.fromRegistry({ "skill": S.Boolean, "skill@02": S.String, "skill@2.0": S.Finite });
  assert.strictEqual(yield* resolver.resolve(SchemaDeclarationByName.make({ name: "skill" }), {}), S.Boolean);
  assert.strictEqual(yield* resolver.resolve(SchemaDeclarationByName.make({ name: "skill", version: "002" }), {}), S.String);
  assert.strictEqual(yield* resolver.resolve(SchemaDeclarationByName.make({ name: "skill", version: "02.00" }), {}), S.Finite);
}));
