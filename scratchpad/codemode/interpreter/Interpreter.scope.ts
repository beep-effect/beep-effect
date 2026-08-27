/**
 * Lexical scope stack for the confined CodeMode interpreter.
 *
 * Bindings themselves are immutable; updates replace the {@link Binding} value
 * inside a `MutableHashMap`. `let`/`const` hoisting uses reserve then initialize
 * so temporal-dead-zone reads fail; `var` uses {@link ScopeStack.declare}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A, O, pipe } from "@beep/utils";
import { MutableHashMap } from "effect";
import { type AstNode, Binding, InterpreterRuntimeError, type Scope } from "./Interpreter.model.ts";

type ResolvedBinding = readonly [scope: Scope, binding: Binding];

/**
 * Mutable stack of Effect hash maps containing immutable binding models.
 *
 * **Gotchas**
 *
 * `reserve` inserts an uninitialized slot and throws if the name already exists
 * in the current frame. `initialize` requires that reserved uninitialized slot
 * and is the only legal first write. `declare` requires absence and stores an
 * already-initialized binding — using it for `let`/`const` skips TDZ.
 * `get`/`set` throw `ReferenceError` for unknown or TDZ names; `set` throws
 * `TypeError` for `const`. `current` throws `"Interpreter scope stack is empty."`
 * when the stack has been popped past the last frame.
 *
 * **Example** (Reserve then initialize vs assign to const)
 *
 * ```ts
 * import { MutableHashMap } from "effect"
 * import {
 *   type Binding,
 *   InterpreterFailure,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
 *
 * const node = { type: "VariableDeclarator" }
 * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
 * scopes.reserve("count", true, node)
 * scopes.initialize("count", 0, node)
 * console.log(scopes.get("count", node))
 * // 0
 *
 * scopes.declare("limit", 10, false, node)
 * try {
 *   scopes.set("limit", 11, node)
 * } catch (error) {
 *   console.log(
 *     InterpreterFailure.guards.InterpreterRuntimeError(error) ? error.message : error,
 *   )
 * }
 * // Cannot assign to constant 'limit'.
 * ```
 *
 * @see {@link Binding} for the immutable slot stored in each map.
 * @see {@link Scope} for the `MutableHashMap` frame type.
 * @throws InterpreterRuntimeError on duplicate reserve/declare, TDZ reads, const assignment, missing names, and empty-stack `current()`.
 * @category constructors
 * @since 0.0.0
 */
export class ScopeStack {
  private scopes: ReadonlyArray<Scope>;

  /**
   * Copies the supplied frames into a new stack without cloning the maps inside.
   *
   * **Example** (Construct from one empty frame)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = new ScopeStack([MutableHashMap.empty<string, Binding>()])
   * scopes.declare("count", 0, true, node)
   * console.log(scopes.get("count", node))
   * // 0
   * ```
   *
   * @since 0.0.0
   */
  constructor(scopes: ReadonlyArray<Scope>) {
    this.scopes = A.copy(scopes);
  }

  /**
   * Constructs a {@link ScopeStack} from the supplied frames, same as `new ScopeStack(scopes)`.
   *
   * **Example** (Create a stack from one empty frame)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.declare("count", 0, true, node)
   * console.log(scopes.get("count", node))
   * // 0
   * ```
   *
   * @since 0.0.0
   */
  static readonly new = (scopes: ReadonlyArray<Scope>): ScopeStack => new ScopeStack(scopes);

  /**
   * Inserts an uninitialized slot in the current frame so later TDZ reads of that name fail.
   *
   * `mutable` is `true` for `let` and `false` for `const`. Throws when the name
   * already exists in the current frame.
   *
   * **Example** (Reserve an uninitialized let)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import * as O from "effect/Option"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.reserve("count", true, node)
   * const slot = scopes.resolve("count")
   * console.log(O.isSome(slot) ? slot.value.initialized : slot)
   * // false
   * ```
   *
   * @since 0.0.0
   */
  reserve(name: string, mutable: boolean, node: AstNode): void {
    const scope = this.current();
    if (MutableHashMap.has(scope, name)) {
      throw InterpreterRuntimeError.new(`Identifier '${name}' has already been declared.`, node);
    }
    MutableHashMap.set(scope, name, Binding.new(mutable, undefined, false));
  }

