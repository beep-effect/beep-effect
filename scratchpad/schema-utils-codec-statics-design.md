# Selectable SchemaUtils statics

Status: design review  
Date: 2026-08-30

## Recommendation

A selected-static API is the right direction for `@beep/schema/SchemaUtils`.
For ordinary schema values, this:

```ts
const MyString = S.String.pipe(
  S.brand("MyString"),
  SchemaUtils.withCodecStatics(["decodeEffect"])
);
```

can give `MyString.decodeEffect` the same hoisting and steady-state
performance characteristics as:

```ts
const MyString = S.String.pipe(S.brand("MyString"));

const decodeMyStringEffect = S.decodeEffect(MyString);
```

That answer depends on one implementation detail. The helper must store the
runner returned by `S.decodeEffect(schema)` exactly once:

```ts
decodeEffect: S.decodeEffect(schema)
```

It must not call `S.decodeEffect(schema)` inside the attached runner:

```ts
decodeEffect: (input, options) =>
  S.decodeEffect(schema)(input, options)
```

The second version recreates the public adapter on every invocation.

The selected API should focus on direct schema runners. JSON-string behavior
should remain an explicit schema transformation, `toStandardSchemaV1` should
have a separate combinator, and direct class statics need special treatment.

## What Effect v4 caches

In the pinned Effect version, each `S.decodeEffect(schema)` call returns a new
adapter function. The underlying schema parser compiler is globally memoized
by AST identity. The returned adapter also caches its parser after its first
invocation.

Therefore:

```ts
S.decodeEffect(MyString) === S.decodeEffect(MyString);
// false
```

If both adapters are created at module scope, however, they have effectively
the same performance profile:

- Each adapter is allocated once.
- Each adapter has its own lazy parser slot.
- Both eventually reach the same AST-keyed parser cache.
- The attached static adds one ordinary property lookup.
- Static attachment happens once during module evaluation.

The direct members currently attached by `withEffectCodecStatics`, including
`decodeEffect`, `decodeUnknownEffect`, and `encodeEffect`, already receive this
benefit. The current implementation constructs them once in
`packages/foundation/modeling/schema/src/SchemaUtils/codecStatics.ts`.

The selector will not make an attached `decodeEffect` faster than the current
attached `decodeEffect`. Its main benefits are:

- Fewer adapter closures allocated during module initialization.
- A smaller and more intentional public API.
- Fewer property collisions.
- Less opportunity to call the wrong runner.
- A declaration of which boundaries a schema is intended to serve.

Unused attached runners do not necessarily compile a complete parser
immediately because Effect's runner adapters are lazy. The current broad
groups still allocate wrappers and properties for every runner.

## Proposed API

Both data-last and data-first forms are useful:

```ts
const MySchema = schema.pipe(
  SchemaUtils.withCodecStatics([
    "is",
    "decodeUnknownEffect",
    "encodeEffect",
  ])
);
```

```ts
const MySchema = SchemaUtils.withCodecStatics(schema, [
  "is",
  "decodeUnknownEffect",
  "encodeEffect",
]);
```

Conceptually, the overloads are:

```ts
withCodecStatics(keys)(schema);
withCodecStatics(schema, keys);
```

The key tuple should use a `const` type parameter so inline arrays retain their
literal members without `as const`:

```ts
type WithCodecStatics<
  Sch extends S.Constraint,
  Keys extends readonly CodecStaticKey[],
> = Sch & Pick<CodecStaticsFor<Sch>, Keys[number]>;
```

### Implementation requirements

Build only the selected values. The implementation must not construct an
object containing every possible static and then pick the requested keys.
That would preserve the allocation work the selector is meant to remove. Each
key needs a factory that runs only when that key is selected.

Preserve the exact Effect signatures. For example, `decodeEffect` should use
the exact return type of `S.decodeEffect(schema)`. This preserves the schema's
encoded input, decoded output, `SchemaError`, decoding services, and optional
`SchemaAST.ParseOptions`.

Reject incompatible selections. `decodeEffect` works for schemas with
decoding services. `decodeResult`, `decodeOption`, `decodeSync`,
`decodePromise`, and `decodeExit` require service-free decoding. The selector
should reject a key whose runner cannot interpret the supplied schema.

Reject collisions instead of overwriting. Selection makes collisions less
likely, but it does not prevent a selected key from colliding. The current
`withStatics` replaces a configurable property with a different value. The
canonical selected-static helper should instead:

- Skip an existing property only when the same helper installed it.
- Reject any other existing selected key.
- Avoid last-write-wins behavior for schema runners.

