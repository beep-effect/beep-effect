import {
  parseAppxPackageFamilies,
  parseBitLockerProtection,
  parseRegistryValue,
  tasklistHasImage,
} from "@beep/practice-gateway/WindowsHost";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";

const regOutput = [
  "",
  "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AnthropicClaude",
  "    DisplayName    REG_SZ    Claude",
  "    DisplayVersion    REG_SZ    0.14.10",
  "",
].join("\r\n");

describe("Windows command output parsing", () => {
  it("reads one registry value and ignores its neighbours", () => {
    assertSome(parseRegistryValue(regOutput, "DisplayVersion"), "0.14.10");
    assertSome(parseRegistryValue("DisplayName")(regOutput), "Claude");
    assertNone(parseRegistryValue(regOutput, "InstallLocation"));
  });

  it("maps the BitLocker shell property", () => {
    expect(parseBitLockerProtection("1\r\n")).toBe("on");
    expect(parseBitLockerProtection("6")).toBe("on");
    expect(parseBitLockerProtection("2")).toBe("off");
    expect(parseBitLockerProtection("5")).toBe("off");
    expect(parseBitLockerProtection("")).toBe("unknown");
  });

  it("finds an image in tasklist CSV output, case-insensitively", () => {
    expect(tasklistHasImage('"Box.exe","4120","Console","1","120,000 K"\r\n', "Box.exe")).toBe(true);
    expect(tasklistHasImage('"BOX.EXE","4120","Console","1","120,000 K"', "Box.exe")).toBe(true);
    expect(tasklistHasImage("INFO: No tasks are running which match the specified criteria.", "Box.exe")).toBe(false);
  });

  it("reads MSIX package families one per line", () => {
    expect(parseAppxPackageFamilies("Claude_pzs8sxrjxfjjc\r\n\r\n")).toEqual(["Claude_pzs8sxrjxfjjc"]);
    expect(parseAppxPackageFamilies("")).toEqual([]);
  });
});
