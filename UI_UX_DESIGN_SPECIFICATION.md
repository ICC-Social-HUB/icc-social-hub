# ICC Social Hub — UI/UX Design System & Specification Manual

> **Target Audience:** UI/UX Designers, Product Designers, Frontend Engineers, and Mobile Developers.  
> **Purpose:** Serve as the definitive design reference for the ICC Social Hub application—documenting design philosophy, design tokens, color palettes, typography, surface elevation, component anatomy, animation choreography, screen-by-screen UX patterns, and mobile ergonomic standards.

---

## Table of Contents
1. [Design Vision & Brand Philosophy](#1-design-vision--brand-philosophy)
2. [Design Tokens & Foundation System](#2-design-tokens--foundation-system)
   - [2.1. Color Palette & Semantic Tokens](#21-color-palette--semantic-tokens)
   - [2.2. Typography System](#22-typography-system)
   - [2.3. Elevation, Surfaces & Glassmorphism](#23-elevation-surfaces--glassmorphism)
   - [2.4. Spacing, Sizing & Layout Grid](#24-spacing-sizing--layout-grid)
3. [Motion & Animation Choreography](#3-motion--animation-choreography)
   - [3.1. Route & View Transitions](#31-route--view-transitions)
   - [3.2. Micro-Interactions](#32-micro-interactions)
   - [3.3. Loading & Progress Indicators](#33-loading--progress-indicators)
4. [Core UI Component Library](#4-core-ui-component-library)
   - [4.1. Navigation System (Header, Sidebar, Bottom Nav & FAB)](#41-navigation-system-header-sidebar-bottom-nav--fab)
   - [4.2. Cards & Content Containers](#42-cards--content-containers)
   - [4.3. Modals & Overlays](#43-modals--overlays)
   - [4.4. Form Elements & Interactive Inputs](#44-form-elements--interactive-inputs)
   - [4.5. Floating Pill Toasts & Status Feedback](#45-floating-pill-toasts--status-feedback)
   - [4.6. Badges, Chips & Status Indicators](#46-badges-chips--status-indicators)
5. [Screen-by-Screen UX Flow & Interface Breakdown](#5-screen-by-screen-ux-flow--interface-breakdown)
   - [5.1. Community Feed View](#51-community-feed-view)
   - [5.2. Direct & Team Messaging Interface](#52-direct--team-messaging-interface)
   - [5.3. Dashboard View](#53-dashboard-view)
   - [5.4. Teams & Core Leads View](#54-teams--core-leads-view)
   - [5.5. Events & Calendar View](#55-events--calendar-view)
   - [5.6. Hardware Inventory & Requisition View](#56-hardware-inventory--requisition-view)
   - [5.7. Attendance Check-in View](#57-attendance-check-in-view)
   - [5.8. Admin Command Console & Super Admin Approval Hub](#58-admin-command-console--super-admin-approval-hub)
   - [5.9. Onboarding & Profile Completion Wizard](#59-onboarding--profile-completion-wizard)
6. [Mobile Ergonomics & Native Hybrid Standards](#6-mobile-ergonomics--native-hybrid-standards)
7. [Accessibility, Performance & Designer Handoff Guide](#7-accessibility-performance--designer-handoff-guide)

---

## 1. Design Vision & Brand Philosophy

**ICC Social Hub** is designed as a focused, dark-themed, ultra-responsive digital ecosystem for the Innovators Creators Club (ICC). The visual aesthetic is inspired by the **Telegram Dark Theme** and modern **Cyber-Minimalist Glassmorphism**.

### Core Tenets:
1. **Dark Obsidian Immersion**: The background uses a deep midnight obsidian palette (`#0e1621`), reducing OLED battery consumption and eye fatigue during late-night hackathons and club sessions.
2. **Tactile Telegram Blue Accents**: Primary interactive highlights are anchored by an energetic Telegram Blue (`#3390ec`), creating immediate visual affordance and cognitive contrast without overwhelming the eye.
3. **Layered Depth & Glassmorphic Surfaces**: Content cards sit on slightly elevated navy-slate panels (`#17212b` and `#242f3d`) with subtle borders (`#1c2a38`), accented by frosted glass backdrops (`backdrop-filter: blur(16px)`).
4. **Zero-Friction Mobile Ergonomics**: Built mobile-first. Bottom-heavy primary navigation, 48px touch targets, momentum scrolling, and custom safe-area handling make one-handed mobile usage effortless.
5. **Subtle Motion Delight**: Micro-animations (heart bursts on likes, orbital spinning loaders, smooth slide-up toasts, floating ambient particles) make the app feel alive and responsive.

---

## 2. Design Tokens & Foundation System

### 2.1. Color Palette & Semantic Tokens

```
+-------------------------------------------------------------------------+
|                          ICC COLOR PALETTE                              |
|                                                                         |
|  [ #0e1621 ]       [ #17212b ]       [ #242f3d ]       [ #3390ec ]     |
|   Obsidian          Dark Panel        Card Surface       Telegram Blue  |
|  (Canvas Base)     (Sidebar/Bar)     (Interactive)      (Primary Brand) |
|                                                                         |
|  [ #2b5278 ]       [ #182533 ]       [ #708499 ]       [ #ffffff ]     |
|   Sent Bubble      Received Bubble    Slate Muted       Primary White   |
+-------------------------------------------------------------------------+
```

#### Base Theme Variables (`css/styles.css`):
```css
:root {
    --tg-bg: #0e1621;              /* Base canvas background */
    --tg-panel: #17212b;           /* Header, sidebar, sticky bars */
    --tg-card: #242f3d;            /* Elevated cards, inputs, button surfaces */
    --tg-border: #1c2a38;          /* Structural borders & dividers */
    --tg-border-light: #2b394a;    /* Highlighted card borders & input outlines */
    --tg-blue: #3390ec;            /* Primary brand accent & active states */
    --tg-blue-hover: #2b7cce;      /* Button hover state */
    --tg-blue-active: #246db8;     /* Button active/pressed state */
    --tg-bubble-sent: #2b5278;      /* User's outgoing chat bubble */
    --tg-bubble-received: #182533;  /* Incoming partner's chat bubble */
    --tg-text: #ffffff;            /* High-emphasis text */
    --tg-text-muted: #708499;      /* Secondary metadata, subtitles, timestamps */
}
```

#### Semantic Status Tokens:
- **Success / Positive**:
  - Green Accent: `#34c759`
  - Subtle Fill: `rgba(52, 199, 89, 0.15)`
  - Border: `rgba(52, 199, 89, 0.3)`
  - Usage: Approved requests, online badges, check-in confirmations, inventory in-stock.
- **Error / Danger / Urgent**:
  - Red Accent: `#ff3b30` / `#ef4444`
  - Subtle Fill: `rgba(255, 59, 48, 0.15)`
  - Border: `rgba(255, 59, 48, 0.3)`
  - Usage: Rejected requests, delete buttons, revoking access, broadcast alert banners.
- **Warning / Super Admin Gold**:
  - Amber Gold Accent: `#f59e0b` / `#fbbf24`
  - Subtle Fill: `rgba(245, 158, 11, 0.1)`
  - Border: `rgba(245, 158, 11, 0.35)`
  - Usage: Super Admin shield badges, pending review indicators, permanent privilege locks.
- **Admin Crown Blue**:
  - Blue Accent: `#3b82f6` / `#3390ec`
  - Subtle Fill: `rgba(59, 130, 246, 0.15)`
  - Usage: Standard Admin badges, verified checkmarks, tab highlights.

---

### 2.2. Typography System

The application relies on **Inter**, an open-source neo-grotesque geometric sans-serif engineered for digital screens.

- **Primary Font Family**: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Monospace Font Family**: `'JetBrains Mono', 'Fira Code', 'Courier New', monospace` (used for USNs, timestamps, code snippets, and diff views)

#### Type Scale:
| Level | Font Size | Line Height | Weight | Letter Spacing | Used For |
|---|---|---|---|---|---|
| **Display / Hero** | `28px` (`1.75rem`) | `34px` | 800 (ExtraBold) | `-0.025em` | Splash title, Hero banners |
| **Heading 1** | `22px` (`1.375rem`) | `28px` | 700 (Bold) | `-0.02em` | View titles, Modal headers |
| **Heading 2** | `18px` (`1.125rem`) | `24px` | 600 (SemiBold) | `-0.015em` | Section headers, Lead names |
| **Heading 3** | `15px` (`0.9375rem`)| `20px` | 600 (SemiBold) | `-0.01em` | Post author, Card titles |
| **Body (Default)** | `15px` (`0.9375rem`)| `22px` | 400 (Regular) | `0` | Post copy, Chat messages |
| **Body Small** | `13.5px` (`0.84rem`)| `18px` | 500 (Medium) | `0` | Subtitles, button labels |
| **Caption / Meta** | `11px` (`0.6875rem`)| `14px` | 500 (Medium) | `+0.01em` | Timestamps, USN, role pills |
| **Micro Badge** | `9px - 10px` | `12px` | 700 (Bold) | `+0.04em` | Unread pill counters, tag chips |

---

### 2.3. Elevation, Surfaces & Glassmorphism

```
Level 0: Canvas Base        -->  #0e1621 (Flat solid)
Level 1: Sticky Bars        -->  #17212b (95% opacity + 20px blur)
Level 2: Cards & Surfaces   -->  #17212b / #242f3d + 1px border #1c2a38
Level 3: Modals & Drawers   -->  #17212b + border #242f3d + shadow-2xl
Level 4: Lightbox / Toasts  -->  Z-Index 10000 + backdrop-filter blur(20px)
```

- **`.glass`**:
  `background: rgba(23, 33, 43, 0.85); backdrop-filter: blur(20px) saturate(160%); border-bottom: 1px solid #101921;`
- **`.glass-card`**:
  `background: #17212b; backdrop-filter: blur(16px); border: 1px solid #1c2a38; border-radius: 16px;`
- **`.glass-morphism`**:
  `background: rgba(23, 33, 43, 0.75); backdrop-filter: blur(12px); border: 1px solid #1c2a38; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);`

---

### 2.4. Spacing, Sizing & Layout Grid

- **Base Unit**: `4px` (All paddings and margins are multiples: `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `48px`).
- **Touch Target Standard**: Minimum `44px x 44px` (ideal `48px x 48px`) for all buttons, icons, and interactive links.
- **Corner Radii (Border Radius)**:
  - Small elements (Tags, badges, pills): `6px` – `8px`
  - Inputs & Buttons: `10px` – `12px`
  - Content Cards (`.post-card`, `.glass-card`): `14px` – `16px`
  - Modals & Sheets: `20px` – `24px`
  - Circular elements (Avatars, FAB): `9999px` (`50%`)
- **Layout Breakpoints**:
  - Mobile: `< 768px` (Single column, bottom navigation visible, full-width cards).
  - Tablet: `768px - 1024px` (Collapsible sidebar, 2-column card grids).
  - Desktop: `> 1024px` (Persistent left navigation drawer, 3-column grids, max content width: `1200px`).

---

## 3. Motion & Animation Choreography

```
Timing Function Curves:
- Standard Ease-Out:  cubic-bezier(0.16, 1, 0.3, 1)   [Smooth entrance]
- Bouncy / Spring:   cubic-bezier(0.34, 1.56, 0.64, 1) [FAB & Heart pop]
- Sharp Exit:        cubic-bezier(0.32, 0.72, 0, 1)   [View tear-down]
```

### 3.1. Route & View Transitions
- **View Enter (`.view-enter`)**:
  ```css
  @keyframes appViewEnter {
      from { opacity: 0; transform: translate3d(0, 14px, 0) scale(0.99); }
      to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
  }
  ```
  *Duration: `300ms`. Smooth upward slide and subtle zoom gives the impression of layered depth.*
- **View Exit (`.view-exit`)**:
  ```css
  @keyframes appViewExit {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.98); }
  }
  ```
  *Duration: `180ms`. Quick fade-out to prevent perceptible UI lag.*

### 3.2. Micro-Interactions
- **Heart Burst (`.like-btn.liked`)**:
  ```css
  @keyframes heartBurst {
      0% { transform: scale(1); }
      40% { transform: scale(1.35); }
      70% { transform: scale(0.9); }
      100% { transform: scale(1); }
  }
  ```
- **Active Button Tap**: Buttons shrink to `scale(0.96 - 0.98)` on touch press (`:active`), providing tactile feedback.
- **Card Hover Elevation**: Cards lift by `translateY(-3px to -4px)` on mouseover with an expanding subtle shadow (`box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4)`).

### 3.3. Loading & Progress Indicators
- **Orbital Concentric Spinner (`.icc-orbital-spinner`)**:
  Two counter-rotating glowing cyan/blue rings surrounding a pulsing core dot:
  - Outer ring: Rotates clockwise in `1.8s`.
  - Inner ring: Rotates counter-clockwise in `1.2s`.
  - Core: Pulses between `0.85` and `1.15` scale in `1s`.
- **Route Progress Bar (`#route-progress`)**: Pinned to the very top edge of the screen (`height: 2px; background: #3390ec`). Animates from 0% to 70% immediately on click, then snaps to 100% and fades out when view mounts.
- **Floating Ambient Background Particles (`#particles-bg`)**: 15 tiny glowing dots floating upward at varying speeds (18s - 43s) in the background canvas, creating visual atmosphere without CPU lag.

---

## 4. Core UI Component Library

### 4.1. Navigation System (Header, Sidebar, Bottom Nav & FAB)

```
DESKTOP LAYOUT (>= 1024px):
+--------------------------------------------------------------------------+
| [ICC] Social Hub                  [Search...]               [Notif] [You]|
+--------------------------------------------------------------------------+
| [Side Nav]       |  MAIN CONTENT VIEW CONTAINER                          |
| 🏠 Dashboard     |                                                       |
| 📰 Feed          |  Card 1                Card 2                         |
| 💬 Chat (2)      |  +------------------+  +------------------+           |
| 👥 Teams         |  |                  |  |                  |           |
| 📅 Events        |  |                  |  |                  |           |
| 📦 Inventory     |  +------------------+  +------------------+           |
| 🛡️ Admin         |                                                       |
+--------------------------------------------------------------------------+

MOBILE LAYOUT (< 768px):
+--------------------------------------------------------------------------+
| [☰] [ICC] Social Hub                                              [Notif]|
+--------------------------------------------------------------------------+
|                                                                          |
|  MAIN MOBILE FEED / CHAT VIEW                                            |
|                                                                          |
+--------------------------------------------------------------------------+
|  [🏠 Home]    [📰 Feed]    ( + FAB )    [💬 Chat]    [👤 Profile]        |
+--------------------------------------------------------------------------+
```

#### Header (`<header class="sticky top-0 z-[500] ...">`)
- **Height**: `64px` (`4rem`).
- **Surface**: `#17212b` at 95% opacity with `backdrop-filter: blur(20px)`.
- **Components**:
  - Left: Hamburger toggle button (visible on mobile to toggle sidebar).
  - Center: Brand avatar (`ICC` badge) and title link `#dashboard`.
  - Right: Notification Bell icon with unread indicator badge (`#notif-bell-root`).

#### Left Sidebar (`js/components/sidebar.js`)
- Responsive slide-out drawer on mobile / persistent rail on desktop.
- Contains user mini-card (avatar, name, role badge, email).
- Navigation links with active indicator pills and unread counter badges (e.g. Chat unread count).
- Role-gated entries: `Admin Command Center` link appears only if `isAdmin()` is true.

#### Mobile Telegram Bottom Navigation (`js/components/bottomNav.js`)
- Fixed at screen bottom (`bottom: 0`), offset by `env(safe-area-inset-bottom)`.
- Features 5 slots: Home (`#dashboard`), Feed (`#feed`), **Floating Center FAB**, Messages (`#chat`), Profile (`#profile`).
- **Round FAB (`.fab-create`)**: Elevated 48px circle elevated by `-16px` with Telegram blue glow shadow (`0 4px 14px rgba(51, 144, 236, 0.45)`). Clicking it opens the Post Composer dialog.

---

### 4.2. Cards & Content Containers

#### Feed Post Card (`.post-card`)
- **Container**: `background: #17212b; border: 1px solid #1c2a38; border-radius: 14px;`
- **Header**: Author avatar (40px circle), Full name, Verified lead badge (if applicable), Role badge (`Admin`, `Super Admin`), and relative timestamp (`"2h ago"`).
- **Body**: Post copy with preserved line breaks and auto-linked URLs.
- **Media**: Rounded image container with zoom-on-hover effect. Clicking triggers the full-screen Lightbox ImageViewer.
- **Footer Bar**: Like counter with heart icon, Comment count with chat bubble icon, and Delete button (visible to author or moderators).

#### Team Lead Card (`.lead-card`)
- High-contrast visual card featuring a portrait with an intentional **80% grayscale filter**.
- **Hover Micro-Interaction**: On mouseover, portrait smoothly transitions to full color (0% grayscale), scales up by `1.04`, and an accent bar animates across the bottom edge.

---

### 4.3. Modals & Overlays

```
+----------------------------------------------------+
|  MODAL BACKDROP (rgba(14, 22, 33, 0.85) + Blur)    |
|                                                    |
|      +--------------------------------------+      |
|      |  MODAL HEADER: Title            [ X ]|      |
|      +--------------------------------------+      |
|      |                                      |      |
|      |  MODAL BODY: Form / Content          |      |
|      |  - Glowing Inputs                    |      |
|      |  - 6-digit OTP Inputs                |      |
|      |                                      |      |
|      +--------------------------------------+      |
|      |  FOOTER: [Cancel]  [Confirm Action]  |      |
|      +--------------------------------------+      |
+----------------------------------------------------+
```

- **Backdrop**: `#0e1621` at 85% opacity with `backdrop-filter: blur(12px)`.
- **Container**: Elevated `#17212b` surface with border `#242f3d` and corner radius `20px`.
- **Exit Triggers**: Clicking the backdrop, pressing `ESC` key, or pressing the Android hardware back button immediately dismisses the top-most modal.

#### Fullscreen Lightbox Image Viewer (`#image-viewer-overlay`)
- Deep darkened backdrop (92% opacity obsidian with `blur(20px)`).
- Zoom in / Zoom out / Reset controls pinned in floating circular glass pills.
- Tap-outside or drag gesture dismisses the viewer.

---

### 4.4. Form Elements & Interactive Inputs

#### Text Fields (`.form-input`)
- **Background**: `#242f3d` (deep card navy).
- **Border**: `1px solid #2b394a`.
- **Focus State**: `border-color: #3390ec; box-shadow: 0 0 0 3px rgba(51, 144, 236, 0.2);` (no generic browser outline).
- **Font Size**: `16px` on mobile to prevent iOS Safari auto-zoom.

#### 6-Box OTP Inputs (`.otp-input`)
- Six discrete square boxes (`48px width x 56px height`).
- Centered, bold `24px` numerical typography.
- Auto-focus advances to the next input upon keydown; backspace retreats to previous input.

#### iOS-Style Toggle Switches (`.switch-container`)
- Smooth rounded capsule track (`44px x 24px`) with a floating circular knob.
- Transitions from `#2b394a` (off) to Telegram Blue `#3390ec` (on) with a `0.2s` sliding animation.

---

### 4.5. Floating Pill Toasts & Status Feedback

```
                     +---------------------------------------+
Bottom Toast Pill -> |  (✓)  User permissions updated!       |
                     +---------------------------------------+
```

- **Mount Point**: Pinned to bottom center (`#toast-root`). On mobile, elevated above bottom nav bar (`bottom: 92px`).
- **Styling**: Floating capsule (`border-radius: 9999px`) with frosted glass background (`#17212b` + `backdrop-filter: blur(16px)`).
- **Color Coding**:
  - `toast-success`: Green border + green circular checkmark icon.
  - `toast-error`: Red border + red exclamation icon.
  - `toast-info`: Blue border + blue info icon.
- **Behavior**: Auto-dismisses after 3 seconds with a smooth downward slide-out.

---

### 4.6. Badges, Chips & Status Indicators

- **`🛡️ Super Admin` Badge**: Amber pill (`bg-amber-500/20 text-amber-300 border-amber-500/40`).
- **`👑 Admin` Badge**: Blue pill (`bg-blue-500/20 text-blue-300 border-blue-500/40`).
- **`Verified Lead Tick`**: Inline SVG badge with blue shadow filter (`filter: drop-shadow(0 0 2px rgba(59, 130, 246, 0.5))`).
- **`🔒 Permanent Access (Immutable)`**: Used in Access Control cards to signify locked, non-degradable authority.

---

## 5. Screen-by-Screen UX Flow & Interface Breakdown

### 5.1. Community Feed View (`#feed`)
- **Primary Goal**: Social interaction, club announcements, project showcases.
- **Top Bar**: Search bar and filter pills (`All`, `Announcements`, `Projects`, `General`).
- **Composer**: Dedicated inline prompt card (`"Share an update or project..."`) that opens the rich modal composer.
- **Post Stream**: Vertical stream with 16px card spacing.
- **Empty State**: Centered illustration with a prompt to create the first post.

### 5.2. Direct & Team Messaging Interface (`#chat`)
- **Primary Goal**: Instant communication without leaving the platform.
- **Left Panel (Conversations)**:
  - Search members input.
  - List of past chats with avatar, name, last message preview, and unread badge.
- **Right Panel (Active Chat)**:
  - Partner header with online status indicator.
  - Message stream: Sent messages right-aligned in `#2b5278`; received messages left-aligned in `#182533`.
  - Pinned bottom bar with text input and blue send button.

### 5.3. Dashboard View (`#dashboard`)
- **Primary Goal**: Central hub and personal status summary.
- **Hero Welcome Card**: Personalized greeting, user role badge, and quick shortcut to complete missing profile details.
- **Stats Grid**: Total members count, upcoming events count, club divisions count.
- **Quick Action Grid**: One-tap navigation cards to Feed, Teams, Events, Inventory, and Attendance.

### 5.4. Teams & Core Leads View (`#teams`)
- **Primary Goal**: Showcase club divisions and leadership.
- **Division Grid**: Interactive cards for Technical, Web Dev, AI/ML, Design, Media, and Logistics teams.
- **Join Team Flow**: Clicking a team allows members to apply by answering skills and motivation questions.
- **Core Leads Carousel**: Highlighted grid of appointed leads with social contact buttons.

### 5.5. Events & Calendar View (`#events` & `#event/:id`)
- **Primary Goal**: Event registration, agenda tracking, and announcements.
- **Event Card**: Banner thumbnail, Date pill chip (`OCT 24`), Event title, venue, and live RSVP count badge.
- **Event Detail Page**: Full-bleed hero banner, rich markdown description, schedule timeline, and prominent `"RSVP for Event"` action button.

### 5.6. Hardware Inventory & Requisition View (`#inventory`)
- **Primary Goal**: Equipment loan tracking and hardware stock visibility.
- **Category Filters**: Sensors, Microcontrollers (Arduino/ESP32), Actuators, Power Modules, Tools.
- **Stock Bar**: Visual progress meter showing Available vs. Total stock (e.g. `8/10 available`).
- **Requisition Modal**: Member selects quantity and submits purpose of borrowing.

### 5.7. Attendance Check-in View (`#attendance`)
- **Primary Goal**: Meeting check-in recording and export.
- **Live Search**: Fast lookup by Student Name or USN.
- **Status Toggle**: Instant 1-tap toggling between `Present` (Green) and `Absent` (Muted).
- **Export Action**: Top right button generates `.xlsx` spreadsheet on the fly using `SheetJS`.

### 5.8. Admin Command Console & Super Admin Approval Hub (`#admin`)
- **Access Rule**: Strictly gated by `ICCSupabase.isAdmin()`.
- **Section 1: Super Admin User Edit Approval Hub**:
  - Visible only to Super Admins.
  - Renders cards for each pending edit request submitted by Standard Admins.
  - **Visual Diff Presentation**: Compares original profile values (red strikethrough) with proposed changes (green highlight).
  - One-click `"Approve Changes"` (patches database) or `"Reject Request"` (closes request with reason).
- **Section 2: Access Control Panel**:
  - **Super Admin Cards**: Displays user avatar, name, and locked `🔒 Permanent Super Admin` badge. Contains **no** feature toggles or demote buttons.
  - **Standard Admin Cards**: Features Master Toggle + 6 granular feature switches (`Broadcast`, `Moderate`, `Events`, `Leads`, `Request User Edits`, `View & Download Excel`). Changes save to Supabase in real time.
- **Section 3: Appoint Administrator**:
  - Live user lookup by name/email/USN.
  - Role selection radio buttons (Standard Admin vs Super Admin).
  - Granular permission selector for standard admin appointment.
- **Section 4: Broadcast Alert Banner**:
  - Allows blasting an emergency top-of-screen alert message to all users.

### 5.9. Onboarding & Profile Completion Wizard (`#onboarding`)
- **Primary Goal**: Enforce student identity verification upon first sign-in.
- **Step 1: USN & Student Lookup**: Matches entered USN against `studentData.js` to auto-fill official name, branch, and section.
- **Step 2: Contact & Socials**: Phone number, GitHub handle, LinkedIn profile.
- **Step 3: Skills & Bio**: Multi-select skill chips (`React`, `Python`, `Figma`, `IoT`, `Robotics`) and short bio.
- **Step 4: Avatar Selection**: Camera capture or file upload with live cropping preview.

---

## 6. Mobile Ergonomics & Native Hybrid Standards

### Safe Area Inset Support
To prevent UI clipping behind notches, dynamic islands, or Android gesture navigation bars:
```css
body {
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
}
.sticky.top-0, .fixed.top-0 {
    top: env(safe-area-inset-top, 0px) !important;
}
#toast-root {
    bottom: calc(92px + env(safe-area-inset-bottom, 0px)) !important;
}
```

### Touch Hygiene Standards
1. **No Accidental Text Selection**: Text selection is disabled globally on buttons, cards, images, and nav elements (`user-select: none`). Enabled only within `<input>`, `<textarea>`, and `.selectable-text`.
2. **No Tap Delay / Highlighting**: `-webkit-tap-highlight-color: transparent` prevents annoying grey flashes on touch.
3. **Momentum Scrolling**: `-webkit-overflow-scrolling: touch; scrollbar-width: none;` provides native iOS/Android flick scrolling feel.
4. **Hardware Back Button Interception**: Capacitor App plugin listens to Android back-button presses to dismiss active modals before navigating backward.

---

## 7. Accessibility, Performance & Designer Handoff Guide

### 7.1. Accessibility Checklist
- **Contrast Ratios**: All body text (`#ffffff` and `#708499`) tested against card backgrounds (`#17212b` and `#242f3d`) exceeds WCAG AA standard (minimum 4.5:1 ratio).
- **Keyboard Navigation**: Form inputs, buttons, and close controls support `Tab` navigation with visible outline focus rings (`outline-color: #3390ec`).
- **Semantic HTML**: Proper heading hierarchy (`<h1>` through `<h5>`), `<main>`, `<header>`, `<nav>`, `<button>`, and `<label>` elements are utilized throughout.

### 7.2. Performance Optimization
- **Hardware-Accelerated CSS**: All transforms use `translate3d(0, 0, 0)` and `will-change` where appropriate to trigger GPU compositing and prevent frame drops (60fps guaranteed).
- **Image Optimization**: Avatars and post images are constrained with `object-fit: cover` and lazy-loaded.
- **Zero Heavy Framework Runtime**: The absence of React/Angular/Vue ensures sub-second initial paint times even on low-end Android mobile devices.

### 7.3. Step-by-Step Guide: Creating a New On-Brand Component
When building a new feature or card:
1. **Container**: Use `.glass-card` or `.post-card` with `background: #17212b` and `border: 1px solid #1c2a38`.
2. **Typography**: Use `text-white font-semibold` for titles; `text-xs text-zinc-400 font-mono` for USNs and metadata.
3. **Buttons**:
   - Primary: `bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold px-4 py-2 transition-all`.
   - Secondary / Ghost: `bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs px-3 py-2`.
4. **Icons**: Use crisp inline SVGs with `w-4 h-4` or `w-5 h-5` bounding boxes.
5. **Interactive feedback**: Wrap async button actions with loading state spinners (`.spinner-sm`) and trigger `Toast.success()` on completion.

---

*Specification maintained by the Innovators Creators Club (ICC) UI/UX Engineering Group.*
