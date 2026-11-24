"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type StaffAccount = { name: string; role: string };

export default function AccountSecurityPage() {
	const router = useRouter();
	const [account, setAccount] = useState<StaffAccount | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	useEffect(() => {
		fetch("/api/auth/session", { cache: "no-store" })
			.then(async (response) => {
				const result = await response.json();
				if (!response.ok) throw new Error(result.error || "Unable to load your account.");
				if (!result.user || !["ADMIN", "OWNER"].includes(result.user.role)) {
					router.replace("/account");
					return;
				}
				setAccount({ name: result.user.name, role: result.user.role });
			})
			.catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Unable to load your account."))
			.finally(() => setLoading(false));
	}, [router]);

	async function changePassword(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		setError("");
		setNotice("");
		const formData = new FormData(form);
		const currentPassword = String(formData.get("currentPassword") ?? "");
		const newPassword = String(formData.get("newPassword") ?? "");
		if (newPassword !== formData.get("confirmPassword")) {
			setError("The new password and confirmation do not match.");
			return;
		}

		setSaving(true);
		try {
			const response = await fetch("/api/account/password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ currentPassword, newPassword }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to change your password.");
			form.reset();
			setNotice("Password updated. Other active sessions have been signed out.");
		} catch (changeError) {
			setError(changeError instanceof Error ? changeError.message : "Unable to change your password.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<main className="account-page">
			<section className="account-card">
				<Link className="account-back-link" href={account?.role === "OWNER" ? "/owner" : "/admin"}>
					← Back to {account?.role === "OWNER" ? "owner" : "admin"} dashboard
				</Link>
				<p className="section-kicker">Account security</p>
				{loading ? <p role="status">Loading your account…</p> : account ? (
					<>
						<h1>Change password</h1>
						<p className="account-description">Update the password for {account.name}. Other signed-in sessions will be revoked after a successful change.</p>
						<form className="account-form" onSubmit={changePassword}>
							<label>Current password<input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required /></label>
							<label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
							<label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
							{error && <p className="account-error" role="alert">{error}</p>}
							{notice && <p className="admin-success-notice" role="status">{notice}</p>}
							<button className="button button-purple account-action" type="submit" disabled={saving}>{saving ? "Updating…" : "Update password"}</button>
						</form>
					</>
				) : <p className="account-error" role="alert">{error || "Sign in as an administrator or owner to continue."}</p>}
			</section>
		</main>
	);
}
