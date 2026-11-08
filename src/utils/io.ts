/// <reference types="vite/client" />
import { decode, encode } from "@msgpack/msgpack";
import { isTauri } from "@tauri-apps/api/core";
import {
	BaseDirectory,
	exists,
	mkdir,
	readFile,
	writeFile,
} from "@tauri-apps/plugin-fs";
import { openDB } from "idb";
import JSZip from "jszip";

export async function extractCodeFromMdext(fileOrBlob: Blob): Promise<string> {
	const zip = new JSZip();
	const zipContent = await zip.loadAsync(fileOrBlob);
	let indexFile = zipContent.file("index.js");

	if (!indexFile) {
		const allFiles = Object.keys(zipContent.files);
		const foundPath = allFiles.find((path) => path.endsWith("index.js"));
		if (foundPath) {
			indexFile = zipContent.file(foundPath);
		}
	}

	if (!indexFile) {
		throw new Error(
			"Invalid .mdext file: 'index.js' not found inside the archive.",
		);
	}

	const codeString = await indexFile.async("text");
	return codeString;
}

export function getPublicPath(path: string): string {
	const cleanPath = path.startsWith("/") ? path.slice(1) : path;
	const base = import.meta.env.BASE_URL;

	if (base === "./") {
		return cleanPath;
	}

	if (base === "/") {
		return `/${cleanPath}`;
	}

	const normalizedBase = base.endsWith("/") ? base : `${base}/`;
	return `${normalizedBase}${cleanPath}`;
}

const dbPromise = openDB("app-storage", 1, {
	upgrade(db) {
		if (!db.objectStoreNames.contains("keyval")) {
			db.createObjectStore("keyval");
		}
	},
});

export async function setStorage(key: string, data: any): Promise<void> {
	const bytes = encode(data);

	if (isTauri()) {
		const fileName = `${key}.msgpack`;
		const lastSlash = fileName.lastIndexOf("/");
		const lastBackslash = fileName.lastIndexOf("\\");
		const lastIndex = Math.max(lastSlash, lastBackslash);

		if (lastIndex !== -1) {
			const dirPath = fileName.substring(0, lastIndex);
			await mkdir(dirPath, {
				baseDir: BaseDirectory.AppData,
				recursive: true,
			});
		}

		await writeFile(fileName, bytes, { baseDir: BaseDirectory.AppData });
	} else {
		const db = await dbPromise;
		await db.put("keyval", bytes, key);
	}
}

export async function getStorage(key: string): Promise<any | undefined> {
	if (isTauri()) {
		try {
			const fileName = `${key}.msgpack`;
			const fileExists = await exists(fileName, {
				baseDir: BaseDirectory.AppData,
			});
			if (!fileExists) return undefined;

			const bytes = await readFile(fileName, {
				baseDir: BaseDirectory.AppData,
			});
			return decode(bytes);
		} catch (e) {
			console.warn("Tauri binary FS read failed:", e);
			return undefined;
		}
	} else {
		try {
			const db = await dbPromise;
			const bytes = await db.get("keyval", key);
			return bytes ? decode(bytes) : undefined;
		} catch (e) {
			console.warn("IndexedDB binary read failed:", e);
			return undefined;
		}
	}
}
