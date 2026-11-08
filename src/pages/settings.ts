import { getStorage, setStorage } from "../utils/io";

const pageName = "settings";

const content = document.getElementById(pageName + "-content")!;

enum SettingType {
	SWITCH,
}

const settings: Record<
	string,
	{
		name: string;
		contents: Record<string, { name: string; type: SettingType; default: any }>;
	}
> = {
	reader: {
		name: "Reader",
		contents: {
			rtl: {
				name: "Manga mode (RTL)",
				type: SettingType.SWITCH,
				default: true,
			},
		},
	},
};

renderSettings();

export async function renderSettings() {
	const savedSettings = (await getStorage("settings")) || {};

	let html = "";

	for (const [groupId, group] of Object.entries(settings)) {
		html += `<div class="settings-group" data-id="${groupId}">`;
		html += `<div class="settings-group-name">${group.name}</div>`;

		for (const [settingId, setting] of Object.entries(group.contents)) {
			const groupSaved = savedSettings[groupId] || {};
			const isChecked =
				groupSaved[settingId] !== undefined
					? groupSaved[settingId]
					: setting.default;

			if (setting.type === SettingType.SWITCH) {
				html += `
                    <mdui-card class="settings-entry" data-id="${settingId}">
                        <p class="setting-name">${setting.name}</p>
                        <mdui-switch class="setting-element" ${isChecked ? "checked" : ""}></mdui-switch>
                    </mdui-card>
                `;
			}
		}

		html += `</div>`;
	}

	content.innerHTML = html;

	const switches = content.querySelectorAll("mdui-switch");
	switches.forEach((switchEl) => {
		switchEl.addEventListener("change", async (e: Event) => {
			const entryEl = (e.target as HTMLElement).closest(".settings-entry");
			const groupEl = (e.target as HTMLElement).closest(".settings-group");

			if (!entryEl || !groupEl) return;

			const groupId = groupEl.getAttribute("data-id")!;
			const settingId = entryEl.getAttribute("data-id")!;
			const isChecked = (e.target as any).checked;

			const currentSettings = (await getStorage("settings")) || {};
			if (!currentSettings[groupId]) {
				currentSettings[groupId] = {};
			}
			currentSettings[groupId][settingId] = isChecked;

			await setStorage("settings", currentSettings);
		});
	});
}
