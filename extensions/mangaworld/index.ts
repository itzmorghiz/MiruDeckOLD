import { joinURL, parseURL, stringifyParsedURL, stringifyQuery } from "ufo";
import {
	ExtensionHelpers,
	MangaChapterEntry,
	MangaChapterInfo,
	MangaDetails,
	MangaGenre,
	MangaReadingMode,
	MangaSearchEntry,
	MangaVolumeEntry,
	MediaStatus,
} from "../../src/ext/types";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import "dayjs/locale/it.js";

dayjs.extend(customParseFormat);

const statusChart: Record<string, MediaStatus> = {
	finito: MediaStatus.COMPLETED,
	droppato: MediaStatus.DROPPED,
	"in corso": MediaStatus.ONGOING,
};

export default {
	async search(
		query: string,
		helpers: ExtensionHelpers,
	): Promise<MangaSearchEntry[]> {
		const url =
			joinURL(helpers.host, "/archive?") + stringifyQuery({ keyword: query });

		let page: string;
		try {
			page = await helpers.fetchPage(url);
		} catch (error) {
			throw new Error("[FETCH] " + error);
		}

		const $ = helpers.load(page);

		const data = $.extract({
			entries: [
				{
					selector: ".comics-grid .entry",
					value: {
						title: {
							selector: "a.manga-title",
							value: "title",
						},
						id: {
							selector: "a.manga-title",
							value: (el: any) => {
								const href = $(el).attr("href")!;
								const purl = parseURL(href);
								const path = purl.pathname;
								const split = path.split("/");

								return split[split.length - 2];
							},
						},
						slur: {
							selector: "a.manga-title",
							value: (el: any) => {
								const href = $(el).attr("href")!;
								const purl = parseURL(href);
								const path = purl.pathname;
								const split = path.split("/");

								return split[split.length - 1];
							},
						},
						cover: {
							selector: "a.thumb img",
							value: (el: any) => {
								const src = $(el).attr("src")!;
								const purl = parseURL(src);
								purl.search = "";

								return stringifyParsedURL(purl);
							},
						},
					},
				},
			],
		});

		return data.entries as MangaSearchEntry[];
	},
	async details(
		queries: Record<string, string>,
		helpers: ExtensionHelpers,
	): Promise<MangaDetails> {
		const url = joinURL(
			helpers.host,
			"/manga/",
			queries["id"],
			"/",
			queries["slur"],
		);

		let page: string;
		try {
			page = await helpers.fetchPage(url);
		} catch (error) {
			throw new Error("[FETCH] " + error);
		}

		const $ = helpers.load(page);

		const title = $(".comic-info .info .name").text();
		const description = $("#noidungm").text();

		const getMeta = (label: string): string | undefined => {
			let value: string | undefined;
			$(".meta-data span.font-weight-bold").each((_, el) => {
				if ($(el).text().trim().toLowerCase().startsWith(label)) {
					value = $(el).closest(".col-12").find("a").last().text().trim();
					return false;
				}
			});
			return value;
		};

		const stat = getMeta("stato")?.toLowerCase();
		const author = getMeta("autore");

		const isVolume = $(".chapters-wrapper .volume-element").length > 0;

		const coverOrig = $(".thumb img").attr()!["src"];
		const purl = parseURL(coverOrig);
		purl.search = "";
		const cover = stringifyParsedURL(purl);

		let content: MangaVolumeEntry[] | MangaChapterEntry[];

		if (isVolume) {
			const volumes: MangaVolumeEntry[] = [];

			$(".chapters-wrapper .volume-element").each((_, volumeEl) => {
				const $volume = $(volumeEl);

				const name = $volume.find(".volume-name").first().text().trim();
				const index = Number(name.toLowerCase().replace("volume", "").trim());

				const chapters = $volume
					.find(".volume-chapters .chapter")
					.toArray()
					.map((chapterEl) => {
						const $chapter = $(chapterEl);

						const chapName = $chapter
							.find("span.d-inline-block")
							.first()
							.text()
							.trim();
						const chapIndex = Number(
							chapName.toLowerCase().replace("capitolo", "").trim(),
						);

						const date = dayjs(
							$chapter.find(".chap-date").first().text().trim().toLowerCase(),
							"DD MMMM YYYY",
							"it",
						).format("YYYY-MM-DD");

						const href = $chapter.find("a.chap").first().attr("href") ?? "";
						const id =
							href
								.split("/")
								.filter(Boolean)
								.pop()
								?.replace("?style=list", "") ?? "";

						return { name: chapName, index: chapIndex, date, id };
					})
					.sort((a, b) => a.index - b.index); // Sorted chapters ascending

				volumes.push({ name, index, chapters });
			});

			content = volumes.sort((a, b) => a.index - b.index); // Sorted volumes ascending
		} else {
			content = [];
		}

		const result: MangaDetails = {
			title,
			url,
			description,
			status:
				stat !== undefined
					? (statusChart[stat] ?? MediaStatus.UNKNOWN)
					: MediaStatus.UNKNOWN,
			genre: isVolume ? MangaGenre.VOLUMES : MangaGenre.CHAPTERS,
			cover,
		};

		if (author) result.authors = [author];

		if (content) result.content = content;

		return result;
	},
	async getChapter(
		queries: Record<string, string>,
		helpers: ExtensionHelpers,
	): Promise<MangaChapterEntry> {
		const url = joinURL(
			helpers.host,
			"/manga/",
			queries["manga_id"],
			"/",
			queries["manga_slur"],
			"/read/",
			queries["chap_id"],
		);

		let page: string;
		try {
			page = await helpers.fetchPage(url);
		} catch (error) {
			throw new Error("[FETCH] " + error);
		}

		let $ = helpers.load(page);

		const readingModeText = $(".top select.mode option[selected]")
			.first()
			.attr("value")
			?.toLowerCase();

		let readingMode = MangaReadingMode.UNKNOWN;

		if (readingModeText == "list") readingMode = MangaReadingMode.STRIP;
		if (readingModeText == "pages") readingMode = MangaReadingMode.PAGED;

		const pageSelectText = $(".top select.page option").first().text();
		const pageSelectSplit = pageSelectText.split("/");
		const pageCount = Number(pageSelectSplit[1]);

		const chapterSelectTextIndex = $(".top select.chapter option[selected]")
			.first()
			.text();
		const index = Number(
			chapterSelectTextIndex.toLowerCase().replace("capitolo", "").trim(),
		);
		const chapterCount = $(".top select.chapter option").length;

		const prevChapter = $(".top select.chapter option[selected]")
			.prev("option")
			.attr("value");
		const nextChapter = $(".top select.chapter option[selected]")
			.next("option")
			.attr("value");

		const volumeSelectTextIndex = $(".top select.volume option[selected]")
			.first()
			.text();
		const volumeIndex = Number(
			volumeSelectTextIndex.toLowerCase().replace("volume", "").trim(),
		);
		const volumeCount = $(".top select.volume option").length;

		const prevVolume = $(".top select.volume option[selected]")
			.prev("option")
			.attr("value");
		const nextVolume = $(".top select.volume option[selected]")
			.next("option")
			.attr("value");

		const images: string[] = [];

		if (readingMode != MangaReadingMode.STRIP) {
			const listUrl = joinURL(
				helpers.host,
				"/manga/",
				queries["manga_id"],
				"/",
				queries["manga_slur"],
				"/read/",
				queries["chap_id"],
				"/?style=list",
			);

			let listPage: string;
			try {
				listPage = await helpers.fetchPage(listUrl);
			} catch (error) {
				throw new Error("[FETCH] " + error);
			}

			$ = helpers.load(listPage);
		}

		$("#page .page-image").each((_i, image) => {
			images.push(image.attribs["src"]);
		});

		const result: MangaChapterInfo = {
			readingMode,
			pageCount,
			index,
			chapterCount,
			images,
			prevChapter,
			nextChapter,
			volumeCount,
			volumeIndex,
			nextVolume,
			prevVolume,
		};

		return result;
	},
};
