# Product Context — Power Station Management Inventory (PSMI)

This document outlines the product scope, objectives, and user personas for the PSMI system, serving as the design and behavioral compass for all frontend development.

## 1. Product Surface Type
*   **Classification:** Product Surface (Dashboard & Admin UI)
*   **Key Focus:** High-density data tables, inventory stats, mobile barcode scanning, and administrative controls.

## 2. Product Objectives
*   **Data Integrity:** Prevent duplicate physical checkouts and inventory drift through strict tracking of unit serial numbers.
*   **Frictionless Operations:** Support fast, error-free mobile scanning of 15+ character serial numbers using device cameras.
*   **Operational Control:** Gate outbound transits with document uploads (waybill/receipt verification) before allowing a status change to `SOLD`.
*   **FIFO Enforcement:** Highlight older units in stock to prevent battery degradation.

## 3. Target Audience & Personas
*   **Warehouse Managers & Staff:**
    *   *Context:* DIMLY lit warehouse floors, handling physical boxes, wearing gloves.
    *   *Needs:* High contrast, large text labels, big tap targets on mobile screen viewports, rapid camera scanning, and auditory/haptic feedback on success.
*   **Branch Staff:**
    *   *Context:* Counter sales or branch receiving desks.
    *   *Needs:* Quick access to status indicators, simple receiving forms, and transfer checklists.
*   **Company Administrators:**
    *   *Context:* Desktop management dashboards.
    *   *Needs:* High-level sales reports, low-stock notifications, location audits, and SKU registration controls.

## 4. Voice and Tone
*   **Scientific & Minimal:** Clean, precise, and objective. No unnecessary visual noise.
*   **Highly Readable:** Information architecture that prioritizes legibility, especially on small screens.
*   **Trustworthy & Professional:** High-contrast text indicators conveying status certainty.
