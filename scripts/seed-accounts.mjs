import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

const required = ["DIRECT_URL", "OWNER_EMAIL", "OWNER_PASSWORD", "ADMIN_EMAIL", "ADMIN_PASSWORD"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
	console.error(`Missing required environment variables: ${missing.join(", ")}`);
	process.exit(1);
}

const ownerEmail = process.env.OWNER_EMAIL.trim().toLowerCase();
const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
const ownerPassword = process.env.OWNER_PASSWORD;
const adminPassword = process.env.ADMIN_PASSWORD;

if (ownerEmail === adminEmail) {
	console.error("OWNER_EMAIL and ADMIN_EMAIL must be different.");
	process.exit(1);
}

for (const [label, password] of [["OWNER_PASSWORD", ownerPassword], ["ADMIN_PASSWORD", adminPassword]]) {
	if (password.length < 12 || password.length > 128) {
		console.error(`${label} must contain between 12 and 128 characters.`);
		process.exit(1);
	}
}

const pool = new Pool({ connectionString: process.env.DIRECT_URL });

try {
	const ownerHash = await hash(ownerPassword, 12);
	const adminHash = await hash(adminPassword, 12);
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		for (const account of [
			{ email: ownerEmail, passwordHash: ownerHash, name: "Centre Owner", role: "OWNER" },
			{ email: adminEmail, passwordHash: adminHash, name: "Administrator", role: "ADMIN" },
		]) {
			const existing = await client.query('SELECT "role" FROM "User" WHERE "email" = $1', [account.email]);
			if (existing.rowCount) {
				throw new Error(`The configured ${account.role.toLowerCase()} email already exists. The seed command never changes existing accounts.`);
			}
			await client.query(
				`INSERT INTO "User" (
					"id", "name", "email", "phone", "passwordHash", "role", "status",
					"approvalStatus", "approvedAt", "createdAt", "updatedAt"
				) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
				[randomUUID(), account.name, account.email, "Not provided", account.passwordHash, account.role],
			);
		}
		await client.query("COMMIT");
		console.log("Owner and administrator accounts were created. Existing accounts were not changed.");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : "Unable to seed dashboard accounts.");
	process.exitCode = 1;
} finally {
	await pool.end();
}