  /**
   * Writes the first value into a reserved uninitialized slot in the current frame.
   *
   * Throws when the name is missing or already initialized; that first write is
   * the only legal `initialize` call.
   *
   * **Example** (Initialize a reserved binding)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.reserve("count", true, node)
   * scopes.initialize("count", 0, node)
   * console.log(scopes.get("count", node))
   * // 0
   * ```
   *
   * @since 0.0.0
   */
  initialize(name: string, value: unknown, node: AstNode): void {
    const scope = this.current();
    const binding = MutableHashMap.get(scope, name);
    if (O.isNone(binding) || binding.value.initialized) {
      throw InterpreterRuntimeError.new(`Identifier '${name}' has not been reserved for initialization.`, node);
    }
    MutableHashMap.set(scope, name, Binding.new(binding.value.mutable, value));
  }

  /**
   * Inserts an already-initialized binding in the current frame, the `var` path that skips TDZ.
   *
   * Throws when the name already exists in the current frame.
   *
   * **Example** (Declare an initialized binding)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.declare("limit", 10, false, node)
   * console.log(scopes.get("limit", node))
   * // 10
   * ```
   *
   * @since 0.0.0
   */
  declare(name: string, value: unknown, mutable: boolean, node: AstNode): void {
    const scope = this.current();
    if (MutableHashMap.has(scope, name)) {
      throw InterpreterRuntimeError.new(`Identifier '${name}' has already been declared.`, node);
    }
    MutableHashMap.set(scope, name, Binding.new(mutable, value));
  }

  /**
   * Reads an initialized binding by walking from the innermost frame outward.
   *
   * Throws a guest `ReferenceError` for unknown names and uninitialized TDZ slots.
   *
   * **Example** (Read an initialized binding)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.declare("count", 3, true, node)
   * console.log(scopes.get("count", node))
   * // 3
   * ```
   *
   * @since 0.0.0
   */
  get(name: string, node: AstNode): unknown {
    const binding = this.resolve(name);
    if (O.isNone(binding)) {
      throw InterpreterRuntimeError.new(`Unknown identifier '${name}'.`, node).as("ReferenceError");
    }
    if (!binding.value.initialized) {
      throw InterpreterRuntimeError.new(`Cannot access '${name}' before initialization.`, node).as("ReferenceError");
    }
    return binding.value.value;
  }

  /**
   * Replaces an initialized mutable binding in its home frame and returns the assigned value.
   *
   * Throws a guest `ReferenceError` for unknown or TDZ names and a guest
   * `TypeError` when the binding is `const`.
   *
   * **Example** (Assign to a mutable binding)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.declare("count", 0, true, node)
   * console.log(scopes.set("count", 5, node))
   * // 5
   * ```
   *
   * @since 0.0.0
   */
  set(name: string, value: unknown, node: AstNode): unknown {
    const resolved = this.resolveBinding(name);
    if (O.isNone(resolved)) {
      throw InterpreterRuntimeError.new(`Unknown identifier '${name}'.`, node).as("ReferenceError");
    }
    const [scope, binding] = resolved.value;
    if (!binding.initialized) {
      throw InterpreterRuntimeError.new(`Cannot access '${name}' before initialization.`, node).as("ReferenceError");
    }
    if (!binding.mutable) {
      throw InterpreterRuntimeError.new(`Cannot assign to constant '${name}'.`, node).as("TypeError");
    }
    MutableHashMap.set(scope, name, Binding.new(true, value));
    return value;
  }

