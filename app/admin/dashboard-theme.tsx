"use client";

import { useEffect } from "react";

type DashboardTheme = "dark" | "light";

const storageKey = "kayabula-dashboard-theme";

function getSavedTheme(): DashboardTheme {
	return window.localStorage.getItem(storageKey) === "light" ? "light" : "dark";
}

export function DashboardThemeInitializer() {
	useEffect(() => {
		document.documentElement.dataset.dashboardTheme = getSavedTheme();
	}, []);

	return null;
}

export function DashboardThemeToggle() {
	function toggleTheme() {
		const currentTheme = document.documentElement.dataset.dashboardTheme ?? getSavedTheme();
		const nextTheme = currentTheme === "dark" ? "light" : "dark";
		window.localStorage.setItem(storageKey, nextTheme);
		document.documentElement.dataset.dashboardTheme = nextTheme;
	}

	return (
		<button
			type="button"
			className="dashboard-theme-toggle"
			aria-label="Toggle dashboard color theme"
			onClick={toggleTheme}
		>
			<span className="theme-label-light">Light mode</span>
			<span className="theme-label-dark">Dark mode</span>
		</button>
	);
}
