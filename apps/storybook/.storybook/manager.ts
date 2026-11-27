import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// decision: static-brand-manager
const brandTheme = create({
  base: "dark",
  brandTitle: "beep",
  brandUrl: "https://github.com/beep-effect/beep-effect",
  brandImage: "./brand/wordmark.svg",
  brandTarget: "_self",
});

addons.setConfig({
  theme: brandTheme,
});
