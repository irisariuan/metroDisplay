import { readFileSync, readdirSync, unlinkSync } from "fs";

const manifest: { clips: Record<string, { url: string }> } = JSON.parse(
	readFileSync(`${process.cwd()}/public/audio/announcements/manifest.json`, "utf-8"),
);
const files = readdirSync(`${process.cwd()}/public/audio/announcements/clips`);
const manifestFiles = Object.values(manifest.clips).map(
	(clip) => clip.url.split("/").pop() ?? "",
);
console.log(manifestFiles)
const filesToDelete = files.filter((file) => !manifestFiles.includes(file) && !file.startsWith('.'));

filesToDelete.forEach((file) => {
	console.log(`Deleting ${file}`);
	try {
		unlinkSync(`${process.cwd()}/public/audio/announcements/clips/${file}`);
	} catch (err) {
		console.error(`Error deleting ${file}:`, err);
	}
});
