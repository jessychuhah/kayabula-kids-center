import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin, isStaffUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

const channels = ["OWNER_USER", "OWNER_ADMIN", "ADMIN_ADMIN"] as const;
const messageSchema = z.object({
	channel: z.enum(channels),
	recipientId: z.string().min(1).optional(),
	message: z.string().trim().min(1).max(2000),
});
const onlineSince = () => new Date(Date.now() - 5 * 60 * 1000);
const pairKey = (channel: string, first: string, second: string) =>
	`${channel}:${[first, second].sort().join(":")}`;

async function claimQueuedMessages(userId: string) {
	const db = getPrismaClient();
	const queued = await db.directConversation.findMany({
		where: { channel: "OWNER_ADMIN", claimedById: null },
		orderBy: { createdAt: "asc" },
		take: 10,
		select: { id: true },
	});
	for (const conversation of queued) {
		await db.$transaction(async (transaction) => {
			const claimed = await transaction.directConversation.updateMany({
				where: { id: conversation.id, claimedById: null },
				data: { claimedById: userId },
			});
			if (claimed.count) {
				await transaction.directConversationMember.create({
					data: { conversationId: conversation.id, userId },
				});
			}
		});
	}
}

export async function GET(request: Request) {
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Log in to use private messages." }, { status: 401 });
		const url = new URL(request.url);
		const channel = url.searchParams.get("channel");
		if (!channels.includes(channel as (typeof channels)[number])) {
			return NextResponse.json({ error: "Choose a valid private channel." }, { status: 400 });
		}
		const db = getPrismaClient();
		if (isStaffUser(user)) {
			await db.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
		}
		if (channel === "OWNER_ADMIN" && user.role === "ADMIN") await claimQueuedMessages(user.id);
		const conversationId = url.searchParams.get("conversationId");
		if (conversationId) {
			const permitted =
				(channel === "OWNER_USER" && (user.role === "OWNER" || user.role === "USER")) ||
				(channel === "OWNER_ADMIN" && (user.role === "OWNER" || user.role === "ADMIN")) ||
				(channel === "ADMIN_ADMIN" && user.role === "ADMIN");
			if (!permitted) return NextResponse.json({ error: "You cannot access this private channel." }, { status: 403 });
			const conversation = await db.directConversation.findFirst({
				where: { id: conversationId, channel, members: { some: { userId: user.id } } },
				include: {
					members: { include: { user: { select: { id: true, name: true, role: true } } } },
					messages: {
						orderBy: { createdAt: "asc" },
						take: 100,
						include: { sender: { select: { id: true, name: true, role: true } } },
					},
				},
			});
			if (!conversation) return NextResponse.json({ error: "That private conversation is not available." }, { status: 404 });
			return NextResponse.json({ conversation });
		}
		if (channel === "OWNER_USER" && user.role === "OWNER") {
			const [conversations, users] = await Promise.all([
				db.directConversation.findMany({
					where: { channel, members: { some: { userId: user.id } } },
					orderBy: { updatedAt: "desc" },
					include: {
						members: { include: { user: { select: { id: true, name: true, role: true } } } },
						messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true } },
					},
				}),
				db.user.findMany({
					where: { role: "USER", status: "ACTIVE" },
					orderBy: { name: "asc" },
					take: 100,
					select: { id: true, name: true, email: true },
				}),
			]);
			return NextResponse.json({ conversations, users });
		}
		if (channel === "OWNER_USER" && user.role === "USER") {
			const conversations = await db.directConversation.findMany({
				where: { channel, members: { some: { userId: user.id } } },
				orderBy: { updatedAt: "desc" },
				include: {
					members: { include: { user: { select: { id: true, name: true, role: true } } } },
					messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true } },
				},
			});
			return NextResponse.json({ conversations });
		}
		if (channel === "OWNER_ADMIN" && user.role === "OWNER") {
			const [conversations, onlineAdmins] = await Promise.all([
				db.directConversation.findMany({
					where: { channel, members: { some: { userId: user.id } } },
					orderBy: { updatedAt: "desc" },
					include: {
						members: { include: { user: { select: { id: true, name: true, role: true } } } },
						messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true } },
						claimedBy: { select: { id: true, name: true, lastActiveAt: true } },
					},
				}),
				db.user.findMany({
					where: { role: "ADMIN", status: "ACTIVE", lastActiveAt: { gte: onlineSince() } },
					orderBy: { lastActiveAt: "desc" },
					select: { id: true, name: true, lastActiveAt: true },
				}),
			]);
			return NextResponse.json({ conversations, onlineAdmins });
		}
		if (channel === "OWNER_ADMIN" && user.role === "ADMIN") {
			const conversations = await db.directConversation.findMany({
				where: { channel, members: { some: { userId: user.id } } },
				orderBy: { updatedAt: "desc" },
				include: {
					members: { include: { user: { select: { id: true, name: true, role: true } } } },
					messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true } },
				},
			});
			return NextResponse.json({ conversations });
		}
		if (channel === "ADMIN_ADMIN" && user.role === "ADMIN") {
			const [conversations, admins] = await Promise.all([
				db.directConversation.findMany({
					where: { channel, members: { some: { userId: user.id } } },
					orderBy: { updatedAt: "desc" },
					include: {
						members: { include: { user: { select: { id: true, name: true, role: true } } } },
						messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true } },
					},
				}),
				db.user.findMany({
					where: { role: "ADMIN", status: "ACTIVE", id: { not: user.id } },
					orderBy: { name: "asc" },
					select: { id: true, name: true, lastActiveAt: true },
				}),
			]);
			return NextResponse.json({ conversations, admins });
		}
		return NextResponse.json({ error: "You cannot access this private channel." }, { status: 403 });
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load private communications.", error);
		return NextResponse.json({ error: "Unable to load private messages right now." }, { status: 503 });
	}
}

