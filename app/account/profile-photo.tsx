"use client";

import Image from "next/image";
import { ChangeEvent, useState } from "react";

type Props = {
	name: string;
	imageUrl: string | null;
	onChange: (imageUrl: string | null) => void;
};

const maximumImageBytes = 5 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export default function ProfilePhoto({ name, imageUrl, onChange }: Props) {
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	async function upload(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		setError("");
		setNotice("");
		if (!allowedTypes.has(file.type) || file.size > maximumImageBytes) {
			setError("Choose a JPG, PNG, GIF or WebP image no larger than 5 MB.");
			return;
		}

		setSaving(true);
		let uploadedKey = "";
		let saved = false;
		try {
			const signatureResponse = await fetch("/api/account/profile-photo", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
			});
			const signature = await signatureResponse.json();
			if (!signatureResponse.ok) throw new Error(signature.error || "Unable to prepare the photo upload.");
			uploadedKey = signature.key;
			const uploadResponse = await fetch(signature.uploadUrl, {
				method: "PUT",
				headers: { "Content-Type": file.type },
				body: file,
			});
			if (!uploadResponse.ok) throw new Error("Cloudflare R2 rejected the image. Check the bucket CORS settings.");

			const saveResponse = await fetch("/api/account/profile-photo", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: signature.key, url: signature.publicUrl }),
			});
			const result = await saveResponse.json();
			if (!saveResponse.ok) throw new Error(result.error || "Unable to save the profile photo.");
			saved = true;
			onChange(result.profileImageUrl);
			setNotice(result.mediaCleanupWarning
				? "Photo saved. The previous image could not be removed from storage."
				: "Profile photo updated.");
		} catch (uploadError) {
			if (uploadedKey && !saved) {
				try {
					const cleanupResponse = await fetch("/api/account/profile-photo", {
						method: "DELETE",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ key: uploadedKey }),
					});
					const cleanup = await cleanupResponse.json();
					if (!cleanupResponse.ok) throw new Error(cleanup.error || "Unable to remove the unused upload.");
				} catch (cleanupError) {
					setError(`${uploadError instanceof Error ? uploadError.message : "Unable to update the profile photo."} ${cleanupError instanceof Error ? cleanupError.message : "Unused photo cleanup failed."}`);
					return;
				}
			}
			setError(uploadError instanceof Error ? uploadError.message : "Unable to update the profile photo.");
		} finally {
			setSaving(false);
		}
	}

	async function remove() {
		setSaving(true);
		setError("");
		setNotice("");
		try {
			const response = await fetch("/api/account/profile-photo", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ remove: true }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Unable to remove the profile photo.");
			onChange(null);
			setNotice(result.mediaCleanupWarning
				? "Photo removed from your profile. Its old storage file could not be deleted."
				: "Profile photo removed.");
		} catch (removeError) {
			setError(removeError instanceof Error ? removeError.message : "Unable to remove the profile photo.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<section className="profile-photo-card" aria-label="Profile photo">
			<div className="profile-photo-preview">
				{imageUrl
					? <Image src={imageUrl} alt={`${name}'s profile`} width={88} height={88} unoptimized />
					: <span aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>}
			</div>
			<div className="profile-photo-controls">
				<strong>Profile photo</strong>
				<p>Use a clear image, up to 5 MB.</p>
				<div>
					<label className="profile-photo-picker">
						{saving ? "Please wait…" : imageUrl ? "Change photo" : "Upload photo"}
						<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload} disabled={saving} />
					</label>
					{imageUrl && <button className="profile-photo-remove" type="button" onClick={remove} disabled={saving}>Remove</button>}
				</div>
				{error && <p className="account-error" role="alert">{error}</p>}
				{notice && <p className="admin-success-notice" role="status">{notice}</p>}
			</div>
		</section>
	);
}
