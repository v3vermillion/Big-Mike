# Progress Media System — Complete Build Spec

You are building the most important feature of this coaching platform. This is a contest prep tracking system for IFBB Pro Big Mike Ely — a 2x World Champion who coaches dozens of athletes through show prep. Every serious bodybuilding coach compares progress photos week over week. They're currently doing this with Google Drive folders and camera rolls. You're building something that makes that look like the Stone Age.

This needs to be flawless. Not functional — flawless. Every interaction, every animation, every edge case. Mike will use this daily with real clients preparing for real competitions. Build it like your career depends on it.

**Branch:** `claude/review-portal-audit-DGocb`
**Read:** `/home/user/bigmike/CLAUDE.md` for full codebase context before starting.

---

## WHAT YOU'RE BUILDING

A progress media tracking system with four parts:

1. **Save from message** — One-tap save of photos/videos from message threads to client profiles
2. **Save from check-ins** — Same for check-in submissions
3. **Progress gallery** — Date-sorted media grid on client detail with pose tagging and filtering
4. **Compare mode** — Side-by-side photo comparison with date labels for tracking changes
5. **Video pose detection** — When a client sends a posing video, auto-tag key frames by mandatory bodybuilding pose

---

## PART 1: Save from Message Thread

### Where

In `_renderMsgAttachment()` in app.html. This function already renders image/video/file attachments inline in message bubbles.

### What to add

Below each image or video attachment in a message from a CLIENT (not from coach), add a "Save to Profile" button. When tapped:

1. Save the media reference to `client.progressPhotos[]` (no re-upload — URL already exists in Supabase Storage)
2. Toast confirmation: "Saved to [client name]'s progress"  
3. Button changes to checkmark + "Saved" (disabled, green accent)
4. If already saved (check by URL match), show the disabled "Saved" state immediately

### Data structure for each saved item

```javascript
{
  id: "pp_" + uid(),
  url: "https://...",           // existing Supabase Storage URL
  type: "image" | "video",     // detect from attachment.type
  date: "2026-04-12",          // from message timestamp
  pose: "",                    // user-editable tag (see POSE_TAGS below)
  notes: "",                   // coach notes
  source: "message" | "checkin",
  sourceId: "msg_xxx",         // original message or check-in ID
  savedAt: new Date().toISOString(),
  thumbnail: ""                // for videos: generated on save (see video section)
}
```

### Save function

```javascript
function saveProgressMedia(clientId, sourceId, url, type, timestamp) {
  var c = clientById(clientId);
  if (!c) { toast("Client not found"); return; }
  if (!c.progressPhotos) c.progressPhotos = [];
  if (c.progressPhotos.some(function(p) { return p.url === url; })) { toast("Already saved"); return; }
  var item = {
    id: "pp_" + uid(),
    url: url,
    type: type.startsWith("video") ? "video" : "image",
    date: new Date(timestamp).toISOString().split("T")[0],
    pose: "",
    notes: "",
    source: "message",
    sourceId: sourceId,
    savedAt: new Date().toISOString()
  };
  c.progressPhotos.push(item);
  save();
  toast("Saved to " + c.name.split(" ")[0] + "'s progress");
  render();
}
```

---

## PART 2: Save from Check-ins

### Where

In `renderClientCheckins()` in app.html. Find where check-in photos are displayed.

### What to add

Same "Save to Profile" button on each photo/video in a check-in submission. Same behavior as Part 1 but with `source: "checkin"`.

---

## PART 3: Progress Gallery

### Where

Add `"photos"` to the client detail subtabs array. Search for `var tabs2=["overview"` (around line 1030). Add the tab and its renderer.

### Tab label

"Progress" (not "Photos" — it includes videos too)

### renderClientProgress... wait.

There's already a `renderClientProgress` for weight/measurements. Use a different name: `renderClientMedia(c, idx)`.

Actually, check if "progress" subtab already exists. If it does, add the photo grid WITHIN that existing tab, below the weight/measurements section. That way all progress tracking is in one place — weight log, measurements, AND photos/videos.

