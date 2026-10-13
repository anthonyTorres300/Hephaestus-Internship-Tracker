import { PAGE_SIZE, PAGE_SIZES } from "@/lib/data/applications";

export const APP_VIEW_COOKIE = "icc_app_view";
export function parseAppView(raw?: string): { layout: "list" | "board"; per: number } {
  const defaults = { layout: "list" as const, per: PAGE_SIZE };
  try {
    const value = JSON.parse(decodeURIComponent(raw ?? "{}"));
    if (!value || typeof value !== "object") return defaults;
    return {
      layout: value.layout === "board" ? "board" : "list",
      per: (PAGE_SIZES as readonly number[]).includes(value.per) ? value.per : PAGE_SIZE,
    };
  } catch {
    return defaults;
  }
}
