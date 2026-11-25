"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type UserRecord = {
	id: string;
	name: string;
	profileImageUrl: string | null;
	email: string;
	phone: string;
	location: string | null;
	category: string | null;
	role: string;
	status: string;
	approvalStatus: string;
	lastLoginAt: string | null;
	createdAt: string;
	_count: { donations: number };
};

type AccountForm = {
	name: string;
	email: string;
	phone: string;
	location: string;
	category: string;
	role: string;
	status: string;
	approvalStatus: string;
	password: string;
};

const emptyForm: AccountForm = {
	name: "",
	email: "",
	phone: "",
	location: "",
	category: "",
	role: "USER",
	status: "ACTIVE",
	approvalStatus: "APPROVED",
	password: "",
};

function displayCategory(category: string | null) {
	if (!category) return "—";
	return category.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function approvalNotice(result: { approvalEmailConfigured: boolean; approvalEmailSent: boolean }) {
	if (result.approvalEmailSent) return "Account approved and notification email sent.";
	if (result.approvalEmailConfigured) return "Account approved. Email delivery is queued for retry.";
	return "Account approved. The in-app notice is ready, but email is not configured.";
}

export default function AdminUsersPage() {
	const router = useRouter();
	const [users, setUsers] = useState<UserRecord[]>([]);
	const [admin, setAdmin] = useState<{ id: string; name: string; email: string; role: string; profileImageUrl: string | null } | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState("ALL");
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
	const [form, setForm] = useState<AccountForm>(emptyForm);
	const [saving, setSaving] = useState(false);
	const [temporaryPasswordVisible, setTemporaryPasswordVisible] = useState(false);
	const [notice, setNotice] = useState("");

	useEffect(() => {
		let active = true;
		fetch("/api/admin/users", { cache: "no-store" })
			.then(async (response) => {
				const result = await response.json();
				if (response.status === 401 || response.status === 403) {
					router.replace("/account");
					return null;
				}
				if (!response.ok) throw new Error(result.error || "Unable to load users.");
				return result as { user: { id: string; name: string; email: string; role: string; profileImageUrl: string | null }; users: UserRecord[] };
			})
			.then((result) => {
				if (active && result) {
					setAdmin(result.user);
					setUsers(result.users);
					setError("");
				}
			})
			.catch((loadError: unknown) => {
				if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => { active = false; };
	}, [refreshKey, router]);

	const filteredUsers = useMemo(() => {
		const query = search.trim().toLowerCase();
		return users.filter((user) => {
			const matchesSearch = !query || [user.name, user.email, user.phone, user.location ?? ""]
				.some((value) => value.toLowerCase().includes(query));
			const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
			return matchesSearch && matchesRole;
		});
	}, [roleFilter, search, users]);

	function startAdd() {
		setEditingUser(null);
		setForm(emptyForm);
		setTemporaryPasswordVisible(false);
		setError("");
		setModalOpen(true);
	}

	function startEdit(user: UserRecord) {
		setEditingUser(user);
		setForm({
			name: user.name,
			email: user.email,
			phone: user.phone,
			location: user.location ?? "",
			category: user.category ?? "",
			role: user.role,
			status: user.status,
			approvalStatus: user.approvalStatus,
			password: "",
		});
		setError("");
		setModalOpen(true);
	}

	async function approveUser(user: UserRecord) {
		setError("");
		try {
			const response = await fetch("/api/admin/users", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: user.id, approvalStatus: "APPROVED" }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to approve the account.");
			if (result.approvalEmailConfigured && !result.approvalEmailSent) {
				setNotice("Account approved. The email is queued for retry; check the email service configuration if delivery continues to fail.");
			} else if (!result.approvalEmailConfigured) {
				setNotice("Account approved. The in-app notice is ready, but email is not configured yet.");
			} else {
				setNotice("Account approved and notification email sent.");
			}
			setRefreshKey((key) => key + 1);
		} catch (approvalError) {
			setError(approvalError instanceof Error ? approvalError.message : "Unable to approve the account.");
		}
	}

	async function submitAccount(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (editingUser && editingUser.role !== "OWNER" && form.role === "OWNER" &&
			!window.confirm(`Grant permanent ownership to ${editingUser.name}? Administrators will not be able to change or revoke this role.`)) return;
		setSaving(true);
		setError("");
		const payload: Record<string, string | null> = {
			name: form.name,
			email: form.email,
			phone: form.phone,
			location: form.location,
			category: form.category || null,
			role: form.role,
			approvalStatus: form.approvalStatus,
		};
		if (editingUser) {
			payload.id = editingUser.id;
			payload.status = form.status;
		} else {
			payload.password = form.password;
		}

		try {
			const response = await fetch("/api/admin/users", {
				method: editingUser ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to save the account.");
			setForm(emptyForm);
			setModalOpen(false);
			if (editingUser && editingUser.role !== "OWNER" && form.role === "OWNER") {
				setNotice(`${editingUser.name} was granted permanent ownership. Administrators cannot change or revoke this role.`);
			} else if (editingUser && editingUser.approvalStatus === "PENDING" && form.approvalStatus === "APPROVED") {
				setNotice(approvalNotice(result));
			} else {
				setNotice("");
			}
			setRefreshKey((key) => key + 1);
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "Unable to save the account.");
		} finally {
			setSaving(false);
		}
	}

	async function deleteAccount(user: UserRecord) {
		if (!window.confirm(`Delete ${user.name}'s account? Past donation records will be kept without a linked account.`)) return;
		setError("");
		try {
			const response = await fetch("/api/admin/users", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: user.id }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to delete the account.");
			setRefreshKey((key) => key + 1);
		} catch (deleteError) {
			setError(deleteError instanceof Error ? deleteError.message : "Unable to delete the account.");
		}
	}

	async function logout() {
		setError("");
		try {
			const response = await fetch("/api/auth/logout", { method: "POST" });
			if (!response.ok) throw new Error("Unable to log out. Please try again.");
			router.replace("/");
		} catch (logoutError) {
			setError(logoutError instanceof Error ? logoutError.message : "Unable to log out.");
		}
	}

	return (
		<div className="admin-shell">
			<aside className={sidebarOpen ? "admin-sidebar open" : "admin-sidebar"}>
				<div className="admin-brand">
					<Image src="/assets/logo.jpeg" alt="Kayabula Kids Centre" width={48} height={48} />
					<div><strong>KAYABULA</strong><span>{admin?.role === "OWNER" ? "Owner Centre" : "Admin Centre"}</span></div>
					<button type="button" className="sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>×</button>
				</div>
				<nav className="admin-nav" aria-label="Admin navigation">
					<p>WORKSPACE</p>
					<Link href="/admin" onClick={() => setSidebarOpen(false)}><span className="nav-icon grid" aria-hidden="true"></span>Overview</Link>
					<Link href="/admin#donations" onClick={() => setSidebarOpen(false)}><span className="nav-icon wallet" aria-hidden="true"></span>Donations</Link>
					<Link className="active" href="/admin/users" onClick={() => setSidebarOpen(false)}><span className="nav-icon users" aria-hidden="true"></span>Users</Link>
					<Link href="/admin/content" onClick={() => setSidebarOpen(false)}><span className="nav-icon pages" aria-hidden="true"></span>Content</Link>
					<Link href="/admin/inbox" onClick={() => setSidebarOpen(false)}><span className="nav-icon inbox" aria-hidden="true"></span>Support inbox</Link>
					<Link href="/admin/communications" onClick={() => setSidebarOpen(false)}><span className="nav-icon inbox" aria-hidden="true"></span>Team &amp; updates</Link>
					<Link href="/account" onClick={() => setSidebarOpen(false)}><span className="nav-icon users" aria-hidden="true"></span>My profile</Link>
					<Link href="/account/security" onClick={() => setSidebarOpen(false)}><span className="nav-icon settings" aria-hidden="true"></span>Security</Link>
				</nav>
				<div className="admin-sidebar-bottom">
					<Link className="admin-home-link" href="/">View public website ↗</Link>
					{admin && <div className="admin-profile">
						<div className="profile-avatar">{admin.profileImageUrl
							? <Image src={admin.profileImageUrl} alt="" width={36} height={36} unoptimized />
							: admin.name.trim().slice(0, 1).toUpperCase()}</div>
						<div><strong>{admin.name}</strong><span>{admin.role === "OWNER" ? "Owner" : "Administrator"}</span></div>
						<button type="button" aria-label="Log out" onClick={logout}>↪</button>
					</div>}
				</div>
			</aside>

			{sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
			<main className="admin-main">
				<header className="admin-topbar">
					<button type="button" className="admin-menu-button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
						<span></span><span></span><span></span>
					</button>
					<div><p>ADMIN WORKSPACE</p><h1>Users</h1></div>
					<div className="topbar-actions">
						<button type="button" className="quick-button" disabled={loading} onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }}>
							<span>↻</span> Refresh data
						</button>
					</div>
				</header>

				<div className="admin-content">
					{error && !modalOpen && <p className="admin-data-error" role="alert">{error}</p>}
					{notice && <p className="admin-success-notice" role="status">{notice}</p>}
					<section className="table-card users-card" aria-labelledby="users-title">
						<div className="card-heading users-heading">
							<div><p>ACCOUNT DIRECTORY</p><h2 id="users-title">Registered accounts</h2></div>
							<button type="button" className="quick-button" onClick={startAdd}>+ Add User</button>
						</div>
						<div className="user-directory-controls">
							<label className="user-search">
								<span className="sr-only">Search by name, email, phone, or location</span>
								<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone, or location" />
							</label>
							<label className="user-role-filter">Role
								<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
									<option value="ALL">All</option>
									<option value="ADMIN">Admins</option>
									<option value="USER">Members</option>
									{admin?.role === "OWNER" && <option value="OWNER">Owners</option>}
								</select>
							</label>
						</div>
						{loading ? (
							<p className="admin-data-state" role="status">Loading accounts…</p>
						) : filteredUsers.length ? (
							<div className="users-table-wrap">
								<table className="users-table">
									<thead><tr>
										<th scope="col">Full name</th><th scope="col">Email / phone</th><th scope="col">Location / category</th>
										<th scope="col">Role</th><th scope="col">Status</th><th scope="col">Approval</th><th scope="col">Donations</th>
										<th scope="col">Last login</th><th scope="col">Created</th><th scope="col"><span className="sr-only">Actions</span></th>
									</tr></thead>
									<tbody>{filteredUsers.map((user) => (
										<tr key={user.id}>
											<td><div className="user-name-with-avatar">
												<span className="user-directory-avatar">{user.profileImageUrl
													? <Image src={user.profileImageUrl} alt="" width={34} height={34} unoptimized />
													: user.name.trim().slice(0, 1).toUpperCase()}</span>
												<strong>{user.name}</strong>
											</div></td>
											<td><span>{user.email}</span><small>{user.phone}</small></td>
											<td><span>{user.location || "—"}</span><small>{displayCategory(user.category)}</small></td>
											<td>{user.role === "OWNER" ? "Owner" : user.role === "ADMIN" ? "Admin" : "Member"}</td>
											<td><span className={`user-status ${user.status.toLowerCase()}`}>{user.status === "ACTIVE" ? "Active" : "Suspended"}</span></td>
											<td><span className={`approval-status ${user.approvalStatus.toLowerCase()}`}>{user.approvalStatus === "APPROVED" ? "Approved" : "Pending"}</span></td>
											<td>{user._count.donations}</td>
											<td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}</td>
											<td>{new Date(user.createdAt).toLocaleDateString()}</td>
											<td>{user.role !== "OWNER" && user.id !== admin?.id ? <details className="user-row-actions">
												<summary aria-label={`Actions for ${user.name}`}>···</summary>
												<div>
													{user.approvalStatus === "PENDING" && <button type="button" onClick={() => approveUser(user)}>Approve &amp; notify</button>}
													<button type="button" onClick={() => startEdit(user)}>Edit details</button>
													<button type="button" className="danger-action" onClick={() => deleteAccount(user)}>Delete account</button>
												</div>
											</details> : "—"}</td>
										</tr>
									))}</tbody>
								</table>
							</div>
						) : (
							<p className="admin-data-state">{users.length ? "No accounts match your search." : "No registered accounts yet."}</p>
						)}
					</section>
				</div>
			</main>

			{modalOpen && <div className="user-modal-backdrop" role="presentation">
				<section className="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
					<div className="card-heading">
						<div><p>ACCOUNT DETAILS</p><h2 id="user-modal-title">{editingUser ? "Edit account" : "Add user"}</h2></div>
						<button type="button" aria-label="Close" onClick={() => setModalOpen(false)}>×</button>
					</div>
					<form className="user-modal-form" onSubmit={submitAccount}>
						<label>Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} maxLength={100} required /></label>
						<label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={160} required /></label>
						<label>Phone number<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} minLength={5} maxLength={40} required /></label>
						<label>Location <span className="account-optional">(optional)</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} maxLength={120} /></label>
						<label>Category <span className="account-optional">(optional)</span>
							<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
								<option value="">Select a category</option><option value="SUPPORTER">Donor / Supporter</option>
								<option value="VOLUNTEER">Volunteer</option><option value="YOUTH_MEMBER">Youth Member</option>
							</select>
						</label>
						<label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
							<option value="USER">Member</option>
							{(admin?.role === "OWNER" || editingUser?.role === "ADMIN") && <option value="ADMIN" disabled={admin?.role !== "OWNER"}>Admin</option>}
							{editingUser && editingUser.role !== "OWNER" && (
								<option value="OWNER" disabled={editingUser.status !== "ACTIVE" || editingUser.approvalStatus !== "APPROVED"}>
									Owner (permanent)
								</option>
							)}
						</select></label>
						{editingUser ? (
							<>
								<label>Account status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
									<option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
								</select></label>
								<label>Approval status<select value={form.approvalStatus} onChange={(event) => setForm({ ...form, approvalStatus: event.target.value })}>
									<option value="PENDING" disabled={editingUser.approvalStatus === "APPROVED"}>Pending</option><option value="APPROVED">Approved</option>
								</select></label>
							</>
						) : (
							<label>Temporary password<div className="password-input-wrap">
								<input type={temporaryPasswordVisible ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={10} maxLength={128} required />
								<button type="button" className="password-visibility-toggle" aria-label={temporaryPasswordVisible ? "Hide password" : "Show password"} aria-pressed={temporaryPasswordVisible} onClick={() => setTemporaryPasswordVisible((visible) => !visible)}>{temporaryPasswordVisible ? "Hide" : "Show"}</button>
							</div></label>
						)}
						{error && <p className="account-error" role="alert">{error}</p>}
						<div className="user-modal-actions">
							<button type="button" className="button button-outline" onClick={() => setModalOpen(false)}>Cancel</button>
							<button type="submit" className="button button-purple" disabled={saving}>{saving ? "Saving…" : editingUser ? "Save changes" : "Create account"}</button>
						</div>
					</form>
				</section>
			</div>}
		</div>
	);
}
