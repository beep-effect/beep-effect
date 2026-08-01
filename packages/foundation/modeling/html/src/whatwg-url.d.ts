declare module "whatwg-url/lib/url-state-machine.js" {
  const urlRecordTypeId: unique symbol;

  export interface UrlRecord {
    readonly [urlRecordTypeId]: typeof urlRecordTypeId;
  }

  export function parseURL(input: string): UrlRecord | null;
}

declare module "whatwg-url/lib/url-string-validator.js" {
  import type { UrlRecord } from "whatwg-url/lib/url-state-machine.js";

  interface UrlOptions {
    readonly baseURL?: UrlRecord;
  }

  export function isValidURLString(input: string, options?: UrlOptions): boolean;
}

declare module "whatwg-url" {
  export { parseURL } from "whatwg-url/lib/url-state-machine.js";
  export { isValidURLString } from "whatwg-url/lib/url-string-validator.js";
}
