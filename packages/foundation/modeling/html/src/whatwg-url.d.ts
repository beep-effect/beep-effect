declare module "whatwg-url" {
  const urlRecordTypeId: unique symbol;

  interface UrlRecord {
    readonly [urlRecordTypeId]: typeof urlRecordTypeId;
  }

  interface UrlOptions {
    readonly baseURL?: UrlRecord;
  }

  export function isValidURLString(input: string, options?: UrlOptions): boolean;

  export function parseURL(input: string, options?: UrlOptions): UrlRecord | null;
}
