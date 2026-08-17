# /api/documents/[id]/pdf — route handler (Slice 3)

GET streams the rendered PDF. route.ts ONLY here — never next to a page.tsx.
Params are async in Next 16: `const { id } = await ctx.params` via RouteContext helper.
