"use client";

import { useEffect } from "react";
import { useLocation } from "react-router";
import { canonicalForPath, normalizeCanonicalBaseUrl, resolveSeo } from "../seo/seoConfig";
import { STATIC_BLOG_POSTS_BY_SLUG } from "../../content/blogPosts";

function upsertMetaByName(name: string, content: string) {
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string) {
  let tag = document.head.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function upsertStructuredData(data?: Record<string, unknown> | Array<Record<string, unknown>>) {
  const id = "careerpilot-structured-data";
  const existing = document.getElementById(id);
  if (!data) {
    if (existing) existing.remove();
    return;
  }

  const payload = Array.isArray(data) ? data : [data];
  const script = existing ?? document.createElement("script");
  script.setAttribute("type", "application/ld+json");
  script.setAttribute("id", id);
  script.textContent = JSON.stringify(payload.length === 1 ? payload[0] : payload);
  if (!existing) {
    document.head.appendChild(script);
  }
}

/** Sets the page's title / description / canonical / robots tags (used by admin-written blog posts). */
export function applyPageSeo(seo: { title: string; description: string; canonical: string; index: boolean; image?: string | null }) {
  document.title = seo.title;
  upsertMetaByName("description", seo.description);
  upsertMetaByName("robots", seo.index ? "index,follow" : "noindex,nofollow");
  upsertMetaByProperty("og:type", "article");
  upsertMetaByProperty("og:title", seo.title);
  upsertMetaByProperty("og:description", seo.description);
  upsertMetaByProperty("og:url", seo.canonical);
  if (seo.image) upsertMetaByProperty("og:image", seo.image);
  upsertMetaByName("twitter:card", "summary_large_image");
  upsertMetaByName("twitter:title", seo.title);
  upsertMetaByName("twitter:description", seo.description);
  upsertCanonical(seo.canonical);
}

export function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    // Admin-written blog posts set their own tags (BlogPost page + server render); bundled posts
    // and every other page come from the static SEO table.
    const blogSlug = location.pathname.startsWith("/blog/") ? location.pathname.slice(6).replace(/\/$/, "").toLowerCase() : "";
    if (blogSlug && !STATIC_BLOG_POSTS_BY_SLUG[blogSlug]) return;
    const seo = resolveSeo(location.pathname);
    const baseUrl = normalizeCanonicalBaseUrl(
      (process.env.NEXT_PUBLIC_SITE_URL as string | undefined) ||
        ((import.meta as any).env?.VITE_SITE_URL as string | undefined),
    );
    const canonical = canonicalForPath(location.pathname, baseUrl);

    document.title = seo.title;
    upsertMetaByName("description", seo.description);
    upsertMetaByName("robots", seo.index ? "index,follow" : "noindex,nofollow");
    upsertMetaByProperty("og:type", "website");
    upsertMetaByProperty("og:title", seo.title);
    upsertMetaByProperty("og:description", seo.description);
    upsertMetaByProperty("og:url", canonical);
    upsertMetaByName("twitter:card", "summary_large_image");
    upsertMetaByName("twitter:title", seo.title);
    upsertMetaByName("twitter:description", seo.description);
    upsertCanonical(canonical);
    upsertStructuredData(seo.structuredData);
  }, [location.pathname]);

  return null;
}

