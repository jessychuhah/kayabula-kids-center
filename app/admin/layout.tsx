import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default function AdminLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<Suspense fallback={<main className="admin-data-state">Checking administrator access…</main>}>
			<RequireAdministrator>{children}</RequireAdministrator>
		</Suspense>
	);
}

async function RequireAdministrator({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const user = await getCurrentUser();
	if (!user) redirect("/account?next=%2Fadmin");
	if (user.role !== "ADMIN") redirect("/");
	return children;
}
