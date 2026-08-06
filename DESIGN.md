# Design Context — Power Station Management Inventory (PSMI)

This document establishes the design language and visual guidelines for the PSMI front-end interface, ensuring a high-end, modern enterprise dashboard aesthetic.

## 1. Visual Language & Aesthetics
*   **Scientific & Minimal:** Focus on legibility, clean layout alignments, and generous whitespace.
*   **Monochromatic & Accentuated:** Slate/gray base with purposeful, vibrant accent colors for status indicators and active buttons.

## 2. Strict Design Rules (Tailwind CSS)

### Backgrounds & Contrast
*   **Main Application Canvas:** `bg-slate-50` or `bg-gray-50` (soft, cool off-white/gray) to establish background contrast.
*   **Main Content Blocks (Cards, Tables):** Pure white `bg-white`.

### Typography
*   **Primary Typeface:** `Inter` sans-serif (legible, neutral, professional).
*   **KPI & Primary Numbers:** Large, bold, high-contrast (`text-slate-900`, sizes ranging from `text-3xl` to `text-5xl`).
*   **Secondary Elements & Headers:** Small, medium weight, muted (`text-slate-500`, `text-sm`, `font-medium`).

### Containers & Cards
*   **Rounding:** Heavily rounded (`rounded-2xl` or `rounded-xl`).
*   **Shadows:** Very subtle, diffuse shadows (`shadow-sm` or custom soft shadow `shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]`).
*   **Borders:** No harsh borders unless separating identical list items.

### Status Badges & Pills
*   **Shape:** Rounded pill shape (`rounded-full`, `px-3`, `py-1`, `text-xs`, `font-semibold`).
*   **Style:** Low-opacity background with high-opacity text.
*   **Color Mapping:**
    *   *In Warehouse:* `bg-emerald-100 text-emerald-700`
    *   *Reserved:* `bg-amber-100 text-amber-700`
    *   *In Transit:* `bg-blue-100 text-blue-700`
    *   *In Branch:* `bg-violet-100 text-violet-700`
    *   *Sold:* `bg-teal-100 text-teal-700`
    *   *Damaged / Repair:* `bg-red-100 text-red-700`

### Tables
*   **Padding:** Generous cell padding (`p-4`).
*   **Borders:** No vertical borders between columns. Subtle horizontal separators only.
*   **Row Hovers:** Interactive row hovers (`hover:bg-slate-50/70`).

### Iconography
*   **Library:** `lucide-react`.
*   **Style:** Consistent stroke widths (recommended `1.5` or `2` based on context), uniform size constraints.

## 3. Responsive Layout Guidelines
*   **Sidebar:** Left-aligned sidebar, fixed desktop view, collapsible hamburger menu with full overlay on mobile.
*   **Detail Pages:** Tabular specification lists on the left (SKU, Price, Stock, Category), with product graphic representations on the right.
