/**
 * WIPO ST.16 kind code value object.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/KindCode/KindCode");

/**
 * WIPO ST.16 patent document kind code.
 *
 * **Details**
 *
 * The set includes the ST.16 letter codes and each letter code supplemented by
 * digits 1 through 9. Digit 0 is intentionally excluded because ST.16 describes
 * it as internal use outside the recommended standard.
 *
 * **Example** (Validate kind code members)
 *
 * ```ts
 * import { KindCode } from "@beep/law-practice-domain"
 *
 * console.log(KindCode.is.A1("A1")) // true
 * console.log(KindCode.is.B1("B1")) // true
 * console.log(KindCode.is.A("A")) // true
 * ```
 *
 * @see https://www.wipo.int/documents/d/standards/docs-en-03-16-01.pdf
 * @category value-objects
 * @since 0.0.0
 */
export const KindCode = LiteralKit([
  "A",
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
  "A7",
  "A8",
  "A9",
  "B",
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
  "B7",
  "B8",
  "B9",
  "C",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "C8",
  "C9",
  "U",
  "U1",
  "U2",
  "U3",
  "U4",
  "U5",
  "U6",
  "U7",
  "U8",
  "U9",
  "Y",
  "Y1",
  "Y2",
  "Y3",
  "Y4",
  "Y5",
  "Y6",
  "Y7",
  "Y8",
  "Y9",
  "Z",
  "Z1",
  "Z2",
  "Z3",
  "Z4",
  "Z5",
  "Z6",
  "Z7",
  "Z8",
  "Z9",
  "M",
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "M7",
  "M8",
  "M9",
  "P",
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
  "S",
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
  "S9",
  "L",
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
  "L8",
  "L9",
  "R",
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
  "R9",
  "T",
  "T1",
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
  "T8",
  "T9",
  "W",
  "W1",
  "W2",
  "W3",
  "W4",
  "W5",
  "W6",
  "W7",
  "W8",
  "W9",
  "E",
  "E1",
  "E2",
  "E3",
  "E4",
  "E5",
  "E6",
  "E7",
  "E8",
  "E9",
  "F",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "G",
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
  "G9",
  "H",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "H7",
  "H8",
  "H9",
  "I",
  "I1",
  "I2",
  "I3",
  "I4",
  "I5",
  "I6",
  "I7",
  "I8",
  "I9",
  "N",
  "N1",
  "N2",
  "N3",
  "N4",
  "N5",
  "N6",
  "N7",
  "N8",
  "N9",
  "X",
  "X1",
  "X2",
  "X3",
  "X4",
  "X5",
  "X6",
  "X7",
  "X8",
  "X9",
]).pipe(
  $I.annoteSchema("KindCode", {
    description: "WIPO ST.16 patent document kind code letters, with optional one-digit supplements 1 through 9.",
  })
);

/**
 * Type-level literal union produced by {@link KindCode}.
 *
 * **Example** (Satisfy KindCode type literal)
 *
 * ```ts
 * import type { KindCode } from "@beep/law-practice-domain"
 *
 * const kind = "B2" satisfies KindCode
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type KindCode = typeof KindCode.Type;
