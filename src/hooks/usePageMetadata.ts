import { useEffect } from 'react';

export interface PageMetadataOptions {
  canonicalPath?: string;
  type?: 'website' | 'article' | 'product';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

const FALLBACK_SITE_URL = 'https://drifter1987.github.io/AutoParts-dc';

/** Build a public, base-path-correct URL independent of the prerender host. */
export function siteUrl(path = '/'): string {
  const origin = (
    import.meta.env.VITE_SITE_URL ||
    (import.meta.env.PROD ? FALLBACK_SITE_URL : `${window.location.origin}${import.meta.env.BASE_URL}`)
  ).replace(/\/$/, '');
  return `${origin}/${path.replace(/^\//, '')}`;
}

function appRelativePath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (base && path.startsWith(base)) return path.slice(base.length) || '/';
  return path || '/';
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/** Keep titles, descriptions, canonical/OG/Twitter tags, and JSON-LD in sync per route. */
export function usePageMetadata(
  title: string,
  description: string,
  options: PageMetadataOptions = {},
): void {
  const { canonicalPath, type = 'website', jsonLd, noindex = false } = options;

  useEffect(() => {
    document.title = title;

    const path = appRelativePath(canonicalPath || window.location.pathname);
    const canonical = siteUrl(path);

    document.head
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', description);

    let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonical);

    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:site_name', 'AutoParts');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:image', siteUrl('favicon.svg'));
    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex,follow' : 'index,follow');

    const existing = document.head.querySelector<HTMLScriptElement>('script[data-page-json-ld="true"]');
    existing?.remove();

    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.pageJsonLd = 'true';
      const payload = Array.isArray(jsonLd)
        ? jsonLd.map(item => ({ '@context': 'https://schema.org', ...item }))
        : { '@context': 'https://schema.org', ...jsonLd };
      script.textContent = JSON.stringify(payload);
      document.head.appendChild(script);
    }
  }, [title, description, canonicalPath, type, jsonLd, noindex]);
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: siteUrl(item.path),
    })),
  };
}
