<div align="center">

# 🎓 EduApply

**A modern university application portal for students, faculty, and administrators.**

Students submit formal applications. Admins review and approve them with feedback. Faculty monitor submissions — all through a single, secure, role-based web app.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-3c873a?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-%3E%3D14-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

[Features](#-features) · [Screenshots](#-screenshots) · [Quick Start](#-quick-start) · [API Reference](#-api-reference) · [Project Structure](#-project-structure) · [Contributing](#-contributing)

</div>

---

## 📖 Overview

**EduApply** is a full-stack web application built for universities and colleges to digitize the process of submitting and reviewing student applications — leave requests, bonafide certificates, fee waivers, and other formal letters.

Instead of paper forms and email chains, students log in, pick a template, fill in the required fields, preview the final letter live, and submit. Admins approve or reject applications with structured feedback. Faculty members have read-only visibility into all submissions.

The system is built around **three user roles**, each with their own dashboard, and includes a **secure admin management CLI** for provisioning accounts directly from the terminal — no backdoor web endpoint to abuse.

---

## ✨ Features

### 🎓 For Students
- **Guided application builder** — choose from pre-built templates (leave, certificate, fee waiver, …)
- **Live letter preview** — see the final document update in real time as you type
- **Automatic field substitution** — name, university ID, department, and batch are pulled from your profile
- **Application tracking** — view status (pending / approved / rejected) and admin feedback in one table
- **Secure signup** — mandatory ID card upload for identity verification
- **Beautiful UI** — animated, responsive, and accessible

### 👔 For Administrators
- **Account approval workflow** — approve or reject new student and teacher registrations
- **View uploaded ID cards** — verify identity before approving an account
- **Review applications** — read the full letter, approve, or reject with mandatory feedback
- **Full audit trail** — every review is timestamped and attributed to the reviewer
- **CLI admin management** — add, list, update, deactivate, delete admins, and promote teachers — all from the terminal

### 🧑‍🏫 For Faculty
- **Read-only dashboard** — view all applications submitted by any student
- **Full application details** — see the final letter, student info, and status
- **No moderation powers** — enforce separation of concerns

### 🔐 Security
- Session-based authentication with `express-session`
- Bcrypt password hashing (cost factor 10)
- Role-based route protection (`requireAuth`, `requireRole`)
- File upload restrictions — MIME type allow-list (JPG / PNG / WEBP / PDF) and 5 MB size cap
- Admin-only file streaming — uploaded ID cards are never publicly accessible
- Account deactivation flag — deactivated accounts are blocked at login
- Self-lockout prevention — cannot delete the last remaining admin or your own account

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14
- **npm** ≥ 9

### 1. Clone & install

```bash
git clone https://github.com/your-username/eduapply.git
cd eduapply
npm install
```

### 2. Configure environment

Create a `.env` file at the project root:

```env
PORT=3000
SESSION_SECRET=change-me-to-a-long-random-string

DB_USER=postgres
DB_HOST=localhost
DB_NAME=application_portal
DB_PASSWORD=postgres
DB_PORT=5432
```

### 3. Set up the database

```bash
# Create the database
createdb application_portal

# Apply the schema
psql -d application_portal -f schema.sql
```

> ⚠️ **Upgrading an existing install?** Some schema changes use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` at the bottom of `schema.sql`. Re-running `psql -f schema.sql` is safe and applies them idempotently.

### 4. Seed demo data *(optional)*

```bash
npm run seed
```

This creates three demo accounts:

| Role | University ID | Password |
|------|--------------|----------|
| Admin | `ADMIN001` | `Admin@123` |
| Teacher | `TEACH001` | `Teacher@123` |
| Student | `STU2026001` | `Student@123` |

### 5. Create your first admin (interactive)

```bash
npm run create-admin
```

Follow the prompts — the CLI creates a fully approved admin account without touching the web.

### 6. Run the app

```bash
# Development (auto-reload on file changes)
npm run dev

# Production
npm start
```

Open **[http://localhost:3000](http://localhost:3000)** 🎉

---

## 🧰 Admin CLI

A dedicated interactive console for managing admin accounts — no web UI required.

```bash
npm run create-admin
```

```
╔══════════════════════════════════════════════════╗
║      EduApply — Admin Management Console         ║
╠══════════════════════════════════════════════════╣
║  1. Add new admin                                ║
║  2. List all admins                              ║
║  3. Change an admin's password                   ║
║  4. Update an admin's name / email               ║
║  5. Deactivate / reactivate an admin             ║
║  6. Delete an admin                              ║
║  7. Promote a teacher to admin                   ║
║  8. View a single admin's details                ║
║  9. Exit                                         ║
╚══════════════════════════════════════════════════╝
```

**Built-in safety:**
- Passwords are masked during input and confirmed twice
- Current password required before changing a password
- Cannot delete the last active admin
- Cannot delete your own account (via `CLI_ADMIN_ID` env var)
- Type the target's University ID to confirm deletion

---

## 🔌 API Reference

All endpoints are prefixed with `/api`. Auth uses an `express-session` cookie set at login.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/register` | Public | Submit a new student/teacher registration (multipart/form-data for students) |
| `POST` | `/login` | Public | Sign in, sets session cookie |
| `POST` | `/logout` | Public | Destroy session |
| `GET`  | `/me` | Any | Return current session user |

### Applications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`    | `/templates` | Any | List application templates |
| `POST`   | `/applications` | Student | Submit a new application |
| `GET`    | `/applications` | Any | List applications (scoped by role) |
| `GET`    | `/applications/:id` | Any | Get a single application |

### Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/admin/users` | Admin | List all non-admin users |
| `POST` | `/admin/users/:id/approve` | Admin | Approve a registration |
| `POST` | `/admin/users/:id/reject` | Admin | Reject a registration |
| `GET`  | `/admin/users/:id/id-card` | Admin | Stream uploaded ID card file |
| `POST` | `/admin/applications/:id/review` | Admin | Approve/reject an application with feedback |

### Example — submit an application

```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  --cookie "connect.sid=..." \
  -d '{
    "template_id": 1,
    "letter_date": "2025-11-04",
    "institution_name": "University of Dhaka",
    "authority_name": "Prof. Dr. A. Rahman",
    "from_date": "2025-11-10",
    "to_date": "2025-11-15",
    "reason": "medical treatment"
  }'
```

---

## 📁 Project Structure

```
eduapply/
├── public/                    # Static frontend (served by Express)
│   ├── index.html             # Login & registration
│   ├── admin.html             # Admin dashboard
│   ├── student.html           # Student dashboard
│   ├── teacher.html           # Faculty dashboard
│   ├── css/
│   │   └── style.css          # Theme & animations
│   └── js/
│       ├── main.js            # Shared helpers (api, toast, auth guard)
│       ├── admin.js           # Admin dashboard logic
│       ├── student.js         # Student dashboard logic
│       └── teacher.js         # Faculty dashboard logic
├── uploads/
│   └── id-cards/              # Uploaded student ID cards (git-ignored)
├── db/
│   └── seed.js                # Demo data seeding
├── schema.sql                 # Postgres schema (+ idempotent migrations)
├── server.js                  # Express app & all API routes
├── create-admin.js            # Interactive admin management CLI
├── package.json
├── .env                       # Environment config (not committed)
├── .gitignore
└── README.md
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express 4 |
| Database | PostgreSQL |
| Auth | `express-session` + `bcryptjs` |
| File Uploads | `multer` |
| Frontend | Vanilla JS + HTML5 + CSS3 |
| Fonts | Outfit · Instrument Serif · JetBrains Mono |

**No frontend framework** — the UI is deliberately dependency-free, using native `fetch` and DOM APIs for speed and clarity.

---

## 🎨 Design Language

The UI uses a **dark, glassmorphic** aesthetic with:

- Layered radial gradients and animated background blobs
- Glass cards with soft borders and hover-lift physics
- Spring-physics easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`)
- Staggered page-load reveals
- Gradient text that animates continuously
- Full respect for `prefers-reduced-motion`

