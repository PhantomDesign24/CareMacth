import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/find-work", priority: 0.9, changeFrequency: "hourly" as const },
    { path: "/care-request", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/home-care", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/business", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/auth/login", priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/auth/register", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/location-terms", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  return routes.map((r) => ({
    url: `${SITE.url}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
