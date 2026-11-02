import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

/**
 * Decode a credential-bearing WebSocket endpoint with an encrypted remote hop.
 * Plaintext is limited to loopback endpoints used by SSH tunnels.
 *
 * **Example** (Reject remote plaintext)
 *
 * ```ts
 * import { protectedBridgeUrl } from "./transport.ts"
 * import * as O from "effect/Option"
 * console.log(O.isNone(protectedBridgeUrl("ws://192.0.2.1:48123"))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const protectedBridgeUrl = (input: string): O.Option<URL> =>
  S.decodeUnknownOption(S.URLFromString)(input).pipe(
    O.filter(
      (url) =>
        url.username === "" &&
        url.password === "" &&
        url.hash === "" &&
        (url.protocol === "wss:" ||
          (url.protocol === "ws:" &&
            (A.contains(["localhost", "[::1]"], url.hostname) ||
              O.isSome(Str.match(/^127(?:\.\d{1,3}){3}$/)(url.hostname)))))
    )
  );
