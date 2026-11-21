"use client";

import Image from "next/image";
import { useState } from "react";

const overviewItems = [
	{ label: "Total donations", value: "UGX 8.42M", change: "+12.5%", tone: "purple" },
	{ label: "Active volunteers", value: "24", change: "+4 this month", tone: "gold" },
	{ label: "Contact enquiries", value: "38", change: "9 awaiting reply", tone: "teal" },
	{ label: "Young people reached", value: "30+", change: "Community impact", tone: "cream" },
];

const donations = [
	{ name: "Sarah Namuli", initials: "SN", amount: "UGX 250,000", method: "MTN MoMo", date: "Today, 10:42", status: "Successful" },
	{ name: "David Kato", initials: "DK", amount: "UGX 100,000", method: "Airtel Money", date: "Today, 09:18", status: "Successful" },
	{ name: "Grace N.", initials: "GN", amount: "UGX 75,000", method: "Visa", date: "Yesterday", status: "Pending" },
	{ name: "Anonymous", initials: "AN", amount: "UGX 50,000", method: "MTN MoMo", date: "18 Nov", status: "Successful" },
];

const enquiries = [
	{ name: "Peace Achieng", subject: "Volunteer application", time: "12 min ago", tone: "purple" },
	{ name: "James Okello", subject: "Community partnership", time: "1 hr ago", tone: "gold" },
	{ name: "Mariam K.", subject: "Education support", time: "3 hrs ago", tone: "teal" },
];

const navItems = [
	["Overview", "grid"],
	["Content", "pages"],
	["Programs", "heart"],
	["Donations", "wallet"],
	["Submissions", "inbox"],
	["Media", "image"],
];

