"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type SettingsForm = {
	youthSupported: string;
	familiesSupported: string;
	villagesReached: string;
	whatsappNumber: string;
};

type Advertisement = {
	id: string;
	title: string;
	handle: string | null;
	text: string | null;
	mediaType: string | null;
	mediaUrl: string | null;
	mediaKey: string | null;
	targetUrl: string | null;
	isActive: boolean;
	sortOrder: number;
};

type AdvertisementForm = {
	title: string;
	handle: string;
	text: string;
	mediaType: string;
	mediaUrl: string;
	mediaKey: string;
	targetUrl: string;
	isActive: boolean;
	sortOrder: string;
};

const emptyAdvertisement: AdvertisementForm = {
	title: "",
	handle: "",
	text: "",
	mediaType: "",
	mediaUrl: "",
	mediaKey: "",
	targetUrl: "",
	isActive: true,
	sortOrder: "0",
};

export default function AdminContentPage() {
	const router = useRouter();
	const [settings, setSettings] = useState<SettingsForm>({
		youthSupported: "20",
		familiesSupported: "23",
		villagesReached: "10",
		whatsappNumber: "+256760597356",
	});
	const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
	const [admin, setAdmin] = useState<{ name: string } | null>(null);
	const [loading, setLoading] = useState(true);
	const [savingSettings, setSavingSettings] = useState(false);
	const [savingAd, setSavingAd] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
	const [adForm, setAdForm] = useState<AdvertisementForm>(emptyAdvertisement);
	const [mediaFile, setMediaFile] = useState<File | null>(null);
	const [fileInputKey, setFileInputKey] = useState(0);
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const loadContent = useCallback(async () => {
		const [settingsResponse, adsResponse] = await Promise.all([
			fetch("/api/admin/settings", { cache: "no-store" }),
			fetch("/api/admin/ads", { cache: "no-store" }),
		]);
		const [settingsResult, adsResult] = await Promise.all([settingsResponse.json(), adsResponse.json()]);
		if ([settingsResponse.status, adsResponse.status].some((status) => status === 401 || status === 403)) {
			router.replace("/account");
			throw new Error("Administrator access is required.");
		}
		if (!settingsResponse.ok) throw new Error(settingsResult.error || "Unable to load site settings.");
		if (!adsResponse.ok) throw new Error(adsResult.error || "Unable to load advertisements.");
		return { settings: settingsResult.settings, advertisements: adsResult.advertisements };
	}, [router]);

	useEffect(() => {
		let active = true;
		Promise.all([
			fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()),
			loadContent(),
		])
			.then(([session, content]) => {
				if (active) {
					setAdmin(session.user ? { name: session.user.name } : null);
					setSettings({
						youthSupported: String(content.settings.youthSupported),
						familiesSupported: String(content.settings.familiesSupported),
						villagesReached: String(content.settings.villagesReached),
						whatsappNumber: `+${content.settings.whatsappNumber}`,
					});
					setAdvertisements(content.advertisements);
				}
			})
			.catch((loadError: unknown) => {
				if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load content settings.");
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => { active = false; };
	}, [loadContent]);

	function applyContent(content: Awaited<ReturnType<typeof loadContent>>) {
		setSettings({
			youthSupported: String(content.settings.youthSupported),
			familiesSupported: String(content.settings.familiesSupported),
			villagesReached: String(content.settings.villagesReached),
			whatsappNumber: `+${content.settings.whatsappNumber}`,
		});
		setAdvertisements(content.advertisements);
	}

	async function saveSettings(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSavingSettings(true);
		setError("");
		setNotice("");
		try {
			const response = await fetch("/api/admin/settings", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					youthSupported: Number(settings.youthSupported),
					familiesSupported: Number(settings.familiesSupported),
					villagesReached: Number(settings.villagesReached),
					whatsappNumber: settings.whatsappNumber,
				}),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to save site settings.");
			setNotice("Impact totals and WhatsApp number saved.");
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "Unable to save site settings.");
		} finally {
			setSavingSettings(false);
		}
	}

	function startEdit(ad: Advertisement) {
		setEditingAd(ad);
		setAdForm({
			title: ad.title,
			handle: ad.handle ?? "",
			text: ad.text ?? "",
			mediaType: ad.mediaType ?? "",
			mediaUrl: ad.mediaUrl ?? "",
			mediaKey: ad.mediaKey ?? "",
			targetUrl: ad.targetUrl ?? "",
			isActive: ad.isActive,
			sortOrder: String(ad.sortOrder),
		});
		setMediaFile(null);
		setFileInputKey((key) => key + 1);
		setError("");
		setNotice("");
	}

	function startNewAd() {
		setEditingAd(null);
		setAdForm(emptyAdvertisement);
		setMediaFile(null);
		setFileInputKey((key) => key + 1);
		setError("");
		setNotice("");
	}

	async function deleteUploadedMedia(key: string) {
		const response = await fetch("/api/admin/ads/upload", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ key }),
		});
		if (!response.ok) {
			const result = await response.json();
			throw new Error(result.error || "Unable to remove uploaded media.");
		}
	}

	async function saveAdvertisement(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSavingAd(true);
		setError("");
		setNotice("");
		let uploadedKey = "";
		let saved = false;
		try {
			let mediaUrl = adForm.mediaUrl || null;
			let mediaKey = adForm.mediaKey || null;
			let mediaType = adForm.mediaType || null;
			if (mediaFile) {
				const signatureResponse = await fetch("/api/admin/ads/upload", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						fileName: mediaFile.name,
						contentType: mediaFile.type,
						size: mediaFile.size,
					}),
				});
				const signature = await signatureResponse.json();
				if (!signatureResponse.ok) throw new Error(signature.error || "Unable to prepare media upload.");
				uploadedKey = signature.key;
				const uploadResponse = await fetch(signature.uploadUrl, {
					method: "PUT",
					headers: { "Content-Type": mediaFile.type },
					body: mediaFile,
				});
				if (!uploadResponse.ok) throw new Error("Cloudflare R2 rejected the media upload. Check the bucket CORS settings.");
				mediaUrl = signature.publicUrl;
				mediaKey = signature.key;
				mediaType = signature.mediaType;
			}

			const payload = {
				title: adForm.title,
				handle: adForm.handle.trim() || null,
				text: adForm.text.trim() || null,
				mediaType,
				mediaUrl,
				mediaKey,
				targetUrl: adForm.targetUrl.trim() || null,
				isActive: adForm.isActive,
				sortOrder: Number(adForm.sortOrder),
			};
			const response = await fetch("/api/admin/ads", {
				method: editingAd ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(editingAd ? { id: editingAd.id, ...payload } : payload),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to save advertisement.");

			saved = true;
			startNewAd();
			applyContent(await loadContent());
			setNotice(result.mediaCleanupWarning
				? "Advertisement saved, but its previous R2 file could not be removed."
				: "Advertisement saved.");
		} catch (saveError) {
			if (uploadedKey && !saved) {
				try {
					await deleteUploadedMedia(uploadedKey);
				} catch (cleanupError) {
					setError(`${saveError instanceof Error ? saveError.message : "Unable to save advertisement."} ${cleanupError instanceof Error ? cleanupError.message : "Uploaded media cleanup failed."}`);
					setSavingAd(false);
					return;
				}
			}
			setError(saveError instanceof Error ? saveError.message : "Unable to save advertisement.");
		} finally {
			setSavingAd(false);
		}
	}

	async function removeAdvertisement(ad: Advertisement) {
		if (!window.confirm(`Delete "${ad.title}" from the public noticeboard?`)) return;
		setError("");
		setNotice("");
		try {
			const response = await fetch("/api/admin/ads", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: ad.id }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to delete advertisement.");
			setNotice("Advertisement deleted.");
			applyContent(await loadContent());
		} catch (deleteError) {
			setError(deleteError instanceof Error ? deleteError.message : "Unable to delete advertisement.");
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
					<div><strong>KAYABULA</strong><span>Admin Centre</span></div>
					<button type="button" className="sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>×</button>
				</div>
				<nav className="admin-nav" aria-label="Admin navigation">
					<p>WORKSPACE</p>
					<Link href="/admin" onClick={() => setSidebarOpen(false)}><span className="nav-icon grid" aria-hidden="true"></span>Overview</Link>
					<Link href="/admin#donations" onClick={() => setSidebarOpen(false)}><span className="nav-icon wallet" aria-hidden="true"></span>Donations</Link>
					<Link href="/admin/users" onClick={() => setSidebarOpen(false)}><span className="nav-icon users" aria-hidden="true"></span>Users</Link>
					<Link className="active" href="/admin/content" onClick={() => setSidebarOpen(false)}><span className="nav-icon pages" aria-hidden="true"></span>Content</Link>
					<Link href="/admin/inbox" onClick={() => setSidebarOpen(false)}><span className="nav-icon inbox" aria-hidden="true"></span>Support inbox</Link>
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
					<div><p>ADMIN WORKSPACE</p><h1>Content</h1></div>
				</header>
				<div className="admin-content admin-content-management">
					{error && <p className="admin-data-error" role="alert">{error}</p>}
					{notice && <p className="admin-success-notice" role="status">{notice}</p>}
					{loading ? <p className="admin-data-state" role="status">Loading content settings…</p> : (
						<>
							<section className="table-card content-settings-card">
								<div className="card-heading"><div><p>PUBLIC WEBSITE</p><h2>Impact and contact details</h2></div></div>
								<form className="content-settings-form" onSubmit={saveSettings}>
									<label>Youth supported<input type="number" min="0" max="1000000000" step="1" value={settings.youthSupported} onChange={(event) => setSettings({ ...settings, youthSupported: event.target.value })} required /></label>
									<label>Families supported<input type="number" min="0" max="1000000000" step="1" value={settings.familiesSupported} onChange={(event) => setSettings({ ...settings, familiesSupported: event.target.value })} required /></label>
									<label>Villages reached<input type="number" min="0" max="1000000000" step="1" value={settings.villagesReached} onChange={(event) => setSettings({ ...settings, villagesReached: event.target.value })} required /></label>
									<label>WhatsApp number (international format)<input type="tel" value={settings.whatsappNumber} onChange={(event) => setSettings({ ...settings, whatsappNumber: event.target.value })} placeholder="+256760597356" minLength={8} maxLength={24} required /></label>
									<button className="button button-purple" type="submit" disabled={savingSettings}>{savingSettings ? "Saving…" : "Save website details"}</button>
								</form>
							</section>

							<section className="table-card ad-management-card">
								<div className="card-heading">
									<div><p>R2-STORED MEDIA</p><h2>Advertising noticeboard</h2></div>
									<span className="admin-live-label">Images, videos, text and links</span>
								</div>
								<p className="content-helper">Active advertisements appear below the impact totals on the public homepage. Media uploads need Cloudflare R2 credentials, a public asset URL, and bucket CORS configured for browser uploads. Image and video files are limited to 100 MB.</p>
								<div className="advertisement-admin-layout">
									<form className="advertisement-admin-form" onSubmit={saveAdvertisement}>
										<h3>{editingAd ? "Edit advertisement" : "Add advertisement"}</h3>
										<label>Title<input value={adForm.title} onChange={(event) => setAdForm({ ...adForm, title: event.target.value })} minLength={2} maxLength={120} required /></label>
										<label>Advertiser / social handle (optional)<input value={adForm.handle} onChange={(event) => setAdForm({ ...adForm, handle: event.target.value })} maxLength={100} placeholder="@partner" /></label>
										<label>Text<textarea value={adForm.text} onChange={(event) => setAdForm({ ...adForm, text: event.target.value })} rows={4} maxLength={2000} placeholder="Optional supporting message" /></label>
										<label>Image or video (optional)<input key={fileInputKey} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={(event) => setMediaFile(event.target.files?.[0] ?? null)} /></label>
										{adForm.mediaUrl && <div className="ad-current-media"><span>Current {adForm.mediaType?.toLowerCase()} attached</span><button type="button" onClick={() => setAdForm({ ...adForm, mediaUrl: "", mediaKey: "", mediaType: "" })}>Remove media</button></div>}
										<label>Link URL (optional)<input type="url" value={adForm.targetUrl} onChange={(event) => setAdForm({ ...adForm, targetUrl: event.target.value })} placeholder="https://example.org" /></label>
										<label>Display order<input type="number" min="0" max="10000" value={adForm.sortOrder} onChange={(event) => setAdForm({ ...adForm, sortOrder: event.target.value })} /></label>
										<label className="ad-active-control"><input type="checkbox" checked={adForm.isActive} onChange={(event) => setAdForm({ ...adForm, isActive: event.target.checked })} />Show on public homepage</label>
										<div className="user-modal-actions">
											{editingAd && <button type="button" className="button button-outline" onClick={startNewAd}>Cancel edit</button>}
											<button className="button button-purple" type="submit" disabled={savingAd}>{savingAd ? "Saving…" : editingAd ? "Save advertisement" : "Add advertisement"}</button>
										</div>
									</form>
									<div className="advertisement-admin-list">
										{advertisements.length ? advertisements.map((ad) => (
											<article key={ad.id}>
												<div><strong>{ad.title}</strong><span>{ad.isActive ? "Visible" : "Hidden"} · order {ad.sortOrder}</span></div>
												<p>{ad.text || (ad.mediaType ? `${ad.mediaType.toLowerCase()} advertisement` : "No text")}</p>
												<div className="advertisement-admin-actions">
													<button type="button" onClick={() => startEdit(ad)}>Edit</button>
													<button type="button" className="danger-action" onClick={() => removeAdvertisement(ad)}>Delete</button>
												</div>
											</article>
										)) : <p className="admin-data-state">No advertisements have been added.</p>}
									</div>
								</div>
							</section>
						</>
					)}
				</div>
			</main>
		</div>
	);
}
