import { parseQuery, stringifyQuery } from "ufo";
import {
	ExtensionPackage,
	MangaChapterEntry,
	MangaDetails,
	MangaGenre,
	MangaVolumeEntry,
	MediaStatus,
} from "../ext/types";
import { getActiveQuery, setActiveTab } from "../scripts/tabs";
import { getMDUIIcon, getMDUISlot, listenForCollapse } from "../utils/elements";
import placeholderCover from "../assets/placeholder_cover.jpg?inline";
import { Button, Collapse, List, ListItem } from "mdui";
import dayjs from "dayjs";
import * as PullToRefresh from "pulltorefreshjs";
import { getStorage, setStorage } from "../utils/io";

const pageName = "details";

const content = document.getElementById(pageName + "-content")!;
const initContent = content.innerHTML;

let query: string | undefined = undefined;

let lastZeroTime: number | null = 200;

const page = document.getElementById(pageName)!;
page.addEventListener("tabactivate", () => {
	const newQuery = getActiveQuery(pageName);
	if (query == newQuery) {
		return;
	} else {
		query = newQuery;
	}

	if (!query) throw new Error("[DETAILS] no query string found");

	displayDetails();
});

content.addEventListener("scroll", () => {
	if (content.scrollTop <= 4) {
		if (lastZeroTime === null) {
			lastZeroTime = Date.now();
		}
	} else {
		lastZeroTime = null;
	}
});

PullToRefresh.init({
	mainElement: "#details-content",
	triggerElement: "#details-content",
	onRefresh: () => {
		displayDetails(true);
	},
	shouldPullToRefresh: () => {
		if (lastZeroTime === null) return false;
		const timeAtTop = Date.now() - lastZeroTime;
		return content.scrollTop === 0 && timeAtTop >= 200;
	},
	iconArrow: "arrow_circle_down",
});

function resetContent() {
	content.innerHTML = initContent;
}

const statusText: Record<MediaStatus, string> = {
	[MediaStatus.COMPLETED]: "Completed",
	[MediaStatus.ONGOING]: "Ongoing",
	[MediaStatus.PLANNED]: "Planned",
	[MediaStatus.HOLD]: "On hold",
	[MediaStatus.DROPPED]: "Dropped",
	[MediaStatus.UNKNOWN]: "Unknown status",
};

export async function displayDetails(
	forceUpdate: boolean = false,
): Promise<void> {
	resetContent();

	const query = getActiveQuery(pageName);
	const queries = parseQuery(query) as Record<string, string | undefined>;

	// Fetch extension and manga details concurrently or sequentially as needed
	const ext = await ExtManager.waitForExtension(queries.source as string);
	const details = await getMangaInfo(queries, ext, forceUpdate);

	// 1. Populate metadata and cover image
	updateCoverImage(details.cover);
	updateMetadata(details, ext);

	// 2. Render chapters or volumes
	renderContentList(details);

	// 3. Bind events and remove loading states
	bindChapterClickEvents(ext, queries);
	removeLoadingStates();
}

// --- Helper Functions ---

function updateCoverImage(coverUrl?: string): void {
	const imageEl = document.getElementById("media-cover") as HTMLImageElement;
	imageEl.src = coverUrl || placeholderCover;

	const handleLoad = () => onImageLoaded(imageEl);

	if (imageEl.complete) {
		if (imageEl.naturalWidth > 0) {
			handleLoad();
		} else {
			console.error("Image failed to load (broken link).");
		}
	} else {
		imageEl.addEventListener("load", handleLoad, { once: true });
	}
}

function updateMetadata(details: any, ext: any): void {
	const startBtn = document.getElementById("start-continue-button") as Button;
	const titleEl = document.getElementById("meta-title")!;
	const titleBarEl = document.getElementById("meta-bar-title")!;
	const authorsEl = document.getElementById("meta-authors")!;
	const statusEl = document.getElementById("meta-status")!;
	const sourceEl = document.getElementById("meta-source")!;
	const descEl = document.getElementById("meta-description")!;

	startBtn.innerHTML = `${getMDUIIcon("book_ribbon", "", "end")}READ`;
	titleEl.innerText = details.title;
	titleBarEl.innerHTML = `${details.title}<span slot="label-large"></span>`;

	const authorsText = details.authors?.length
		? details.authors.join(", ")
		: "Unknown author";
	authorsEl.innerHTML = `${getMDUIIcon("person", "meta-icon")}${authorsText}`;

	statusEl.innerHTML = `${getMDUIIcon("schedule", "meta-icon")}${statusText[details.status as MediaStatus]}`;
	sourceEl.innerHTML = `${getMDUIIcon("code", "meta-icon")}${ext.manifest.name}`;

	if (details.description) {
		descEl.innerText = details.description;
	} else {
		descEl.parentElement?.remove();
	}
}

