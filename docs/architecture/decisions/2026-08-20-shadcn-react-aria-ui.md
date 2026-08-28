# Use shadcn/ui with React Aria for the web UI

| Field | Value |
| --- | --- |
| Status | Superseded |
| Date | 2026-08-20 |
| Superseded by | [Adopt a readability-first light UI preset](2026-08-28-readability-first-ui-preset.md) |

## Context

Yetano Work is growing from one case-management workspace toward a broader CRM/ERP interface. The
web application needs consistent, accessible controls and interaction patterns without making each
feature invent and maintain its own UI primitives. Accessibility and responsive performance are
product priorities, while the project still has only one frontend consumer and does not need a
separate shared UI workspace.

## Decision

Use app-local shadcn/ui components as the web UI foundation. Generate components with the React
Aria base and Nova style, use Tailwind CSS 4 for styling, and use CSS variables for semantic theme
tokens. Apply preset `b7kBsBkh7b`: Zinc surfaces, a green primary theme, medium radius, Geist Mono
body text, Instrument Sans headings, Remix Icon, subtle menu accents, and inverted translucent menu
color. Keep components under `apps/web` and treat their generated source as project-owned code.

Before implementing a custom UI primitive or interaction, check the current shadcn registry and
React Aria API. Prefer a matching shadcn component when it satisfies the behavior. Feature-specific
compositions remain project code and compose those primitives. When several matching components
exist, prefer the simplest accessible implementation, including native-backed controls when richer
interaction would add unnecessary runtime cost.

Target WCAG 2.2 AA for user-visible web behavior. Use automated accessibility checks together with
keyboard and focus tests; automation is evidence, not a complete conformance claim.

## Rationale

shadcn/ui provides accessible, modifiable source instead of an opaque component package. React Aria
aligns the component base with the accessibility priority, while semantic theme tokens let the
product adopt or revise a brand palette later without rewriting feature components. Keeping the
components app-local avoids a package boundary that has no second consumer.

## Alternatives considered

- Continue with feature-owned CSS and native controls. This keeps the smallest dependency graph but
  repeats accessibility, state, and styling work as the product grows.
- Use the Radix or Base UI shadcn bases. Both are supported, but React Aria more directly matches the
  project's accessibility-first priority.
- Create a shared UI workspace immediately. This adds release and ownership structure without a
  second frontend consumer.

## Consequences

- Tailwind CSS, shadcn/ui, React Aria, and their generated components become part of the web build.
- Feature code uses semantic tokens rather than literal palette colors.
- Contributors inspect the shadcn registry before adding custom UI primitives.
- Upstream component updates are deliberate source changes that require review and verification.
- Preset `b7kBsBkh7b` is active initially. Dark tokens may exist without a theme switcher.
- Future visual changes update semantic tokens or apply another reviewed shadcn preset.
- A form library remains a separate deferred decision.

## References

- [Repository technical foundation](../../../README.md#technical-foundation)
- [Web application instructions](../../../apps/web/AGENTS.md)
- [shadcn/ui introduction](https://ui.shadcn.com/docs)
- [Selected shadcn/ui preset](https://ui.shadcn.com/create?preset=b7kBsBkh7b)
- [shadcn/ui React Aria announcement](https://ui.shadcn.com/docs/changelog/2026-07-react-aria)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
