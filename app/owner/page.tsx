"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardCharts from "@/app/admin/dashboard-charts";
import { DashboardThemeInitializer, DashboardThemeToggle } from "@/app/admin/dashboard-theme";

type OwnerDashboardData = {
	user: { name: string; email: string; role: string; profileImageUrl: string | null };
	summary: {
		successfulAmount: number;
		successfulCount: number;
		pendingCount: number;
		userCount: number;
		pendingApprovalCount: number;
		youthSupported: number;
		familiesSupported: number;
		villagesReached: number;
	};
	analytics: {
		monthlyDonations: Array<{ label: string; amount: number }>;
		donationStatuses: Array<{ status: string; count: number }>;
	};
	recentDonations: Array<{
		id: string;
		reference: string;
		customerName: string | null;
		amount: number;
		currency: string;
		method: string;
		status: string;
		createdAt: string;
	}>;
};

function formatAmount(amount: number, currency = "UGX") {
	return `${currency} ${amount.toLocaleString()}`;
}

export default function OwnerDashboard() {
	const router = useRouter();
	const [data, setData] = useState<OwnerDashboardData | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const [sidebarOpen, setSidebarOpen] = useState(false);

	useEffect(() => {
		fetch("/api/admin/dashboard", { cache: "no-store" })
			.then(async (response) => {
				const result = await response.json();
				if (response.status === 401 || response.status === 403) {
					router.replace("/account");
					return null;
				}
				if (!response.ok) throw new Error(result.error || "Unable to load the owner dashboard.");
				if (result.user.role !== "OWNER") {
					router.replace("/admin");
					return null;
				}
				return result as OwnerDashboardData;
			})
			.then((result) => {
				if (result) {
					setData(result);
					setError("");
				}
			})
			.catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load the owner dashboard."))
			.finally(() => setLoading(false));
	}, [router]);

	async function logout() {
		try {
			const response = await fetch("/api/auth/logout", { method: "POST" });
			if (!response.ok) throw new Error("Unable to log out. Please try again.");
			router.replace("/");
		} catch (logoutError) {
			setError(logoutError instanceof Error ? logoutError.message : "Unable to log out.");
		}
	}

	return (
		<div className="admin-shell owner-shell">
			<DashboardThemeInitializer />
			<aside className={sidebarOpen ? "admin-sidebar open" : "admin-sidebar"}>
				<div className="admin-brand">
					<Image src="/assets/logo.jpeg" alt="Kayabula Kids Centre" width={48} height={48} />
					<div><strong>KAYABULA</strong><span>Owner workspace</span></div>
					<button type="button" className="sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>×</button>
				</div>
				<nav className="admin-nav" aria-label="Owner navigation">
					<p>WORKSPACE</p>
					<a className="active" href="#overview" onClick={() => setSidebarOpen(false)}><span className="nav-icon grid" aria-hidden="true"></span>Overview</a>
					<Link href="/admin/users" onClick={() => setSidebarOpen(false)}><span className="nav-icon users" aria-hidden="true"></span>People &amp; admins</Link>
					<Link href="/admin/content" onClick={() => setSidebarOpen(false)}><span className="nav-icon pages" aria-hidden="true"></span>Website content</Link>
					<Link href="/admin/inbox" onClick={() => setSidebarOpen(false)}><span className="nav-icon inbox" aria-hidden="true"></span>Member support</Link>
					<Link href="/admin/communications" onClick={() => setSidebarOpen(false)}><span className="nav-icon inbox" aria-hidden="true"></span>Team &amp; updates</Link>
					<Link href="/account" onClick={() => setSidebarOpen(false)}><span className="nav-icon users" aria-hidden="true"></span>My profile</Link>
					<Link href="/account/security" onClick={() => setSidebarOpen(false)}><span className="nav-icon settings" aria-hidden="true"></span>Security</Link>
				</nav>
				<div className="admin-sidebar-bottom">
					<Link className="admin-home-link" href="/">View public website ↗</Link>
					{data && <div className="admin-profile">
						<div className="profile-avatar">{data.user.profileImageUrl
							? <Image src={data.user.profileImageUrl} alt="" width={36} height={36} unoptimized />
							: data.user.name.trim().slice(0, 1).toUpperCase()}</div>
						<div><strong>{data.user.name}</strong><span>Owner</span></div>
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
					<div><p>OWNER WORKSPACE</p><h1>Overview</h1></div>
					<div className="topbar-actions"><DashboardThemeToggle /><Link className="quick-button" href="/account/security">Account security</Link></div>
				</header>
				<div className="admin-content" id="overview">
					{error && <p className="admin-data-error" role="alert">{error}</p>}
					{loading && !data ? <p className="admin-data-state" role="status">Loading owner overview…</p> : data ? (
						<>
							<section className="owner-welcome">
								<div><p>YOUR CENTRE AT A GLANCE</p><h2>Welcome back, {data.user.name}</h2><span>Manage the people, communications and public information for Kayabula.</span></div>
								<Link className="button button-purple" href="/admin/communications">Open team channel <span>→</span></Link>
							</section>
							<section className="overview-grid owner-overview-grid" aria-label="Centre overview">
								<article className="overview-card"><div className="metric-icon purple"><span></span></div><div><p>Successful donations</p><strong>{formatAmount(data.summary.successfulAmount)}</strong><span className="metric-change">{data.summary.successfulCount} confirmed</span></div></article>
								<article className="overview-card"><div className="metric-icon gold"><span></span></div><div><p>Pending donations</p><strong>{data.summary.pendingCount.toLocaleString()}</strong><span className="metric-change amber">Awaiting confirmation</span></div></article>
								<Link className="overview-card overview-card-link" href="/admin/users"><div className="metric-icon teal"><span></span></div><div><p>Accounts</p><strong>{data.summary.userCount.toLocaleString()}</strong><span className="metric-change">{data.summary.pendingApprovalCount} awaiting approval</span></div></Link>
								<Link className="overview-card overview-card-link" href="/admin/content"><div className="metric-icon cream"><span></span></div><div><p>Young people supported</p><strong>{data.summary.youthSupported.toLocaleString()}</strong><span className="metric-change">Community impact</span></div></Link>
								<Link className="overview-card overview-card-link" href="/admin/content"><div className="metric-icon gold"><span></span></div><div><p>Families supported</p><strong>{data.summary.familiesSupported.toLocaleString()}</strong><span className="metric-change">Community impact</span></div></Link>
								<Link className="overview-card overview-card-link" href="/admin/content"><div className="metric-icon teal"><span></span></div><div><p>Villages reached</p><strong>{data.summary.villagesReached.toLocaleString()}</strong><span className="metric-change">Community impact</span></div></Link>
							</section>
							<section className="owner-shortcuts" aria-label="Owner actions">
								<Link href="/admin/users"><span className="nav-icon users" aria-hidden="true"></span><strong>Manage accounts &amp; admins</strong><small>Approve members and manage staff access</small></Link>
								<Link href="/admin/content"><span className="nav-icon pages" aria-hidden="true"></span><strong>Manage website content</strong><small>Edit impact totals, contact details and ads</small></Link>
								<Link href="/admin/communications"><span className="nav-icon inbox" aria-hidden="true"></span><strong>Communicate</strong><small>Use the private team room and publish updates</small></Link>
							</section>
							<DashboardCharts analytics={data.analytics} />
							<section className="table-card admin-live-table" aria-labelledby="owner-donations-title">
								<div className="card-heading"><div><p>PAYMENT ACTIVITY</p><h2 id="owner-donations-title">Recent donations</h2></div><span className="admin-live-label">Live records</span></div>
								{data.recentDonations.length ? <div className="donation-table" role="table" aria-label="Recent donation records">
									<div className="table-row table-head" role="row"><span>DONOR</span><span>AMOUNT</span><span>METHOD</span><span>DATE</span><span>STATUS</span></div>
									{data.recentDonations.map((donation) => <div className="table-row" role="row" key={donation.id}>
										<div className="donor-cell"><i>{(donation.customerName || "Guest").trim().slice(0, 1).toUpperCase()}</i><strong>{donation.customerName || "Guest"}</strong></div>
										<strong>{formatAmount(donation.amount, donation.currency)}</strong><span>{donation.method}</span>
										<span>{new Date(donation.createdAt).toLocaleDateString()}</span>
										<span className={`status ${donation.status.toLowerCase()}`}>{donation.status}</span>
									</div>)}
								</div> : <p className="admin-data-state">No donation records yet.</p>}
							</section>
							<p className="owner-permissions-note">Administrators can upload advertising media. The owner workspace manages all other dashboard areas.</p>
						</>
					) : <p className="admin-data-state">Owner overview is currently unavailable. Try again in a moment.</p>}
				</div>
			</main>
		</div>
	);
}
