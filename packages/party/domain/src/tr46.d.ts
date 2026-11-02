declare module "tr46" {
  interface ToAsciiOptions {
    readonly checkBidi?: boolean;
    readonly checkHyphens?: boolean;
    readonly checkJoiners?: boolean;
    readonly ignoreInvalidPunycode?: boolean;
    readonly transitionalProcessing?: boolean;
    readonly useSTD3ASCIIRules?: boolean;
    readonly verifyDNSLength?: boolean;
  }

  /**
   * UTS #46 ToASCII. Returns `null` when processing records an error.
   */
  export function toASCII(domainName: string, options?: ToAsciiOptions): string | null;
}