---

## 🗺 Roadmap

- [ ] Email notifications on approval / rejection
- [ ] PDF export of approved letters
- [ ] Application drafts (save & continue later)
- [ ] Bulk approval for administrators
- [ ] Department-scoped faculty views
- [ ] CSV export of applications
- [ ] Two-factor authentication for admins
- [ ] Public status page

---

## 🧪 Testing

Currently tested manually via the flows above. Automated test suite planned:

```bash
# Coming soon
npm test
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. **Fork** the repository
2. **Create a branch** — `git checkout -b feature/your-feature`
3. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/) — e.g. `feat: add PDF export`
4. **Push** — `git push origin feature/your-feature`
5. **Open a Pull Request**

Please run `npm run dev` and manually verify the changed flows before opening a PR.

---

## 🐛 Reporting Issues

Found a bug or have a suggestion? Please [open an issue](https://github.com/your-username/eduapply/issues) with:

- Steps to reproduce
- Expected vs. actual behavior
- Screenshots if applicable
- Environment (OS, Node version, DB version)

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

## 🙏 Acknowledgements

- **[Express](https://expressjs.com/)** — minimal, unopinionated server framework
- **[PostgreSQL](https://www.postgresql.org/)** — rock-solid relational database
- **[Multer](https://github.com/expressjs/multer)** — painless multipart uploads
- **[Google Fonts](https://fonts.google.com/)** — Outfit · Instrument Serif · JetBrains Mono
- **[Shields.io](https://shields.io/)** — README badges

---

<div align="center">

**Built with ☕ and a lot of `console.log`**

⭐ If you find this project useful, consider giving it a star!

</div>
