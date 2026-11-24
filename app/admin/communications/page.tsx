"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import DirectMessages from "@/app/admin/communications/direct-messages";

type Staff = { id: string; name: string; role: "ADMIN" | "OWNER"; profileImageUrl: string | null };
type StaffMessage = {
	id: string;
	senderId: string | null;
	senderName: string;
	senderRole: string;
	body: string | null;
	imageUrl: string | null;
	createdAt: string;
};
type UpdateMedia = { id: string; url: string };
type SiteUpdate = {
	id: string;
	authorId: string | null;
	authorName: string;
	title: string;
	body: string;
	createdAt: string;
	media: UpdateMedia[];
};
type UploadedImage = { key: string; publicUrl: string };

const maximumImageBytes = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function uploadImage(file: File, scope: "team" | "updates"): Promise<UploadedImage> {
	if (!allowedTypes.has(file.type) || file.size > maximumImageBytes) {
		throw new Error("Choose a JPG, PNG, GIF or WebP image no larger than 10 MB.");
	}
	const response = await fetch("/api/communications/upload", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ scope, fileName: file.name, contentType: file.type, size: file.size }),
	});
	const result = await response.json();
	if (!response.ok) throw new Error(result.error || "Unable to prepare image upload.");
	const uploadResponse = await fetch(result.uploadUrl, {
		method: "PUT",
		headers: { "Content-Type": file.type },
		body: file,
	});
	if (!uploadResponse.ok) {
		try {
			await removeUnlinkedImage(result.key);
		} catch (cleanupError) {
			throw new Error(`Cloudflare R2 rejected the image. ${cleanupError instanceof Error ? cleanupError.message : "The unused upload could not be removed."}`);
		}
		throw new Error("Cloudflare R2 rejected the image. Check the bucket CORS settings.");
	}
	return { key: result.key, publicUrl: result.publicUrl };
}

async function removeUnlinkedImage(key: string) {
	const response = await fetch("/api/communications/upload", {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key }),
	});
	if (!response.ok) {
		const result = await response.json();
		throw new Error(result.error || "Unable to remove the unused image.");
	}
}

