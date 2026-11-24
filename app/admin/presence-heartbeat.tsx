"use client";

import { useEffect, useState } from "react";

export default function PresenceHeartbeat() {
	const [error, setError] = useState("");

	useEffect(() => {
		let active = true;
		const updatePresence = async () => {
			try {
				const response = await fetch("/api/communications/presence", { method: "POST" });
				const result = await response.json();
				if (!response.ok) throw new Error(result.error || "Unable to update online status.");
				if (active) setError("");
			} catch (presenceError) {
				if (active) setError(presenceError instanceof Error ? presenceError.message : "Unable to update online status.");
			}
		};
		void updatePresence();
		const interval = window.setInterval(updatePresence, 60_000);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, []);

	return error ? <p className="admin-data-error" role="alert">{error}</p> : null;
}
