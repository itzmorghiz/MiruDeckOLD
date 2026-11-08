import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { setActiveTab } from "../scripts/tabs";

export async function setupDeepLinking() {
	// Helper function to parse an incoming URL and activate the corresponding tab/page
	const handleUrl = (urlStr: string) => {
		try {
			const url = new URL(urlStr);

			// Example 1: If using hash routing like my-tauri-app://#reader-page
			let targetId = url.hash ? url.hash.slice(1) : "";

			// Example 2: If using path routing like my-tauri-app://reader-page or https://yourdomain.com/reader-page
			if (!targetId) {
				targetId = url.pathname.split("/").filter(Boolean).pop() || "";
			}

			if (targetId) {
				setActiveTab(targetId);
			}
		} catch (e) {
			console.error("[DeepLink] Failed to parse URL:", urlStr, e);
		}
	};

	// 1. Check if the app was launched by clicking a deep link (Cold Start)
	try {
		const startUrls = await getCurrent();
		if (startUrls && startUrls.length > 0) {
			// Handle the first initial launch URL
			handleUrl(startUrls[0]);
		}
	} catch (error) {
		console.error("[DeepLink] Error getting current startup URL:", error);
	}

	// 2. Listen for deep links opened while the app is already running (Warm Start)
	await onOpenUrl((urls) => {
		if (urls && urls.length > 0) {
			handleUrl(urls[0]);
		}
	});
}
