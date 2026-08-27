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
import {
  type AstNode,
  Binding,
  InterpreterRuntimeError,
  type Scope,
} from "./Interpreter.model.ts";

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

  constructor(scopes: ReadonlyArray<Scope>) {
    this.scopes = A.copy(scopes);
  }

  static readonly new = (scopes: ReadonlyArray<Scope>): ScopeStack =>
    new ScopeStack(scopes);

  reserve(name: string, mutable: boolean, node: AstNode): void {
    const scope = this.current();
    if (MutableHashMap.has(scope, name)) {
      throw InterpreterRuntimeError.new(
        `Identifier '${name}' has already been declared.`,
        node
      );
    }
    MutableHashMap.set(scope, name, Binding.new(mutable, undefined, false));
  }

  initialize(name: string, value: unknown, node: AstNode): void {
    const scope = this.current();
    const binding = MutableHashMap.get(scope, name);
    if (O.isNone(binding) || binding.value.initialized) {
      throw InterpreterRuntimeError.new(
        `Identifier '${name}' has not been reserved for initialization.`,
        node
      );
    }
    MutableHashMap.set(
      scope,
      name,
      Binding.new(binding.value.mutable, value)
    );
  }

  declare(name: string, value: unknown, mutable: boolean, node: AstNode): void {
    const scope = this.current();
    if (MutableHashMap.has(scope, name)) {
      throw InterpreterRuntimeError.new(
        `Identifier '${name}' has already been declared.`,
        node
      );
    }
    MutableHashMap.set(scope, name, Binding.new(mutable, value));
  }

  get(name: string, node: AstNode): unknown {
    const binding = this.resolve(name);
    if (O.isNone(binding)) {
      throw InterpreterRuntimeError.new(
        `Unknown identifier '${name}'.`,
        node
      ).as("ReferenceError");
    }
    if (!binding.value.initialized) {
      throw InterpreterRuntimeError.new(
        `Cannot access '${name}' before initialization.`,
        node
      ).as("ReferenceError");
    }
    return binding.value.value;
  }

  set(name: string, value: unknown, node: AstNode): unknown {
    const resolved = this.resolveBinding(name);
    if (O.isNone(resolved)) {
      throw InterpreterRuntimeError.new(
        `Unknown identifier '${name}'.`,
        node
      ).as("ReferenceError");
    }
    const [scope, binding] = resolved.value;
    if (!binding.initialized) {
      throw InterpreterRuntimeError.new(
        `Cannot access '${name}' before initialization.`,
        node
      ).as("ReferenceError");
    }
    if (!binding.mutable) {
      throw InterpreterRuntimeError.new(
        `Cannot assign to constant '${name}'.`,
        node
      ).as("TypeError");
    }
    MutableHashMap.set(scope, name, Binding.new(true, value));
    return value;
  }

  resolve(name: string): O.Option<Binding> {
    return pipe(
      this.resolveBinding(name),
      O.map(([, binding]) => binding)
    );
  }

  current(): Scope {
    return pipe(
      A.last(this.scopes),
      O.getOrElse(() => {
        throw InterpreterRuntimeError.new(
          "Interpreter scope stack is empty."
        );
      })
    );
  }

  push(scope: Scope = MutableHashMap.empty()): void {
    this.scopes = A.append(this.scopes, scope);
  }

  pop(): void {
    this.scopes = A.dropRight(this.scopes, 1);
  }

  capture(): ReadonlyArray<Scope> {
    return A.copy(this.scopes);
  }

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
