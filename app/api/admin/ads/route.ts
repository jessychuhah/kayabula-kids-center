import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";
import { getR2Client } from "@/lib/r2";

const httpUrl = z.url().refine((value) => value.startsWith("https://") || value.startsWith("http://"));
const r2AdObjectKey = z.string().max(260).refine((value) =>
	value.startsWith("ads/") && !value.includes("\\") && !value.split("/").includes(".."),
);
const adFields = {
	title: z.string().trim().min(2).max(120),
	handle: z.string().trim().max(100).nullable(),
	text: z.string().trim().max(2000).nullable(),
	mediaType: z.enum(["IMAGE", "VIDEO"]).nullable(),
	mediaUrl: httpUrl.nullable(),
	mediaKey: r2AdObjectKey.nullable(),
	targetUrl: httpUrl.nullable(),
	isActive: z.boolean(),
	sortOrder: z.number().int().min(0).max(10000),
};

const createAdSchema = z.object(adFields).refine(
	(ad) => Boolean(ad.text || ad.mediaUrl),
	{ message: "An advertisement needs text or an uploaded image/video." },
);
const updateAdSchema = z.object({ id: z.string().min(1), ...adFields });

async function requireAdministrator(request: Request) {
	const user = await getCurrentUserFromRequest(request);
	if (!user) return { response: NextResponse.json({ error: "Please log in to continue." }, { status: 401 }) };
	if (user.role !== "ADMIN") return { response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
	return { user };
}

export async function GET(request: Request) {
	try {
		const auth = await requireAdministrator(request);
		if ("response" in auth) return auth.response;
		const advertisements = await getPrismaClient().advertisement.findMany({
			orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
		});
		return NextResponse.json({ advertisements });
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load administrator advertisements.", error);
		return NextResponse.json({ error: "Unable to load advertisements right now." }, { status: 503 });
	}
}

export async function POST(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const auth = await requireAdministrator(request);
		if ("response" in auth) return auth.response;
		const parsed = createAdSchema.safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "Enter a title and text or upload media." }, { status: 400 });
		const advertisement = await getPrismaClient().advertisement.create({ data: parsed.data });
		return NextResponse.json({ advertisement }, { status: 201 });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		console.error("Unable to create advertisement.", error);
		return NextResponse.json({ error: "Unable to create the advertisement right now." }, { status: 503 });
	}
}

export async function PATCH(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const auth = await requireAdministrator(request);
		if ("response" in auth) return auth.response;
		const parsed = updateAdSchema.safeParse(await request.json());
		if (!parsed.success || !parsed.data.text && !parsed.data.mediaUrl) {
			return NextResponse.json({ error: "Enter a title and text or upload media." }, { status: 400 });
		}
		const { id, ...data } = parsed.data;
		const db = getPrismaClient();
		const existing = await db.advertisement.findUnique({ where: { id } });
		if (!existing) return NextResponse.json({ error: "That advertisement no longer exists." }, { status: 404 });
		const advertisement = await db.advertisement.update({ where: { id }, data });

		let mediaCleanupWarning = false;
		if (existing.mediaKey && existing.mediaKey !== data.mediaKey) {
			try {
				const { client, bucket } = getR2Client();
				if (!bucket) throw new Error("R2 bucket name is not configured.");
				await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: existing.mediaKey }));
			} catch (error) {
				mediaCleanupWarning = true;
				console.error("Updated advertisement but could not remove old R2 media.", { advertisementId: id, error });
			}
		}
		return NextResponse.json({ advertisement, mediaCleanupWarning });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		console.error("Unable to update advertisement.", error);
		return NextResponse.json({ error: "Unable to update the advertisement right now." }, { status: 503 });
	}
}

export async function DELETE(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const auth = await requireAdministrator(request);
		if ("response" in auth) return auth.response;
		const parsed = z.object({ id: z.string().min(1) }).safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "A valid advertisement ID is required." }, { status: 400 });

		const db = getPrismaClient();
		const advertisement = await db.advertisement.findUnique({ where: { id: parsed.data.id } });
		if (!advertisement) return NextResponse.json({ error: "That advertisement no longer exists." }, { status: 404 });
		if (advertisement.mediaKey) {
			const { client, bucket } = getR2Client();
			if (!bucket) return NextResponse.json({ error: "R2 bucket name is not configured; media was not removed." }, { status: 503 });
			await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: advertisement.mediaKey }));
		}
		await db.advertisement.delete({ where: { id: advertisement.id } });
		return NextResponse.json({ success: true });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		console.error("Unable to delete advertisement.", error);
		return NextResponse.json({ error: "Unable to delete the advertisement or its stored media." }, { status: 503 });
	}
}
