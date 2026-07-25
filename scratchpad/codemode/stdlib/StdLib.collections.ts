import { A } from "@beep/utils"
import { CodeModeMap, CodeModeSet, CodeModeURLSearchParams } from "../Codemode.values.ts"
export {
  arrayMethods,
  mapMethods,
  mapStatics,
  setMethods,
} from "../Codemode.method-names.ts"

export const spreadItems = (value: unknown): Array<unknown> | undefined => {
  if (A.isArray(value)) return value
  if (typeof value === "string") return A.fromIterable(value)
  if (CodeModeMap.is(value)) return A.map(A.fromIterable(value.map.entries()), ([key, item]) => [key, item])
  if (CodeModeSet.is(value)) return A.fromIterable(value.set.values())
  if (CodeModeURLSearchParams.is(value)) {
    return A.map(A.fromIterable(value.params.entries()), ([key, item]) => [key, item])
  }
  return undefined
}
