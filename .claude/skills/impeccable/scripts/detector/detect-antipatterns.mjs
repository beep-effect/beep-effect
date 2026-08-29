#!/usr/bin/env node

/**
 * Anti-Pattern Detector for Impeccable
 * Copyright (c) 2026 Paul Bakaus
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public API facade. Runtime engines live under cli/engine/engines/.
 */

import { detectCli } from "./cli/main.mjs";

export { detectCli, formatFindings } from "./cli/main.mjs";
export {
  checkSourceDesignSystem,
  collectStaticDesignSystemFindings,
  loadDesignSystemForCwd,
  normalizeDesignSystem,
  parseFrontmatter as parseDesignFrontmatter,
} from "./design-system.mjs";
export { createBrowserDetector, detectUrl } from "./engines/browser/detect-url.mjs";
export { detectText, extractCSSinJS, extractStyleBlocks } from "./engines/regex/detect-text.mjs";
export { detectHtml } from "./engines/static-html/detect-html.mjs";
export {
  buildImportGraph,
  detectFrameworkConfig,
  FRAMEWORK_CONFIGS,
  hasScannableExtension,
  isPortListening,
  resolveImport,
  SCANNABLE_EXTENSIONS,
  SKIP_DIRS,
  walkDir,
} from "./node/file-system.mjs";
export { createDetectorProfile, summarizeDetectorProfile } from "./profile/profiler.mjs";
export {
  ANTIPATTERNS,
  getAntipattern,
  getRuleEngineSupport,
  getRulesForCategory,
  RULE_ENGINE_SUPPORT,
} from "./registry/antipatterns.mjs";
export {
  checkElementBorders,
  checkElementGlow,
  checkElementMotion,
  checkHtmlPatterns,
  checkPageLayout,
  checkPageTypography,
} from "./rules/checks.mjs";
export {
  colorToHex,
  contrastRatio,
  getHue,
  hasChroma,
  isNeutralColor,
  parseGradientColors,
  parseRgb,
  relativeLuminance,
} from "./shared/color.mjs";
export { BORDER_SAFE_TAGS, GENERIC_FONTS, KNOWN_SERIF_FONTS, OVERUSED_FONTS, SAFE_TAGS } from "./shared/constants.mjs";
export { isFullPage } from "./shared/page.mjs";

const isMainModule =
  process.argv[1]?.endsWith("detect-antipatterns.mjs") || process.argv[1]?.endsWith("detect-antipatterns.mjs/");
if (isMainModule) detectCli();
