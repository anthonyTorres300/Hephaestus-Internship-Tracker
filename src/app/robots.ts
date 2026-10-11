import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms"],
        disallow: ["/dashboard", "/applications", "/jobs", "/practice", "/settings", "/admin", "/api", "/account-status"],
      },
    ],
  };
}
