/**
 * Internal executable entries for the file-type catalog.
 *
 * @internal
 * @since 0.0.0
 */

import { makeCatalogFileTypeInfo } from "./FileTypeChecker.catalog-constructor.ts";
import type { FileTypeInfo } from "./FileTypeChecker.schema.ts";

type ExecutableFileType = "elf" | "exe" | "macho";
type ExecutableCatalog = { readonly [K in ExecutableFileType]: FileTypeInfo & { readonly extension: K } };

/**
 * Internal executable metadata keyed by canonical extension.
 *
 * **Example** (Read executable metadata)
 *
 * ```ts
 * import { executableCatalog } from "@beep/schema/FileTypeChecker/FileTypeChecker.executable-catalog"
 *
 * console.log(executableCatalog.elf.extension) // "elf"
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const executableCatalog: ExecutableCatalog = {
  elf: makeCatalogFileTypeInfo({
    extension: "elf",
    mimeType: "application/x-executable",
    description: "Executable and Linking Format executable file (Linux/Unix)",
    signatures: [
      {
        sequence: [0x7f, 0x45, 0x4c, 0x46],
      },
    ],
  }),
  exe: makeCatalogFileTypeInfo({
    extension: "exe",
    mimeType: "application/x-msdownload", // 'application/x-dosexec' is a subtype of 'application/x-msdownload', therefore it is not necessary to include it (https://web.archive.org/web/20160629113130/http://www.webarchive.org.uk/interject/types/application/x-dosexec)
    description: "Windows/DOS executable file and its descendants",
    signatures: [
      {
        sequence: [0x4d, 0x5a],
        compatibleExtensions: [
          "acm",
          "ax",
          "cpl",
          "com",
          "dll",
          "drv",
          "efi",
          "fon",
          "iec",
          "ime",
          "mui",
          "ocx",
          "olb",
          "pif",
          "qts",
          "qtx",
          "rs",
          "sys",
          "scr",
          "tsp",
          "vbx",
          "vxd",
        ],
      },
      {
        sequence: [0x5a, 0x4d],
        description: "DOS ZM executable (rare)",
      },
    ],
  }),
  macho: makeCatalogFileTypeInfo({
    extension: "macho",
    mimeType: "application/x-mach-binary",
    description: "Apple OS X ABI Mach-O binary file",
    signatures: [
      {
        sequence: [0xfe, 0xed, 0xfa, 0xce],
        description: "32-bit",
      },
      {
        sequence: [0xce, 0xfa, 0xed, 0xfe],
        description: "32-bit, where target system has reverse byte ordering from host running compiler",
      },
      {
        sequence: [0xfe, 0xed, 0xfa, 0xcf],
        description: "64-bit",
      },
      {
        sequence: [0xcf, 0xfa, 0xed, 0xfe],
        description: "64-bit, where target system has reverse byte ordering from host running compiler",
      },
      {
        sequence: [0xca, 0xfe, 0xba, 0xbe],
        description: "Mach-O Fat Binary",
      },
    ],
  }),
};
