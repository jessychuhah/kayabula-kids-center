import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin, isStaffUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";
import { getR2Client } from "@/lib/r2";

const httpUrl = z.url().refine((value) => value.startsWith("https://") || value.startsWith("http://"));
const r2AdObjectKey = z.string().max(260).refine((value) =>
	value.startsWith("ads/") && !value.includes("\\") && !value.split("/").includes(".."),
);
const adMedia = z.object({
	url: httpUrl,
	key: r2AdObjectKey.nullable().optional(),
	mediaType: z.enum(["IMAGE", "VIDEO"]),
});
const adFields = {
	title: z.string().trim().min(2).max(120),
	handle: z.string().trim().max(100).nullable(),
	text: z.string().trim().max(2000).nullable(),
	targetUrl: httpUrl.nullable(),
	durationSeconds: z.number().int().min(2).max(300),
	isActive: z.boolean(),
	sortOrder: z.number().int().min(0).max(10000),
	assets: z.array(adMedia).max(10).default([]),
	mediaType: z.enum(["IMAGE", "VIDEO"]).nullable().optional(),
	mediaUrl: httpUrl.nullable().optional(),
	mediaKey: r2AdObjectKey.nullable().optional(),
};

function hasContent(ad: { text: string | null; assets: Array<unknown>; mediaUrl?: string | null }) {
	return Boolean(ad.text || ad.assets.length || ad.mediaUrl);
}

async function requireStaff(request: Request) {
	const user = await getCurrentUserFromRequest(request);
	if (!user) return { response: NextResponse.json({ error: "Please log in to continue." }, { status: 401 }) };
	if (!isStaffUser(user)) return { response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
	return { user };
}

async function removeR2Objects(keys: string[]) {
	if (!keys.length) return;
	const { client, bucket } = getR2Client();
	if (!bucket) throw new Error("R2 bucket name is not configured.");
	await Promise.all(keys.map((Key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key }))));
}

export async function GET(request: Request) {
	try {
		const auth = await requireStaff(request);
		if ("response" in auth) return auth.response;
		const advertisements = await getPrismaClient().advertisement.findMany({
			orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
			include: { assets: { orderBy: { sortOrder: "asc" } } },
		});
		return NextResponse.json({ advertisements });
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load administrator advertisements.", error);
		return NextResponse.json({ error: "Unable to load advertisements right now." }, { status: 503 });
	}
}

export async function POST(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const auth = await requireStaff(request);
		if ("response" in auth) return auth.response;
		const parsed = z.object(adFields).safeParse(await request.json());
		if (!parsed.success || !hasContent(parsed.data)) {
			return NextResponse.json({ error: "Enter a title and text or attach media." }, { status: 400 });
		}
		if (auth.user.role !== "ADMIN" && (parsed.data.assets.length || parsed.data.mediaUrl || parsed.data.mediaKey)) {
			return NextResponse.json({ error: "Only administrators can add advertising media." }, { status: 403 });
		}
		const { assets, mediaType, mediaUrl, mediaKey, ...fields } = parsed.data;
		const advertisement = await getPrismaClient().advertisement.create({
			data: {
				...fields,
				mediaType: mediaType ?? null,
				mediaUrl: mediaUrl ?? null,
				mediaKey: mediaKey ?? null,
				assets: { create: assets.map((asset, sortOrder) => ({
					url: asset.url,
					objectKey: asset.key ?? null,
					mediaType: asset.mediaType,
					sortOrder,
				})) },
			},
			include: { assets: { orderBy: { sortOrder: "asc" } } },
		});
		return NextResponse.json({ advertisement }, { status: 201 });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to create advertisement.", error);
		return NextResponse.json({ error: "Unable to create the advertisement right now." }, { status: 503 });
	}
}

