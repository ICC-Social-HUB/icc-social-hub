<div align="center">

# 🌐 ICC Social Hub

**The All-In-One Innovation, Collaboration, and Project Management Platform**

[![Build Status](https://img.shields.io/github/actions/workflow/status/ICC-Social-HUB/icc-social-hub/android-build.yml?branch=main&style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/ICC-Social-HUB/icc-social-hub/actions)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Android-crimson?style=for-the-badge&logo=android&logoColor=white)](https://github.com/ICC-Social-HUB/icc-social-hub/releases/tag/latest)
[![Database](https://img.shields.io/badge/Database-Supabase%20Postgres-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Capacitor](https://img.shields.io/badge/Native-Capacitor%208-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com)
[![Deployment](https://img.shields.io/badge/Hosted%20On-Vercel-black?style=for-the-badge&logo=vercel&logoColor=white)](https://icc-social-hub.vercel.app)

[Live Web App](https://icc-social-hub.vercel.app) • [Download Android APK](https://github.com/ICC-Social-HUB/icc-social-hub/releases/download/latest/icc-social-hub.apk) • [Architecture Guide](TECHNICAL_ARCHITECTURE_MANUAL.md) • [UI/UX Specs](UI_UX_DESIGN_SPECIFICATION.md)

---

</div>

## 📖 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Repository Structure](#-repository-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running Locally](#running-locally)
- [Android App Compilation](#-android-app-compilation)
- [Security & Access Control](#-security--access-control)
- [Branch Protection & Contribution Workflow](#-branch-protection--contribution-workflow)
- [License](#-license)

---

## 🌟 Overview

**ICC Social Hub** is a centralized ecosystem built for college innovation labs, clubs, hackathon teams, and student creators. It bridges the gap between students, project leads, mentors, and lab administrators by unifying project recruitment, live communication, lab inventory checkout, event attendance, and student portfolios into a responsive web application and native Android app.

---

## 🚀 Key Features

| Module | Features & Capabilities |
| :--- | :--- |
| **👥 Hustlers Directory** | Searchable student talent catalog with skill badges, branch/year filters, verified lead ticks, and direct LinkedIn profile links. |
| **🛠️ Core Projects & Teams** | Lead dashboard to recruit team members, review project join requests, manage milestones, track tasks, and publish meeting minutes (MoM). |
| **💬 Real-Time Messaging** | Live community channels and direct mentor-student communication powered by Supabase Realtime WebSocket subscriptions. |
| **📦 Lab Inventory Management** | Hardware catalog with live stock tracking, component checkout requests, barcode scanning, and multi-tier approval workflows. |
| **📅 Events & Attendance** | College hackathon & workshop scheduling, RSVP tracking, dynamic OTP/QR check-ins, and downloadable attendee rosters. |
| **🔔 Instant Notifications** | Real-time in-app alerts and native push notifications powered by Firebase Cloud Messaging (FCM). |
| **🛡️ Role-Based Access (RBAC)** | Strict Row-Level Security (RLS) separating permissions across `super_admin`, `admin`, `mentor`, `lead`, and `member`. |

---

## 🏗 Architecture & Tech Stack

```mermaid
graph TD
    ClientWeb["🌐 Web Client (Vanilla JS / Tailwind)"] --> Router["Client-Side Router (Hash-Based)"]
    ClientApp["📱 Native Android App (Capacitor)"] --> Router
    Router --> Views["Modular Views & Components"]
    Views --> SupabaseClient["Supabase JS Client v2"]
    Views --> BackendAPI["Vercel Serverless Functions (/api)"]
    
    SupabaseClient --> Postgres[("🐘 Supabase PostgreSQL & RLS")]
    SupabaseClient --> Realtime["⚡ Realtime WebSockets"]
    SupabaseClient --> Storage["📁 Storage Buckets (Avatars, Attachments)"]
    
    BackendAPI --> Mailer["📧 Nodemailer / Resend SMTP"]
    BackendAPI --> FCM["🔔 Firebase Cloud Messaging"]
    BackendAPI --> AdminSupabase[("🔑 Supabase Admin Service Role")]
```

- **Frontend**: Vanilla ES6+ JavaScript, Tailwind CSS (Tailwind Play CDN), HTML5 Semantic SPA.
- **Mobile Container**: [Capacitor 8](https://capacitorjs.com) for cross-platform Android compilation with native status bar handling, hardware back button routing, and push notification plugins.
- **Backend & APIs**: Vercel Serverless Functions (Node.js runtime) for privileged tasks (OTP dispatch, team update emails, secure account management).
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL 15) with Row-Level Security (RLS) policies, built-in Auth, Storage, and Realtime replication.
- **Push Services**: Firebase Cloud Messaging (FCM Admin SDK).
- **Email Delivery**: Dual-engine with Gmail SMTP (Nodemailer) and Resend API fallback.

---

## 📂 Repository Structure

```text
icc-social-hub/
├── .github/
│   ├── workflows/             # GitHub Actions CI/CD (Android APK build, cleanup)
│   └── CODEOWNERS             # Mandatory code owner review rules
├── android/                   # Native Capacitor Android project & Gradle build
├── api/                       # Vercel serverless backend functions (Node.js)
│   ├── _mailer.js             # Email dispatch helper (Gmail SMTP & Resend)
│   ├── delete-user.js         # Protected user account deletion endpoint
│   ├── send-auth-otp.js       # OTP code generation & email delivery
│   ├── send-push.js           # Firebase Cloud Messaging push dispatcher
│   ├── students.js            # Paginated & filtered student directory endpoint
│   └── verify-auth-otp.js     # OTP verification & session token exchange
├── assets/                    # Static assets, branding, and latest compiled APK
├── css/                       # Core styles and design system variables
├── js/                        # Core application scripts
│   ├── components/            # Reusable UI components (modals, cards, navbar)
│   ├── views/                 # Page controllers (hustlers, projects, inventory, admin)
│   ├── allowedEmails.js       # Configurable email allowlist
│   ├── config.js              # Client configuration & API endpoint resolution
│   ├── router.js              # Hash router with navigation history stack
│   ├── studentData.js         # Student schema definitions
│   └── supabase.js            # Database client & state management
├── www/                       # Capacitor web asset sync directory (mirrors root)
├── capacitor.config.json      # Capacitor runtime configuration
├── local-server.js            # Standalone Node.js server for local API testing
├── package.json               # Project manifest, scripts, and dependencies
└── README.md                  # Project documentation
```

---

## 🛠 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v20.x or later recommended)
- [Git](https://git-scm.com/)
- (Optional for Android builds) [Android Studio](https://developer.android.com/studio) and JDK 21

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ICC-Social-HUB/icc-social-hub.git
   cd icc-social-hub
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Configuration

Copy the example environment configuration template:
```bash
cp .env.example .env.local
```

Open `.env.local` and populate the required keys:
```ini
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email Notification Services
EMAIL_USER=your-service-email@gmail.com
EMAIL_PASS=your-gmail-16-character-app-password
RESEND_API_KEY=your-resend-api-key

# Firebase Cloud Messaging (Push Notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Administration
ADMIN_EMAIL=admin@example.com
```

> ⚠️ **Important**: Never commit `.env` or `.env.local` to Git. Keep all production credentials stored securely in **GitHub Repository Secrets** and **Vercel Project Environment Variables**.

### Running Locally

1. **Start the local API backend** (port `5000`):
   ```bash
   npm start
   ```

2. **Serve the frontend** (in a separate terminal):
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

---

## 📱 Android App Compilation

The mobile application is packaged using Capacitor:

1. **Sync web code to the Android shell**:
   ```bash
   npm run sync
   ```
   *(This copies the latest HTML, JS, CSS, and asset files into `www/` and updates the Android assets).*

2. **Open the project in Android Studio**:
   ```bash
   npx cap open android
   ```

3. **Compile Debug APK via command line**:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
   The compiled APK will be located at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

4. **Automated CI/CD**:
   Every push to `main` touching `android/**`, `js/**`, or `css/**` triggers `.github/workflows/android-build.yml` to automatically build and release `icc-social-hub.apk` on GitHub Releases.

---

## 🔐 Security & Access Control

- **Row-Level Security (RLS)**: Enforced on all Supabase tables (`profiles`, `posts`, `comments`, `projects`, `inventory_items`, `events`). Anonymous and unauthorized queries are blocked at the database engine level.
- **Client Security**: Public client code strictly uses the Supabase Anon Key. Privileged database mutations run exclusively via authenticated serverless endpoints using `SUPABASE_SERVICE_ROLE_KEY`.
- **Protected Administrative Roles**:
  - `super_admin`: Full, permanent control over platform permissions, role delegations, and system settings.
  - `admin`: Granular feature permissions for broadcast moderation, inventory management, event operations, and user exports.
  - `mentor`: Project guidance, task board management, meeting notes curation, and student consultation.
  - `lead`: Project team leadership, applicant acceptance/rejection, and milestone planning.
  - `member`: General student membership and project collaboration.

---

## 🤝 Branch Protection & Contribution Workflow

To maintain production stability and code quality across the organization:

1. **Direct pushes to `main` are strictly disabled**.
2. **Pull Requests Required**: All changes must be made on feature branches:
   ```bash
   git checkout -b feat/your-feature-name
   # Make your changes
   git commit -m "feat(module): description of feature"
   git push origin feat/your-feature-name
   ```
3. **Mandatory Code Review**:
   - The repository uses [`.github/CODEOWNERS`](.github/CODEOWNERS) to require approval from the Organization Owner before any pull request can be merged.
   - Stale approvals are automatically dismissed when new commits are added to an active PR.
4. **Commit Guidelines**:
   Use standard Conventional Commits:
   - `feat:` New features
   - `fix:` Bug fixes and corrections
   - `chore:` Maintenance, dependency bumps, or tooling
   - `docs:` Documentation improvements
   - `refactor:` Code improvements without behavioral changes

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.

---

<div align="center">
Built with ❤️ for innovators, creators, and builders at <b>ICC Social Hub</b>.
</div>
