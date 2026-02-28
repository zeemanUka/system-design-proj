# Lessons Learned

## 2026-02-27 - Avoid Basic Visual Delivery
- Correction pattern: user asked for a more interactive and appealing UI after seeing a basic implementation.
- Prevention rule: for frontend requests, define a clear visual system first (typography, color tokens, cards, buttons, motion) before editing individual pages.
- Prevention rule: always include a purposeful landing page when the product targets new users and onboarding flow starts from `/`.

## 2026-02-28 - Validate CORS Preflight for Non-GET Flows
- Correction pattern: user reported browser CORS errors on authenticated `PATCH` calls (autosave and traffic profile save).
- Prevention rule: after changing API security/CORS config, explicitly test `OPTIONS` preflight for `PATCH/PUT/DELETE` with `Authorization` and `Content-Type` headers.
- Prevention rule: include explicit CORS methods list with `PATCH` and `OPTIONS`; do not rely on defaults.
- Prevention rule: default local allowed origins must include both `http://localhost:3000` and `http://127.0.0.1:3000`.

## 2026-02-28 - Avoid Forced Remounts on User Click Paths
- Correction pattern: user reported visible quick page redraw/flicker on click across dashboard surfaces.
- Prevention rule: never key large layout wrappers (`section`, page containers, workspace grids) with frequently changing state used for local UI bookkeeping.
- Prevention rule: for transitions, use class toggles and CSS animation triggers instead of `key`-based remounts of major subtrees.
- Prevention rule: when adding undo/redo stacks with refs, trigger lightweight rerenders without remounting view roots.

## 2026-02-28 - Guard Prisma Major-Version Mismatch
- Correction pattern: user hit Prisma error saying datasource `url` is unsupported while project schema intentionally uses Prisma 6 format.
- Prevention rule: for Prisma commands, prefer workspace scripts (`npm --workspace @sdc/api run ...`) over direct/global CLI usage.
- Prevention rule: when a Prisma schema error seems inconsistent with repo code, verify local Prisma version first (`npx prisma -v`) before editing schema.
- Prevention rule: add explicit troubleshooting docs for Prisma 6/7 version mismatch and editor plugin version selection.

## 2026-02-28 - Always Generate Prisma Client Before CI Typecheck/Build
- Correction pattern: CI failed with missing Prisma model/payload/json types (`ProjectGetPayload`, `InputJsonValue`, `User`) after clean install.
- Prevention rule: every CI workflow that runs lint/typecheck/build must run `npm --workspace @sdc/api run prisma:generate` immediately after dependency installation.
- Prevention rule: if TypeScript errors report missing `Prisma.*GetPayload`, `Prisma.JsonValue`, or `@prisma/client` model exports, first verify client generation rather than editing app code.

## 2026-02-28 - Enforce Server-Managed Auth and Secret Hygiene
- Correction pattern: security audit flagged client-set auth cookies, JWT fallback secret, and secret hygiene gaps.
- Prevention rule: never set sensitive auth cookies from frontend JavaScript; auth cookies must be API-managed with `HttpOnly` and production `Secure`.
- Prevention rule: do not allow fallback values for critical auth secrets (`JWT_SECRET`); fail startup when missing.
- Prevention rule: enforce secret hygiene in CI (`.env` must not be tracked) and avoid insecure default credentials in examples/fallbacks.
