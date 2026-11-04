# EduApply — Student Application Portal

A web portal where students write direct applications to university/college authorities.
Students pick a predefined letter template, change only the date, institution name and
principal/dean, and submit. The department head (admin) approves or rejects each
application — rejection **requires feedback** explaining why. Faculty can view all
applications read-only.

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript (no frameworks)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Auth:** bcrypt password hashing + express-session

## Project Structure
```
├── server.js            # Express server, all API routes
├── package.json
├── .env.example         # copy to .env and fill in your DB credentials
├── db/
│   └── schema.sql       # tables: users, templates, applications
└── public/
    ├── index.html       # login + register
    ├── student.html     # student dashboard
    ├── admin.html       # admin (Head of Dept) dashboard
    ├── teacher.html     # faculty read-only dashboard
    ├── css/style.css
    └── js/  (main.js, student.js, admin.js, teacher.js)
```

## Setup

1. **Create the database**
   ```bash
   createdb application_portal
   psql -U postgres -d application_portal -f db/schema.sql
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # edit .env with your PostgreSQL credentials
   ```

3. **Install & run**
   ```bash
   npm install
   npm start
   ```

4. Open http://localhost:3000

## Default Admin Account (auto-seeded)
| Field        | Value            |
|--------------|------------------|
| University ID| `ADMIN-001`      |
| Password     | `admin123`       |

> Change this password in production (update the seed in `server.js`).

## Roles & Flow

1. **Register** — Students enter ID, name, email, phone, address, department, advisor,
   batch and ID card number. Teachers enter ID, name, number, email.
   New accounts start as `pending` — they **cannot log in** until the admin approves them.
2. **Admin approves/rejects accounts** in the *Account Requests* tab.
3. **Student submits an application** — chooses a predefined template, sets the date,
   institution name and principal/dean name; the full letter is auto-generated with a live preview.
4. **Admin reviews applications** — approves, or rejects **with mandatory feedback**,
   which the student sees in their dashboard.
5. **Faculty** sees every application and its status, read-only.

## API Summary
| Method | Route | Role |
|---|---|---|
| POST | `/api/register` | public |
| POST | `/api/login` · `/api/logout` · GET `/api/me` | public |
| GET | `/api/templates` | any |
| POST | `/api/applications` | student |
| GET | `/api/applications` | any (scoped by role) |
| GET | `/api/admin/users` · POST `/api/admin/users/:id/approve|reject` | admin |
| POST | `/api/admin/applications/:id/review` | admin |
