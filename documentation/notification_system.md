# ICC Social Hub — Notification System Documentation

This document outlines the architecture, data flow, and implementation details of the notification system within the ICC Social Hub application.

---

## 1. Database Schema (Supabase/Postgres)

The core of the system is the `public.notifications` table.

### Structure:
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key to `profiles.id`) — The recipient of the notification.
- `actor_id`: UUID (Foreign Key to `profiles.id`, Optional) — The user who triggered the notification.
- `type`: TEXT (Check Constraint) — Categorizes the notification.
- `body`: TEXT (Optional) — Custom message content.
- `reference_id`: TEXT (Optional) — ID of the related object (Post, Team, Chat).
- `is_read`: BOOLEAN (Default: `false`).
- `created_at`: TIMESTAMPTZ (Default: `now()`).

### Supported Types:
The `type` column is strictly enforced by a check constraint:
`'like', 'comment', 'message', 'post', 'broadcast', 'team_join', 'team_approve', 'team_deny', 'mention', 'welcome', 'system'`

---

## 2. Notification Policy (The 24-Hour Rule)

To maintain a clean and performant user experience, the application enforces a **Strict 24-Hour Visibility Window**:
- Notifications older than 24 hours are ignored during retrieval.
- This is implemented in the `fetchNotifications` and `getUnreadNotifCount` functions using a PostgreSQL timestamp comparison: `gt('created_at', oneDayAgo)`.

---

## 3. Real-Time Architecture

The system uses **Supabase Realtime (Postgres Changes)** to push updates to active clients.

1.  **Subscription**: Upon login, the app (`app.js`) initializes a global subscription using `ICCSupabase.subscribeToNotifications`.
2.  **Filter**: The subscription is filtered by `user_id=eq.${currentUser.id}` to ensure users only receive their own notifications.
3.  **Payload**: When a notification is inserted into the DB, the payload is sent to the client. The client then:
    *   Updates the floating `NotifBell` unread count.
    *   Updates the `BottomNav` badge.
    *   If the user is on the `NotificationsView`, the list is updated dynamically.

---

## 4. Specific Business Logic Flows

### A. Team Join Request (Multi-Channel)
When a user clicks "Join Team":
1.  **Data Capture**: Summary and DISC tag are saved to `team_join_data`.
2.  **Lead Discovery**: The system queries the `profiles` table for all users with `role = 'lead'` and the matching `team_id`.
3.  **System Notification**: A notification of type `team_join` is created for every lead.
4.  **Direct Chat Message**: A standard chat message is automatically sent from the applicant to the lead(s) as a fallback: *"👋 Hello! I've just requested to join [Team Name]..."*

### B. Approval & Denial
When a Team Lead resolves a request:
1.  **Approval (`team_approve`)**:
    *   `is_pending_member` set to `false`.
    *   Notification sent to applicant.
    *   Body contains the `teamName` for UI formatting.
2.  **Denial (`team_deny`)**:
    *   `team_id` set to `null`.
    *   `team_join_data` deleted.
    *   Notification sent to applicant.

---

## 5. Frontend Components

### `NotificationsView` (js/views/notifications.js)
- Handles rendering the notification list.
- **Virtual Fallbacks**: Implements logic to track pending states via `localStorage` to show immediate "virtual" notifications if database replication lags.
- **Grouping**: Automatically groups notifications by "Today", "Yesterday", and "Earlier".

### `NotifBell` (js/components/notifBell.js)
- A floating UI element present on all main views (Feed, Teams, etc.).
- Polls the unread count via `getUnreadNotifCount` and listens for real-time updates to provide instant feedback.

### `ICCSupabase` (js/supabase.js)
- **`createNotification`**: The primary API for triggering notifications from any part of the app.
- **`fetchNotifications`**: Retrieves both database notifications and "Global Post" alerts (which are treated as virtual notifications for secondary visibility).

---

## 6. Implementation Summary for AI Agents
To add a new notification trigger:
1.  Call `ICCSupabase.createNotification({ userId, type, actorId, referenceId, body })`.
2.  Ensure `type` is in the allowed list.
3.  If a specific rendering is needed, update `formatBody` and `NOTIF_CONFIG` in `js/views/notifications.js`.
