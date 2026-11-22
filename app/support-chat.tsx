"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type ChatMessage = {
	id: string;
	senderRole: string;
	body: string;
	createdAt: string;
};

export default function SupportChatWidget({ authenticated }: { authenticated: boolean }) {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [draft, setDraft] = useState("");
	const [error, setError] = useState("");
	const [sending, setSending] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);

	useEffect(() => {
		if (!open || !authenticated) return;
		let active = true;
		const loadMessages = async () => {
			try {
				const response = await fetch("/api/support/chat", { cache: "no-store" });
				const result = await response.json();
				if (!response.ok) throw new Error(result.error || "Unable to load support messages.");
				if (active) {
					setMessages(result.messages);
					setError("");
				}
			} catch (loadError) {
				if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load support messages.");
			}
		};
		void loadMessages();
		const interval = window.setInterval(loadMessages, 5000);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, [authenticated, open, refreshKey]);

	async function sendMessage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSending(true);
		setError("");
		try {
			const response = await fetch("/api/support/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: draft }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to send your message.");
			setMessages((current) => [...current, result.message]);
			setDraft("");
			setRefreshKey((key) => key + 1);
		} catch (sendError) {
			setError(sendError instanceof Error ? sendError.message : "Unable to send your message.");
		} finally {
			setSending(false);
		}
	}

	return (
		<div className="support-chat-widget">
			{open && <section className="support-chat-panel" aria-label="Support chat">
				<header>
					<div><strong>Chat with Kayabula</strong><span>Support and questions</span></div>
					<button type="button" aria-label="Close chat" onClick={() => setOpen(false)}>×</button>
				</header>
				{!authenticated ? (
					<div className="support-chat-login">
						<p>Sign in to start a private conversation with our team.</p>
						<Link className="button button-purple" href="/account">Log in or create an account</Link>
					</div>
				) : (
					<>
						<div className="support-chat-messages" aria-live="polite">
							{messages.length === 0 && <p className="support-chat-empty">Send a message and our team will reply here.</p>}
							{messages.map((message) => (
								<article className={`support-chat-message ${message.senderRole === "ADMIN" ? "from-admin" : "from-user"}`} key={message.id}>
									<p>{message.body}</p><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
								</article>
							))}
						</div>
						<form onSubmit={sendMessage}>
							<textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} placeholder="Write a message…" required />
							<button type="submit" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send"}</button>
						</form>
					</>
				)}
				{error && <p className="support-chat-error" role="alert">{error}</p>}
			</section>}
			<button className="support-chat-toggle" type="button" aria-label={open ? "Close support chat" : "Open support chat"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
				{open ? "×" : (
					<svg aria-hidden="true" viewBox="0 0 64 64" focusable="false">
						<defs>
							<linearGradient id="support-chat-gradient" x1="0" y1="0" x2="1" y2="1">
								<stop offset="0" stopColor="#0878f9" />
								<stop offset="0.62" stopColor="#27a6dd" />
								<stop offset="1" stopColor="#42dfc5" />
							</linearGradient>
							<filter id="support-chat-shadow" x="-25%" y="-25%" width="150%" height="170%">
								<feDropShadow dx="0" dy="2" stdDeviation="1.4" floodColor="#163c59" floodOpacity="0.3" />
							</filter>
						</defs>
						<rect x="1" y="1" width="62" height="62" rx="17" fill="url(#support-chat-gradient)" />
						<g filter="url(#support-chat-shadow)">
							<rect x="15" y="16" width="35" height="28" rx="10" fill="#f6fcff" />
							<path d="M36 40 46 49c1.3 1.2 3.2-.1 2.6-1.7L46 39" fill="#f6fcff" />
						</g>
						<circle cx="25" cy="30" r="2" fill="#39b9dc" />
						<circle cx="33" cy="30" r="2" fill="#39b9dc" />
						<circle cx="41" cy="30" r="2" fill="#39b9dc" />
					</svg>
				)}
			</button>
		</div>
	);
}
