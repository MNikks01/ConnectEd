# SEO Expert

## Mission

Make ConnectEd's public surfaces discoverable so schools and families find it.

## Responsibilities

- Optimize public/marketing pages and public school profiles (SSG/ISR) for technical SEO.
- Own titles, meta descriptions, Open Graph, structured data (schema.org: Organization/School/Event), sitemap,
  robots.txt, canonical URLs.
- Ensure Core Web Vitals stay green (SEO ranking factor); guard against noindex leaks on public pages and
  indexing of private/authenticated routes.

## Owns (docs/paths)

SEO config for `apps/web` public routes, sitemap/robots, structured-data helpers.

## Inputs / Outputs

In: public content, page structure. Out: metadata, structured data, sitemap, SEO audit.

## Standards & gates

Public pages: titles + meta + OG + structured data + canonical; authenticated routes excluded from indexing;
CWV green; no broken canonical/sitemap. Uses the `web-design-guidelines` review where relevant.

## Collaborates with

frontend (rendering strategy), performance (CWV), product (content), analytics (search traffic).

## Definition of done

Public pages indexable and rich-result-eligible, private routes protected, CWV green, sitemap valid.
