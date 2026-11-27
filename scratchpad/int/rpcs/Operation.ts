/**
 * The shape every operation module has, as a type the compiler checks, and
 * the two derivations a protocol makes from a record of such modules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array"
import * as R from "effect/Record"
import type * as Rpc from "effect/rpc/Rpc"
import type * as RpcSchema from "effect/rpc/RpcSchema"
import * as Struct from "effect/Struct"

type Carried<Contract extends Rpc.AnyWithProps> =
  Contract["successSchema"] extends RpcSchema.Stream<infer Success, infer Failure>
    ? { readonly Success: Success; readonly Failure: Failure }
    : { readonly Success: Contract["successSchema"]; readonly Failure: Contract["errorSchema"] }

type ContractOf<M> = M extends { readonly Contract: infer Contract extends Rpc.AnyWithProps }
  ? Contract
  : Rpc.AnyWithProps

/**
 * What an operation's contract file exports: four slots under fixed names.
 *
 * **Details**
 *
 * `Tag` is the name the module is imported under, and the contract must carry
 * that same tag. `Payload`, `Success` and `Failure` must be the schemas the
 * contract itself was made from; for a streaming contract those are the
 * stream's element and its error.
 *
 * **Example** (Check one module against the shape)
 *
 * ```ts import.meta.vitest name="Check one module against the shape"
 * import type * as Operation from "@beep/scratchpad/int/rpcs/Operation"
 * import { Posts } from "@beep/scratchpad/int/rpcs/index"
 *
 * const checked: Operation.Module<"Posts", typeof Posts.Contract> = Posts
 * checked.Contract._tag // => "Posts"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface Module<Tag extends string = string, Contract extends Rpc.AnyWithProps = Rpc.AnyWithProps> {
  readonly Payload: Contract["payloadSchema"]
  readonly Success: Carried<Contract>["Success"]
  readonly Failure: Carried<Contract>["Failure"]
  readonly Contract: Contract & { readonly _tag: Tag }
}

/**
 * A {@link Module} as the server sees it: the same four slots and the
 * `Handler` that serves its contract.
 *
 * **Example** (Check a served module against the shape)
 *
 * ```ts import.meta.vitest name="Check a served module against the shape"
 * import type * as Operation from "@beep/scratchpad/int/rpcs/Operation"
 * import { Posts } from "@beep/scratchpad/int/rpcs/server"
 * import * as P from "effect/Predicate"
 *
 * const checked: Operation.Served<"Posts", typeof Posts.Contract> = Posts
 * P.isFunction(checked.Handler) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface Served<Tag extends string = string, Contract extends Rpc.AnyWithProps = Rpc.AnyWithProps>
  extends Module<Tag, Contract> {
  readonly Handler: Rpc.ToHandlerFn<Contract>
}

/**
 * A record of modules in which every key is the tag of the module under it.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Modules<T> = { readonly [K in keyof T]: Module<K & string, ContractOf<T[K]>> }

/**
 * {@link Modules} whose every member also carries its handler.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ServedModules<T> = { readonly [K in keyof T]: Served<K & string, ContractOf<T[K]>> }

interface HandlerOf extends Struct.Lambda {
  <M extends { readonly Handler: unknown }>(self: M): M["Handler"]
  readonly "~lambda.out": this["~lambda.in"] extends { readonly Handler: infer Handler } ? Handler : never
}

const handlerOf = Struct.lambda<HandlerOf>((module) => module.Handler)

/**
 * The contract of each module, in the record's order, ready to spread into a
 * group.
 *
 * **Gotchas**
 *
 * A module filed under a name other than its contract's tag, or missing a
 * slot, is a compile error at the call, not a runtime one.
 *
 * **Example** (List the tags of a record of modules)
 *
 * ```ts import.meta.vitest name="List the tags of a record of modules"
 * import * as Operation from "@beep/scratchpad/int/rpcs/Operation"
 * import { Posts, Profile } from "@beep/scratchpad/int/rpcs/index"
 * import * as A from "effect/Array"
 *
 * A.map(Operation.contracts({ Posts, Profile }), ({ _tag }) => _tag) // => ["Posts", "Profile"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const contracts = <const T extends Modules<T>>(modules: T): Array<T[keyof T & string]["Contract"]> =>
  A.map(R.values<keyof T & string, T[keyof T & string]>(modules), ({ Contract }) => Contract)

/**
 * The handler of each served module under the module's own key, which is the
 * record a group's `toLayer` takes.
 *
 * **Example** (Key each handler by its operation)
 *
 * ```ts import.meta.vitest name="Key each handler by its operation"
 * import * as Operation from "@beep/scratchpad/int/rpcs/Operation"
 * import { Posts, Profile } from "@beep/scratchpad/int/rpcs/server"
 * import * as R from "effect/Record"
 *
 * R.keys(Operation.handlers({ Posts, Profile })) // => ["Posts", "Profile"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const handlers = <const T extends ServedModules<T>>(modules: T) => Struct.map(modules, handlerOf)
