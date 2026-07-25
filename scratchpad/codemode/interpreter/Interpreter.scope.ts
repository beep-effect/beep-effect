import { A, O, pipe } from "@beep/utils";
import { MutableHashMap } from "effect";
import {
  type AstNode,
  Binding,
  InterpreterRuntimeError,
  type Scope,
} from "./Interpreter.model.ts";

type ResolvedBinding = readonly [scope: Scope, binding: Binding];

/** Mutable stack of Effect hash maps containing immutable binding models. */
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
