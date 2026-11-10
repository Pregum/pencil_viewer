# Pencil built-in libraries

Files in this directory are the design kits that ship inside the Pencil desktop app
(pen.dev). Documents made from a kit import it as `pencil:<name>.lib.pen`, for example:

```json
"imports": { "j": "pencil:shadcn.lib.pen" }
```

The app is the only place these files exist, so Pencil Viewer bundles a copy and loads it
only when an opened document imports it (see `src/pen/libraries.ts`).

| File | Source | Format version |
| --- | --- | --- |
| `shadcn.lib.pen` | Pencil 1.1.68 (`Pencil.app/Contents/Resources/app.asar` → `out/data/shadcn.lib.pen`) | 2.8 |

## License

These kits are made by High Agency, Inc. (pen.dev), not by this project, and are not covered
by this repository's MIT license. The [pen.dev Terms of Use](https://www.pen.dev/terms-of-use)
(section 5a) release "Design Assets" (style guides, design kits, UI components and icons that
pen.dev makes available and identifies as Design Assets) under the
[Unlicense](https://unlicense.org/). The shadcn kit is based on [shadcn/ui](https://ui.shadcn.com/)
(MIT). If pen.dev asks for these files to be removed, delete them here and from
`BUILTIN_LIBRARIES` in `src/pen/libraries.ts`; documents that import them still open, with the
kit's components shown as placeholders.
