# Frontend Engineering Master Checklist

`Status: Accepted` · `Last updated: 2026-07-28`

Frontend Engineer → Senior → Architect. ConnectEd uses this as a PR/feature gate (see
[`00-index.md`](./00-index.md)).

## Level 1 — Frontend Engineer

### 1. Requirements & Planning
- [ ] Understand business requirements, user expectations, acceptance criteria, personas, journeys, success
  metrics, edge cases.
- [ ] UI/UX: review designs; verify responsive, accessibility, animations/interactions, supported browsers.
- [ ] State planning: Loading / Error / Empty / Success / Offline states identified.
- [ ] Technical planning: component structure, state-management strategy, API-integration strategy, reusable
  components.

### 2. Project Structure
- [ ] Consistent folder structure; UI separated from business logic; modular components; feature-based
  organization; shared library; clear module boundaries.

### 3. Code Quality
- [ ] Meaningful names (component/variable/file); DRY; small functions; no giant components; no deep nesting;
  no dead code; consistent conventions.
- [ ] Components: single responsibility, reusable, predictable, testable.

### 4. Type Safety (TypeScript)
- [ ] No `any`; interfaces/types defined; API responses, props, hooks, global state typed.

### 5. Component Development
- [ ] Props typed, documented, minimal. State necessary, localized, not duplicated.
- [ ] Proper conditional rendering & list keys; avoid unnecessary rerenders; avoid prop drilling; use composition.

### 6. State Management
- [ ] `useState`/`useReducer` used appropriately; global state minimized (Redux only if necessary; state
  normalized).
- [ ] Server state (TanStack Query): cache, revalidation, retry, stale-data handling.

### 7. API Layer
- [ ] API abstraction; request/response interceptors; retries.
- [ ] Loading/Error/Empty/Success/Offline states handled in UX.

### 8. Forms
- [ ] Validation (required, email, password, file, custom) with clear messages.
- [ ] Disable submit during submission; loading + success feedback.

### 9. Security
- [ ] No secrets/API keys exposed; CSP; XSS prevention; CSRF mitigation; sanitize input/HTML; avoid
  `dangerouslySetInnerHTML`.
- [ ] Auth: session handling, token expiration, refresh flow, route guards, logout clears sensitive data.

### 10. Performance
- [ ] Avoid unnecessary renders; `React.memo`/`useMemo`/`useCallback` where appropriate.
- [ ] Code splitting, lazy loading, dynamic imports, tree shaking, remove unused deps.
- [ ] Images: compress, WebP/AVIF, lazy load, responsive.

### 11. Accessibility (WCAG)
- [ ] Semantic HTML; form labels; keyboard nav; screen-reader support; focus management; ARIA; color contrast;
  alt text.

### 12. Responsive Design
- [ ] Mobile/tablet/desktop/large/ultrawide; no horizontal scroll; no broken layouts; images/typography scale.
- [ ] Test slow 3G / offline / poor connectivity.

### 13. Error Handling
- [ ] Graceful, friendly errors; retry; error boundaries; fallback UI.

### 14. Testing
- [ ] Unit (components/hooks/utils); integration (flows/forms/API); E2E (auth, critical flows).

### 15. Monitoring & Analytics
- [ ] Error/crash/performance monitoring; interaction/event/funnel/conversion tracking.

### 16. SEO
- [ ] Titles, meta descriptions, Open Graph, structured data, sitemap, robots.txt; good Core Web Vitals; fast
  load; optimized assets.

### 17. Git & Delivery (before commit)
- [ ] Builds; lint passes; tests pass; no console logs; no commented code; no secrets committed.

## Level 2 — Frontend Architect
- [ ] **18. Architecture:** SPA/SSR/SSG/ISR decision documented; rendering & state strategy documented; scalable
  structure; multi-team support; design system enforced; shared UI library; ownership boundaries.
- [ ] **19. Design System:** color/typography/spacing/elevation tokens; button/form/modal/table/notification
  systems.
- [ ] **20. Performance Architecture:** LCP/CLS/INP optimized; TTFB monitored; Server Components/Suspense/
  streaming evaluated; bundle analysis, budgets, dependency audits.
- [ ] **21. Internationalization:** multiple languages (English + Hindi), date/currency/timezone formatting; RTL.
- [ ] **22. Observability:** error monitoring, session replay, performance monitoring; business KPIs, funnels,
  observable journeys.
- [ ] **23. CI/CD:** lint, type-check, unit/integration tests, build verification; preview deploys, canary,
  rollback, feature flags, kill switches.
- [ ] **24. Production Readiness:** Lighthouse > 90, a11y > 90, performance > 90; no console/TS/ESLint errors.

## Gold Standard Feature Review
- [ ] Loading / Error / Empty / Success / Responsive / Accessibility states implemented.
- [ ] Security reviewed; performance reviewed; test coverage adequate; component reusable; maintainable
  (understandable in 6 months).

## Architect Final Questions
- [ ] Handles 1M users? slow networks? API failures? slow devices? maintainable by 20 devs? onboardable in a
  week? every interaction observable? every critical flow tested? rollback in minutes? production-grade?
