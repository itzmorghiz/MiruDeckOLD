import { CircularProgress } from "mdui";
import { MangaSearchEntry } from "../ext/types";
import { resultsDiv } from "../scripts/init";
import { setActiveTab } from "../scripts/tabs";
import { stringifyQuery } from "ufo";

export function search(query: string) {
	let sepNeed = false;

	Object.keys(Extensions).forEach((id) => {
		const ext = Extensions[id];

		if (sepNeed) {
			resultsDiv.innerHTML += `
					<mdui-divider></mdui-divider>
					`;
		}
		sepNeed = true;
		resultsDiv.innerHTML += `
					<div class="source-container" data-source="${ext.manifest.id}">
						<div class="source-result-top">
							<h4 class="source-result-name">${ext.manifest.name}</h4>
							<mdui-circular-progress class="source-loader"></mdui-circular-progress>
						</div>

						<div class="search-results"></div>
					</div>
				`;
	});

	Object.keys(Extensions).forEach(async (id) => {
		const ext = Extensions[id];

		const entries = await ExtManager.runExtension<MangaSearchEntry[]>(
			ext.code,
			"search",
			[query],
			ext.manifest.host,
		);

		const sourceTopDiv = resultsDiv.querySelector(
			`.source-container[data-source="${ext.manifest.id}"]`,
		) as HTMLDivElement;
		const sourceDiv = sourceTopDiv.querySelector(
			`.search-results`,
		) as HTMLDivElement;

		entries.forEach((entry) => {
			const slur = entry.slur ? ` data-slur="${entry.slur}"` : "";
			const id = entry.id ? ` data-id="${entry.id}"` : "";

			sourceDiv.innerHTML += /*html*/ `
						<mdui-card clickable class="result-entry"${slur + id}>
							<img class="cover" src="${entry.cover}" />
							<div class="info">
								<h5 class="title">${entry.title}</h5>
							</div>
						</mdui-card>
				`;

			const loader = sourceTopDiv.querySelector(
				".source-loader",
			) as CircularProgress;
			loader.setAttribute("hidden", "true");
		});

		const resultCards = [...sourceDiv.querySelectorAll(".result-entry")];

		resultCards.forEach((card) => {
			card.addEventListener("click", () => {
				const queries: Record<string, string | undefined> = {};

				const id = card.getAttribute("data-id");
				const slur = card.getAttribute("data-slur");

				if (id) queries["id"] = id;
				if (slur) queries["slur"] = slur;

				queries["source"] = ext.manifest.id;

				let qString = stringifyQuery(queries);

				setActiveTab("details", true, qString);
			});
		});
	});
}