If "progress" already exists, add the media grid after the existing content. If it doesn't, create the subtab.

### Media grid layout

```
PROGRESS MEDIA section label + count + filter row

Filter chips: ALL | PHOTOS | VIDEOS | [pose tags that have entries]

Grid:
- Mobile: 3 columns, 8px gap
- Tablet: 4 columns  
- Desktop: 5 columns
- Each cell: aspect-ratio 3/4, border-radius 10px, overflow hidden
- Photos: object-fit cover
- Videos: show thumbnail with play icon overlay (white triangle in semi-transparent circle)
- Date label: bottom-left of each cell, font-size 9px, mono font, semi-transparent dark overlay
- Pose tag: bottom-right, accent-colored chip if set

Tap photo → opens detail modal
Tap video → plays in modal with controls

Empty state:
  Icon: camera SVG (not emoji)
  "No progress media yet"
  "Save photos and videos from client messages or check-ins to track changes over time"
```

### Detail modal (tap a photo/video)

Full-screen modal with:
- Full-size photo or video player
- Date (displayed prominently)
- Weeks out counter: if client has a competition date set (`c.compDate`), show "X weeks out" calculated from the photo date
- Pose tag dropdown (see POSE_TAGS)
- Notes textarea
- "Delete" button with `showConfirm()`
- Changes to pose/notes auto-save on change (no save button needed)

### POSE_TAGS — Mandatory bodybuilding poses

These are the 8 mandatory poses in NPC/IFBB competition plus common extras. Use these as the dropdown options:

```javascript
var POSE_TAGS = [
  {k: "", l: "No Tag"},
  {k: "front_dbl_bi", l: "Front Double Bicep"},
  {k: "front_lat", l: "Front Lat Spread"},
  {k: "side_chest", l: "Side Chest"},
  {k: "side_tri", l: "Side Tricep"},
  {k: "rear_dbl_bi", l: "Rear Double Bicep"},
  {k: "rear_lat", l: "Rear Lat Spread"},
  {k: "most_muscular", l: "Most Muscular"},
  {k: "abs_thigh", l: "Abs & Thigh"},
  {k: "front_relaxed", l: "Front Relaxed"},
  {k: "back_relaxed", l: "Back Relaxed"},
  {k: "side_relaxed", l: "Side Relaxed"},
  {k: "custom", l: "Custom Pose"},
  {k: "full_body", l: "Full Body (no pose)"},
  {k: "posing_routine", l: "Posing Routine (video)"}
];
```

When a video is tagged as "Posing Routine", the system should treat it specially in compare mode (see Part 4).

---

## PART 4: Compare Mode + Branded Export

This is the money feature. This is what separates this app from every other coaching platform. Treat this like you're building a professional photo editing tool inside a coaching app. It needs to feel like swiping through a camera roll from the future — smooth, premium, intuitive.

Take your time on this. If it takes hours, take hours. Get it right.

### Activation

"Compare" button in the progress gallery header. When tapped:
- Grid items get circular checkboxes in the top-right corner (accent border, filled when selected)
- Mike selects exactly 2 photos
- After 2 selected, compare view opens automatically with a smooth transition
- If he tries to select a 3rd, the oldest deselects (rolling selection of 2)

### Compare View — The Full Experience

This opens as a full-screen overlay (not a modal — it IS the screen). Dark background, immersive.

```
┌──────────────────────────────────────────────────┐
│ [← BACK]                         Week 4 → Week 8│
│                                                  │
│ ┌──────────────────┬───────────────────┐         │
│ │                  │                   │         │
│ │                  │                   │         │
│ │    Photo 1       │     Photo 2       │         │
│ │                  │                   │         │
│ │                  │                   │         │
│ ├──────────────────┼───────────────────┤         │
│ │  Feb 24, 2026    │   Mar 29, 2026    │         │
│ │  Front Dbl Bi    │   Front Dbl Bi    │         │
│ │  12 weeks out    │   8 weeks out     │         │
│ └──────────────────┴───────────────────┘         │
│                                                  │
│        ◀ ─────────○───────── ▶                   │
│         timeline scrubber (all dates)             │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  SAVE    │  │  SEND    │  │  EXPORT  │       │
│  │  TO PHONE│  │  TO      │  │  BRANDED │       │
│  │          │  │  CLIENT  │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘       │
└──────────────────────────────────────────────────┘
```