export default function AdminDashboard() {
	const [activeNav, setActiveNav] = useState("Overview");
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [range, setRange] = useState("This month");

	return (
		<div className="admin-shell">
			<aside className={sidebarOpen ? "admin-sidebar open" : "admin-sidebar"}>
				<div className="admin-brand">
					<Image src="/assets/logo.jpeg" alt="Kayabula Kids Centre" width={48} height={48} />
					<div>
						<strong>KAYABULA</strong>
						<span>Admin Centre</span>
					</div>
					<button type="button" className="sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>×</button>
				</div>

				<nav className="admin-nav" aria-label="Admin navigation">
					<p>WORKSPACE</p>
					{navItems.map(([label, icon]) => (
						<button
							type="button"
							key={label}
							className={activeNav === label ? "active" : ""}
							onClick={() => {
								setActiveNav(label);
								setSidebarOpen(false);
							}}
						>
							<span className={`nav-icon ${icon}`} aria-hidden="true"></span>
							{label}
							{label === "Submissions" && <b>9</b>}
						</button>
					))}
				</nav>

				<div className="admin-sidebar-bottom">
					<button type="button"><span className="nav-icon settings" aria-hidden="true"></span>Settings</button>
					<div className="admin-profile">
						<div className="profile-avatar">LA</div>
						<div><strong>Linda A.</strong><span>Administrator</span></div>
						<button type="button" aria-label="Open profile menu">•••</button>
					</div>
				</div>
			</aside>

			{sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

			<main className="admin-main">
				<header className="admin-topbar">
					<button type="button" className="admin-menu-button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
						<span></span><span></span><span></span>
					</button>
					<div>
						<p>WELCOME BACK</p>
						<h1>{activeNav}</h1>
					</div>
					<div className="topbar-actions">
						<button type="button" className="icon-button" aria-label="Search">
							<span className="search-glyph"></span>
						</button>
						<button type="button" className="icon-button notification-button" aria-label="Notifications">
							<span className="bell-glyph"></span>
							<i></i>
						</button>
						<button type="button" className="quick-button"><span>+</span> Quick action</button>
					</div>
				</header>

				<div className="admin-content">
					<section className="overview-grid" aria-label="Overview statistics">
						{overviewItems.map((item) => (
							<article className="overview-card" key={item.label}>
								<div className={`metric-icon ${item.tone}`}><span></span></div>
								<div>
									<p>{item.label}</p>
									<strong>{item.value}</strong>
									<span className={item.tone === "teal" ? "metric-change amber" : "metric-change"}>{item.change}</span>
								</div>
							</article>
					 ))}
					</section>

					<section className="admin-middle-grid">
						<article className="chart-card">
							<div className="card-heading">
								<div>
									<p>DONATION PERFORMANCE</p>
									<h2>UGX 8,420,000</h2>
								</div>
								<select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Chart range">
									<option>This month</option>
									<option>Last 6 months</option>
									<option>This year</option>
								</select>
							</div>
							<div className="chart-wrap">
								<div className="chart-y-axis"><span>3M</span><span>2M</span><span>1M</span><span>0</span></div>
								<div className="chart-area">
									<div className="chart-grid"><i></i><i></i><i></i><i></i></div>
									<svg viewBox="0 0 700 220" role="img" aria-label="Donation trend chart" preserveAspectRatio="none">
										<defs>
											<linearGradient id="areaPurple" x1="0" y1="0" x2="0" y2="1">
												<stop offset="0%" stopColor="#451a82" stopOpacity=".18" />
												<stop offset="100%" stopColor="#451a82" stopOpacity="0" />
											</linearGradient>
										</defs>
										<path className="chart-fill" d="M0 178 C55 170 70 145 115 152 C170 160 190 112 235 125 C280 138 305 94 350 108 C400 122 425 72 470 86 C525 102 550 48 595 62 C635 74 662 34 700 42 L700 220 L0 220 Z" />
										<path className="chart-line" d="M0 178 C55 170 70 145 115 152 C170 160 190 112 235 125 C280 138 305 94 350 108 C400 122 425 72 470 86 C525 102 550 48 595 62 C635 74 662 34 700 42" />
										<circle cx="595" cy="62" r="6" />
									</svg>
									<div className="chart-tooltip"><span>UGX 2.1M</span><small>18 Nov</small></div>
									<div className="chart-x-axis"><span>1 Nov</span><span>5 Nov</span><span>10 Nov</span><span>15 Nov</span><span>20 Nov</span><span>25 Nov</span><span>30 Nov</span></div>
								</div>
							</div>
						</article>

						<article className="donation-mix-card">
							<div className="card-heading">
								<div><p>DONATION MIX</p><h2>By payment method</h2></div>
								<button type="button" aria-label="Donation mix options">•••</button>
							</div>
							<div className="donut-wrap">
								<div className="donut" role="img" aria-label="MTN 48%, Airtel 32%, Visa 20%">
									<div><strong>UGX 8.42M</strong><span>Total</span></div>
								</div>
							</div>
							<div className="mix-list">
								<div><i className="purple-dot"></i><span>MTN MoMo</span><strong>48%</strong></div>
								<div><i className="gold-dot"></i><span>Airtel Money</span><strong>32%</strong></div>
								<div><i className="teal-dot"></i><span>Visa</span><strong>20%</strong></div>
							</div>
						</article>
					</section>

					<section className="admin-bottom-grid">
						<article className="table-card">
							<div className="card-heading">
								<div><p>RECENT ACTIVITY</p><h2>Latest donations</h2></div>
								<button type="button" className="view-link">View all <span>→</span></button>
							</div>
							<div className="donation-table" role="table" aria-label="Latest donations">
								<div className="table-row table-head" role="row">
									<span>DONOR</span><span>AMOUNT</span><span>METHOD</span><span>DATE</span><span>STATUS</span>
								</div>
								{donations.map((donation) => (
									<div className="table-row" role="row" key={donation.name}>
										<div className="donor-cell"><i>{donation.initials}</i><strong>{donation.name}</strong></div>
										<strong>{donation.amount}</strong>
										<span>{donation.method}</span>
										<span>{donation.date}</span>
										<span className={`status ${donation.status.toLowerCase()}`}>{donation.status}</span>
									</div>
								))}
							</div>
						</article>

						<article className="enquiry-card">
							<div className="card-heading">
								<div><p>NEEDS ATTENTION</p><h2>Recent enquiries</h2></div>
								<button type="button" aria-label="Enquiry options">•••</button>
							</div>
							<div className="enquiry-list">
								{enquiries.map((enquiry) => (
									<button type="button" className="enquiry-item" key={enquiry.name}>
										<div className={`enquiry-avatar ${enquiry.tone}`}>{enquiry.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
										<div><strong>{enquiry.name}</strong><span>{enquiry.subject}</span></div>
										<small>{enquiry.time}</small>
									</button>
								))}
							</div>
							<button type="button" className="review-button">Review submissions <span>→</span></button>
						</article>
					</section>
				</div>
			</main>
		</div>
	);
}
