import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
	prisma?: PrismaClient;
};

export function getPrismaClient() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not configured.");
	}

	if (!globalForPrisma.prisma) {
		globalForPrisma.prisma = new PrismaClient({
			adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
		});
	}

	return globalForPrisma.prisma;
}
