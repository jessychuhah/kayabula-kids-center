"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type InboxMessage = {
	id: string;
	senderRole: string;
	body: string;
	createdAt: string;
};

type InboxConversation = {
	id: string;
	updatedAt: string;
	user: { id: string; name: string; email: string };
	messages: Array<{ body: string; createdAt: string; senderRole: string }>;
};

export default function AdminInboxPage() {
	const router = useRouter();
	const [admin, setAdmin] = useState<{ name: string } | null>(null);
	const [conversations, setConversations] = useState<InboxConversation[]>([]);
	const [selectedId, setSelectedId] = useState("");
	const [messages, setMessages] = useState<InboxMessage[]>([]);
	const [draft, setDraft] = useState("");
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState("");
	const [refreshKey, setRefreshKey] = useState(0);
	const [sidebarOpen, setSidebarOpen] = useState(false);

	useEffect(() => {
		let active = true;
		const load = async () => {
			try {
				const url = selectedId
					? `/api/admin/inbox?conversationId=${encodeURIComponent(selectedId)}`
					: "/api/admin/inbox";
				const [inboxResponse, sessionResponse] = await Promise.all([
					fetch(url, { cache: "no-store" }),
					fetch("/api/auth/session", { cache: "no-store" }),
				]);
				const [result, session] = await Promise.all([inboxResponse.json(), sessionResponse.json()]);
				if (inboxResponse.status === 401 || inboxResponse.status === 403) {
					router.replace("/account");
					return;
				}
				if (!inboxResponse.ok) throw new Error(result.error || "Unable to load support inbox.");
				if (active) {
					setAdmin(session.user ? { name: session.user.name } : null);
					setConversations(result.conversations);
					if (!selectedId && result.conversations.length) {
						setSelectedId(result.conversations[0].id);
					} else {
						setMessages(result.conversation?.messages ?? []);
					}
					setError("");
				}
			} catch (loadError) {
				if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load support inbox.");
			} finally {
				if (active) setLoading(false);
			}
		};
		void load();
		const interval = window.setInterval(load, 6000);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, [refreshKey, router, selectedId]);

	async function sendReply(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedId) return;
		setSending(true);
		setError("");
		try {
			const response = await fetch("/api/admin/reply", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ conversationId: selectedId, message: draft }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to send reply.");
			setMessages((current) => [...current, result.message]);
			setDraft("");
			setRefreshKey((key) => key + 1);
		} catch (replyError) {
			setError(replyError instanceof Error ? replyError.message : "Unable to send reply.");
		} finally {
			setSending(false);
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

	const selectedConversation = conversations.find((conversation) => conversation.id === selectedId);

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
					<Link href="/admin" onClick={() => setSidebarOpen(false)}><span className="nav-icon grid" aria-hidden="true"></span>Overview</Link>
					<Link href="/admin#donations" onClick={() => setSidebarOpen(false)}><span className="nav-icon wallet" aria-hidden="true"></span>Donations</Link>
					<Link href="/admin/users" onClick={() => setSidebarOpen(false)}><span className="nav-icon users" aria-hidden="true"></span>Users</Link>
					<Link href="/admin/content" onClick={() => setSidebarOpen(false)}><span className="nav-icon pages" aria-hidden="true"></span>Content</Link>
					<Link className="active" href="/admin/inbox" onClick={() => setSidebarOpen(false)}><span className="nav-icon inbox" aria-hidden="true"></span>Support inbox</Link>
				</nav>
				<div className="admin-sidebar-bottom">
					<Link className="admin-home-link" href="/">View public website ↗</Link>
					{admin && <div className="admin-profile">
						<div className="profile-avatar">{admin.name.trim().slice(0, 1).toUpperCase()}</div>
						<div><strong>{admin.name}</strong><span>Administrator</span></div>
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
					<div><p>ADMIN WORKSPACE</p><h1>Support inbox</h1></div>
				</header>
				<div className="admin-content">
					{error && <p className="admin-data-error" role="alert">{error}</p>}
					<section className="support-inbox">
						<aside className="support-conversation-list" aria-label="Conversations">
							{conversations.length ? conversations.map((conversation) => (
								<button className={conversation.id === selectedId ? "selected" : ""} type="button" key={conversation.id} onClick={() => setSelectedId(conversation.id)}>
									<strong>{conversation.user.name}</strong>
									<small>{conversation.user.email}</small>
									<span>{conversation.messages[0]?.body ?? "No messages yet"}</span>
								</button>
							)) : <p className="admin-data-state">{loading ? "Loading conversations…" : "No support conversations yet."}</p>}
						</aside>
						<div className="support-conversation">
							{selectedConversation ? (
								<>
									<header><strong>{selectedConversation.user.name}</strong><span>{selectedConversation.user.email}</span></header>
									<div className="support-inbox-messages" aria-live="polite">
										{messages.map((message) => (
											<article className={message.senderRole === "ADMIN" ? "from-admin" : "from-user"} key={message.id}>
												<strong>{message.senderRole === "ADMIN" ? "Admin" : selectedConversation.user.name}</strong>
												<p>{message.body}</p>
												<time>{new Date(message.createdAt).toLocaleString()}</time>
											</article>
										))}
									</div>
									<form onSubmit={sendReply}>
										<textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} maxLength={2000} placeholder="Write a reply…" required />
										<button className="button button-purple" type="submit" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send reply"}</button>
									</form>
								</>
							) : <p className="admin-data-state">Select a conversation to view and reply.</p>}
						</div>
					</section>
				</div>
			</main>
		</div>
	);
}
