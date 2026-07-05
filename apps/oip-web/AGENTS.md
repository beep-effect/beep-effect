# @beep/oip-web Agent Guide

Public Next.js app for the OIP solo-practice intellectual property law firm
website. Uses `@beep/ui` for product-agnostic Tailwind/shadcn/Base UI; keeps
OIP-specific content, launch review gates, and presentation app-local unless
reuse proves a slice or shared-kernel package is needed.

| Surface | Key exports | Notes |
| --- | --- | --- |
| `src/content` | `oipSiteContent`, schemas, review gates | static launch content and public-claim review status |
| `src/components` | `OipHomePage` | app-local public site composition |

Follow `goals/oip-web-launch` for launch scope and review gates.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->
