"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

type MemberUpdate = {
	id: string;
	authorName: string;
	title: string;
	body: string;
	createdAt: string;
	media: Array<{ id: string; url: string }>;
};

export default function UpdatesPage() {
	const [updates, setUpdates] = useState<MemberUpdate[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch("/api/updates", { cache: "no-store" })
			.then(async (response) => {
				const result = await response.json();
				if (response.status === 401) throw new Error("Sign in to see updates from Kayabula Kids Centre.");
				if (!response.ok) throw new Error(result.error || "Unable to load updates.");
				setUpdates(result.updates);
			})
			.catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Unable to load updates."))
			.finally(() => setLoading(false));
	}, []);

	return (
		<main className="member-updates-page">
			<div className="member-updates-header">
				<Link className="account-back-link" href="/account">← Your account</Link>
				<p className="section-kicker">Kayabula Kids Centre</p>
				<h1>Centre updates</h1>
				<p>News and notices from our team for signed-in members.</p>
			</div>
			{loading ? <p className="admin-data-state" role="status">Loading updates…</p> : error ? (
				<section className="member-updates-empty"><p role="alert">{error}</p><Link className="button button-purple" href="/account">Go to account</Link></section>
			) : updates.length ? (
				<div className="member-updates-list">
					{updates.map((update) => <article className="member-update-card" key={update.id}>
						<div className="member-update-meta"><span>{update.authorName}</span><time>{new Date(update.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</time></div>
						<h2>{update.title}</h2>
						<p>{update.body}</p>
						{update.media.length > 0 && <div className="member-update-media">{update.media.map((media) => <a href={media.url} target="_blank" rel="noreferrer" key={media.id}><Image src={media.url} alt="" width={480} height={360} unoptimized /></a>)}</div>}
					</article>)}
				</div>
			) : <section className="member-updates-empty"><h2>No updates yet</h2><p>When the team posts an update, you will find it here.</p></section>}
		</main>
	);
}
