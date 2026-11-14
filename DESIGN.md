# DESIGN.md: Grace Chat Interface

This document describes the visual design of the Grace chat interface, based on the five app screenshots provided. Colors are estimated from the screenshots and should be checked against the source files before production use.

Use this file as the reference when building new screens, components, or states so they match the existing look.

---

## 1. Design Principles

1. **Dark, quiet, focused.** The interface is pure black with muted grays. The chat content is the main focus, and controls stay visually light until the user needs them.
2. **One accent color.** Blue marks interactive or active elements only: the effort slider, the credits ring, primary buttons, and the send/effort indicators.
3. **Round everything.** Buttons, the input bar, pills, and menus use fully rounded or large-radius shapes. Keep the shapes consistent.
4. **Personal and calm.** The greeting uses the user's first name and a short, open question. Copy is brief and conversational.
5. **Clear limits, no surprises.** Usage, credits, and costs are always visible and easy to understand before the user spends them.

---

## 2. Color Tokens

| Token | Hex (approx.) | Usage |
|---|---|---|
| `--color-bg` | `#000000` | App background, full screen |
| `--color-surface` | `#1C1C1E` | Input bar, modal, dropdown menus |
| `--color-surface-raised` | `#26262A` | Menu rows on press, modal cards |
| `--color-control` | `#1A1A1C` | Circular icon buttons (menu, credits ring) |
| `--color-border` | `#2E2E32` | Subtle outlines on pills, cards, and the input bar |
| `--color-text-primary` | `#FFFFFF` | Headings, labels, menu item text |
| `--color-text-secondary` | `#9A9A9F` | Greeting text, footer note, disabled labels |
| `--color-text-muted` | `#5C5C62` | Helper text, "Soon" badge, placeholder text |
| `--color-accent` | `#3B82F6` | Active slider, progress ring, "Buy credits", highlighted words |
| `--color-accent-soft` | `#1E2A44` | Outlined secondary button background ("Buy Apex") |
| `--color-accent-text` | `#7AA8FF` | Text on outlined secondary buttons |
| `--color-disabled` | `#3A3A3F` | Disabled send button, disabled menu items |

**Rules**
- Never use blue for body text or decoration. Blue means "this is active or can be acted on."
- Use white for primary text and gray for secondary text. Do not use pure gray backgrounds on the main screen.
- Do not add gradients to the background. The screen is flat black.

---

## 3. Typography

**Typeface:** Roboto (or a close system sans-serif such as the platform default). Use one family throughout.

| Role | Size | Weight | Color | Example |
|---|---|---|---|---|
| Greeting | 28px / 34px line height | 500 | `text-secondary` | "Where should we start, Ritam?" |
| Modal title | 26px / 32px | 700 | `text-primary` | "Usage & Limits" |
| Agent name pill | 18px / 24px | 700 | `text-primary` | "Grace" |
| Effort label | 32px / 40px | 700 | Mixed: first word `accent`, second word `text-primary` | "Instant effort" |
| Menu item | 20px / 26px | 500 | `text-primary` | "Attach files" |
| Body / stat label | 18px / 24px | 400 | `text-secondary` | "This month" |
| Stat value | 18px / 24px | 700 | `text-primary` | "8% used" |
| Helper text | 14px / 20px | 400 | `text-muted` | "Grace can make mistakes." |
| Badge | 12px / 16px | 700 | `text-primary` | "APEX", "92" |

**Rules**
- Keep line length under 60 characters on mobile.
- Use sentence case for all labels. Do not use ALL CAPS.
- Use the two-tone effort label (accent word + white word) only for the effort slider title. Do not reuse this treatment elsewhere.
- Do not use a monospace font.

---

## 4. Spacing and Layout

Use an 8px base grid.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Icon-to-label gap inside a pill |
| `space-2` | 8px | Gap between related controls |
| `space-3` | 12px | Inner padding of compact pills |
| `space-4` | 16px | Standard screen side margin |
| `space-5` | 24px | Gap between major sections |
| `space-6` | 32px | Space above the effort label |

- **Screen margins:** 16px on both sides on phones.
- **Header height:** about 88px. Contains menu button (left), agent avatar (center), and credits ring (right).
- **Input bar:** full width minus 16px margins, about 72px tall, anchored to the bottom with 16px bottom padding. Safe-area inset must be respected.
- **Chat area:** fills the space between the header and the input bar. Scroll vertically only.

### Layout Sketch (Home Screen)

```
+-----------------------------------+
| (≡)        [avatar]        (92)   |  <- header: menu, agent, credits
|             Grace               |
|                                   |
|    Where should we start, Ritam?  |  <- greeting, centered
|                                   |
|                                   |
|                                   |  <- chat area (empty on home)
|                                   |
| ( + ) Ask Grace  (gauge)(mic)(↑)  |  <- input bar
|     Grace can make mistakes.      |  <- helper text, centered
+-----------------------------------+
```

