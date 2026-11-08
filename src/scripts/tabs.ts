import { NavigationBar } from "mdui";

const PAGE_TREE = {
	profile: {},
	main: {
		navbar: true,
		home: {},
		search: {},
		settings: {},
	},
	reader: {},
	details: {},
};

let globalFallbackTabId: string | null = "home";

export function setGlobalFallbackTab(id: string) {
	if (!PAGE_REGISTRY[id]) {
		throw new Error(
			`[TAB] Page configuration not found for fallback id '${id}'.`,
		);
	}
	globalFallbackTabId = id;
}

interface PageEntry {
	parent: string;
	navbar: boolean;
	path: string[];
}

const PAGE_REGISTRY: Record<string, PageEntry> = {};

function traverseTree(
	node: Record<string, any>,
	parent: string = "body",
	path: string[] = ["body"],
) {
	for (const [key, value] of Object.entries(node)) {
		if (key === "navbar") continue;

		const config = value || {};
		const navbar = !!config.navbar;
		const currentPath = [...path, key];

		PAGE_REGISTRY[key] = {
			parent,
			navbar,
			path: currentPath,
		};

		const children = Object.fromEntries(
			Object.entries(config).filter(([k]) => k !== "navbar"),
		);

		if (Object.keys(children).length > 0) {
			traverseTree(children, key, currentPath);
		}
	}
}

traverseTree(PAGE_TREE);

const ActiveTab: Record<string, HTMLElement | null> = {};
const ActiveQuery: Record<string, string | undefined> = {};

export function getActiveQuery(id: string): string | undefined {
	return ActiveQuery[id];
}

function getURLHash(id: string, query?: string): string {
	if (!query) return `#${id}`;
	const formattedQuery = query.startsWith("?") ? query : `?${query}`;
	return `#${id}${formattedQuery}`;
}

function parseHashFromURL(hashContent: string): {
	targetId: string;
	query?: string;
} {
	if (!hashContent) return { targetId: "" };

	const [routePart, queryPart] = hashContent.split("?");

	if (PAGE_REGISTRY[routePart]) {
		return { targetId: routePart, query: queryPart };
	}

	const segments = routePart.split("/");
	for (let i = segments.length; i > 0; i--) {
		const potentialId = segments.slice(0, i).join("/");
		if (PAGE_REGISTRY[potentialId]) {
			const extraSegments = segments.slice(i).join("/");
			const combinedQuery = extraSegments
				? queryPart
					? `${extraSegments}&${queryPart}`
					: extraSegments
				: queryPart;
			return { targetId: potentialId, query: combinedQuery || undefined };
		}
	}

	return { targetId: routePart, query: queryPart };
}

export function setActiveTab(
	id: string,
	pushHistory?: boolean,
	query?: string,
	eventSource: "setActiveTab" | "popstate" | "init" = "setActiveTab",
) {
	const entry = PAGE_REGISTRY[id];
	if (!entry) {
		throw new Error(`[TAB] Page configuration not found for id '${id}'.`);
	}

	const { parent } = entry;
	const parentConfig = PAGE_REGISTRY[parent];

	const isNavbarTab = parentConfig && parentConfig.navbar;
	const isAlreadyInNavbar = isNavbarTab && ActiveTab["body"]?.id === parent;

	if (
		eventSource === "setActiveTab" &&
		isAlreadyInNavbar &&
		id === globalFallbackTabId &&
		ActiveTab[parent]?.id !== globalFallbackTabId &&
		typeof window !== "undefined"
	) {
		window.history.back();
		return;
	}

	let shouldPush = pushHistory;
	if (shouldPush === undefined) {
		if (id === globalFallbackTabId) {
			shouldPush = false;
		} else if (!isAlreadyInNavbar) {
			shouldPush = true;
		} else {
			const currentActiveTabId = ActiveTab[parent]?.id;
			const isLeavingFallback =
				currentActiveTabId === globalFallbackTabId &&
				id !== globalFallbackTabId;

			shouldPush = isLeavingFallback;
		}
	}

	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`[TAB] Unable to find DOM element with id '${id}'.`);
	}

	if (parent !== "body" && ActiveTab["body"]?.id !== parent) {
		setActiveTab(parent, false, undefined, eventSource);
	}

	const parentNode = document.getElementById(parent);
	if (!parentNode) {
		throw new Error(
			`[TAB] Unable to find parent container with id '${parent}'.`,
		);
	}

	const old = ActiveTab[parent];
	ActiveTab[parent] = element;

	element.setAttribute("active", "true");

	if (old && old !== element) {
		old.removeAttribute("active");
	}

	if (query !== undefined) {
		ActiveQuery[id] = query;
	}

	// Fire the custom event on the target element
	element.dispatchEvent(
		new CustomEvent("tabactivate", {
			bubbles: true,
			detail: {
				source: eventSource,
				query: ActiveQuery[id],
			},
		}),
	);

	if (isNavbarTab) {
		const navBar = parentNode.querySelector(
			"mdui-navigation-bar",
		) as NavigationBar | null;

		if (navBar) {
			navBar.value = id;
		}
	}

	if (typeof window !== "undefined") {
		const currentState = history.state;
		const resolvedQuery =
			query !== undefined
				? query
				: currentState?.tabId === id
					? currentState.query
					: ActiveQuery[id];
		const targetState = { tabId: id, query: resolvedQuery };
		const hash = getURLHash(id, resolvedQuery);

		if (shouldPush) {
			if (
				!currentState ||
				currentState.tabId !== id ||
				currentState.query !== resolvedQuery
			) {
				history.pushState(targetState, "", hash);
			}
		} else {
			history.replaceState(targetState, "", hash);
		}
	}
}

