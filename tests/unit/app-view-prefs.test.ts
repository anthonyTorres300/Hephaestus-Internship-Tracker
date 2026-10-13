import { describe, expect, it } from "vitest";
import { parseAppView } from "@/lib/applications/prefs";
describe("application view preferences", () => {
  it.each([undefined, "null", "false", "[]", "broken", "%invalid"])("ignores malformed cookies: %s", (raw) => {
    expect(parseAppView(raw)).toEqual({ layout: "list", per: 25 });
  });
  it("retains only supported view and page-size choices", () => {
    expect(parseAppView(encodeURIComponent(JSON.stringify({ layout: "board", per: 50 })))).toEqual({ layout: "board", per: 50 });
    expect(parseAppView('{"layout":"unknown","per":999}')).toEqual({ layout: "list", per: 25 });
  });
});
