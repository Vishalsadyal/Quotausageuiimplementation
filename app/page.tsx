import type { Metadata } from "next";
import App from "../src/app/App";
import { OG_IMAGE, canonicalForPath, resolveSeo } from "../src/app/seo/seoConfig";

export function generateMetadata(): Metadata {
  const seo = resolveSeo("/");
  const canonical = canonicalForPath("/");
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical },
    robots: seo.index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      type: "website",
      siteName: "AutoApply CV",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [OG_IMAGE.url],
    },
  };
}

export default function HomePage() {
  const seo = resolveSeo("/");
  const structuredData = seo.structuredData;

  return (
    <>
      {structuredData ? (
        <script
          id="careerpilot-structured-data"
          type="application/ld+json"
          // JSON-LD is expected to be a plain string.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(Array.isArray(structuredData) ? structuredData : structuredData),
          }}
        />
      ) : null}
      <App initialPathname="/" />
    </>
  );
}
