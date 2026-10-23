/** Bind a draft's operation nonce to its submitted values so edited retries cannot reuse an earlier successful write. */
export async function applicationOperationKey(fd: FormData): Promise<string> {
  const seed = String(fd.get("idem") ?? "");
  const ignored = new Set(["idem", "intent", "attested", "season_pick", "allow_duplicate"]);
  const fields = [...fd]
    .filter(([name, value]) => !ignored.has(name) && !name.startsWith("$ACTION_") && typeof value === "string")
    .map(([name, value]) => [name, String(value).trim()]);
  fields.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const input = JSON.stringify([seed, fields, fd.get("allow_duplicate") === "on"]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return `entry-${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