### Alignment
- Greeting and helper text: **center aligned.**
- Chat messages: **left aligned** for assistant, **right aligned** for user (standard chat convention).
- Menu items: **left aligned** with icon on the left.
- Stats and modal rows: **left aligned** label, **right aligned** value.

---

## 5. Shape, Radius, and Elevation

| Element | Radius | Border | Shadow |
|---|---|---|---|
| Circular icon buttons | 50% (full circle) | none, or 1px `border` | none |
| Agent avatar | 50% | 1px `border` | none |
| Name pill ("Grace") | 999px | 1px `border` | none |
| Input bar | 999px | 1px `border` | none |
| Dropdown menu | 24px | 1px `border` | 0 8px 24px rgba(0,0,0,0.5) |
| Modal | 28px | 1px `border` | 0 16px 40px rgba(0,0,0,0.6) |
| Modal inner cards | 20px | 1px `border` | none |
| Buttons (primary, secondary) | 999px | none (primary) / 1px accent (secondary) | none |
| Toggle | 999px | none | none |

**Rule:** Elevation comes from the dark background and borders, not from shadows. Use shadows only on floating layers (menus and modals).

---

## 6. Components

### 6.1 Header

- **Menu button:** 56px circle, `control` background, three horizontal lines in `text-primary`. Opens the side drawer.
- **Agent avatar:** 72px circle, `control` background, with the Grace logo mark in light gray. Sits centered and overlaps the top edge slightly.
- **Name pill:** centered beneath the avatar, `control` background, 1px `border`, text "Grace" in bold.
- **Credits ring:** 56px circle. A thin progress ring shows usage (white on dark, blue when a usage ring is active). The number inside (for example "92") is the remaining percentage.
  - Tapping it opens the **Usage & Limits** modal.

### 6.2 Greeting

- Centered text, `text-secondary`, 28px.
- Uses the user's first name at the end: "Where should we start, {name}?"
- Rotate the question with the context. Examples from the screenshots: "Where should we start, {name}?" and "What needs clarity, {name}?"
- Show the greeting only on an empty conversation. Hide it as soon as messages appear.

### 6.3 Input Bar

Layout from left to right:
1. **Plus button (+):** opens the attach menu. Icon is white, 24px.
2. **Text field:** placeholder "Ask Grace", `text-muted`, 18px. Grows up to 5 lines, then scrolls.
3. **Effort control (gauge icon):** 32px, blue arc. Tapping opens the effort slider.
4. **Microphone:** 24px white icon. Starts voice input.
5. **Send button:** 56px circle. Disabled (`--color-disabled`) when the field is empty. Turns solid white or accent when text is present.

**States**
- *Empty:* send disabled, mic visible.
- *Typing:* mic hides, send button enables.
- *Sending:* send button shows a spinner or stop icon.

### 6.4 Attach Menu (opened from +)

A floating panel above the input bar, 24px radius, `surface` background, about 300px wide. Rows, top to bottom:

| Row | Icon | Label | Status |
|---|---|---|---|
| Attach files | Paperclip | "Attach files" | Enabled |
| Take photo | Camera | "Take photo" | Enabled |
| Create an image | Image frame | "Create an image" | Disabled, with "Soon" badge in `text-muted` |
| Deep Research | Open book | "Deep Research" | Enabled, with cost "25 credits" on the right |

- Each row is at least 56px tall.
- Disabled rows use `text-muted` and do not respond to taps.
- Show credit cost on the right in `text-secondary` when a feature uses credits.

### 6.5 Effort Slider

Opened from the gauge icon. A full-width bar above the input bar.

- **Track:** pill shape, `surface` background, about 56px tall.
- **Thumb:** 72px white circle with a 4px accent ring.
- **Label above:** the current level name, for example "Instant effort" or "Ultra effort". First word in `accent`, second word in white.
- **Levels:** Instant → Ultra. Use discrete steps. Show a dot marker at the ultra end when not selected.
- **Filled state:** the track fills with `accent` from the left up to the thumb.
- Dragging should update the label live.

Level names in order: Instant effort, then intermediate levels, then Ultra effort. Keep the same two-word pattern.

### 6.6 Usage & Limits Modal

Opened from the credits ring.

- **Container:** 28px radius, `surface` background, 1px `border`, about 90% screen width, centered.
- **Title row:** "Usage & Limits" on the left, plan badge on the right (pill, `control` background, "APEX" in bold).
- **Usage card:** 20px radius, `control` background.
  - Label "This month" in `text-secondary`, value "8% used" in bold white.
  - Progress bar: 8px tall, `border` color track, white fill (or accent when active).
  - Caption "Resets December 1" in `text-secondary`.
- **Toggle row:** "Show credit percentage" with a toggle on the right. When on, the toggle is white with a dark thumb.
- **Actions:**
  - "Buy Apex": outlined, `accent-soft` background, 1px accent border, `accent-text` label.
  - "Buy credits": solid `accent` background, white label.
  - Buttons sit side by side with equal width and 12px gap.
