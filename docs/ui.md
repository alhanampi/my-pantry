# UI Standards — Mi Despensa

## Component library

**Material-UI (MUI) v5** is the primary component library (`@mui/material`, `@mui/icons-material`). Styling is a hybrid of MUI's `ThemeProvider` and **styled-components v6** for custom layout and component overrides.

Icons come from **react-icons v5** (Material Design set, `react-icons/md`).

---

## Theming

### Color scheme system

The app has **6 selectable color schemes**, all defined in `src/styles/colorSchemes.ts`. The active scheme is stored in `localStorage` under `mi-despensa-color-scheme` and applied at runtime via `applySchemeVars()`, which sets CSS custom properties on `document.documentElement`.

| Scheme  | Mode  | Primary color       |
| ------- | ----- | ------------------- |
| Green   | Light | `#2e7d32` (default) |
| Light   | Light | `#546e7a`           |
| Dark    | Dark  | `#90caf9`           |
| Pink    | Light | `#c2185b`           |
| Celeste | Light | `#0288d1`           |
| Purple  | Light | `#7b1fa2`           |

### CSS custom properties

All components consume colors through CSS variables. Never hard-code colors — use the variables below:

| Variable                  | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `--scheme-bg`             | Page background                                    |
| `--scheme-surface`        | Card / surface background                          |
| `--scheme-surface-alt`    | Alternate surface                                  |
| `--scheme-primary`        | Primary brand color                                |
| `--scheme-primary-dark`   | Hover / active state                               |
| `--scheme-primary-light`  | Subtle accent                                      |
| `--scheme-text-primary`   | Main text                                          |
| `--scheme-text-secondary` | Secondary / label text                             |
| `--scheme-text-muted`     | De-emphasized text                                 |
| `--scheme-border`         | Default border                                     |
| `--scheme-error-bg`       | Error state background (`#ffebee`)                 |
| `--scheme-info-bg`        | Info state background (`#e3f2fd`)                  |
| `--scheme-overlay-*`      | Opacity-based overlays (0.15 / 0.18 / 0.20 / 0.28) |
| `--scheme-hover-overlay`  | Subtle hover background (light: `rgba(0,0,0,0.06)`, dark: `rgba(255,255,255,0.06)`) |
| `--scheme-swatch-active-border` | Active swatch ring (light: `rgba(0,0,0,0.45)`, dark: `rgba(255,255,255,0.55)`) |
| `--scheme-shadow-xs`      | Extra-small drop-shadow (light: `rgba(0,0,0,0.08)`, dark: `rgba(0,0,0,0.15)`) — cards |
| `--scheme-shadow-sm`      | Small drop-shadow (light: `rgba(0,0,0,0.25)`, dark: `rgba(0,0,0,0.25)`) — swatches |
| `--scheme-shadow-md`      | Medium drop-shadow (light: `rgba(0,0,0,0.5)`, dark: `rgba(0,0,0,0.7)`) — map markers |

Semantic MUI palette slots:

- **Secondary**: orange (`#ff8f00`)
- **Error**: `#c62828`
- **Warning**: `#e65100`
- **Info**: blue (`#90caf9`)

### Theme file locations

- `src/styles/colorSchemes.ts` — scheme definitions, `baseThemeOptions`, `createAppTheme()` and `applySchemeVars()` (all MUI theme building now lives here — there is no separate `theme.ts`)
- `src/contexts/ThemeContext.tsx` — React context that drives scheme switching

---

## Typography

- **Font**: Roboto, loaded from Google Fonts in `index.html`
- **Weights used**: 300, 400, 500, 600, 700

| Variant     | Usage                                     |
| ----------- | ----------------------------------------- |
| `h6`        | Dialog/section titles (`fontWeight: 700`) |
| `subtitle1` | Card subtitles (`fontWeight: 600`)        |
| `body1`     | Default text                              |
| `body2`     | Secondary body text                       |
| `caption`   | Fine print / labels (`0.75rem`)           |

Font sizes are made responsive with the MUI `sx` prop using breakpoint objects, e.g.:

```tsx
sx={{ fontSize: { xs: '0.95rem', sm: '1.15rem' } }}
```

---

## Spacing & shape

- **Border radius — buttons**: `8px`
- **Border radius — dialogs / cards**: `14px`
- **Button padding**: `8px 20px`
- **Button text transform**: `none` (override MUI default)
- **Button font weight**: `600`
- Spacing follows MUI's default 8 px grid.

---

## Responsive design

**Primary breakpoint: 600 px** (aligns with MUI `sm`).

### Mobile (< 600 px)

- Fixed **BottomNav** bar (z-index 1100); adds `72px` bottom padding to the page
- Hamburger menu drawer (slides from right)
- Search bar moves below the header title
- Dialog margins collapse to `8px`
- Desktop-only elements hidden via `display: none`

### Desktop (≥ 600 px)

- Horizontal tab navigation in the header
- Inline search bar
- Icon + label action buttons
- BottomNav and mobile drawer hidden
- Dialog margins `24px`

Implementation uses styled-components `@media` queries and `useMediaQuery(theme.breakpoints.down('sm'))` where logic is needed in JS.

---

## Component file conventions

Every component in `src/components/` follows this structure:

```
ComponentName/
  index.tsx           # Component logic and JSX
  ComponentName.styles.ts  # All styled-components for this component
```

Views under `src/views/` follow the same pattern, with sub-components nested inside the view folder.

### Styled-components specificity

Use the `&&` double-ampersand selector when overriding MUI defaults to avoid `!important`:

```ts
const StyledButton = styled(Button)`
  && {
    border-radius: 8px;
    text-transform: none;
  }
`
```

---

## Modals / dialogs

Use MUI `Dialog` as the base. Standard structure:

```tsx
<Dialog>
  <DialogTitle>{/* icon + title text + close IconButton */}</DialogTitle>
  <Divider />
  <DialogContent>{/* scrollable body */}</DialogContent>
  <DialogActions>{/* cancel + confirm buttons */}</DialogActions>
</Dialog>
```

- `borderRadius: 14px` applied via theme override
- Full-width on mobile with `8px` margin; constrained `maxWidth` on desktop

---

## Icons

Use `react-icons/md` (Material Design). Common sizes: `14`, `16`, `18`, `20`, `22`, `24`, `28` px.

Color should reference CSS variables or MUI palette tokens:

```tsx
<MdDelete color="var(--scheme-primary)" size={20} />
```

---

## Do not

- Hard-code hex colors anywhere — use `--scheme-*` variables or MUI palette tokens.
- Use a separate CSS file for component styles — keep everything in the paired `.styles.ts`.
- Override MUI with `!important` — use `&&` specificity instead.
- Add a new color scheme without updating `src/styles/colorSchemes.ts` and the `ThemePicker` component.
