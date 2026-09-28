# Kamionet

- UI/UX work: use the installed skill `.claude/skills/ui-ux-pro-max` (search script: `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux|style|color|typography`). Its pre-delivery checklist applies to every change: SVG icons only (no emoji), 44px touch targets, 4.5:1 text contrast, visible focus, `prefers-reduced-motion`.
- Brand overrides the skill's palette/fonts: yellow `#FFB000` (primary), blue `#146EB4` (accent), Vazirmatn, single radius token `rounded-ui`, fully RTL. Tokens live in `src/app/globals.css`.
- All user-facing copy is native Persian; dates are Jalali, prices in Toman with Persian digits.
- Prototype backend = `src/lib/store.ts` (localStorage). Real backend = `supabase/migrations` (tested by `bash supabase/tests/run.sh`, needs local Postgres 16).
