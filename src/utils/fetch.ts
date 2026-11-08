import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { stringifyQuery } from "ufo";

export function safeFetch(
	...args: Parameters<typeof window.fetch>
): Promise<Response> {
	if (isTauri()) {
		return tauriFetch(...args);
	}

	const input = args[0];
	let urlString: string;

	if (typeof input === "string") {
		urlString = input;
	} else if (input instanceof URL) {
		urlString = input.toString();
	} else if (input instanceof Request) {
		urlString = input.url;
	} else {
		urlString = String(input);
	}

	const proxiedUrl = `https://de-cors.itzmorghiz.workers.dev/?${stringifyQuery({ url: urlString })}`;

	if (input instanceof Request) {
		const newRequest = new Request(proxiedUrl, input);
		return window.fetch(newRequest, args[1]);
	}

	return window.fetch(proxiedUrl, args[1]);
}

export async function fetchPage(url: string) {
	return (await browserFetch(url)).text();
}

export function browserFetch(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	const defaultHeaders: Record<string, string> = {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
		Accept:
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
		"Accept-Language": "en-US,en;q=0.9",
		"Upgrade-Insecure-Requests": "1",
	};
	const headers = new Headers(init?.headers || {});

	for (const [key, value] of Object.entries(defaultHeaders)) {
		if (!headers.has(key)) {
			headers.set(key, value);
		}
	}

	return safeFetch(input, {
		...init,
		headers,
	});
}
