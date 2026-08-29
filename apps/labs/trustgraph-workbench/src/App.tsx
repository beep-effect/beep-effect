import { beep } from "@beep/brand";
import appleTouchIconUrl from "@beep/brand/assets/apple-touch-icon.png";
import faviconSvgUrl from "@beep/brand/assets/favicon.svg";
import favicon16Url from "@beep/brand/assets/favicon-16.png";
import favicon32Url from "@beep/brand/assets/favicon-32.png";
import { BeepMark } from "@beep/brand/react";

/**
 * Document-head tags for the beep identity. React 19 hoists `<link>` and `<meta>`
 * rendered anywhere in the tree into `<head>`, so the favicon set ships from
 * `@beep/brand/assets` through Vite's asset pipeline instead of a copied `public/`.
 */
const BrandHead = () => (
  <>
    <link rel="icon" type="image/svg+xml" href={faviconSvgUrl} />
    <link rel="icon" type="image/png" sizes="32x32" href={favicon32Url} />
    <link rel="icon" type="image/png" sizes="16x16" href={favicon16Url} />
    <link rel="apple-touch-icon" sizes="180x180" href={appleTouchIconUrl} />
    <meta name="theme-color" content={beep.dark.brand["900"]} />
  </>
);

export const App = () => (
  <>
    <BrandHead />
    <main className="min-h-screen bg-surface-0 text-fg font-sans">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <BeepMark className="size-8 text-brand-400" />
        <h1 className="text-xl font-bold tracking-tight">Beep Graph</h1>
        <span className="text-sm text-fg-subtle">Knowledge graph engine</span>
      </header>
    </main>
  </>
);