- **Footer:** full-width "Done" text button in `text-secondary`, separated from content by a 1px `border` line.

### 6.7 Buttons

| Variant | Background | Text | Border | Use |
|---|---|---|---|---|
| Primary | `accent` | `#FFFFFF` | none | Main action, such as "Buy credits" |
| Secondary | `accent-soft` | `accent-text` | 1px accent | Alternate action, such as "Buy Apex" |
| Ghost | transparent | `text-secondary` | none | Dismiss, such as "Done" |
| Icon | `control` | `text-primary` | none | Menu, plus, mic |

- Height: 52px for full buttons, 56px for icon circles.
- Label: 18px, weight 700.
- Press state: reduce opacity to 0.85 or darken background by one step.
- Disabled state: `disabled` background, `text-muted` label, no pointer response.

### 6.8 Toggle

- Track: 56px wide, 32px tall, pill shape.
- On: `text-primary` track (white), dark thumb on the right.
- Off: `border` track, white thumb on the left.

---

## 7. Motion

- **Entrance:** a single fade-up on the greeting when the screen first loads (300ms, ease-out). Do not animate every element.
- **Sheets and menus:** slide up 200ms for the attach menu and effort slider, with a dimmed backdrop (`rgba(0,0,0,0.6)`).
- **Modal:** scale from 0.96 to 1 and fade in over 200ms.
- **Progress ring and bars:** animate width or stroke changes over 400ms on value change.
- **Respect reduced motion:** when the system setting is on, turn off slides and scales and keep fades only.

---

## 8. States and Feedback

| State | Treatment |
|---|---|
| Empty conversation | Show greeting. Hide messages list. |
| Loading response | Show a subtle pulsing dot row in `text-secondary` in the assistant bubble. |
| Error | Show a single-line message in `text-primary` with an inline "Try again" ghost button. Explain what happened in plain language. |
| Out of credits | Show a card with the message "You're out of credits this month." and a primary "Buy credits" button. |
| Disabled feature | Show the row in `text-muted` with a "Soon" or cost label. Never hide it silently. |

**Copy rules**
- Use plain verbs and sentence case: "Buy credits," "Attach files," "Try again."
- Do not apologize in error messages. Say what happened and what to do next.
- Keep helper text short. The current helper text is "Grace can make mistakes."

---

## 9. Accessibility

- **Contrast:** primary text on black must meet WCAG AA (4.5:1). Secondary gray (`#9A9A9F`) passes on black. `text-muted` is for non-essential text only and should not carry instructions.
- **Touch targets:** at least 44 × 44px for every control. Icon circles in this design are 56px.
- **Focus:** show a visible 2px `accent` focus ring on keyboard navigation. Do not remove outlines without a replacement.
- **Labels:** every icon button needs an accessible name, for example "Open menu," "Add attachment," "Start voice input," "Send message," "Show usage and limits."
- **Progress ring:** expose the value to screen readers, for example "92 percent credits remaining."
- **Slider:** support arrow keys and announce the level name on change.

---

## 10. Implementation Checklist

When adding a new screen or component, confirm:

- [ ] Background is `#000000`, with no gradients.
- [ ] Only `accent` blue is used for active or interactive elements.
- [ ] Text uses the defined type scale. No ALL CAPS, no monospace.
- [ ] Corners follow the radius table in Section 5.
- [ ] Padding and gaps use the spacing tokens in Section 4.
- [ ] Shadows appear only on floating layers (menus, modals).
- [ ] Touch targets are at least 44px.
- [ ] Empty, loading, error, and disabled states are all designed.
- [ ] Copy is short, plain, and in sentence case.
- [ ] Reduced motion is respected.
- [ ] Safe-area insets are respected at top and bottom.

---

## 11. Suggested CSS Variables

```css
:root {
  --color-bg: #000000;
  --color-surface: #1C1C1E;
  --color-surface-raised: #26262A;
  --color-control: #1A1A1C;
  --color-border: #2E2E32;
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #9A9A9F;
  --color-text-muted: #5C5C62;
  --color-accent: #3B82F6;
  --color-accent-soft: #1E2A44;
  --color-accent-text: #7AA8FF;
  --color-disabled: #3A3A3F;

  --font-family: Roboto, system-ui, -apple-system, sans-serif;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;

  --radius-pill: 999px;
  --radius-menu: 24px;
  --radius-modal: 28px;
  --radius-card: 20px;
}
```

---

## 12. Open Questions

- Confirm exact hex values from the design source or Figma file. The values above are estimates from screenshots.
- Confirm the full list of effort levels between Instant and Ultra.
- Confirm the set of greeting variants and how names are shown when a name is missing.
- Confirm whether the credits ring should use blue when usage is high.