export async function POST(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Log in to send private messages." }, { status: 401 });
		const parsed = messageSchema.safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "Enter a message of up to 2,000 characters." }, { status: 400 });
		const { channel, message } = parsed.data;
		const db = getPrismaClient();
		let recipientId: string | null = parsed.data.recipientId ?? null;
		let conversationKey = "";
		let memberIds: string[] = [user.id];
		let claimedById: string | null = null;

		if (channel === "OWNER_USER") {
			if (user.role === "OWNER") {
				if (!recipientId) return NextResponse.json({ error: "Choose a user for this private message." }, { status: 400 });
				const recipient = await db.user.findUnique({ where: { id: recipientId }, select: { role: true, status: true } });
				if (!recipient || recipient.role !== "USER" || recipient.status !== "ACTIVE") {
					return NextResponse.json({ error: "Choose an active user account." }, { status: 400 });
				}
			} else if (user.role === "USER") {
				const owner = await db.user.findFirst({ where: { role: "OWNER", status: "ACTIVE" }, select: { id: true } });
				if (!owner) return NextResponse.json({ error: "The owner is not available for private messages." }, { status: 503 });
				recipientId = owner.id;
			} else {
				return NextResponse.json({ error: "Only users and the owner can use this channel." }, { status: 403 });
			}
		} else if (channel === "OWNER_ADMIN") {
			if (user.role === "OWNER") {
				if (recipientId) {
					const recipient = await db.user.findUnique({ where: { id: recipientId }, select: { role: true, status: true, lastActiveAt: true } });
					if (!recipient || recipient.role !== "ADMIN" || recipient.status !== "ACTIVE") {
						return NextResponse.json({ error: "Choose an active administrator." }, { status: 400 });
					}
					const existing = await db.directConversation.findFirst({
						where: { channel, claimedById: recipientId, members: { some: { userId: user.id } } },
						orderBy: { updatedAt: "desc" },
						select: { pairKey: true, members: { select: { userId: true } } },
					});
					if (existing) {
						conversationKey = existing.pairKey;
						memberIds = existing.members.map((member) => member.userId);
						claimedById = recipientId;
					} else if (!recipient.lastActiveAt || recipient.lastActiveAt < onlineSince()) {
						return NextResponse.json({ error: "That administrator is no longer online. Send to the available-admin queue instead." }, { status: 409 });
					}
				}
			} else if (user.role === "ADMIN") {
				if (!recipientId) return NextResponse.json({ error: "Choose an owner conversation to reply to." }, { status: 400 });
				const conversation = await db.directConversation.findFirst({
					where: {
						id: recipientId,
						channel,
						claimedById: user.id,
						members: { some: { userId: user.id } },
					},
					select: { id: true, pairKey: true, members: { select: { userId: true } } },
				});
				if (!conversation || !conversation.members.some((member) => member.userId !== user.id)) {
					return NextResponse.json({ error: "That owner conversation is not assigned to you." }, { status: 403 });
				}
				conversationKey = conversation.pairKey;
				memberIds = conversation.members.map((member) => member.userId);
				claimedById = user.id;
			} else {
				return NextResponse.json({ error: "Only admins and the owner can use this channel." }, { status: 403 });
			}
		} else if (channel === "ADMIN_ADMIN") {
			if (user.role !== "ADMIN") return NextResponse.json({ error: "Only admins can use this channel." }, { status: 403 });
			if (!recipientId || recipientId === user.id) return NextResponse.json({ error: "Choose another administrator." }, { status: 400 });
			const recipient = await db.user.findUnique({ where: { id: recipientId }, select: { role: true, status: true } });
			if (!recipient || recipient.role !== "ADMIN" || recipient.status !== "ACTIVE") {
				return NextResponse.json({ error: "Choose an active administrator." }, { status: 400 });
			}
		}

		if (!conversationKey && channel === "OWNER_ADMIN" && user.role === "OWNER" && !recipientId) {
			const queued = await db.directConversation.findFirst({
				where: { channel, claimedById: null, members: { some: { userId: user.id } } },
				select: { pairKey: true },
				orderBy: { createdAt: "asc" },
			});
			conversationKey = queued?.pairKey ?? `${channel}:${user.id}:queued:${randomUUID()}`;
		} else if (!conversationKey && channel === "OWNER_ADMIN" && user.role === "ADMIN") {
			return NextResponse.json({ error: "That owner conversation is no longer available." }, { status: 404 });
		} else if (!conversationKey && recipientId) {
			memberIds = [user.id, recipientId];
			conversationKey = pairKey(channel, user.id, recipientId);
			if (channel === "OWNER_ADMIN" && user.role === "OWNER") claimedById = recipientId;
		} else if (!conversationKey) {
			return NextResponse.json({ error: "A message recipient is required." }, { status: 400 });
		}

		const result = await db.$transaction(async (transaction) => {
			const conversation = await transaction.directConversation.upsert({
				where: { pairKey: conversationKey },
				create: { channel, pairKey: conversationKey, claimedById },
				update: { updatedAt: new Date(), ...(claimedById ? { claimedById } : {}) },
				select: { id: true },
			});
			await transaction.directConversationMember.createMany({
				data: [...new Set(memberIds)].map((memberId) => ({ conversationId: conversation.id, userId: memberId })),
				skipDuplicates: true,
			});
			const savedMessage = await transaction.directMessage.create({
				data: { conversationId: conversation.id, senderId: user.id, body: message },
				include: { sender: { select: { id: true, name: true, role: true } } },
			});
			return { conversationId: conversation.id, message: savedMessage };
		});
		return NextResponse.json({
			...result,
			queued: channel === "OWNER_ADMIN" && user.role === "OWNER" && !recipientId,
		}, { status: 201 });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to send a private message.", error);
		return NextResponse.json({ error: "Unable to send your private message right now." }, { status: 503 });
	}
}
