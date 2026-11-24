"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Channel = "community" | "owner" | "support";
type Message = {
	id: string;
	body: string;
	createdAt: string;
	senderRole?: string;
	senderName?: string;
	sender?: { id: string; name: string; role: string };
};
type PrivateConversation = { id: string; messages: Message[] };

const channelLabels: Record<Channel, string> = {
	community: "General",
	owner: "Private with owner",
	support: "Support",
};

export default function SupportChatWidget({ authenticated }: { authenticated: boolean }) {
	const [open, setOpen] = useState(false);
	const [channel, setChannel] = useState<Channel>("community");
	const [role, setRole] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [draft, setDraft] = useState("");
	const [error, setError] = useState("");
	const [sending, setSending] = useState(false);
	const [conversationId, setConversationId] = useState("");

	useEffect(() => {
		if (!open || !authenticated) return;
		let active = true;
		fetch("/api/auth/session", { cache: "no-store" })
			.then(async (response) => {
				const result = await response.json();
				if (!response.ok) throw new Error(result.error || "Unable to check your account.");
				if (active) setRole(result.user?.role ?? "");
			})
			.catch((loadError: unknown) => {
				if (active) setError(loadError instanceof Error ? loadError.message : "Unable to check your account.");
			});
		return () => { active = false; };
	}, [authenticated, open]);

	useEffect(() => {
		if (!open || !authenticated || (channel === "owner" && role !== "USER")) return;
		let active = true;
		const loadMessages = async () => {
			try {
				if (channel === "community") {
					const response = await fetch("/api/community/chat", { cache: "no-store" });
					const result = await response.json();
					if (!response.ok) throw new Error(result.error || "Unable to load the general channel.");
					if (active) setMessages(result.messages);
				} else if (channel === "owner") {
					const listResponse = await fetch("/api/communications/direct?channel=OWNER_USER", { cache: "no-store" });
					const listResult = await listResponse.json();
					if (!listResponse.ok) throw new Error(listResult.error || "Unable to load your private conversation.");
					const list: PrivateConversation[] = listResult.conversations ?? [];
					const currentId = conversationId || list[0]?.id || "";
					if (!conversationId && currentId && active) setConversationId(currentId);
					if (currentId) {
						const response = await fetch(`/api/communications/direct?channel=OWNER_USER&conversationId=${encodeURIComponent(currentId)}`, { cache: "no-store" });
						const result = await response.json();
						if (!response.ok) throw new Error(result.error || "Unable to load your private conversation.");
						if (active) setMessages(result.conversation.messages);
					} else if (active) setMessages([]);
				} else {
					const response = await fetch("/api/support/chat", { cache: "no-store" });
					const result = await response.json();
					if (!response.ok) throw new Error(result.error || "Unable to load support messages.");
					if (active) setMessages(result.messages);
				}
				if (active) setError("");
			} catch (loadError) {
				if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load messages.");
			}
		};
		void loadMessages();
		const interval = window.setInterval(loadMessages, 6000);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, [authenticated, channel, conversationId, open, role]);

	async function sendMessage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSending(true);
		setError("");
		try {
			const endpoint = channel === "community"
				? "/api/community/chat"
				: channel === "owner"
					? "/api/communications/direct"
					: "/api/support/chat";
			const body = channel === "community"
				? { message: draft }
				: channel === "owner"
					? { channel: "OWNER_USER", message: draft }
					: { message: draft };
			const response = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to send your message.");
			if (channel === "owner") setConversationId(result.conversationId);
			setMessages((current) => [...current, channel === "community" ? result.message : channel === "owner" ? result.message : result.message]);
			setDraft("");
		} catch (sendError) {
			setError(sendError instanceof Error ? sendError.message : "Unable to send your message.");
		} finally {
			setSending(false);
		}
	}

	const availableChannels: Channel[] = role === "USER" ? ["community", "owner", "support"] : ["community", "support"];

	return (
		<div className={`support-chat-widget${open ? " is-open" : ""}`}>
			{open && <section className="support-chat-panel" aria-label="Kayabula communications">
				<header>
					<div><strong>Kayabula communications</strong><span>{channel === "community" ? "Everyone can join; messages are shared" : channel === "owner" ? "Private conversation with the owner" : "Private support conversation"}</span></div>
					<button type="button" aria-label="Close chat" onClick={() => setOpen(false)}>×</button>
				</header>
				{!authenticated ? (
					<div className="support-chat-login">
						<p>Sign in to join the general channel or start a private conversation.</p>
						<Link className="button button-purple" href="/account">Log in or create an account</Link>
					</div>
				) : (
					<>
						<nav className="support-chat-channels" aria-label="Communication channels">
							{availableChannels.map((item) => <button className={channel === item ? "active" : ""} type="button" key={item} onClick={() => {
								setChannel(item);
								setMessages([]);
								setError("");
							}}>{channelLabels[item]}</button>)}
						</nav>
						<div className="support-chat-messages" aria-live="polite">
							{messages.length === 0 && <p className="support-chat-empty">{channel === "community" ? "Start the general conversation. Everyone in the channel can see your message." : channel === "owner" ? "Send a private message to the owner. Only you and the owner can see it." : "Send a message and our support team will reply here."}</p>}
							{messages.map((message) => {
								const senderRole = message.sender?.role ?? message.senderRole ?? "";
								const senderName = message.sender?.name ?? message.senderName ?? (senderRole === "ADMIN" ? "Admin" : senderRole === "OWNER" ? "Owner" : "You");
								return <article className={`support-chat-message ${senderRole === "USER" ? "from-user" : "from-admin"}`} key={message.id}>
									{channel === "community" && <strong>{senderName}{senderRole ? ` · ${senderRole === "OWNER" ? "Owner" : senderRole === "ADMIN" ? "Admin" : "Member"}` : ""}</strong>}
									<p>{message.body}</p><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
								</article>;
							})}
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