Define attached properties as non-enumerable and read-only. Codec runners are
companion capabilities, not schema data.

Deduplicate or reject repeated keys. `["is", "is"]` should not compile two
guards or attempt two definitions.

### Naming

Once the registry includes `is`, assertions, equivalence, arbitrary
derivation, and Standard Schema conversion, it is broader than a codec
registry. A broad helper could be called `withSchemaStatics`, while
`withCodecStatics` could remain limited to decode and encode runners. A single
registry is still workable, but the name should match what it contains.

## JSON-string boundaries

The JSON-specific runner variants are the most serious part of the current
design.

Given:

```ts
const MyStruct = S.Struct({
  prop: S.String,
});

const MyStructJson = S.fromJsonString(MyStruct).pipe(
  SchemaUtils.withEffectCodecStatics
);
```

`MyStructJson` already has the following boundary:

```ts
Encoded = string
Type = { readonly prop: string }
```

The correct generic runner is therefore:

```ts
MyStructJson.decodeUnknownEffect('{"prop":"foo"}');
// Effect that succeeds with { prop: "foo" }
```

The current JSON-specific static effectively constructs:

```ts
S.decodeUnknownEffect(
  S.fromJsonString(MyStructJson)
);
```

That is equivalent to:

```ts
S.fromJsonString(
  S.fromJsonString(MyStruct)
);
```

A normally encoded JSON object string is no longer enough. A successful input
would need to be a JSON string containing another JSON string:

```ts
'"{\\"prop\\":\\"foo\\"}"'
```

Passing `{ prop: "foo" }` fails even earlier because the outer encoded
boundary expects a string.

Selective attachment makes the wrong method less available, but the stronger
design is to omit every `*FromJsonString` runner name from the general static
registry. JSON should remain visible as a schema transformation:

```ts
const MyStructJson = S.fromJsonString(MyStruct).pipe(
  SchemaUtils.withCodecStatics([
    "decodeUnknownEffect",
    "encodeEffect",
  ])
);
```

The composition is then explicit:

```text
MyStruct
  encoded as object
      -> S.fromJsonString
MyStructJson
  encoded as string
      -> decodeUnknownEffect
MyStruct
```

A schema either has a JSON-string encoded boundary or it does not. No separate
JSON runner family is needed.

## Parse options and JSON options

`SchemaAST.ParseOptions` can already be passed when invoking a compiled
runner:

```ts
MyStructJson.decodeUnknownEffect(json, {
  onExcessProperty: "error",
});
```

This does not require rebuilding the schema or runner.

The JSON options are different:

- `reviver` configures the `S.fromJsonString` decoding transformation.
- `replacer` and `space` configure its encoding transformation.
- The transformation captures them when `S.fromJsonString(schema, options)`
  constructs the schema.

A fully dynamic per-call `reviver`, `replacer`, or `space` conflicts with a
single hoisted codec. Changing those values constructs a different schema
transformation.

The current implementation combines JSON construction options and parser
invocation options into one object. It then constructs
`S.fromJsonString(...)` and its runner inside every call. Those JSON-specific
statics do not receive the same hoisting benefit as the direct runners.

Prefer named, module-scoped JSON schema variants:

```ts
const MyStructJson = S.fromJsonString(MyStruct).pipe(
  SchemaUtils.withCodecStatics([
    "decodeUnknownEffect",
    "encodeEffect",
  ])
);

const MyStructPrettyJson = S.fromJsonString(MyStruct, {
  space: 2,
}).pipe(
  SchemaUtils.withCodecStatics(["encodeEffect"])
);

const MyStructRevivedJson = S.fromJsonString(MyStruct, {
  reviver,
}).pipe(
  SchemaUtils.withCodecStatics(["decodeUnknownEffect"])
);
```

If an application needs arbitrary dynamic JSON options, expose an explicitly
allocating factory:

```ts
const makeMyStructJsonCodec = (
  options?: NonNullable<Parameters<typeof S.fromJsonString>[1]>
) =>
  S.fromJsonString(MyStruct, options).pipe(
    SchemaUtils.withCodecStatics([
      "decodeUnknownEffect",
      "encodeEffect",
    ])
  );
```

Calling code can hoist or cache the factory result when its options are stable.
The `make` name signals that a new schema and adapter may be constructed.

## Derived helpers

`toArbitrary` is reasonable as a selected convenience static. Its expensive
internal derivation is already memoized by schema AST. Attaching it once still
avoids recreating the final factory wrapper.

`equivalence` is also reasonable. Effect internally memoizes equivalence
derivation by AST, and the repo's dual equivalence wrapper adds a useful call
shape.

