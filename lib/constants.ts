import marqueeContentData from "@/lib/data/marquee-content.json";
import type {
	AnnouncementContent,
	AnnouncementContentType,
} from "@/types/metro";

export const SPEED_PRESETS = { slow: 30, normal: 60, fast: 100 };

interface StoredMarqueePreset {
	id: string;
	label: string;
	items?: AnnouncementContent[];
	sourcePresetId?: string;
	includeTypes?: AnnouncementContentType[];
}

export interface MarqueeContentPreset {
	id: string;
	label: string;
	items: AnnouncementContent[];
}

const storedMarqueePresets =
	marqueeContentData.presets as StoredMarqueePreset[];

/** Resolve direct and filtered JSON presets into the shape used by the UI. */
export const MARQUEE_CONTENT_PRESETS: MarqueeContentPreset[] =
	storedMarqueePresets.map((preset) => {
		if (preset.items)
			return { id: preset.id, label: preset.label, items: preset.items };

		const source = storedMarqueePresets.find(
			(candidate) => candidate.id === preset.sourcePresetId,
		);
		if (!source?.items)
			throw new Error(
				`Marquee preset ${preset.id} has no readable source preset`,
			);
		const includeTypes = new Set(preset.includeTypes ?? []);
		return {
			id: preset.id,
			label: preset.label,
			items: source.items.filter((item) => includeTypes.has(item.type)),
		};
	});

const defaultMarqueePreset = MARQUEE_CONTENT_PRESETS.find(
	(preset) => preset.id === marqueeContentData.defaultPresetId,
);
if (!defaultMarqueePreset)
	throw new Error("The default marquee content preset does not exist");

export const DEFAULT_MARQUEE_CONTENT = defaultMarqueePreset.items;

export type MarqueeContentPresetId = string;
