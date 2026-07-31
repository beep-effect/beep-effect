import type { JSX } from "react";

// Neutral inline glyphs for the adapter's chrome buttons. The adapter is
// product-agnostic, so these stay dependency-free stroke SVGs drawn in
// currentColor; hosts size and color them through the button's font/color.
const Glyph = (props: { readonly children: JSX.Element | ReadonlyArray<JSX.Element> }) => (
  <svg
    aria-hidden="true"
    focusable={false}
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block" }}
  >
    {props.children}
  </svg>
);

export const FloatIcon = () => (
  <Glyph>
    <path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
    <rect width="10" height="7" x="12" y="13" rx="2" />
  </Glyph>
);

export const MaximizeIcon = () => (
  <Glyph>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </Glyph>
);

export const RestoreIcon = () => (
  <Glyph>
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </Glyph>
);

export const DockIcon = () => (
  <Glyph>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 15h18" />
  </Glyph>
);
