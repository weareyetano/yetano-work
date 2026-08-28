# Adopt a readability-first light UI preset

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-08-28 |
| Supersedes | [Use shadcn/ui with React Aria for the web UI](2026-08-20-shadcn-react-aria-ui.md) |

## Context

The initial shadcn/ui preset established the web component foundation but used Geist Mono for body
copy, compact controls, low-contrast neutral boundaries, and inverted translucent menus. That
combination made dense case lists, forms, timestamps, and activity sentences harder to scan than
the product's accessibility-first priority allows.

The component foundation remains suitable. The visual preset needs to change without altering the
case workspace layout, responsive behavior, or application workflows.

## Decision

Continue using app-local shadcn/ui components with the React Aria base, Nova style, Tailwind CSS 4,
semantic CSS variables, and Remix Icon. Replace preset `b7kBsBkh7b` with the project-owned **Clear
Desk** light preset.

Clear Desk uses Instrument Sans for interface and body text. Geist Mono is reserved for timestamps
and technical metadata. The default text size is 16 pixels with comfortable line height; secondary
metadata is 14 pixels; standard controls are 40 pixels high and primary mobile targets are 44
pixels high.

The preset uses cool neutral application and surface colors, dark navy text, a blue primary and
focus color, opaque light menus, and semantic status tones. Text, control boundaries, focus
indicators, selected states, and status labels must remain identifiable without relying on color
alone. The actively supported interface is light only and has no theme selector. Dormant dark
tokens or upstream dark modifiers may remain, but application components must not force dark mode.

Keep the existing panel grid, widths, breakpoints, content order, independent desktop scrolling,
and narrow-screen navigation flow.

## Rationale

Instrument Sans and a 16-pixel base improve continuous reading while retaining Geist Mono where
fixed-width digits help comparison. Stronger surface separation and form boundaries reduce the
effort needed to locate interactive controls. Opaque menus and explicit selected states avoid
contrast changing with content behind them. Text labels and icons on status badges keep lifecycle
meaning available independently of hue.

Retaining the existing component and token architecture makes the change reviewable and keeps
future feature UI aligned with the same accessibility defaults.

## Alternatives considered

- Keep the initial preset and adjust only the Cases screen. This would leave navigation, dialogs,
  Settings, and future modules visually inconsistent.
- Add a selectable high-contrast theme. This adds preference persistence and two supported visual
  systems before the product needs theme selection.
- Add a dark theme at the same time. This doubles the active contrast and visual verification
  surface without a current product requirement.

## Consequences

- Clear Desk is the single default visual preset for the web application.
- UI primitives use comfortable sizing and stronger focus and boundary contrast by default.
- Feature components continue to use semantic tokens instead of literal palette colors.
- Case status presentation is shared across the list, summary, and activity timeline.
- Automated WCAG checks remain necessary but do not replace visual and keyboard review.
- A future dark or user-selectable theme requires a separate reviewed decision and complete visual
  verification.

## References

- [Repository technical foundation](../../../README.md#technical-foundation)
- [Web application instructions](../../../apps/web/AGENTS.md)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
