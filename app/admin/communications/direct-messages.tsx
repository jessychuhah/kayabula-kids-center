"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Channel = "OWNER_USER" | "OWNER_ADMIN" | "ADMIN_ADMIN";
type Person = { id: string; name: string; role: string; lastActiveAt?: string | null };
type DirectMessage = {
	id: string;
	body: string;
	createdAt: string;
	sender: { id: string; name: string; role: string };
};
const queueRecipient = "__next_active_admin__";
type Conversation = {
	id: string;
	channel: Channel;
	members: Array<{ userId: string; user: Person }>;
	claimedBy?: Person | null;
	messages: Array<{ body: string; createdAt: string }>;
};
type ConversationDetails = Omit<Conversation, "messages"> & { messages: DirectMessage[] };

const channelLabels: Record<Channel, string> = {
	OWNER_USER: "Owner ↔ user",
	OWNER_ADMIN: "Owner ↔ admin",
	ADMIN_ADMIN: "Admin ↔ admin",
};

export default function DirectMessages({ role, staffId }: { role: "ADMIN" | "OWNER"; staffId: string }) {
	const [channel, setChannel] = useState<Channel>(role === "OWNER" ? "OWNER_USER" : "OWNER_ADMIN");
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [people, setPeople] = useState<Person[]>([]);
	const [selectedId, setSelectedId] = useState("");
	const [selectedPersonId, setSelectedPersonId] = useState("");
	const [messages, setMessages] = useState<DirectMessage[]>([]);
	const [draft, setDraft] = useState("");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [sending, setSending] = useState(false);

	const load = useCallback(async () => {
		const response = await fetch(`/api/communications/direct?channel=${channel}${selectedId ? `&conversationId=${encodeURIComponent(selectedId)}` : ""}`, { cache: "no-store" });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "Unable to load private messages.");
		const nextConversations: Conversation[] = result.conversations ?? [];
		setConversations(nextConversations);
		setPeople(result.users ?? result.onlineAdmins ?? result.admins ?? []);
		if (selectedId) {
			const conversation: ConversationDetails | undefined = result.conversation;
			setMessages(conversation?.messages ?? []);
		} else if (nextConversations.length) {
			setSelectedId(nextConversations[0].id);
		}
		setError("");
	}, [channel, selectedId]);

	useEffect(() => {
		let active = true;
		const refresh = async () => {
			try {
				if (active) await load();
			} catch (loadError) {
				if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load private messages.");
			}
		};
		void refresh();
		const interval = window.setInterval(refresh, 8000);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, [load]);

	const selectedConversation = conversations.find((conversation) => conversation.id === selectedId);

	function otherMember(conversation: Conversation) {
		return conversation.members.find((member) => member.userId !== staffId)?.user;
	}

	async function send(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");
		setNotice("");
		setSending(true);
		let recipientId: string | undefined = selectedPersonId === queueRecipient ? undefined : selectedPersonId || people[0]?.id;
		if (selectedConversation) {
			if (channel === "OWNER_ADMIN" && role === "ADMIN") recipientId = selectedConversation.id;
			else if (channel === "OWNER_ADMIN" && role === "OWNER") recipientId = selectedConversation.claimedBy?.id;
			else recipientId = otherMember(selectedConversation)?.id;
		}
		try {
			const response = await fetch("/api/communications/direct", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ channel, recipientId, message: draft }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to send private message.");
			setDraft("");
			setSelectedId(result.conversationId);
			if (result.queued) setNotice("No administrators are online. Your message is queued for the next active administrator.");
			await load();
		} catch (sendError) {
			setError(sendError instanceof Error ? sendError.message : "Unable to send private message.");
		} finally {
			setSending(false);
		}
	}

	const selectorLabel = channel === "OWNER_USER" ? "Choose a user" : channel === "ADMIN_ADMIN" ? "Choose an administrator" : "Choose an online administrator";
	const recipientOptions = channel === "OWNER_ADMIN" && role === "OWNER"
		? people.filter((person) => person.role === "ADMIN")
		: people;
	const recipientIdForSelection = selectedConversation
		? channel === "OWNER_ADMIN" && role === "OWNER"
			? selectedConversation.claimedBy?.id ?? ""
			: otherMember(selectedConversation)?.id ?? ""
		: selectedPersonId || recipientOptions[0]?.id || "";

	return (
		<section className="table-card communications-card direct-messages-card" aria-labelledby="direct-messages-title">
			<div className="card-heading">
				<div><p>PRIVATE CHANNELS</p><h2 id="direct-messages-title">Direct messages</h2></div>
				{role === "OWNER" ? (
					<select aria-label="Private channel" value={channel} onChange={(event) => {
						setChannel(event.target.value as Channel);
						setSelectedId("");
						setSelectedPersonId("");
						setMessages([]);
						setConversations([]);
						setPeople([]);
					}}>
						<option value="OWNER_USER">{channelLabels.OWNER_USER}</option>
						<option value="OWNER_ADMIN">{channelLabels.OWNER_ADMIN}</option>
					</select>
				) : (
					<select aria-label="Private channel" value={channel} onChange={(event) => {
						setChannel(event.target.value as Channel);
						setSelectedId("");
						setSelectedPersonId("");
						setMessages([]);
						setConversations([]);
						setPeople([]);
					}}>
						<option value="OWNER_ADMIN">{channelLabels.OWNER_ADMIN}</option>
						<option value="ADMIN_ADMIN">{channelLabels.ADMIN_ADMIN}</option>
					</select>
				)}
			</div>
			{error && <p className="admin-data-error" role="alert">{error}</p>}
			{notice && <p className="admin-success-notice" role="status">{notice}</p>}
			<div className="direct-messages-layout">
				<aside className="direct-conversation-list" aria-label="Private conversations">
					{(recipientOptions.length > 0 || channel === "OWNER_ADMIN" && role === "OWNER") && (
						<label className="direct-recipient-select">
							{selectorLabel}
							<select value={channel === "OWNER_ADMIN" && role === "OWNER" && selectedConversation && !selectedConversation.claimedBy ? queueRecipient : recipientIdForSelection} onChange={(event) => {
								setSelectedId("");
								setSelectedPersonId(event.target.value);
							}}>
								{channel === "OWNER_ADMIN" && role === "OWNER" && <option value={queueRecipient}>Queue for the next active admin</option>}
								{selectedConversation?.claimedBy && !recipientOptions.some((person) => person.id === selectedConversation.claimedBy?.id) && <option value={selectedConversation.claimedBy.id}>{selectedConversation.claimedBy.name} · Assigned admin</option>}
								{recipientOptions.map((person) => <option value={person.id} key={person.id}>{person.name}{channel === "OWNER_ADMIN" && person.lastActiveAt ? " · Online" : ""}</option>)}
							</select>
						</label>
					)}
					{conversations.map((conversation) => (
						<button className={conversation.id === selectedId ? "selected" : ""} type="button" key={conversation.id} onClick={() => {
							setSelectedId(conversation.id);
							setSelectedPersonId("");
						}}>
							<strong>{otherMember(conversation)?.name ?? (conversation.claimedBy ? conversation.claimedBy.name : "Waiting for an active admin")}</strong>
							<span>{conversation.messages[0]?.body ?? "No messages yet"}</span>
						</button>
					))}
					{!conversations.length && <p className="admin-data-state">No private conversations yet.</p>}
					{channel === "OWNER_ADMIN" && role === "OWNER" && recipientOptions.length === 0 && <p className="admin-data-state">No admins are online. Send a message to queue it for the next active admin.</p>}
				</aside>
				<div className="direct-conversation">
					{selectedConversation || channel === "OWNER_ADMIN" && role === "OWNER" || recipientIdForSelection && channel !== "OWNER_ADMIN" ? (
						<>
							<div className="direct-message-list" aria-live="polite">
							{messages.map((item) => <article className={item.sender.id === staffId ? "from-current-user" : ""} key={item.id}>
									<strong>{item.sender.name}</strong><p>{item.body}</p><time>{new Date(item.createdAt).toLocaleString()}</time>
								</article>)}
								{!messages.length && <p className="admin-data-state">Write the first message in this private conversation.</p>}
							</div>
							<form onSubmit={send}>
								<textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} maxLength={2000} placeholder="Write a private message…" required />
								<button className="button button-purple" type="submit" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send privately"}</button>
							</form>
						</>
					) : <p className="admin-data-state">Choose a conversation or recipient to start a private chat.</p>}
				</div>
			</div>
		</section>
	);
}
