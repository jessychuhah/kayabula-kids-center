"use client";

type Analytics = {
	monthlyDonations: Array<{ label: string; amount: number }>;
	donationStatuses: Array<{ status: string; count: number }>;
};

const colors: Record<string, string> = {
	SUCCESSFUL: "#451a82",
	PENDING: "#d6a84a",
	FAILED: "#cb6a62",
	REVERSED: "#8f607e",
};

export default function DashboardCharts({ analytics }: { analytics: Analytics }) {
	const points = analytics.monthlyDonations;
	const maximum = Math.max(1, ...points.map((point) => point.amount));
	const line = points.map((point, index) => {
		const x = points.length < 2 ? 150 : 20 + index * (260 / (points.length - 1));
		const y = 145 - (point.amount / maximum) * 120;
		return `${x},${y}`;
	}).join(" ");
	const fill = points.length ? `20,150 ${line} 280,150` : "";
	const statusTotal = analytics.donationStatuses.reduce((total, item) => total + item.count, 0);
	let previousPercent = 0;
	const pieSegments = analytics.donationStatuses.map((item) => {
		const end = previousPercent + (statusTotal ? item.count / statusTotal * 100 : 0);
		const segment = `${colors[item.status] ?? "#68a59b"} ${previousPercent}% ${end}%`;
		previousPercent = end;
		return segment;
	});

	return (
		<section className="dashboard-analytics" aria-label="Donation analytics">
			<article className="chart-card dashboard-trend-card">
				<div className="card-heading"><div><p>LAST SIX MONTHS · UGX</p><h2>Successful donations</h2></div></div>
				<div className="dashboard-line-chart">
					<svg viewBox="0 0 300 180" role="img" aria-label="Line graph of successful monthly donations in Ugandan shillings">
						{[25, 65, 105, 145].map((y) => <line key={y} x1="20" x2="280" y1={y} y2={y} />)}
						{points.length > 1 && <polygon points={fill} />}
						{points.length > 1 && <polyline points={line} />}
						{points.map((point, index) => {
							const x = points.length < 2 ? 150 : 20 + index * (260 / (points.length - 1));
							const y = 145 - (point.amount / maximum) * 120;
							return <circle key={point.label} cx={x} cy={y} r="3.5"><title>{`${point.label}: UGX ${point.amount.toLocaleString()}`}</title></circle>;
						})}
					</svg>
					<div className="dashboard-chart-labels">{points.map((point) => <span key={point.label}>{point.label}</span>)}</div>
				</div>
			</article>
			<article className="donation-mix-card dashboard-status-card">
				<div className="card-heading"><div><p>ALL DONATION RECORDS</p><h2>Status breakdown</h2></div></div>
				<div className="dashboard-pie-area">
					<div className="dashboard-pie" role="img" aria-label={`Donation status breakdown: ${statusTotal} total records`} style={{
						background: statusTotal ? `conic-gradient(${pieSegments.join(", ")})` : "#e9e6ed",
					}}>
						<strong>{statusTotal.toLocaleString()}</strong><span>records</span>
					</div>
				</div>
				<ul className="dashboard-pie-legend">
					{analytics.donationStatuses.length ? analytics.donationStatuses.map((item) => <li key={item.status}>
						<i style={{ background: colors[item.status] ?? "#68a59b" }} />
						<span>{item.status.replaceAll("_", " ").toLowerCase()}</span>
						<strong>{item.count.toLocaleString()}</strong>
					</li>) : <li><span>No donation records yet</span><strong>0</strong></li>}
				</ul>
			</article>
		</section>
	);
}
