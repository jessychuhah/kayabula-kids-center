import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";

export async function GET() {
	try {
		const db = getPrismaClient();
		const [settings, advertisements] = await Promise.all([
			db.siteSettings.findUnique({ where: { id: "default" } }),
			db.advertisement.findMany({
				where: { isActive: true },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
				select: {
					id: true,
					title: true,
					handle: true,
					text: true,
					mediaType: true,
					mediaUrl: true,
					targetUrl: true,
					durationSeconds: true,
					assets: {
						orderBy: { sortOrder: "asc" },
						select: { id: true, url: true, mediaType: true },
					},
				},
			}),
		]);

		if (!settings) {
			return NextResponse.json({ error: "Public site settings are not initialized." }, { status: 503 });
		}
		return NextResponse.json({
			youthSupported: settings.youthSupported,
			familiesSupported: settings.familiesSupported,
			villagesReached: settings.villagesReached,
			whatsappNumber: settings.whatsappNumber,
			advertisements,
		});
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load public site content.", error);
		return NextResponse.json({ error: "Unable to load current community details." }, { status: 503 });
	}
}
