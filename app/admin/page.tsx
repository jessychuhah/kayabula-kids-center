"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type DashboardData = {
	user: { name: string; email: string };
	summary: {
		successfulAmount: number;
		successfulCount: number;
		pendingCount: number;
		userCount: number;
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

export default function AdminDashboard() {
	const router = useRouter();
	const [data, setData] = useState<DashboardData | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);

	useEffect(() => {
		let active = true;
		fetch("/api/admin/dashboard", { cache: "no-store" })
			.then(async (response) => {
				const result = await response.json();
				if (response.status === 401 || response.status === 403) {
					router.replace("/account");
					return null;
				}
				if (!response.ok) throw new Error(result.error || "Unable to load dashboard.");
				return result as DashboardData;
			})
			.then((result) => {
				if (active && result) {
					setData(result);
					setError("");
				}
			})
			.catch((loadError: unknown) => {
				if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => { active = false; };
	}, [refreshKey, router]);

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
					<div><strong>KAYABULA</strong><span>Admin Centre</span></div>
					<button type="button" className="sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>×</button>
				</div>
				<nav className="admin-nav" aria-label="Admin navigation">
					<p>WORKSPACE</p>
					<a className="active" href="#overview" onClick={() => setSidebarOpen(false)}><span className="nav-icon grid" aria-hidden="true"></span>Overview</a>
					<a href="#donations" onClick={() => setSidebarOpen(false)}><span className="nav-icon wallet" aria-hidden="true"></span>Donations</a>
				</nav>
				<div className="admin-sidebar-bottom">
					<Link className="admin-home-link" href="/">View public website ↗</Link>
					{data && <div className="admin-profile">
						<div className="profile-avatar">{data.user.name.trim().slice(0, 1).toUpperCase()}</div>
						<div><strong>{data.user.name}</strong><span>Administrator</span></div>
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
					<div><p>ADMIN WORKSPACE</p><h1>Overview</h1></div>
					<div className="topbar-actions">
						<button type="button" className="quick-button" disabled={loading} onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }}>
							<span>↻</span> Refresh data
						</button>
					</div>
				</header>

				<div className="admin-content" id="overview">
					{error && <p className="admin-data-error" role="alert">{error}</p>}
					{loading && !data ? (
						<p className="admin-data-state" role="status">Loading dashboard data…</p>
					) : data ? (
						<>
							<section className="overview-grid" aria-label="Live overview statistics">
								<article className="overview-card"><div className="metric-icon purple"><span></span></div><div><p>Successful donations</p><strong>{formatAmount(data.summary.successfulAmount)}</strong><span className="metric-change">{data.summary.successfulCount} confirmed</span></div></article>
								<article className="overview-card"><div className="metric-icon gold"><span></span></div><div><p>Pending donations</p><strong>{data.summary.pendingCount.toLocaleString()}</strong><span className="metric-change amber">Awaiting confirmation</span></div></article>
								<article className="overview-card"><div className="metric-icon teal"><span></span></div><div><p>Registered accounts</p><strong>{data.summary.userCount.toLocaleString()}</strong><span className="metric-change">Member accounts</span></div></article>
								<article className="overview-card"><div className="metric-icon cream"><span></span></div><div><p>Young people reached</p><strong>30+</strong><span className="metric-change">Community impact</span></div></article>
							</section>

							<section className="table-card admin-live-table" id="donations" aria-labelledby="donations-title">
								<div className="card-heading">
									<div><p>PAYMENT ACTIVITY</p><h2 id="donations-title">Recent donations</h2></div>
									<span className="admin-live-label">Live records</span>
								</div>
								{data.recentDonations.length ? (
									<div className="donation-table" role="table" aria-label="Recent donation records">
										<div className="table-row table-head" role="row"><span>DONOR</span><span>AMOUNT</span><span>METHOD</span><span>DATE</span><span>STATUS</span></div>
										{data.recentDonations.map((donation) => (
											<div className="table-row" role="row" key={donation.id}>
												<div className="donor-cell"><i>{(donation.customerName || "Guest").trim().slice(0, 1).toUpperCase()}</i><strong>{donation.customerName || "Guest"}</strong></div>
												<strong>{formatAmount(donation.amount, donation.currency)}</strong>
												<span>{donation.method}</span>
												<span>{new Date(donation.createdAt).toLocaleDateString()}</span>
												<span className={`status ${donation.status.toLowerCase()}`}>{donation.status}</span>
											</div>
										))}
									</div>
								) : (
									<p className="admin-data-state">No donation records yet. New checkout attempts will appear here.</p>
								)}
							</section>
						</>
					) : (
						<p className="admin-data-state">Dashboard data is currently unavailable. Try refreshing in a moment.</p>
					)}
				</div>
			</main>
		</div>
	);
}
