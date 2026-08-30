# Share2Me Admin Portal

A modern, secure, glassmorphic Admin Portal built for managing and publishing HTML blog articles across multi-site destinations (**share2.me** and **share2me.in**) with automated SEO validation, sandboxed live preview, audit logs, and version control rollback.

---

## ✦ Features

- 🔐 **Secure Google OAuth & Email Allowlist Authentication**: Restrict portal access to authorized admin accounts.
- 📝 **Rich HTML Article Editor & Live Preview**: Real-time sandboxed preview of HTML content.
- ⚡ **Automated SEO Validation Engine**: Detects blocking errors (multiple `<h1>`s, missing titles, invalid slugs) and advisory warnings (meta description length, missing canonical URLs, image alt attributes).
- 🌐 **Multi-Site Publishing Engine**: One-click publication across `share2.me` and `share2me.in`.
- 📜 **Version Control & Rollback System**: Saves snapshots of every edit and allows single-click restoration of previous revisions.
- 🛡️ **Comprehensive Audit Activity Logs**: Tracks all admin actions, status changes, and target destinations.

---

## ✦ Repository Layout

```
admin-portal/
├── README.md                          # Portal Overview & GitHub Deployment Instructions
├── package.json                       # Dependencies & scripts
├── .env.example                       # Environment variables template
├── .gitignore                         # Standard git ignore config
├── frontend/                          # Next.js 14 / App Router Admin Interface
│   └── app/
│       ├── layout.tsx                 # Glassmorphic Layout & Sidebar Navigation
│       ├── page.tsx                   # Control Center Dashboard & Analytics
│       ├── login/page.tsx             # OAuth Login & Access Control
│       ├── blogs/page.tsx             # Blog List, Search, and Status Filters
│       ├── blogs/editor/page.tsx      # Rich Editor & SEO Validator
│       ├── revisions/page.tsx         # Version Control & History Rollback
│       └── logs/page.tsx             # System Audit Activity Stream
└── backend/                           # Express + Socket.io Server Services
    ├── routes/adminRoutes.js          # REST API endpoints for Admin Portal
    ├── lib/adminAuth.js               # Authorization & Allowlist Middleware
    ├── lib/publisher.js               # Multi-destination Publishing Adapter
    ├── lib/seoValidator.js            # Automated SEO Auditor
    └── database/admin-schema.sql      # PostgreSQL DB Schemas
```

---

## ✦ Quick Start

### 1. Environment Configuration

Copy `.env.example` to your `.env` file:

```env
AUTHORIZED_ADMIN_EMAILS=admin@share2.me,rishabh@share2.me,rishabhdev2026@gmail.com
AUTH_SECRET=your_secret_key_here
DATABASE_URL=postgresql://user:password@localhost:5432/share2me
SHARE2ME_DEPLOY_TOKEN=your_deploy_token
SHARE2ME_IN_DEPLOY_TOKEN=your_deploy_token
```

### 2. Push to GitHub as a Dedicated Repository

To create a separate GitHub repository for this Admin Portal:

```bash
cd admin-portal
git init
git add .
git commit -m "feat: Add Share2Me Admin Portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/share2me-admin-portal.git
git push -u origin main
```

---

## ✦ Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React Icons
- **Backend**: Node.js, Express.js, PostgreSQL
- **Auth**: NextAuth (Google OAuth) + Custom Email Allowlist Middleware
- **Design System**: Soft Glassmorphism with dark accents (`#0f1015`, `#fcd535`, `#9333ea`)