For assertions, keep the Effect name `asserts` if the behavior and assertion
signature match `S.asserts`. Calling it `assert` suggests a different API.
There is also a performance wrinkle. `S.asserts` is uncurried. The current
static calls `S.asserts(schema, input)` on every invocation, so it does not
bind a returned compiler in the same way as `S.decodeEffect(schema)`. A
genuinely hoisted assertion would need a precompiled type-side decoder and
tests proving identical error behavior.

Exclude `toStandardSchemaV1` from the selector. It is not an ordinary runner:

- It accepts configuration.
- It adds `~standard` to the schema.
- It mutates and returns the schema.
- Once a schema has a validator, later option changes may not replace it.

A dedicated combinator is clearer:

```ts
const MyString = S.String.pipe(
  S.brand("MyString"),
  SchemaUtils.withCodecStatics([
    "is",
    "decodeUnknownEffect",
  ]),
  SchemaUtils.withStandardSchemaV1({
    // Fixed module-scope configuration.
  })
);
```

## Class schemas

### Nested utilities

For a nested class property, this is the simplest safe design:

```ts
export class MyClass extends S.Class<MyClass>($I`MyClass`)({}) {
  static readonly utils = SchemaUtils.classStatics(this, [
    "decodeEffect",
    "is",
  ]);
}

const value = MyClass.make({});

MyClass.utils.is(value);
MyClass.utils.decodeEffect({});
```

The nested object has several advantages:

- TypeScript sees `utils` because the class declares it.
- No constructor mutation is required.
- Only one class static key can collide.
- The utility object can be frozen.
- Its selected runners are constructed once during static initialization.
- `this` is the completed concrete `MyClass` constructor at that point.

This literal form cannot produce class-bound runners under ordinary JavaScript
semantics:

```ts
static readonly utils =
  SchemaUtils.classStatics(["decodeEffect", "is"]);
```

The right-hand expression receives no reference to the class being assigned
to. When this runs later:

```ts
MyClass.utils.is(value);
```

the JavaScript `this` inside `is` is `MyClass.utils`, not `MyClass`. A proxy has
the same limitation. The helper cannot infer the owning class from the field
assignment.

That exact spelling is possible only if the returned utilities are unbound and
accept the class at every call:

```ts
MyClass.utils.is(MyClass, value);
```

Alternatively, another mechanism must supply the owner, such as a field
decorator, a getter, or an explicit `this` argument. For bound runners, the
minimal form is:

```ts
static readonly utils =
  SchemaUtils.classStatics(this, ["decodeEffect", "is"]);
```

Class fields do not support destructuring declarations. This is invalid:

```ts
static readonly { decodeEffect, is } =
  SchemaUtils.classStatics(this, ["decodeEffect", "is"]);
```

A static block can flatten the values at runtime:

```ts
static {
  Object.assign(
    this,
    SchemaUtils.classStatics(this, ["decodeEffect", "is"])
  );
}
```

TypeScript will not add `decodeEffect` and `is` to the exported static type of
`MyClass`, however. Consumers still receive property-not-found errors unless
the class declares every property.

### Flat, typed class statics

If `MyClass.decodeEffect` is important enough to justify a specialized helper,
the selected-static helper must participate in the heritage expression:

```ts
export class MyClass extends SchemaUtils.withClassCodecStatics(
  S.Class<MyClass>($I`MyClass`)({}),
  ["decodeEffect", "is"]
) {}

MyClass.is(MyClass.make({}));
MyClass.decodeEffect({});
```

TypeScript can preserve the constructor type and selected-static intersection
in this form. The implementation must be lazy and receiver-bound. It must not
eagerly run `S.decodeEffect` against the anonymous base returned by
`S.Class(...)`.

Effect's class schema factory determines and memoizes the concrete constructor
the first time its AST is accessed. Testing confirmed the distinction:

- Eager compilation against the base decoded an instance of Effect's anonymous
  base constructor. The value was not an instance of the final class.
- A lazy getter compiled against the getter's `this` and decoded a proper
  instance of the final class.

The flat helper therefore needs to install accessors conceptually resembling:

```ts
Object.defineProperty(Base, "decodeEffect", {
  get() {
    const receiver = this;
    const runner = S.decodeEffect(receiver);

    Object.defineProperty(receiver, "decodeEffect", {
      value: runner,
      enumerable: false,
      writable: false,
      configurable: false,
    });

    return runner;
  },
});
```

The getter is inherited by `MyClass`. Its first access receives `MyClass` as
`this`, constructs the runner against the final class, and replaces itself on
`MyClass` with the compiled runner.

