import { A } from "@beep/utils";
import * as Str from "effect/String";

export const formalizeValues = A.map(Str.capitalize);
