import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

const settingsSchema = z.object({
	youthSupported: z.number().int().min(0).max(1_000_000_000),
	familiesSupported: z.number().int().min(0).max(1_000_000_000),
	villagesReached: z.number().int().min(0).max(1_000_000_000),
	whatsappNumber: z.string().trim().min(9).max(24).regex(/^\+?[1-9][\d\s()-]{7,20}$/).transform((number) => number.replace(/\D/g, ""))
		.pipe(z.string().min(8).max(15)),
});

export async function GET(request: Request) {
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
		if (user.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

		const settings = await getPrismaClient().siteSettings.findUnique({ where: { id: "default" } });
		if (!settings) return NextResponse.json({ error: "Site settings are not initialized." }, { status: 503 });
		return NextResponse.json({ settings });
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load administrator site settings.", error);
		return NextResponse.json({ error: "Unable to load site settings right now." }, { status: 503 });
	}
}

export async function PATCH(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
		if (user.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

		const parsed = settingsSchema.safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "Enter non-negative whole-number impact totals and a valid international WhatsApp number." }, { status: 400 });
		const settings = await getPrismaClient().siteSettings.upsert({
			where: { id: "default" },
			create: { id: "default", ...parsed.data },
			update: parsed.data,
		});
		return NextResponse.json({ settings });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		console.error("Unable to update administrator site settings.", error);
		return NextResponse.json({ error: "Unable to save site settings right now." }, { status: 503 });
	}
}
