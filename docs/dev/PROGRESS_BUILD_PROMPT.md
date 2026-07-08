# Builder Prompt — Progress Media System

Paste this as your first message in a new Claude Code session:

---

Read /home/user/bigmike/PROGRESS_PHOTOS_BUILD.md for the complete feature specification. Read /home/user/bigmike/CLAUDE.md for codebase architecture and rules. Branch is claude/review-portal-audit-DGocb. Pull latest before starting.

You are building the most important feature of this entire platform. This is a progress photo tracking and branded comparison system for IFBB Pro Big Mike Ely's coaching app. Mike is a 2x World Champion bodybuilding coach with dozens of clients in contest prep at any given time. This feature is the reason celebrity bodybuilders will pay for this platform.

Here is how the feature works in real life:

A client logs into their portal. They send Mike progress photos through the messaging system — front double bicep, side chest, rear lat spread, whatever pose. Mike saves those photos to the client's profile with one tap. Four months later, the same client sends another front double bicep. Mike now has two photos of the same pose months apart. He opens the client's progress gallery, selects the two front double bicep shots, taps Compare. The system generates a premium branded side-by-side image — both photos perfectly aligned, Mike's branding (gold gradients, logo, typography), the dates under each photo, no "before/after" text, just the dates. It looks like it was made by a professional design agency, not a free Canva template. Mike taps Save and it downloads to his phone. He posts it on Instagram. It's an ad for his coaching with his branding already on it. Then he opens the messaging system, finds the client, attaches that branded comparison image, and sends it to the client. The client sees it in their chat, taps the download arrow, saves it to their own phone. They post it too. Now Mike's brand is everywhere.

That is the feature. Build it exactly as described in the spec. But here's what matters beyond the spec:

THE GALLERY MUST FEEL LIKE AN iPHONE CAMERA ROLL. Smooth scrolling. Date headers that stick as you scroll. Photos load instantly. Tapping a photo opens it full-screen with a smooth zoom animation. Swiping left/right navigates between photos. Pinch to zoom. The transition between gallery and full-screen should feel native — not like a web modal opening, like the photo is expanding from its position in the grid.

THE BRANDED COMPARISON MUST LOOK LIKE IT COST $500 TO DESIGN. Not two photos slapped next to each other. The canvas rendering needs:
- Perfect alignment of both photos at matched aspect ratios
- Mike's gold gradient lines (thin, elegant, top and bottom)
- The M logo mark rendered as a gold gradient square with rounded corners
- "BIG MIKE ELY COACHING" in Cinzel font, tracked out, below the logo
- "IFBB PRO" in IBM Plex Mono, small, muted
- Client name centered, prominent
- Pose name if tagged
- Dates under each photo in mono font
- The entire thing at 1080x1350 (Instagram 4:5 ratio)
- Background #030302 (the app's dark bg)
- The gold gradient must match exactly: linear-gradient(135deg, #A67C00, #C9A227, #E8D48B, #C9A227, #A67C00)

Do NOT hardcode dates or text into the individual photos. The dates only appear in the branded comparison output and in the gallery's date headers. The raw photos stay clean.

THE COMPARE FLOW MUST BE SMOOTH. Mike selects two photos. The compare view opens with both side by side. He sees them at full quality. There's a Save button (downloads the branded PNG), a Send button (opens client picker to send via messaging), and a Done button. That's it. No clutter.

THE CLIENT PORTAL NEEDS A DOWNLOAD BUTTON ON EVERY IMAGE IN CHAT. When Mike sends a branded comparison through messaging, the client sees it as a full-width image in the chat thread. There should be a small download arrow icon in the corner of the image. One tap saves it to their device.

Build the complete spec from PROGRESS_PHOTOS_BUILD.md. Every part. The save-from-message, the gallery, the compare mode, the branded export, the client portal My Progress tab, the video thumbnail support. Take your time. Screenshot every screen with Playwright after building. Validate JS syntax after every file change. Commit with clear messages.

This feature needs to be so good that when Mike shows it to his bodybuilder friends — people with millions of followers — they immediately want one for themselves. That's the bar. Build to that bar.
