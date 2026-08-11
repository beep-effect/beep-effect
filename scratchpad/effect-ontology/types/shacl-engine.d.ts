/**
 * Type definitions for shacl-engine
 * @module types/shacl-engine
 */

declare module "shacl-engine" {
  import type { DataFactory, Quad, Store } from "n3"

  // Validation function type for SPARQL and other constraints
  type ValidationFunction = (...args: Array<any>) => any

  interface ValidatorOptions {
    factory?: typeof DataFactory
    debug?: boolean
    coverage?: boolean
    // SPARQL-based constraint validations (from shacl-engine/sparql.js)
    validations?: Record<string, ValidationFunction>
  }

  interface ValidationOptions {
    dataset: Store
  }

  interface ValidationResult {
    readonly _tag?: string
    readonly severity?: { value?: string }
    readonly focusNode?: { value?: string }
    readonly path?: { value?: string }
    readonly message?: ReadonlyArray<{ value?: string }>
    readonly sourceShape?: { value?: string }
    readonly sourceConstraintComponent?: { value?: string }
    readonly value?: { value?: string }
  }

  interface ValidationReport {
    readonly conforms: boolean
    readonly results: ReadonlyArray<ValidationResult>
    readonly dataset?: Store
  }

  export class Validator {
    constructor(shapesGraph: Store, options?: ValidatorOptions)
    validate(options: ValidationOptions): Promise<ValidationReport>
  }
}