**Core features:**
- 50/50 split, both photos fill their half with matched aspect ratio
- Pinch to zoom on EITHER photo independently (each has its own zoom state)
- Double-tap to zoom in/out on a single photo
- Date + pose label below each photo
- If client has `c.compDate`, show "X weeks out" under each date
- Week range in header: "Week 4 → Week 8"

**Timeline scrubber:**
- Horizontal slider at the bottom showing all saved dates as dots
- Dragging the scrubber cycles through chronological pairs
- The LEFT photo is the anchor (earlier date), RIGHT photo moves through later dates
- Or: both dots move and Mike can drag either one to pick any two dates

**Pose-filtered compare:**
If Mike entered compare mode while filtered by a specific pose (e.g., "Front Double Bicep"), the scrubber only shows dates that have that pose. This lets him see one pose's progression over time.

### Three action buttons at the bottom:

**1. SAVE TO PHONE**
- Generates a single image (canvas) combining both photos side by side
- Downloads it to the device camera roll / downloads folder
- No branding on this version — just the raw comparison for Mike's records

**2. SEND TO CLIENT**
- Same combined image but sent through the messaging system to this client
- Client receives it in their message thread as a regular image attachment
- Push notification: "Coach Mike sent you a progress comparison"

**3. EXPORT BRANDED**
- This is the premium output. Generates a canvas with:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│          ┌─ gold gradient thin line ──┐          │
│                                                  │
│     ┌───────────────┬────────────────┐           │
│     │               │                │           │
│     │   BEFORE      │    AFTER       │           │
│     │               │                │           │
│     │               │                │           │
│     │               │                │           │
│     ├───────────────┼────────────────┤           │
│     │  Feb 24       │   Mar 29       │           │
│     │  12 wks out   │   8 wks out    │           │
│     └───────────────┴────────────────┘           │
│                                                  │
│              CLIENT NAME                         │
│         Front Double Bicep                        │
│                                                  │
│     ┌─ M ─┐  BIG MIKE ELY COACHING              │
│              IFBB PRO · EST. 1996                │
│                                                  │
│          ┌─ gold gradient thin line ──┐          │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Branded export details:**
- Background: `#030302` (var(--bg) equivalent)
- Gold gradient lines top and bottom (matching the app's `--goldGrad`)
- "M" logo mark: gold gradient text in a rounded square (matching the app header logo)
- "BIG MIKE ELY COACHING" in Cinzel font (var(--display))
- "IFBB PRO · EST. 1996" in IBM Plex Mono (var(--mono)), muted color
- Client name in display font, centered
- Pose name below client name in mono font
- "BEFORE" and "AFTER" labels on the photos in small mono text
- Date and weeks-out below each photo
- The entire thing renders to canvas at 1080px wide (Instagram-ready resolution)
- Downloads as PNG

**Canvas rendering approach:**
```javascript
function renderBrandedComparison(photo1, photo2, clientName, poseName, compDate) {
  var canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350; // 4:5 ratio (Instagram optimal)
  var ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#030302';
  ctx.fillRect(0, 0, 1080, 1350);

  // Gold gradient line top
  var grad = ctx.createLinearGradient(200, 0, 880, 0);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.3, '#A67C00');
  grad.addColorStop(0.5, '#C9A227');
  grad.addColorStop(0.7, '#A67C00');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 60, 1080, 1.5);

  // ... photos, text, logo, bottom line ...

  // Download
  var link = document.createElement('a');
  link.download = clientName.replace(/\s/g, '_') + '_progress_' + photo1.date + '_vs_' + photo2.date + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
```

This function should be complete and production-ready. The builder should implement the full canvas rendering including loading both images, drawing them side by side, and all the text/branding elements. Use `drawImage()` for photos, `fillText()` for labels. Load fonts by setting `ctx.font` to the display/mono families.

---

## PART 5: Client Portal — "My Progress" Tab

### Concept

The client doesn't build their own gallery. Mike curates it. But the client should be able to SEE their progress — every comparison Mike has sent them, every check-in they've submitted, organized in a timeline.

### Where

Add a "My Progress" tab to the portal tab bar. This shows up alongside Overview, Training, Nutrition, Messages, etc.

### What it shows

A chronological timeline of:

1. **Branded comparisons Mike sent via messaging** — displayed as the full branded image (they can tap to view full-size and save to their phone)
2. **Check-in photos the client submitted** — displayed in a grid with dates
3. **Progress notes from Mike** — if Mike added notes to a progress photo, show them as quote cards between the photos

### Layout

```
MY PROGRESS section header

Timeline:
  ┌─ APR 12 ──────────────────────┐
  │ [branded comparison image]     │
  │  Front Double Bicep            │
  │  "Looking tighter in the      │
  │   midsection. Keep pushing."   │
  │              — Coach Mike      │
  └────────────────────────────────┘

  ┌─ APR 5 ───────────────────────┐
  │ [check-in photo grid: 3 imgs] │
  │  Submitted via check-in       │
  └────────────────────────────────┘

  ┌─ MAR 29 ──────────────────────┐
  │ [branded comparison image]     │
  │  Side Chest                    │
  └────────────────────────────────┘
```

### Data source

The client portal already loads messages via `loadMessages()`. Branded comparisons are sent as image attachments in messages. Check-in photos are loaded separately.

Filter messages to find comparison images: look for messages from "coach" that have image attachments. Display them in reverse chronological order.

For check-ins, the portal already has `submitCheckin()` — the submitted photos are in Supabase Storage. Display them in the timeline.

### Empty state

```
"Your progress timeline will appear here as Coach Mike tracks your transformation."
```

### Save to phone

Each comparison image and check-in photo should have a download button. On tap, save to device.

---

## PART 5: Video Posing Routine Support

### What this does

When a client sends a posing practice video and Mike saves it, the video gets its own card in the progress gallery with a play button overlay. When Mike taps it, the video plays in a modal with standard controls.

### Video thumbnails

When saving a video to progress, generate a thumbnail:

```javascript
function generateVideoThumbnail(videoUrl, callback) {
  var video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.src = videoUrl;
  video.muted = true;
  video.currentTime = 1; // grab frame at 1 second
  video.addEventListener('seeked', function() {
    var canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 426; // 3:4 aspect
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    callback(canvas.toDataURL('image/jpeg', 0.7));
    video.remove();
  });
  video.addEventListener('error', function() { callback(null); });
  video.load();
}
```

Store the thumbnail as a data URL in `item.thumbnail`. It's small (< 20KB) and avoids needing another Storage upload.

### Video in gallery grid

```html
<div style="position:relative;aspect-ratio:3/4;...">
  <img src="THUMBNAIL_DATA_URL" style="width:100%;height:100%;object-fit:cover">
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
    <div style="width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21"/></svg>
    </div>
  </div>
</div>
```

### Video detail modal

Same as photo detail but with `<video>` element instead of `<img>`:
- Full-width video player with native controls
- Same pose tag dropdown, notes, delete button
- Date and weeks-out display

---

## INFRASTRUCTURE

### Storage
- NO new buckets needed
- Photos/videos are already uploaded as message attachments (`message-attachments`) or check-in photos (`checkin-photos`)
- Progress system only saves URL references, never re-uploads

### Data
- `client.progressPhotos[]` array on the client object
- Saved via existing `save()` function → localStorage → Supabase cloud sync
- No new database table

### CSP
- Already configured for img-src and media-src from Supabase domain

---

## DESIGN SYSTEM

Follow these exactly. Do not invent new patterns.

- `.cd` cards for containers
- `.sl` for section labels ("PROGRESS MEDIA")
- `.btn2` for secondary buttons (Save to Profile, Compare, Done)
- `.btn` for primary actions only if needed
- `.chip` for pose filter tags and pose selector
- `var(--acc)` accent, `var(--accGlow)` fills, `var(--accB)` borders
- `var(--borderS)` subtle borders, `var(--glassB)` glass backgrounds
- `var(--dm)` muted text, `var(--mu)` secondary text, `var(--wh)` primary text
- `var(--success)` for "Saved" state
- `showModal()` for detail views
- `showConfirm()` for destructive actions
- All touch targets minimum 44px
- `esc()` for all user-generated text

---

## VALIDATION CHECKLIST

After building, verify each of these:

- [ ] Save button appears on image attachments in message threads
- [ ] Save button appears on video attachments in message threads
- [ ] Save button appears on check-in photos
- [ ] Already-saved items show disabled "Saved" state
- [ ] Progress gallery renders with correct grid layout
- [ ] Pose filter chips work
- [ ] Photo/video type filter works
- [ ] Detail modal opens with full-size media
- [ ] Pose tag dropdown saves on change
- [ ] Notes field saves on change
- [ ] Delete works with confirmation
- [ ] Compare mode: selecting 2 photos opens side-by-side
- [ ] Compare mode: dates displayed correctly
- [ ] Compare mode: weeks-out shows if client has comp date
- [ ] Compare mode: swipe/arrow navigation through chronological pairs
- [ ] Video thumbnail generates correctly
- [ ] Video plays in detail modal
- [ ] Empty state displays when no progress media
- [ ] Client name with apostrophe doesn't break anything
- [ ] Touch targets are all 44px minimum
- [ ] JS syntax validates on `node -c`
- [ ] Screenshots taken on mobile (390x844) and desktop (1440x900)

---

## PLAYWRIGHT TESTING

Screenshot the progress gallery with mock data. Inject progress photos on a client:

```javascript
await page.addInitScript(() => {
  // ... existing mock client setup ...
  // Add progressPhotos to first client
  var client = JSON.parse(localStorage.getItem('fm_clients'));
  client[0].progressPhotos = [
    {id:'pp1',url:'data:image/svg+xml,...',type:'image',date:'2026-03-01',pose:'front_dbl_bi',notes:'12 weeks out',source:'message',sourceId:'msg1',savedAt:'2026-03-01T10:00:00Z'},
    {id:'pp2',url:'data:image/svg+xml,...',type:'image',date:'2026-03-15',pose:'front_dbl_bi',notes:'10 weeks out',source:'message',sourceId:'msg2',savedAt:'2026-03-15T10:00:00Z'},
    // ... more entries covering different poses and dates
  ];
  client[0].compDate = '2026-06-15'; // competition date for weeks-out calc
  localStorage.setItem('fm_clients', JSON.stringify(client));
});
```

For the SVG placeholder images, generate colored rectangles with pose text:
```javascript
function mockPhoto(pose, week) {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect fill="#1a1a1a" width="300" height="400"/><text x="150" y="180" text-anchor="middle" fill="#D4A830" font-size="14">' + pose + '</text><text x="150" y="220" text-anchor="middle" fill="#666" font-size="12">Week ' + week + '</text></svg>');
}
```

---

## RULES

- Do NOT create new Supabase tables
- Do NOT re-upload media files
- Do NOT add emoji to UI text
- Do NOT use max-height + overflow-y:auto inside modals (breaks iOS)
- Do NOT modify any existing functionality — this is purely additive
- Validate JS with `node -c` after every change
- Screenshot every view with Playwright and visually verify with Read tool
- Commit with clear messages, push to `claude/review-portal-audit-DGocb`
- If you're unsure about a design decision, match what already exists in the app