function renderContentList(details: any): void {
	const volumeList = document.getElementById("volumes-list") as Collapse;
	const chapterList = document.getElementById("chapters-list") as List;

	if (details.genre === MangaGenre.VOLUMES) {
		const volumes = details.content as MangaVolumeEntry[];

		volumes.forEach((vol) => {
			volumeList.insertAdjacentHTML("beforeend", getVolumeElement(vol));

			const volumeChapterList = volumeList.lastElementChild!.querySelector(
				"mdui-list",
			) as List;
			const chaptersHtml = vol.chapters.map(getChapterElement).join("");

			volumeChapterList.insertAdjacentHTML("beforeend", chaptersHtml);
		});

		listenForCollapse(volumeList);
		chapterList.remove();
	} else {
		const chapters = details.content as MangaChapterEntry[];
		const chaptersHtml = chapters.map(getChapterElement).join("");

		volumeList.insertAdjacentHTML("beforeend", chaptersHtml);
		volumeList.remove();
	}
}

function bindChapterClickEvents(
	ext: any,
	queries: Record<string, string | undefined>,
): void {
	const chapters = [
		...content.querySelectorAll(".chapter-entry"),
	] as ListItem[];

	chapters.forEach((chap) => {
		chap.addEventListener("click", () => {
			readChapter(
				ext.manifest.id,
				chap.getAttribute("data-index")!,
				chap.getAttribute("data-id") || undefined,
				queries["id"] as string | undefined,
				queries["slur"] as string | undefined,
			);
		});
	});
}

function removeLoadingStates(): void {
	const loadingElements = [
		...content.querySelectorAll(":not(#media-cover-wrapper).loading"),
	];
	loadingElements.forEach((el) => el.classList.remove("loading"));
}

function getVolumeElement(vol: MangaVolumeEntry) {
	return `
		<mdui-collapse-item value="volume-${vol.index}">
			<mdui-list-item slot="header">
				<span class="volume-name">${vol.name || "Volume " + vol.index.toString()}</span>
				<mdui-icon name="arrow_right" slot="end-icon" class="collapse-arrow"></mdui-icon>
			</mdui-list-item>
			<mdui-list class="volume-chapters"></mdui-list>
		</mdui-collapse-item>
		`;
}

function getChapterElement(chap: MangaChapterEntry) {
	return `
			<mdui-list-item class="chapter-entry" data-index="${chap.index}"${chap.id ? ' data-id="' + chap.id + '"' : ""}>
				<span class="chapter-name">${chap.name || "Chapter " + chap.index.toString()}</span>
				${chap.date ? getMDUISlot("i", "description", dayjs(chap.date, "YYYY-MM-DD").format("MMMM DD YYYY")) : ""}
			</mdui-list-item>
		`;
}

function onImageLoaded(image: HTMLImageElement) {
	image.parentElement!.classList.remove("loading");
}

function readChapter(
	source: string,
	chap: string,
	chap_id: string | undefined,
	manga_id: string | undefined,
	manga_slur: string | undefined,
) {
	setActiveTab(
		"reader",
		true,
		stringifyQuery({ source, chap, chap_id, manga_id, manga_slur }),
	);
}

async function getMangaInfo(
	queries: Record<string, string | undefined>,
	ext: ExtensionPackage,
	forceUpdate: boolean = false,
) {
	const { id, slur, source } = queries;

	if (typeof source != "string")
		throw new Error("[DETAILS] Invalid query string");

	const arr: string[] = [];
	if (id) arr.push(id);
	if (slur) arr.push(slur);

	const path = `offline/manga/${source}/${arr.join("-")}/manga`;

	const saved = forceUpdate ? undefined : await getStorage(path);

	let details: MangaDetails = saved;

	if (saved == undefined) {
		details = await ExtManager.runExtension<MangaDetails>(
			ext.code,
			pageName,
			[queries],
			ext.manifest.host,
		);

		await setStorage(path, details);
	}

	return details;
}
