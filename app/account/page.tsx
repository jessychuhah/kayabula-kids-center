"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type AccountUser = {
	id: string;
	name: string;
	email: string;
	phone: string;
	location: string | null;
	category: string | null;
	role: string;
	approvalStatus: string;
};

type AccountNotification = {
	id: string;
	title: string;
	message: string;
	createdAt: string;
};

export default function AccountPage() {
	const router = useRouter();
	const [user, setUser] = useState<AccountUser | null>(null);
	const [loading, setLoading] = useState(true);
	const [registering, setRegistering] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [notifications, setNotifications] = useState<AccountNotification[]>([]);

	useEffect(() => {
		fetch("/api/auth/session", { cache: "no-store" })
			.then(async (response) => {
				const data = await response.json();
				if (!response.ok) throw new Error(data.error || "Unable to load your account.");
				setUser(data.user);
				if (data.user) {
					const notificationResponse = await fetch("/api/account/notifications", { cache: "no-store" });
					const notificationData = await notificationResponse.json();
					if (!notificationResponse.ok) throw new Error(notificationData.error || "Unable to load account notifications.");
					setNotifications(notificationData.notifications);
				}
			})
			.catch((requestError: unknown) => {
				setError(requestError instanceof Error ? requestError.message : "Unable to load your account.");
			})
			.finally(() => setLoading(false));
	}, []);

	async function submitAccount(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitting(true);
		setError("");
		const formData = new FormData(event.currentTarget);
		const payload: Record<string, FormDataEntryValue> = {
			email: formData.get("email") ?? "",
			password: formData.get("password") ?? "",
		};
		if (registering) {
			payload.name = formData.get("name") ?? "";
			payload.phone = formData.get("phone") ?? "";
			payload.location = formData.get("location") ?? "";
			const category = formData.get("category");
			if (category) payload.category = category;
			payload.adminSetupToken = formData.get("adminSetupToken") ?? "";
		}

		try {
			const response = await fetch(registering ? "/api/auth/register" : "/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Unable to access your account.");
			setUser(data.user);
			if (data.user.role === "ADMIN") router.push("/admin");
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : "Unable to access your account.");
		} finally {
			setSubmitting(false);
		}
	}

	async function logout() {
		setError("");
		try {
			const response = await fetch("/api/auth/logout", { method: "POST" });
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Unable to log out.");
			setUser(null);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : "Unable to log out.");
		}
	}

	return (
		<main className="account-page">
			<section className="account-card">
				<Link className="account-back-link" href="/">← Kayabula Kids Centre</Link>
				<p className="section-kicker">Your account</p>
				{loading ? (
					<p role="status">Loading your account…</p>
				) : user ? (
					<>
						<h1>Welcome, {user.name}</h1>
						<p className="account-description">Your details are ready to use at checkout. You can also donate as a guest at any time.</p>
						{user.approvalStatus === "PENDING" && (
							<p className="account-approval-notice" role="status">
								Your account is awaiting administrator approval. You can continue using the website while you wait. Accounts not approved within five days are automatically suspended.
							</p>
						)}
						{notifications.map((notification) => (
							<article className="account-notification" key={notification.id}>
								<strong>{notification.title}</strong>
								<p>{notification.message}</p>
								<small>{new Date(notification.createdAt).toLocaleString()}</small>
							</article>
						))}
						<div className="account-details">
							<p><span>Email</span><strong>{user.email}</strong></p>
							<p><span>Phone</span><strong>{user.phone}</strong></p>
							{user.location && <p><span>Location</span><strong>{user.location}</strong></p>}
							{user.category && <p><span>Category</span><strong>{user.category.replaceAll("_", " ").toLowerCase()}</strong></p>}
						</div>
						{user.role === "ADMIN" && <Link className="button button-purple account-action" href="/admin">Open admin dashboard <span>→</span></Link>}
						<button className="button button-outline account-action" type="button" onClick={logout}>Log out</button>
					</>
				) : (
					<>
						<h1>{registering ? "Create your account" : "Log in"}</h1>
						<p className="account-description">
							{registering ? "Save your contact details for a quicker checkout." : "Log in to use your saved details at checkout."}
						</p>
						<form className="account-form" onSubmit={submitAccount}>
							{registering && (
								<>
									<label>Full name<input name="name" autoComplete="name" minLength={2} maxLength={100} required /></label>
									<label>Phone number<input name="phone" type="tel" autoComplete="tel" minLength={5} maxLength={40} required /></label>
									<label>Location <span className="account-optional">(optional)</span><input name="location" autoComplete="address-level2" maxLength={120} /></label>
									<label>Category <span className="account-optional">(optional)</span>
										<select name="category" defaultValue="">
											<option value="">Select a category</option>
											<option value="SUPPORTER">Donor / Supporter</option>
											<option value="VOLUNTEER">Volunteer</option>
											<option value="YOUTH_MEMBER">Youth Member</option>
										</select>
									</label>
								</>
							)}
							<label>Email<input name="email" type="email" autoComplete="email" maxLength={160} required /></label>
							<label>Password<input name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 10 : undefined} maxLength={128} required /></label>
							{registering && (
								<label>
									Administrator setup token <span className="account-optional">(optional; first administrator only)</span>
									<input name="adminSetupToken" type="password" autoComplete="off" maxLength={256} />
								</label>
							)}
							{error && <p className="account-error" role="alert">{error}</p>}
							<button className="button button-gold account-action" type="submit" disabled={submitting}>
								{submitting ? "Please wait…" : registering ? "Create account" : "Log in"}
							</button>
						</form>
						<button className="account-switch" type="button" onClick={() => { setError(""); setRegistering(!registering); }}>
							{registering ? "Already have an account? Log in" : "New here? Create an account"}
						</button>
					</>
				)}
				{error && user && <p className="account-error" role="alert">{error}</p>}
			</section>
		</main>
	);
}
