import { sanitize } from "../../Fmt.ts";

/**
 * Consumer text made safe for one row of a widget: sanitised as `Fmt.sanitize` does (no escape sequence, no other
 * control character), with each line break (CR, LF or CR LF) folded to a space.
 *
 * @remarks
 * Every string a kit widget draws from data goes through it before it is measured or cut. Ink keeps SGR and OSC
 * sequences it is handed, so unsanitised text would paint colour at colour `none` and could plant a hyperlink whose
 * target differs from its label; and a widget's row budget counts one row per line, so a second line would push the
 * frame past the terminal, where Ink wipes the screen and its scrollback.
 *
 * @internal
 */
export const lineText = (text: string): string => sanitize(text).replace(/\r\n|\r|\n/g, " ");
