import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { deliverPendingApprovalEmails } from "@/lib/approval-email";
import { getCurrentUserFromRequest, isSameOrigin, isStaffUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

const userFields = {
	name: z.string().trim().min(2).max(100),
	email: z.email().trim().toLowerCase().max(160),
	phone: z.string().trim().min(5).max(40),
	location: z.string().trim().max(120).optional().default(""),
	category: z.enum(["SUPPORTER", "VOLUNTEER", "YOUTH_MEMBER"]).nullable().optional(),
	role: z.enum(["USER", "ADMIN"]),
};

const createUserSchema = z.object({
	...userFields,
	password: z.string().min(10).max(128),
});

const updateUserSchema = z.object({
	id: z.string().min(1),
	name: userFields.name.optional(),
	email: userFields.email.optional(),
	phone: userFields.phone.optional(),
	location: z.string().trim().max(120).optional(),
	category: userFields.category,
	role: userFields.role.optional(),
	status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
	approvalStatus: z.enum(["PENDING", "APPROVED"]).optional(),
}).refine((value) => Object.keys(value).some((key) => key !== "id"), {
	message: "At least one account field must be provided.",
});

async function requireAdministrator(request: Request) {
	const user = await getCurrentUserFromRequest(request);
	if (!user) {
		return { response: NextResponse.json({ error: "Please log in to continue." }, { status: 401 }) };
	}
	if (!isStaffUser(user)) {
		return { response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
	}
	return { user };
}

export async function GET(request: Request) {
	try {
		const auth = await requireAdministrator(request);
		if ("response" in auth) return auth.response;

		const users = await getPrismaClient().user.findMany({
			where: auth.user.role === "OWNER" ? undefined : { role: { not: "OWNER" } },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				name: true,
				email: true,
				phone: true,
				location: true,
				category: true,
				profileImageUrl: true,
				role: true,
				status: true,
				approvalStatus: true,
				lastLoginAt: true,
				createdAt: true,
				_count: { select: { donations: true } },
			},
		});
		return NextResponse.json({
			user: { id: auth.user.id, name: auth.user.name, email: auth.user.email, role: auth.user.role, profileImageUrl: auth.user.profileImageUrl },
			users,
		});
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load administrator user directory.", error);
		return NextResponse.json({ error: "Unable to load the user directory right now." }, { status: 503 });
	}
}

export async function POST(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const auth = await requireAdministrator(request);
		if ("response" in auth) return auth.response;

		const parsed = createUserSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json({ error: "Check the account details and use a password of at least 10 characters." }, { status: 400 });
		}
		const { name, email, phone, location, category, role, password } = parsed.data;
		if (role === "ADMIN" && auth.user.role !== "OWNER") {
			return NextResponse.json({ error: "Only the owner can create administrator accounts." }, { status: 403 });
		}
		const passwordHash = await hash(password, 12);
		const user = await getPrismaClient().user.create({
			data: { name, email, phone, location: location || null, category, role, passwordHash, approvalStatus: "APPROVED", approvedAt: new Date() },
			select: { id: true },
		});
		return NextResponse.json({ user }, { status: 201 });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
			return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
		}
		console.error("Administrator account creation failed.", error);
		return NextResponse.json({ error: "Unable to create the account right now." }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const auth = await requireAdministrator(request);
		if ("response" in auth) return auth.response;
		const parsed = updateUserSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json({ error: "Check the account details and try again." }, { status: 400 });
		}
		const { id, ...changes } = parsed.data;
		const db = getPrismaClient();
		let approvalNotificationId: string | undefined;
		await db.$transaction(async (transaction) => {
			const target = await transaction.user.findUnique({
				where: { id },
				select: { id: true, role: true, status: true, approvalStatus: true },
			});
			if (!target) throw new Error("USER_NOT_FOUND");
			if (target.role === "OWNER") throw new Error("CANNOT_MANAGE_OWNER");
			if (auth.user.role !== "OWNER" && target.role === "ADMIN") throw new Error("OWNER_ACCESS_REQUIRED");
			if (auth.user.role !== "OWNER" && changes.role === "ADMIN") throw new Error("OWNER_ACCESS_REQUIRED");
			if (target.approvalStatus === "APPROVED" && changes.approvalStatus === "PENDING") {
				throw new Error("CANNOT_REVOKE_APPROVAL");
			}

			const willBeAdmin = changes.role ?? target.role;
			const willBeApproved = changes.approvalStatus ?? target.approvalStatus;
			const isApprovalTransition = target.approvalStatus !== "APPROVED" && willBeApproved === "APPROVED";
			const willBeActive = isApprovalTransition ? "ACTIVE" : changes.status ?? target.status;
			if (target.id === auth.user.id && (willBeAdmin !== "ADMIN" || willBeActive !== "ACTIVE")) {
				throw new Error("CANNOT_DISABLE_SELF");
			}
			if (target.role === "ADMIN" && target.status === "ACTIVE" && (willBeAdmin !== "ADMIN" || willBeActive !== "ACTIVE")) {
				const activeAdminCount = await transaction.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
				if (activeAdminCount <= 1) throw new Error("LAST_ACTIVE_ADMIN");
			}

			const data = {
				...changes,
				status: willBeActive,
				...(changes.approvalStatus === "APPROVED" ? { approvedAt: isApprovalTransition ? new Date() : undefined } : {}),
				...(changes.approvalStatus === "PENDING" ? { approvedAt: null } : {}),
				...(changes.location !== undefined ? { location: changes.location || null } : {}),
			};
			await transaction.user.update({ where: { id }, data });
			if (isApprovalTransition) {
				const notification = await transaction.userNotification.create({
					data: {
						userId: id,
						kind: "ACCOUNT_APPROVED",
						title: "Your account has been approved",
						message: "Your Kayabula Kids Centre account has been approved. You can continue using the website and your account.",
					},
					select: { id: true },
				});
				approvalNotificationId = notification.id;
			}
			if (willBeActive === "SUSPENDED") {
				await transaction.authSession.deleteMany({ where: { userId: id } });
			}
		}, { isolationLevel: "Serializable" });
		let emailResult: Awaited<ReturnType<typeof deliverPendingApprovalEmails>> | null = null;
		if (approvalNotificationId) {
			try {
				emailResult = await deliverPendingApprovalEmails(1, approvalNotificationId);
			} catch (emailError) {
				console.error("Account was approved, but its email could not be attempted.", { notificationId: approvalNotificationId, error: emailError });
				emailResult = {
					sent: 0,
					failed: 1,
					configured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
				};
			}
		}
		return NextResponse.json({
			success: true,
			approvalEmailSent: emailResult?.sent === 1,
			approvalEmailConfigured: emailResult?.configured ?? false,
		});
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		if (error instanceof Error && error.message === "USER_NOT_FOUND") {
			return NextResponse.json({ error: "That account no longer exists." }, { status: 404 });
		}
		if (error instanceof Error && error.message === "CANNOT_MANAGE_OWNER") {
			return NextResponse.json({ error: "The owner account cannot be changed from the user directory." }, { status: 409 });
		}
		if (error instanceof Error && error.message === "OWNER_ACCESS_REQUIRED") {
			return NextResponse.json({ error: "Only the owner can manage administrator accounts." }, { status: 403 });
		}
		if (error instanceof Error && error.message === "CANNOT_DISABLE_SELF") {
			return NextResponse.json({ error: "You cannot suspend or demote your own administrator account." }, { status: 409 });
		}
		if (error instanceof Error && error.message === "LAST_ACTIVE_ADMIN") {
			return NextResponse.json({ error: "The last active administrator cannot be suspended or demoted." }, { status: 409 });
		}
		if (error instanceof Error && error.message === "CANNOT_REVOKE_APPROVAL") {
			return NextResponse.json({ error: "Approval cannot be revoked. Suspend the account instead." }, { status: 409 });
		}
		if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
			return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
		}
		console.error("Administrator account update failed.", error);
		return NextResponse.json({ error: "Unable to update the account right now." }, { status: 500 });
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
		if (!parsed.success) {
			return NextResponse.json({ error: "A valid account ID is required." }, { status: 400 });
		}
		if (parsed.data.id === auth.user.id) {
			return NextResponse.json({ error: "You cannot delete your own administrator account." }, { status: 409 });
		}

		const db = getPrismaClient();
		await db.$transaction(async (transaction) => {
			const target = await transaction.user.findUnique({
				where: { id: parsed.data.id },
				select: { id: true, role: true, status: true },
			});
			if (!target) throw new Error("USER_NOT_FOUND");
			if (target.role === "OWNER") throw new Error("CANNOT_MANAGE_OWNER");
			if (auth.user.role !== "OWNER" && target.role === "ADMIN") throw new Error("OWNER_ACCESS_REQUIRED");
			if (target.role === "ADMIN" && target.status === "ACTIVE") {
				const activeAdminCount = await transaction.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
				if (activeAdminCount <= 1) throw new Error("LAST_ACTIVE_ADMIN");
			}
			await transaction.user.delete({ where: { id: target.id } });
		}, { isolationLevel: "Serializable" });
		return NextResponse.json({ success: true });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		if (error instanceof Error && error.message === "USER_NOT_FOUND") {
			return NextResponse.json({ error: "That account no longer exists." }, { status: 404 });
		}
		if (error instanceof Error && error.message === "CANNOT_MANAGE_OWNER") {
			return NextResponse.json({ error: "The owner account cannot be deleted from the user directory." }, { status: 409 });
		}
		if (error instanceof Error && error.message === "OWNER_ACCESS_REQUIRED") {
			return NextResponse.json({ error: "Only the owner can manage administrator accounts." }, { status: 403 });
		}
		if (error instanceof Error && error.message === "LAST_ACTIVE_ADMIN") {
			return NextResponse.json({ error: "The last active administrator cannot be deleted." }, { status: 409 });
		}
		console.error("Administrator account deletion failed.", error);
		return NextResponse.json({ error: "Unable to delete the account right now." }, { status: 500 });
	}
}
