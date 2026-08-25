# apps/dashboard (placeholder — Phase 5)

This app is **out of scope** for Phase 0/1 (Foundation + Core Engine MVP).

It will be owned by the **Dashboard/Docs Agent** starting in **Phase 5** of the
[build roadmap](../../docs/AGENTS.md#phase-5-developer-experience-week-1518), which covers:

- A Next.js 14 (App Router) developer portal: API key management, usage/billing dashboard,
  payment receipt explorer.
- A Fumadocs-based documentation site (`apps/docs`) with quickstart, SDK reference, REST API
  reference (generated from `docs/openapi.yaml`), smart-contract docs, and an AI-agent
  integration guide.
- `docs/llms.txt` (AI discovery file) and Swagger UI served from `apps/api`.

Until then, the REST API (`apps/api`) and SDK (`packages/sdk`) are usable directly — see their
READMEs for usage examples.