export async function PATCH(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const auth = await requireStaff(request);
		if ("response" in auth) return auth.response;
		const parsed = z.object({ id: z.string().min(1), ...adFields }).safeParse(await request.json());
		if (!parsed.success || !hasContent(parsed.data)) {
			return NextResponse.json({ error: "Enter a title and text or attach media." }, { status: 400 });
		}
		const { id, assets, mediaType, mediaUrl, mediaKey, ...fields } = parsed.data;
		const db = getPrismaClient();
		const existing = await db.advertisement.findUnique({ where: { id }, include: { assets: true } });
		if (!existing) return NextResponse.json({ error: "That advertisement no longer exists." }, { status: 404 });
		if (auth.user.role !== "ADMIN") {
			const existingAssetKeys = new Set([
				...existing.assets.map((asset) => `${asset.objectKey ?? ""}\n${asset.url}\n${asset.mediaType}`),
				...(existing.mediaUrl ? [`${existing.mediaKey ?? ""}\n${existing.mediaUrl}\n${existing.mediaType ?? "IMAGE"}`] : []),
			]);
			if (assets.some((asset) => !existingAssetKeys.has(`${asset.key ?? ""}\n${asset.url}\n${asset.mediaType}`))) {
				return NextResponse.json({ error: "Only administrators can add or replace advertising media." }, { status: 403 });
			}
			if (mediaUrl && mediaUrl !== existing.mediaUrl || mediaKey && mediaKey !== existing.mediaKey) {
				return NextResponse.json({ error: "Only administrators can add or replace advertising media." }, { status: 403 });
			}
		}
		const advertisement = await db.advertisement.update({
			where: { id },
			data: {
				...fields,
				mediaType: mediaType ?? null,
				mediaUrl: mediaUrl ?? null,
				mediaKey: mediaKey ?? null,
				assets: {
					deleteMany: {},
					create: assets.map((asset, sortOrder) => ({
						url: asset.url,
						objectKey: asset.key ?? null,
						mediaType: asset.mediaType,
						sortOrder,
					})),
				},
			},
			include: { assets: { orderBy: { sortOrder: "asc" } } },
		});
		const retainedKeys = new Set([
			...assets.flatMap((asset) => asset.key ? [asset.key] : []),
			...((mediaKey && mediaUrl) ? [mediaKey] : []),
		]);
		const removedKeys = [
			...existing.assets.flatMap((asset) => asset.objectKey ? [asset.objectKey] : []),
			...(existing.mediaKey ? [existing.mediaKey] : []),
		].filter((key) => !retainedKeys.has(key));
		let mediaCleanupWarning = false;
		try {
			await removeR2Objects(removedKeys);
		} catch (error) {
			mediaCleanupWarning = true;
			console.error("Updated advertisement but could not remove old R2 media.", { advertisementId: id, error });
		}
		return NextResponse.json({ advertisement, mediaCleanupWarning });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to update advertisement.", error);
		return NextResponse.json({ error: "Unable to update the advertisement right now." }, { status: 503 });
	}
}

export async function DELETE(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const auth = await requireStaff(request);
		if ("response" in auth) return auth.response;
		const parsed = z.object({ id: z.string().min(1) }).safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "A valid advertisement ID is required." }, { status: 400 });
		const db = getPrismaClient();
		const advertisement = await db.advertisement.findUnique({ where: { id: parsed.data.id }, include: { assets: true } });
		if (!advertisement) return NextResponse.json({ error: "That advertisement no longer exists." }, { status: 404 });
		const keys = [
			...advertisement.assets.flatMap((asset) => asset.objectKey ? [asset.objectKey] : []),
			...(advertisement.mediaKey ? [advertisement.mediaKey] : []),
		];
		try {
			await removeR2Objects(keys);
		} catch (error) {
			console.error("Unable to remove advertisement media; record was retained.", { advertisementId: advertisement.id, error });
			return NextResponse.json({ error: "Unable to remove stored media; the advertisement was not deleted." }, { status: 503 });
		}
		await db.advertisement.delete({ where: { id: advertisement.id } });
		return NextResponse.json({ success: true });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to delete advertisement.", error);
		return NextResponse.json({ error: "Unable to delete the advertisement or its stored media." }, { status: 503 });
	}
}