The data-first overload of the general helper could potentially provide this
shape:

```ts
export class MyClass extends SchemaUtils.withCodecStatics(
  S.Class<MyClass>($I`MyClass`)({}),
  ["decodeEffect", "is"]
) {}
```

That requires a new attachment implementation. The current `withStatics`
eagerly evaluates the statics object and reads accessor values while inspecting
collisions, so it cannot provide these lazy class semantics unchanged.

Calling the helper after a class declaration attaches the runtime properties
safely:

```ts
SchemaUtils.withCodecStatics(MyClass, ["decodeEffect", "is"]);
```

The ignored return value cannot widen the exported `typeof MyClass`. That is
why the heritage form matters for flat statics.

The nested `utils` object remains the preferred default. The lazy heritage
helper is viable if the extra `.utils` is objectionable enough to justify the
added machinery.

## Mutation warning

The current `withStatics` mutates the schema it receives. Therefore:

```ts
const MySchema = S.String.pipe(
  SchemaUtils.withCodecStatics(["is"])
);
```

would attach the property to Effect's shared `S.String` singleton if the new
helper keeps the current mutation behavior.

A branded or otherwise derived schema is safer because it creates a local
schema value first:

```ts
const MyString = S.String.pipe(
  S.brand("MyString"),
  SchemaUtils.withCodecStatics(["is"])
);
```

The helper should either document that it mutates and require a locally owned
schema value, or rebuild a distinct schema before attaching. Rebuilding needs
special treatment for `S.Class`, which is another reason the non-mutating
nested `utils` object is attractive for classes.

## Promoting `no-inline-schema-compile`

Promoting `beep/no-inline-schema-compile` to an error makes sense after the
ergonomic replacement lands.

The rule's current medium-severity message says the compiled function is
rebuilt on every call. In Effect v4, a repeated call with the same schema AST
recreates adapter closures and re-enters a globally memoized parser cache. It
does not necessarily rebuild the whole structural parser after the first
compilation.

The distinction is:

```ts
S.decodeResult(ObjectRefSchema)(value);
```

This form:

- Recreates the public adapter stack.
- Re-enters the AST parser cache.
- Should still be hoisted.

```ts
S.decodeResult(
  S.fromJsonString(ObjectRefSchema, dynamicOptions)
)(value);
```

This form:

- Creates a new schema and AST.
- Creates a new adapter.
- Cannot reuse the previous AST-keyed compiler entry.
- Is the more serious case.

The warning in `packages/foundation/modeling/rdf/src/ProvRdf.ts` should still be
fixed with a module-scoped runner:

```ts
const decodeObjectRef = S.decodeResult(ObjectRefSchema);
```

After the selector exists, attaching the runner at the schema's owning
declaration is another option:

```ts
const ObjectRefSchemaWithCodec = ObjectRefSchema.pipe(
  SchemaUtils.withCodecStatics(["decodeResult"])
);
```

Before promoting the rule, ensure that it:

- Understands the new selected-static forms.
- Does not treat the current dynamic JSON helper as compliant merely because
  the `S.decodeEffect(...)` call moved into `SchemaUtils`.
- Handles `asserts` specially or provides a genuinely compiled assertion
  helper.
- Uses distinct messages for adapter recreation and new-AST recompilation.

## Proposed end state

1. Add a typed per-key factory shared by all APIs.

   ```ts
   SchemaUtils.makeSchemaStatics(schema, keys);
   ```

   It returns a frozen selected object and does not mutate the schema.

2. Add a dual attachment helper for locally owned non-class schemas.

   ```ts
   schema.pipe(SchemaUtils.withSchemaStatics(keys));
   SchemaUtils.withSchemaStatics(schema, keys);
   ```

3. Use the simple class form by default.

   ```ts
   static readonly utils =
     SchemaUtils.makeSchemaStatics(this, keys);
   ```

4. Optionally add a lazy heritage helper for direct class statics.

   ```ts
   class MyClass extends SchemaUtils.withClassSchemaStatics(
     S.Class<MyClass>(identifier)(fields),
     keys
   ) {}
   ```

5. Do not add general `*FromJsonString` statics. Use `S.fromJsonString` to make
   the boundary explicit, then attach ordinary runners.

6. Add a separate `withStandardSchemaV1` combinator.

7. Reject collisions for selected direct statics.

This design keeps the terse API while preserving the schema's encoded-boundary
meaning. It also gives developers a mechanical fix for the eventual hard lint
error without requiring a wall of hand-written class fields.