  /**
   * Returns the binding for a name without throwing, including uninitialized TDZ slots.
   *
   * Walks from the innermost frame outward. Missing names are `O.none()`.
   *
   * **Example** (Look up a binding without throwing)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import * as O from "effect/Option"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.declare("count", 1, true, node)
   * const found = scopes.resolve("count")
   * console.log(O.isSome(found) ? found.value.value : found)
   * // 1
   * console.log(O.isNone(scopes.resolve("missing")))
   * // true
   * ```
   *
   * @since 0.0.0
   */
  resolve(name: string): O.Option<Binding> {
    return pipe(
      this.resolveBinding(name),
      O.map(([, binding]) => binding)
    );
  }

  /**
   * Returns the innermost frame, throwing when the stack has been popped empty.
   *
   * **Example** (Read the innermost frame)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.declare("count", 1, true, node)
   * console.log(MutableHashMap.has(scopes.current(), "count"))
   * // true
   * ```
   *
   * @since 0.0.0
   */
  current(): Scope {
    return pipe(
      A.last(this.scopes),
      O.getOrElse(() => {
        throw InterpreterRuntimeError.new("Interpreter scope stack is empty.");
      })
    );
  }

  /**
   * Pushes a new frame so inner names can shadow outer ones.
   *
   * Defaults to an empty `MutableHashMap` when `scope` is omitted.
   *
   * **Example** (Enter a nested lexical frame)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.declare("count", 1, true, node)
   * scopes.push()
   * scopes.declare("count", 2, true, node)
   * console.log(scopes.get("count", node))
   * // 2
   * ```
   *
   * @since 0.0.0
   */
  push(scope: Scope = MutableHashMap.empty()): void {
    this.scopes = A.append(this.scopes, scope);
  }

  /**
   * Drops the innermost frame; bindings in remaining frames stay in place.
   *
   * **Example** (Leave a nested lexical frame)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.declare("count", 1, true, node)
   * scopes.push()
   * scopes.declare("count", 2, true, node)
   * scopes.pop()
   * console.log(scopes.get("count", node))
   * // 1
   * ```
   *
   * @since 0.0.0
   */
  pop(): void {
    this.scopes = A.dropRight(this.scopes, 1);
  }

  /**
   * Returns a shallow copy of the frame array; the maps inside stay shared.
   *
   * **Example** (Snapshot the current frames)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.declare("count", 1, true, node)
   * const snapshot = scopes.capture()
   * scopes.push()
   * console.log(snapshot.length, scopes.capture().length)
   * // 1 2
   * ```
   *
   * @since 0.0.0
   */
  capture(): ReadonlyArray<Scope> {
    return A.copy(this.scopes);
  }

  /**
   * Walks frames from the inside out and returns the home frame plus binding, or none.
   *
   * **Example** (Resolve a name from an outer frame)
   *
   * ```ts
   * import { MutableHashMap } from "effect"
   * import * as O from "effect/Option"
   * import { type Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
   * import { ScopeStack } from "../../../codemode/interpreter/Interpreter.scope.ts"
   *
   * const node = { type: "VariableDeclarator" }
   * const scopes = ScopeStack.new([MutableHashMap.empty<string, Binding>()])
   * scopes.declare("count", 1, true, node)
   * scopes.push()
   * const found = scopes.resolve("count")
   * console.log(O.isSome(found) ? found.value.value : found)
   * // 1
   * ```
   *
   * @since 0.0.0
   */
  private resolveBinding(name: string): O.Option<ResolvedBinding> {
    for (let index = A.length(this.scopes) - 1; index >= 0; index -= 1) {
      const scope = this.scopes[index];
      if (O.isNone(O.fromUndefinedOr(scope))) continue;
      const binding = MutableHashMap.get(scope, name);
      if (O.isSome(binding)) return O.some([scope, binding.value]);
    }
    return O.none();
  }
}
