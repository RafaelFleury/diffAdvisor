---
name: Next.js
detect:
  files: ["package.json", "next.config.js", "next.config.mjs"]
  content_patterns: ["next", "nextjs"]
  extensions: [".jsx", ".tsx"]
tags: [frontend, fullstack, nextjs, react]
description: Next.js specific concerns including SSR/SSG trade-offs, API routes security, middleware, and caching
---

## Next.js-Specific Concerns

### Rendering Strategy
- Is the correct rendering strategy chosen for each page (SSR vs SSG vs ISR vs client)?
- Are pages that can be static using generateStaticParams / getStaticPaths?
- Is ISR revalidation time appropriate for the data freshness requirements?
- Are client components marked with 'use client' only when necessary?

### API Routes / Route Handlers
- Are API routes validating input and authentication?
- Are API routes using appropriate HTTP methods?
- Is rate limiting applied to API routes?
- Are responses setting correct cache headers?
- Are route handlers not importing client-side code?

### Middleware
- Is Next.js middleware used appropriately (auth checks, redirects, headers)?
- Is middleware running only on necessary paths (matcher config)?
- Is middleware fast (no heavy computation or database calls)?

### Data Fetching
- Are server components fetching data directly (not through API routes)?
- Is fetch caching configured correctly (revalidate, no-store)?
- Are loading.tsx and error.tsx boundaries in place?
- Is parallel data fetching used where possible?

### Security
- Are environment variables prefixed correctly (NEXT_PUBLIC_ only for client-side)?
- Are server actions validated and rate-limited?
- Is CSRF protection in place for mutations?
- Are headers configured in next.config.js for security?

### Performance
- Are images using next/image with proper sizing?
- Is next/font used for font optimization?
- Are dynamic imports used for heavy client components?
- Is bundle size monitored (@next/bundle-analyzer)?
