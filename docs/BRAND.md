# Brand and design tokens

AllovWapp is infrastructure for people who build software. The look is calm, precise and readable. There is one light theme. There is no dark theme, no theme switch and no `prefers-color-scheme` rule.

Tokens are defined once in `web/styles/tokens.css` and mapped to Tailwind names in `web/tailwind.config.ts`.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| Product green | `#25D366` | Primary button fill, active navigation marker. Always with dark text. |
| Deep green | `#128C7E` | Hover fill for primary buttons. |
| Green text | `#0B6B5F` | Green used as text on light backgrounds (darkened from Deep green). |
| Allovity blue | `#246BFE` | Focus ring, selected accents, symbol. |
| Blue text | `#1D5FE8` | Links (darkened from Allovity blue). |
| Ink | `#0B1220` | Primary text and headings. |
| Muted ink | `#4B5768` | Secondary text and helper lines. |
| Cyan | `#0090C2` | Reserved for data visualisation fills. |
| Cyan text | `#00769E` | Cyan used as text (darkened). |
| Success | `#128C56` | Success fills and icons. |
| Success text | `#0F7A4A` | Success used as text (darkened). |
| Warning | `#9A6400` | Warning text and icons. |
| Danger | `#C8343F` | Errors and destructive actions. |
| Background | `#F7F9FC` | Page background. |
| Surface | `#FFFFFF` | Cards and panels. |
| Border | `#DCE3ED` | Dividers and card borders. |
| Strong border | `#7C8AA0` | Input and button borders (needs 3:1 against the surface). |

Soft banner backgrounds: info `#EAF1FF`, warning `#FFF6E5`, danger `#FDECEE`, success `#E8F6EE`. Text on them is always Ink.

Green is an accent. It is a button fill and a small navigation marker, not the colour of every border and card.

## Measured contrast (WCAG 2.x relative luminance)

AA needs 4.5:1 for normal text and 3:1 for large text and interface boundaries.

| Combination | Ratio | Result |
|---|---|---|
| Ink on Background | 17.75 | pass |
| Ink on Surface | 18.72 | pass |
| Muted ink on Background | 6.96 | pass |
| Muted ink on Surface | 7.34 | pass |
| Ink on Product green (button) | 9.44 | pass |
| Ink on Deep green (button hover) | 4.53 | pass |
| Green text on Surface | 6.40 | pass |
| Blue text on Surface | 5.45 | pass |
| Blue text on Background | 5.17 | pass |
| Cyan text on Surface | 5.14 | pass |
| Success text on Surface | 5.38 | pass |
| Warning on Surface | 5.00 | pass |
| Warning on Background | 4.74 | pass |
| Danger on Surface | 5.23 | pass |
| Danger on Background | 4.95 | pass |
| Strong border on Surface | 3.50 | pass (interface boundary) |
| Allovity blue on Surface (focus ring) | 4.56 | pass (3:1 needed) |

Values adjusted from the brief, and why:

- Deep green `#128C7E` on white measures 4.14, which fails for text. It is kept only as a button hover fill under Ink text (4.53). Green used as text uses `#0B6B5F`.
- Allovity blue `#246BFE` on Background measures 4.32, which fails for text. Links use `#1D5FE8`.
- Cyan `#0090C2` on white measures 3.64, which fails for text. Text uses `#00769E`.
- Success `#128C56` on white measures 4.28, which fails for text. Text uses `#0F7A4A`.
- The brief's Border `#DCE3ED` is only 1.29:1 against white. It is used for decorative dividers. Form inputs and secondary buttons use `#7C8AA0` so their edges are visible.

The ratios above were computed with a script from the hex values. They have not been checked in a rendered browser.

## Type

- Space Grotesk for headlines and the product name.
- Inter for interface and body text.
- JetBrains Mono for code, identifiers, request ids and technical values.

Fonts are self hosted through `@fontsource` packages. Nothing loads from another website at runtime.

Scale: 12, 14, 16, 18, 22, 28, 36 pixels (`xs`, `sm`, `base`, `lg`, `xl`, `2xl`, `3xl`).

## Spacing, radius, shadow

- Spacing: the Tailwind 4 pixel scale. In practice the interface uses 1, 2, 3, 4, 5, 6, 8 and 10 steps.
- Radius: 6 pixels (small badges), 10 pixels (controls), 14 pixels (cards).
- Shadows: `card` (a 1 pixel soft shadow) and `pop` (menus).
- Motion: only colour transitions and a loading pulse. Reduced motion is respected.

## Logo

The symbol is an arch with a dot passing through it: a gateway joining two sides. It is built from one thick stroke and one circle, with no gradients, so it stays readable at 16 and 32 pixels. It is original and does not resemble a telephone or a speech bubble.

Files in `web/public/`: `logo.svg` (symbol and name), `logo-symbol.svg`, `logo-white.svg` and `logo-dark.svg` (single colour), `favicon.svg`.

The name in the SVG logo files is live text with a font fallback list, so it will use Space Grotesk only where that font is installed. Convert the text to outlines when final artwork is prepared. Inside the dashboard the name is real text in Space Grotesk.

"By Allovity" appears as a small line in the public page footer and on the sign in page. It is never part of the product name.

## Layout

- Below 768 pixels: compact top bar (logo and account menu) and a fixed bottom navigation bar with targets at least 56 pixels tall.
- 768 to 1023 pixels: the top bar also holds the navigation links.
- 1024 pixels and wider: left sidebar (logo, navigation, workspace name at the bottom) and a top bar with the page title and account menu.
- Content has a 56 rem maximum width.
