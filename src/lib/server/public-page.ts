import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  // Restrict IPv6 to global unicast; exclude transition and documentation networks.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !/^(2001:(0:|db8:)|2002:)/i.test(address);
}
export function publicPageUrl(raw: string): URL {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hostname === "localhost" ||
    /\.(localhost|local|internal)$/i.test(url.hostname)
  )
    throw new Error("Use a public HTTPS job link.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new Error("Use a public HTTPS job link.");
  return url;
}
export async function readPublicPage(raw: string): Promise<string> {
  const deadline = Date.now() + 8000;
  let url = publicPageUrl(raw);
  for (let hop = 0; hop <= 3; hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("The job site took too long to respond.");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let addresses;
    try {
      addresses = await Promise.race([
        lookup(url.hostname, { all: true, verbatim: true }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("DNS timeout")), remaining);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) throw new Error("Use a public HTTPS job link.");
    const pinned = addresses.find((address) => address.family === 4) ?? addresses[0];
    const result = await new Promise<{ body: string; redirect?: string }>((resolve, reject) => {
      const req = request(
        url,
        {
          method: "GET",
          family: pinned.family,
          lookup: (_, __, callback) => callback(null, pinned.address, pinned.family),
          headers: { Accept: "text/html,application/json", "Accept-Encoding": "identity", "User-Agent": "Hephaestus-JobPreview/1.0" },
        },
        (response) => {
          if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
            response.resume();
            resolve({ body: "", redirect: response.headers.location });
            return;
          }
          if (response.statusCode !== 200) {
            response.resume();
            reject(new Error("The job site did not share readable details."));
            return;
          }
          let bytes = 0;
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 1024 * 1024) req.destroy(new Error("This page is too large to preview."));
            else chunks.push(chunk);
          });
          response.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8") }));
          response.on("error", reject);
        },
      );
      req.setTimeout(Math.max(1, deadline - Date.now()), () => req.destroy(new Error("The job site took too long to respond.")));
      const totalTimer = setTimeout(
        () => req.destroy(new Error("The job site took too long to respond.")),
        Math.max(1, deadline - Date.now()),
      );
      req.on("close", () => clearTimeout(totalTimer));
      req.on("error", reject);
      req.end();
    });
    if (result.redirect) {
      if (hop === 3) throw new Error("Too many job-site redirects.");
      url = publicPageUrl(new URL(result.redirect, url).href);
    } else return result.body;
  }
  throw new Error("Could not read the job page.");
}
