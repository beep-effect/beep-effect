// Effect-diagnostics canary for the effected-port `check` gate.
//
// Every declaration below violates one `@effect/tsgo` rule on purpose. The
// gate runs tsgo over this file before checking a module and refuses to go
// green unless each expected diagnostic is reported, so a disabled language
// service plugin, a severity map that stopped applying, or a tsgo binary that
// is not the patched Effect build turns the gate red instead of passing
// silently. Never "fix" this file. The dot-directory keeps it out of every
// module's tsconfig, oxlint and law scope.

// missingPipeableSignature (upstream default `off`; on only through the repo map)
export const canaryPair = (left: number, right: number): number => left + right;

// strictBooleanExpressions
export const canaryTruthy = (value: string): string => (value ? value : "empty");
