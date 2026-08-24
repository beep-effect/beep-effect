import * as O from "effect/Option";
import * as P from "effect/Predicate";

// `annotate` returns the bare codec type and `EntityId.Any` only types the entity metadata
// statics, so the factory-attached codec statics are probed by name without widening either type.

/** Whether `schema` carries a callable static named `key`. */
export const hasFunctionStatic = (schema: object, key: string): boolean =>
  P.hasProperty(schema, key) && P.isFunction(Reflect.get(schema, key));

/** Invoke the static named `key` on `schema`, or `None` when no callable static exists. */
export const invokeStatic = (schema: object, key: string, ...args: ReadonlyArray<unknown>): O.Option<unknown> => {
  const candidate: unknown = Reflect.get(schema, key);
  return O.map(O.liftPredicate(candidate, P.isFunction), (fn) => fn.call(schema, ...args));
};
