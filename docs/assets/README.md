# README banner

- Latest edit: removed the bottom website line using the built-in `image_gen` tool, preserving the logo, title, subtitle and canvas. The banner's Markdown link still opens the product website; no hosted-app copy was removed from the surrounding README.
- Asset: `scrinium-note-banner-v2.png`, linked from both project READMEs to `https://scrinium-note.com/`.
- Created on 2026-11-18 with the built-in `image_gen` tool. The tool did not expose a model identifier. No fallback CLI or external image API was used.
- Reference: the project's existing `public/icon.png` brand mark. The generated banner was inspected for brand consistency, exact wording, clipping and legibility before use. Only proportional downscaling and PNG compression were applied afterward.
- Current visible copy: “Scrinium Note” and “Encrypted Markdown notes”. The website line was removed at the user’s request. The image is a brand banner, not a screenshot or a claim that hosted functions are included in the local application.
- Scope: documentation asset only. It is not imported into the application or Docker build. The hosted website was checked for the linked sync, attachment and version-history descriptions; current plans are explained there.

## Original generation prompt (historical)

Use case: ads-marketing.
Asset type: a polished raster GitHub README banner for Scrinium Note, very wide 3:1 landscape, 1536 by 512 pixels.
Input image 1 is the existing Scrinium brand icon: a purple sculptural spiral shell wrapped around a white note shape. It is a brand reference, not a UI screenshot. Preserve this exact recognizable mark and purple/white identity; do not invent a different logo.
Design one minimal, professional banner on a flat near-black charcoal background matching a dark note editor. Place the existing sculptural purple mark toward the left and strong, clear white typography beside it. The mark and title form the single visual focus. Generous practical padding, balanced vertically, restrained lavender accent. No mock interface, no fabricated screenshots, no decorative cards, particles, padlocks, emoji, patterns, extra icons, badges or gradients across the background.
Exact visible text, case and spelling:
"Scrinium Note"
"Encrypted Markdown notes"
"Hosted version at scrinium-note.com"
Title largest, subtitle smaller, website line compact but legible at GitHub README width. No text saying Community, Pro, Open Source or free. No security guarantees. Render all text accurately. Clean typography, no clipping, no watermark. Output the complete finished banner as one image, opaque background.

## Latest edit prompt

Use case: precise-object-edit. Remove only the complete lavender bottom line “Hosted version at scrinium-note.com” from the supplied banner. Fill that area with the matching charcoal background. Preserve the existing purple mark, the exact title “Scrinium Note”, subtitle “Encrypted Markdown notes”, typography, placement and 3:1 canvas. Add no replacement text or graphics. Keep an opaque background. Executed with the built-in image_gen tool; no model identifier was exposed.
