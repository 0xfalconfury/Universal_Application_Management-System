const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "application_portal",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD
});

async function seed() {
    const client = await pool.connect();

    try {
        console.log("Starting Student Application Portal seeding...");

        await client.query("BEGIN");

        const check = await client.query(`
            SELECT
                current_database() AS database,
                current_schema() AS schema,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = 'users'
                    AND column_name = 'department'
                ) AS has_department
        `);

        console.log("Database:", check.rows[0].database);
        console.log("Schema:", check.rows[0].schema);
        console.log("Department column:", check.rows[0].has_department);

        if (!check.rows[0].has_department) {
            throw new Error(
                "department column missing from users table. Check schema.sql."
            );
        }

        const users = [
            {
                university_id: "ADMIN001",
                role: "admin",
                name: "System Administrator",
                email: "admin@example.com",
                password: "Admin@123",
                status: "approved"
            },
            {
                university_id: "TEACH001",
                role: "teacher",
                name: "Demo Teacher",
                email: "teacher@example.com",
                password: "Teacher@123",
                status: "approved"
            },
            {
                university_id: "STU2026001",
                role: "student",
                name: "Demo Student",
                email: "student@example.com",
                password: "Student@123",
                department: "Computer Science",
                advisor: "Dr. Demo Advisor",
                batch: "2026",
                status: "approved"
            }
        ];

        for (const user of users) {
            const passwordHash = await bcrypt.hash(user.password, 10);

            await client.query(
                `INSERT INTO users (
                    university_id, role, name, email,
                    department, advisor, batch,
                    password_hash, status
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                ON CONFLICT DO NOTHING`,
                [
                    user.university_id,
                    user.role,
                    user.name,
                    user.email,
                    user.department || null,
                    user.advisor || null,
                    user.batch || null,
                    passwordHash,
                    user.status
                ]
            );
        }

        const templates = [
            {
                title: "General Application",
                body: `Date: {{date}}

To,
The Principal

Subject: {{subject}}

Dear Sir/Madam,

I am {{name}}, a student of {{department}}, Batch {{batch}}.

I would like to request your kind consideration regarding {{reason}}.

Thank you.

Sincerely,
{{name}}
University ID: {{university_id}}`
            },
            {
                title: "Leave Application",
                body: `Date: {{date}}

To,
The Principal

Subject: Application for Leave

Dear Sir/Madam,

I am {{name}}, a student of {{department}}.

I kindly request leave for {{reason}}.

Thank you for your consideration.

Sincerely,
{{name}}
University ID: {{university_id}}`
            },
            {
                title: "Certificate Application",
                body: `Date: {{date}}

To,
The Principal

Subject: Application for Certificate

Dear Sir/Madam,

I am {{name}}, from {{department}}, Batch {{batch}}.

I would like to request a certificate for {{reason}}.

I would be grateful for your assistance.

Sincerely,
{{name}}
University ID: {{university_id}}`
            }
        ];

        for (const template of templates) {
            await client.query(
                `INSERT INTO templates (title, body)
                 SELECT $1::VARCHAR(150), $2::TEXT
                 WHERE NOT EXISTS (
                     SELECT 1
                     FROM templates
                     WHERE title = $1::VARCHAR(150)
                 )`,
                [template.title, template.body]
            );
        }

        await client.query("COMMIT");

        console.log("----------------------------------");
        console.log("Database seeded successfully!");
        console.log("----------------------------------");
        console.log("Admin: admin@example.com / Admin@123");
        console.log("Teacher: teacher@example.com / Teacher@123");
        console.log("Student: student@example.com / Student@123");
        console.log("----------------------------------");

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Seed error:", error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(error => {
    console.error("Database connection error:", error.message);
    process.exitCode = 1;
});