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
