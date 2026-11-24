"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import ProfilePhoto from "@/app/account/profile-photo";

type AccountUser = {
	id: string;
	name: string;
	email: string;
	phone: string;
	location: string | null;
	category: string | null;
	profileImageUrl: string | null;
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
	const [recovering, setRecovering] = useState(false);
	const [otpRequested, setOtpRequested] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [resetNotice, setResetNotice] = useState("");
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
			if (data.user.role === "OWNER") router.push("/owner");
			else if (data.user.role === "ADMIN") router.push("/admin");
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : "Unable to access your account.");
		} finally {
			setSubmitting(false);
		}
	}

	async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitting(true);
		setError("");
		setResetNotice("");
		const formData = new FormData(event.currentTarget);
		const payload = otpRequested
			? {
				action: "reset",
				email: formData.get("email"),
				code: formData.get("code"),
				password: formData.get("newPassword"),
			}
			: {
				action: "request",
				email: formData.get("email"),
			};
		try {
			const response = await fetch("/api/auth/password-reset", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to reset your password.");
			if (otpRequested) {
				setRecovering(false);
				setOtpRequested(false);
				setResetNotice(result.message);
			} else {
				setOtpRequested(true);
				setResetNotice(result.message);
			}
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : "Unable to reset your password.");
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
		<main className={user ? "account-page account-profile-page" : "account-page account-auth-page"}>
			<section className={user ? "account-card account-profile-card" : "account-card account-auth-card"}>
				{!user ? (
					<div className="account-auth-layout">
						<aside className="account-brand-panel">
							<Link className="account-brand" href="/" aria-label="Kayabula Kids Centre home">
								<Image src="/assets/logo.jpeg" alt="" width={58} height={58} />
								<span><strong>KAYABULA</strong><small>KIDS CENTRE</small></span>
							</Link>
							<div className="account-brand-message">
								<p>YOUR KAYABULA ACCOUNT</p>
								<h2>Stay connected to the support that matters.</h2>
								<span>Sign in to manage your details, follow centre updates and make giving easier.</span>
							</div>
							<div className="account-brand-footer">Education · Wellness · Opportunity</div>
							<div className="account-brand-decoration" aria-hidden="true"></div>
						</aside>
						<div className="account-auth-main">
							<Link className="account-back-link" href="/">← Back to website</Link>
							<p className="section-kicker">{registering ? "Create an account" : "Welcome back"}</p>
							{loading ? <p className="account-loading" role="status">Checking your account…</p> : (
								<>
									{recovering ? (
										<>
											<h1>Reset your password</h1>
											<p className="account-description">We’ll email a one-time verification code. The code expires after 10 minutes.</p>
											<form className="account-form" onSubmit={submitPasswordReset}>
												<label>Email address<input name="email" type="email" autoComplete="email" maxLength={160} required /></label>
												{otpRequested && (
													<>
														<label>Email verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
														<label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label>
													</>
												)}
												{error && <p className="account-error" role="alert">{error}</p>}
												{resetNotice && <p className="account-notification" role="status">{resetNotice}</p>}
												<button className="button button-purple account-action" type="submit" disabled={submitting}>
													{submitting ? "Please wait…" : otpRequested ? "Reset password" : "Email reset code"}
												</button>
											</form>
											<button className="account-switch" type="button" onClick={() => { setRecovering(false); setOtpRequested(false); setError(""); setResetNotice(""); }}>Back to sign in</button>
										</>
									) : (
										<>
											<h1>{registering ? "Join the community" : "Sign in to your account"}</h1>
											<p className="account-description">
												{registering ? "Create an account to save your details and receive centre updates." : "Enter your details to continue to Kayabula."}
											</p>
											{resetNotice && <p className="account-notification" role="status">{resetNotice}</p>}
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
										<label>Email address<input name="email" type="email" autoComplete="email" maxLength={160} required /></label>
										<label>Password<input name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 10 : undefined} maxLength={128} required /></label>
										{error && <p className="account-error" role="alert">{error}</p>}
										<button className="button button-purple account-action" type="submit" disabled={submitting}>
											{submitting ? "Please wait…" : registering ? "Create account" : "Sign in"}
										</button>
											</form>
											{!registering && <button className="account-switch" type="button" onClick={() => { setRecovering(true); setError(""); setResetNotice(""); setOtpRequested(false); }}>Forgot password?</button>}
											<button className="account-switch" type="button" onClick={() => { setError(""); setRegistering(!registering); }}>
												{registering ? "Already have an account? Sign in" : "New to Kayabula? Create an account"}
											</button>
										</>
									)}
								</>
							)}
							{error && loading && <p className="account-error" role="alert">{error}</p>}
						</div>
					</div>
				) : (
					<div className="account-profile-content">
						<Link className="account-back-link" href="/">← Kayabula Kids Centre</Link>
						<p className="section-kicker">Your account</p>
						<h1>Welcome, {user.name}</h1>
						<p className="account-description">Manage your profile, see centre updates and use your saved details at checkout.</p>
						<ProfilePhoto
							name={user.name}
							imageUrl={user.profileImageUrl}
							onChange={(profileImageUrl) => setUser((current) => current ? { ...current, profileImageUrl } : current)}
						/>
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
						{user.role === "OWNER" && <Link className="button button-purple account-action" href="/owner">Open owner dashboard <span>→</span></Link>}
						{user.role !== "ADMIN" && user.role !== "OWNER" && <Link className="button button-outline account-action" href="/updates">View centre updates <span>→</span></Link>}
						<button className="button button-outline account-action" type="button" onClick={logout}>Log out</button>
						{error && <p className="account-error" role="alert">{error}</p>}
					</div>
				)}
			</section>
		</main>
	);
}
