import { useEffect } from "react";

const DEFAULT_TITLE = "TapTime | Attendance and Shift Management";
const DEFAULT_DESCRIPTION =
  "TapTime helps teams manage attendance, employee sign-in, and shift operations from one streamlined web app.";

const ensureMetaTag = (selector, attributes) => {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
};

const ensureLinkTag = (selector, attributes) => {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
};

const ensureJsonLdScript = (id, payload) => {
  let element = document.head.querySelector(`#${id}`);

  if (!element) {
    element = document.createElement("script");
    element.type = "application/ld+json";
    element.id = id;
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(payload);
};

export default function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  robots = "index, follow",
  canonicalPath = "/",
  structuredData,
}) {
  useEffect(() => {
    const origin = window.location.origin;
    const canonicalUrl = new URL(canonicalPath, origin).toString();

    document.title = title;

    ensureMetaTag('meta[name="description"]', {
      name: "description",
      content: description,
    });
    ensureMetaTag('meta[name="robots"]', {
      name: "robots",
      content: robots,
    });
    ensureMetaTag('meta[property="og:title"]', {
      property: "og:title",
      content: title,
    });
    ensureMetaTag('meta[property="og:description"]', {
      property: "og:description",
      content: description,
    });
    ensureMetaTag('meta[property="og:url"]', {
      property: "og:url",
      content: canonicalUrl,
    });
    ensureMetaTag('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: title,
    });
    ensureMetaTag('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: description,
    });
    ensureLinkTag('link[rel="canonical"]', {
      rel: "canonical",
      href: canonicalUrl,
    });

    const jsonLdId = "seo-structured-data";
    if (structuredData) {
      ensureJsonLdScript(jsonLdId, structuredData);
    } else {
      const existingScript = document.head.querySelector(`#${jsonLdId}`);
      if (existingScript) {
        existingScript.remove();
      }
    }
  }, [canonicalPath, description, robots, structuredData, title]);

  return null;
}
