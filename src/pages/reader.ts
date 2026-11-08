import { parseQuery } from "ufo";
import { getActiveQuery } from "../scripts/tabs";
import { ExtensionPackage, MangaChapterInfo } from "../ext/types";
import Swiper from "swiper";
import { Keyboard, Zoom } from "swiper/modules";
import { getStorage, setStorage } from "../utils/io";

const pageName = "reader";

const content = document.getElementById(pageName + "-content")!;

const swiperElement = document.getElementById(
	"reader-swiper",
) as HTMLDivElement;

const swiperWrapper = document.getElementById(
	"reader-swiper-wrapper",
) as HTMLDivElement;

var swiper = new Swiper(swiperElement, {
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
});

function resetContent() {
	swiperWrapper.innerHTML = "";
	swiper.update();
	swiper.slideTo(0);
	swiper.slideReset(0);
	content.setAttribute("info", "true");
}

export async function displayChapterReader() {
	resetContent();

	const query = getActiveQuery(pageName);
	console.log(query);
	if (!query) throw new Error("[DETAILS] no query string found");

	const queries = parseQuery(query) as Record<string, string | undefined>;
	const ext = await ExtManager.waitForExtension(queries.source as string);

	const info = await getChapterInfo(queries, ext);

	let inner = "";

	info.images.forEach((url) => {
		inner += getImageElement(url);
	});

	swiperWrapper.innerHTML = inner;

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
