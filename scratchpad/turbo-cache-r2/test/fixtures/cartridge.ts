import { turboCache } from "../../index.js";

export default turboCache({
  main: import.meta.url,
  resourceNamePrefix: "TurboCache",
  retentionDays: 7,
  teams: ["rat-stack"],
});
