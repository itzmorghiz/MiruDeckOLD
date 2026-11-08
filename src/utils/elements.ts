import { setActiveTab } from "../scripts/tabs";

export function getMDUIIcon(
	name: string,
	classes: string = "",
	slot: "end" | boolean = false,
) {
	return `<mdui-icon name="${name}" class="${classes}"${slot ? "slot='" + (slot == "end" ? "end-icon" : "icon") + "'" : ""}></mdui-icon>`;
}

export function getMDUISlot(
	tag: string,
	slot: string,
	content: string,
	classes: string = "",
) {
	return `<${tag} slot="${slot}" class="${classes}">${content}</${tag}>`;
}

export async function listenForCollapse(
	root: HTMLElement | HTMLDocument = document,
) {
	const collapseArrows = [...root.getElementsByClassName("collapse-arrow")];
	collapseArrows.forEach((arrow) => {
		const collapse = arrow.closest("mdui-collapse-item")!;

		collapse.addEventListener("open", () => {
			collapse.setAttribute("open", "true");
		});
		collapse.addEventListener("close", () => {
			collapse.removeAttribute("open");
		});
	});
}

export async function listenForTabLink(
	root: HTMLElement | HTMLDocument = document,
) {
	const elements = [...root.getElementsByClassName("tab-link")];
	elements.forEach((elem) => {
		elem.addEventListener("click", () => {
			setActiveTab(elem.getAttribute("data-page")!);
		});
	});
}