export function initTabFromURL(defaultTabId?: string) {
	if (typeof window === "undefined") return;

	const hashContent = window.location.hash ? window.location.hash.slice(1) : "";
	let { targetId, query } = parseHashFromURL(hashContent);

	if (
		!targetId ||
		!PAGE_REGISTRY[targetId] ||
		!document.getElementById(targetId)
	) {
		if (
			defaultTabId &&
			PAGE_REGISTRY[defaultTabId] &&
			document.getElementById(defaultTabId)
		) {
			targetId = defaultTabId;
			query = undefined;
		} else if (
			globalFallbackTabId &&
			PAGE_REGISTRY[globalFallbackTabId] &&
			document.getElementById(globalFallbackTabId)
		) {
			targetId = globalFallbackTabId;
			query = undefined;
		}
	}

	if (
		targetId &&
		PAGE_REGISTRY[targetId] &&
		document.getElementById(targetId)
	) {
		const targetEntry = PAGE_REGISTRY[targetId];
		const fallbackId = globalFallbackTabId;
		const fallbackEntry = fallbackId ? PAGE_REGISTRY[fallbackId] : undefined;

		const isInSameHierarchy = Boolean(
			targetEntry &&
			fallbackEntry &&
			fallbackId &&
			(targetId === fallbackId ||
				targetEntry.parent === fallbackEntry.parent ||
				targetEntry.path.includes(fallbackId) ||
				fallbackEntry.path.includes(targetId)),
		);

		if (
			!isInSameHierarchy &&
			fallbackId &&
			fallbackEntry &&
			PAGE_REGISTRY[fallbackId] &&
			document.getElementById(fallbackId)
		) {
			const fallbackChain = fallbackEntry.path.slice(1);
			for (let i = 0; i < fallbackChain.length - 1; i++) {
				setActiveTab(fallbackChain[i], false, undefined, "init");
			}
			setActiveTab(fallbackId, false, undefined, "init");
		}

		const chain = targetEntry.path.slice(1);

		for (let i = 0; i < chain.length - 1; i++) {
			setActiveTab(chain[i], false, undefined, "init");
		}

		const shouldPushTarget =
			!isInSameHierarchy && !!fallbackId && targetId !== fallbackId;

		setActiveTab(targetId, shouldPushTarget, query, "init");
	}
}

if (typeof window !== "undefined") {
	window.addEventListener("popstate", (event) => {
		const state = event.state;
		let targetId = "";
		let query: string | undefined = undefined;

		if (state && state.tabId && PAGE_REGISTRY[state.tabId]) {
			targetId = state.tabId;
			query = state.query;
		} else {
			const hashContent = window.location.hash
				? window.location.hash.slice(1)
				: "";
			const parsed = parseHashFromURL(hashContent);
			targetId = parsed.targetId;
			query = parsed.query;
		}

		const currentActiveNavbarParent = ActiveTab["body"]?.id;
		const fallbackId = globalFallbackTabId;

		if (
			(!targetId || !PAGE_REGISTRY[targetId]) &&
			currentActiveNavbarParent &&
			fallbackId
		) {
			const currentParentConfig = PAGE_REGISTRY[currentActiveNavbarParent];
			const fallbackEntry = PAGE_REGISTRY[fallbackId];

			if (
				currentParentConfig?.navbar &&
				fallbackEntry &&
				fallbackEntry.parent === currentActiveNavbarParent &&
				ActiveTab[currentActiveNavbarParent]?.id !== fallbackId
			) {
				const entry = PAGE_REGISTRY[fallbackId];
				const chain = entry.path.slice(1);
				for (let i = 0; i < chain.length - 1; i++) {
					setActiveTab(chain[i], false, undefined, "popstate");
				}
				setActiveTab(fallbackId, true, undefined, "popstate");
				return;
			}
		}

		if (
			targetId &&
			PAGE_REGISTRY[targetId] &&
			document.getElementById(targetId)
		) {
			const entry = PAGE_REGISTRY[targetId];
			const chain = entry.path.slice(1);
			for (let i = 0; i < chain.length - 1; i++) {
				setActiveTab(chain[i], false, undefined, "popstate");
			}
			setActiveTab(targetId, false, query, "popstate");
		}
	});
}