export default function CommunicationsPage() {
	const router = useRouter();
	const [staff, setStaff] = useState<Staff | null>(null);
	const [messages, setMessages] = useState<StaffMessage[]>([]);
	const [updates, setUpdates] = useState<SiteUpdate[]>([]);
	const [message, setMessage] = useState("");
	const [messageImage, setMessageImage] = useState<File | null>(null);
	const [updateImages, setUpdateImages] = useState<File[]>([]);
	const [sendingMessage, setSendingMessage] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const loadCommunications = useCallback(async () => {
		const [messagesResponse, updatesResponse] = await Promise.all([
			fetch("/api/admin/communications", { cache: "no-store" }),
			fetch("/api/updates", { cache: "no-store" }),
		]);
		const [messagesData, updatesData] = await Promise.all([messagesResponse.json(), updatesResponse.json()]);
		if ([messagesResponse.status, updatesResponse.status].some((status) => status === 401 || status === 403)) {
			router.replace("/account");
			throw new Error("Administrator access is required.");
		}
		if (!messagesResponse.ok) throw new Error(messagesData.error || "Unable to load the team channel.");
		if (!updatesResponse.ok) throw new Error(updatesData.error || "Unable to load published updates.");
		setMessages(messagesData.messages);
		setUpdates(updatesData.updates);
	}, [router]);

	useEffect(() => {
		let active = true;
		fetch("/api/auth/session", { cache: "no-store" })
			.then(async (response) => {
				const result = await response.json();
				if (!response.ok || !result.user || !["ADMIN", "OWNER"].includes(result.user.role)) {
					router.replace("/account");
					throw new Error(result.error || "Administrator access is required.");
				}
				if (active) setStaff({ id: result.user.id, name: result.user.name, role: result.user.role, profileImageUrl: result.user.profileImageUrl });
				await loadCommunications();
			})
			.catch((loadError: unknown) => {
				if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load communications.");
			});
		return () => { active = false; };
	}, [loadCommunications, router]);

	async function sendMessage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		setError("");
		setNotice("");
		setSendingMessage(true);
		let uploaded: UploadedImage | null = null;
		let saved = false;
		try {
			if (messageImage) uploaded = await uploadImage(messageImage, "team");
			const response = await fetch("/api/admin/communications", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message, attachment: uploaded ? { key: uploaded.key, url: uploaded.publicUrl } : null }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to send the team message.");
			saved = true;
			setMessage("");
			setMessageImage(null);
			form.reset();
			await loadCommunications();
		} catch (sendError) {
			if (uploaded && !saved) {
				try {
					await removeUnlinkedImage(uploaded.key);
				} catch (cleanupError) {
					setError(`${sendError instanceof Error ? sendError.message : "Unable to send the message."} ${cleanupError instanceof Error ? cleanupError.message : "Image cleanup failed."}`);
					return;
				}
			}
			setError(sendError instanceof Error ? sendError.message : "Unable to send the team message.");
		} finally {
			setSendingMessage(false);
		}
	}

	async function publishUpdate(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		setError("");
		setNotice("");
		setPublishing(true);
		const formData = new FormData(form);
		const title = String(formData.get("title") ?? "");
		const body = String(formData.get("body") ?? "");
		const uploaded: UploadedImage[] = [];
		let saved = false;
		try {
			for (const file of updateImages) uploaded.push(await uploadImage(file, "updates"));
			const response = await fetch("/api/updates", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					body,
					media: uploaded.map((image) => ({ key: image.key, url: image.publicUrl })),
				}),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to publish the update.");
			saved = true;
			form.reset();
			setUpdateImages([]);
			setNotice("Update published for signed-in members.");
			await loadCommunications();
		} catch (publishError) {
			if (uploaded.length && !saved) {
				const cleanupResults = await Promise.allSettled(uploaded.map((image) => removeUnlinkedImage(image.key)));
				const cleanupFailure = cleanupResults.find((result) => result.status === "rejected");
				if (cleanupFailure?.status === "rejected") {
					setError(`${publishError instanceof Error ? publishError.message : "Unable to publish the update."} ${cleanupFailure.reason instanceof Error ? cleanupFailure.reason.message : "Image cleanup failed."}`);
					return;
				}
			}
			setError(publishError instanceof Error ? publishError.message : "Unable to publish the update.");
		} finally {
			setPublishing(false);
		}
	}

	async function deleteMessage(item: StaffMessage) {
		if (!window.confirm("Delete this team message and its attached image?")) return;
		await removeRecord("/api/admin/communications", item.id, "Message deleted.");
	}

	async function deleteUpdate(item: SiteUpdate) {
		if (!window.confirm(`Delete “${item.title}” and its attached images?`)) return;
		await removeRecord("/api/updates", item.id, "Update deleted.");
	}

	async function removeRecord(url: string, id: string, successNotice: string) {
		setError("");
		setNotice("");
		try {
			const response = await fetch(url, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to delete this item.");
			setNotice(result.mediaCleanupWarning
				? `${successNotice} The unused R2 image could not be removed; check storage cleanup.`
				: successNotice);
			await loadCommunications();
		} catch (deleteError) {
			setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this item.");
		}
	}

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
		<div className="admin-shell">
			<aside className={sidebarOpen ? "admin-sidebar open" : "admin-sidebar"}>
				<div className="admin-brand">
					<Image src="/assets/logo.jpeg" alt="Kayabula Kids Centre" width={48} height={48} />
					<div><strong>KAYABULA</strong><span>{staff?.role === "OWNER" ? "Owner Centre" : "Admin Centre"}</span></div>
					<button type="button" className="sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>×</button>
				</div>
				<nav className="admin-nav" aria-label="Admin navigation">
					<p>WORKSPACE</p>
					<Link href={staff?.role === "OWNER" ? "/owner" : "/admin"} onClick={() => setSidebarOpen(false)}><span className="nav-icon grid" aria-hidden="true"></span>Overview</Link>
					<Link href="/admin/users" onClick={() => setSidebarOpen(false)}><span className="nav-icon users" aria-hidden="true"></span>Users</Link>
					<Link href="/admin/content" onClick={() => setSidebarOpen(false)}><span className="nav-icon pages" aria-hidden="true"></span>Content</Link>
					<Link href="/admin/inbox" onClick={() => setSidebarOpen(false)}><span className="nav-icon inbox" aria-hidden="true"></span>Support inbox</Link>
					<Link className="active" href="/admin/communications" onClick={() => setSidebarOpen(false)}><span className="nav-icon inbox" aria-hidden="true"></span>Team &amp; updates</Link>
					<Link href="/account" onClick={() => setSidebarOpen(false)}><span className="nav-icon users" aria-hidden="true"></span>My profile</Link>
					<Link href="/account/security" onClick={() => setSidebarOpen(false)}><span className="nav-icon settings" aria-hidden="true"></span>Security</Link>
				</nav>
				<div className="admin-sidebar-bottom">
					<Link className="admin-home-link" href="/">View public website ↗</Link>
					{staff && <div className="admin-profile">
						<div className="profile-avatar">{staff.profileImageUrl
							? <Image src={staff.profileImageUrl} alt="" width={36} height={36} unoptimized />
							: staff.name.trim().slice(0, 1).toUpperCase()}</div>
						<div><strong>{staff.name}</strong><span>{staff.role === "OWNER" ? "Owner" : "Administrator"}</span></div>
						<button type="button" aria-label="Log out" onClick={logout}>↪</button>
					</div>}
				</div>
			</aside>
			{sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
			<main className="admin-main">
				<header className="admin-topbar">
					<button type="button" className="admin-menu-button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><span></span><span></span><span></span></button>
					<div><p>COMMUNICATIONS</p><h1>Team &amp; updates</h1></div>
					<div className="topbar-actions"><Link className="quick-button" href="/account/security">Security</Link></div>
				</header>
				<div className="admin-content admin-content-management communications-content">
					{error && <p className="admin-data-error" role="alert">{error}</p>}
					{notice && <p className="admin-success-notice" role="status">{notice}</p>}
					{staff && <DirectMessages role={staff.role} staffId={staff.id} />}
					<section className="table-card communications-card" aria-labelledby="team-channel-title">
						<div className="card-heading"><div><p>PRIVATE · ADMIN AND OWNER</p><h2 id="team-channel-title">Team channel</h2></div><span className="admin-live-label">Shared room</span></div>
						<div className="staff-message-list" aria-live="polite">
							{messages.length ? messages.map((item) => <article className="staff-message" key={item.id}>
								<div className="profile-avatar">{item.senderName.trim().slice(0, 1).toUpperCase()}</div>
								<div className="staff-message-body">
									<div className="staff-message-meta"><strong>{item.senderName}</strong><span>{item.senderRole === "OWNER" ? "Owner" : "Admin"}</span><time>{new Date(item.createdAt).toLocaleString()}</time></div>
									{item.body && <p>{item.body}</p>}
									{item.imageUrl && <a href={item.imageUrl} target="_blank" rel="noreferrer"><Image src={item.imageUrl} alt={`Image shared by ${item.senderName}`} width={560} height={360} unoptimized /></a>}
								</div>
								{(staff?.role === "OWNER" || item.senderId === staff?.id) && <button className="communication-delete" type="button" onClick={() => deleteMessage(item)} aria-label={`Delete message from ${item.senderName}`}>Delete</button>}
							</article>) : <p className="admin-data-state">No team messages yet. Send the first note to the shared room.</p>}
						</div>
						<form className="team-message-form" onSubmit={sendMessage}>
							<label className="visually-hidden" htmlFor="team-message">Message for administrators and owner</label>
							<textarea id="team-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={3} placeholder="Write a team message…" />
							<div><label className="file-pick">Attach image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setMessageImage(event.target.files?.[0] ?? null)} /></label>
								{messageImage && <span className="selected-file">{messageImage.name}</span>}
								<button className="button button-purple" type="submit" disabled={sendingMessage || (!message.trim() && !messageImage)}>{sendingMessage ? "Sending…" : "Send message"}</button>
							</div>
						</form>
					</section>
					<section className="communications-lower-grid">
						<div className="table-card communications-card">
							<div className="card-heading"><div><p>MEMBER NOTICEBOARD</p><h2>Publish an update</h2></div></div>
							<p className="content-helper">Updates appear to signed-in members in their account. You may attach up to eight images.</p>
							<form className="update-publish-form" onSubmit={publishUpdate}>
								<label>Title<input name="title" minLength={2} maxLength={120} required /></label>
								<label>Update<textarea name="body" rows={6} maxLength={4000} required /></label>
								<label>Images<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => {
									const files = Array.from(event.target.files ?? []);
									if (files.length > 8) {
										setError("Choose no more than eight images for one update.");
										setUpdateImages([]);
										event.target.value = "";
										return;
									}
									setError("");
									setUpdateImages(files);
								}} /></label>
								{updateImages.length > 0 && <p className="selected-file">{updateImages.length} image{updateImages.length === 1 ? "" : "s"} selected</p>}
								<button className="button button-purple" type="submit" disabled={publishing}>{publishing ? "Publishing…" : "Publish update"}</button>
							</form>
						</div>
						<div className="table-card communications-card">
							<div className="card-heading"><div><p>LIVE POSTS</p><h2>Recent updates</h2></div><Link href="/updates" className="text-link">Member view ↗</Link></div>
							<div className="published-update-list">
								{updates.length ? updates.map((item) => <article key={item.id}>
									<div className="published-update-heading"><div><strong>{item.title}</strong><span>{item.authorName} · {new Date(item.createdAt).toLocaleDateString()}</span></div>
										{(staff?.role === "OWNER" || item.authorId === staff?.id) && <button className="communication-delete" type="button" onClick={() => deleteUpdate(item)} aria-label={`Delete update ${item.title}`}>Delete</button>}
									</div>
									<p>{item.body}</p>
									{item.media.length > 0 && <div className="published-update-images">{item.media.map((media) => <Image src={media.url} alt="" width={160} height={120} unoptimized key={media.id} />)}</div>}
								</article>) : <p className="admin-data-state">No member updates have been published.</p>}
							</div>
						</div>
					</section>
				</div>
			</main>
		</div>
	);
}
