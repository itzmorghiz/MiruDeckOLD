import { parseQuery } from "ufo";
import { getActiveQuery } from "../scripts/tabs";
import {
	ExtensionPackage,
	MangaChapterInfo,
	MangaReadingMode,
} from "../ext/types";
import Swiper from "swiper";
import { FreeMode, Keyboard, Mousewheel, Zoom } from "swiper/modules";
import { getStorage, setStorage } from "../utils/io";
import { SwiperOptions } from "swiper/types";

const pageName = "reader";

//const content = document.getElementById(pageName + "-content")!;

const swiperElement = document.getElementById(
	"reader-swiper",
) as HTMLDivElement;

const swiperWrapper = document.getElementById(
	"reader-swiper-wrapper",
) as HTMLDivElement;

var swiper: Swiper | undefined;

const mangaConfig: SwiperOptions = {
	direction: "horizontal",
	slidesPerView: 1,
	lazyPreload: true,
	modules: [Zoom, Keyboard],
	zoom: {
		maxRatio: 3,
		minRatio: 1,
		toggle: true,
	},
	keyboard: {
		enabled: true,
		onlyInViewport: true,
		pageUpDown: true,
	},
};

const webtoonConfig: SwiperOptions = {
	direction: "vertical",
	slidesPerView: "auto",
	freeMode: {
		enabled: true,
		sticky: false,
		momentum: true,
	},
	mousewheel: {
		sensitivity: 1,
		releaseOnEdges: true,
	},
	autoHeight: true,
	observer: true,
	observeParents: true,
	lazyPreload: true,
	modules: [Zoom, Keyboard, FreeMode, Mousewheel],
	zoom: {
		maxRatio: 3,
		minRatio: 1,
		toggle: true,
	},
	keyboard: {
		enabled: false,
		onlyInViewport: true,
		pageUpDown: true,
	},
};

function resetContent() {
	if (swiper) swiper.destroy();
	swiperWrapper.innerHTML = "";
}

export async function displayChapterReader() {
	resetContent();

	const query = getActiveQuery(pageName);
	console.log(query);
	if (!query) throw new Error("[DETAILS] no query string found");

	const queries = parseQuery(query) as Record<string, string | undefined>;
	const ext = await ExtManager.waitForExtension(queries.source as string);

	const info = await getChapterInfo(queries, ext);

	swiper = new Swiper(
		swiperElement,
		info.readingMode == MangaReadingMode.STRIP ? webtoonConfig : mangaConfig,
	);

	let inner = "";

	info.images.forEach((url) => {
		inner += getImageElement(url);
	});

	swiperWrapper.innerHTML = inner;

	(
		[...document.querySelectorAll(".swiper-slide img")] as HTMLImageElement[]
	).forEach((img) => {
		if (img.complete) {
			img.classList.add("loaded");
		} else {
			img.addEventListener("load", () => {
				img.classList.add("loaded");
				if (swiper) {
					swiper.updateAutoHeight();
				}
			});
		}
	});

	const settings = await getStorage("settings");
	swiper.changeLanguageDirection(settings["reader"]["rtl"] ? "rtl" : "ltr");
	swiper.update();
}

function getImageElement(src: string) {
	return `
        <div class="swiper-slide">
            <!-- Wrap the image in this container -->
            <div class="swiper-zoom-container">
                <img src="${src}" loading="lazy"/>
            </div>
            <div class="swiper-lazy-preloader swiper-lazy-preloader-white"></div>
        </div>
    `;
}

async function getChapterInfo(
	queries: Record<string, string | undefined>,
	ext: ExtensionPackage,
) {
	const { chap, chap_id, manga_id, manga_slur, source } = queries;

	console.log("[chap]", chap);

	if (typeof source != "string" || typeof chap != "string")
		throw new Error("[DETAILS] Invalid query string");

	const arr: string[] = [];
	if (manga_id) arr.push(manga_id);
	if (manga_slur) arr.push(manga_slur);

	const path = `offline/manga/${source}/${arr.join("-")}/chapters/${chap + (chap_id ? "-" + chap_id : "")}`;

	let details: MangaChapterInfo | undefined = await getStorage(path);

	if (details == undefined) {
		details = await ExtManager.runExtension<MangaChapterInfo>(
			ext.code,
			"getChapter",
			[queries],
			ext.manifest.host,
		);

		await setStorage(path, details);
	}

	return details;
}
