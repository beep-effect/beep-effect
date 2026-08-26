import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// Brand chrome only: the wordmark and favicon are served from @beep/brand/assets via
// `staticDirs` in main.ts. Colors stay Storybook's dark defaults; the manager bundle
// does not import the brand package so it stays free of effect/Schema.
addons.setConfig({
  theme: create({
    base: "dark",
    brandTitle: "beep",
    brandUrl: "https://github.com/beep-effect/beep-effect",
    brandImage: "./brand/wordmark.svg",
    brandTarget: "_self",
  }),
});
