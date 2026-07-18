import type { MarqueeItem } from "@/types/metro";

export const SPEED_PRESETS = { slow: 30, normal: 60, fast: 100 };

export const DEFAULT_MARQUEE_CONTENT: MarqueeItem[] = [
	{
		type: "ad",
		en: "Discover the Shuika Metro Museum at Arakawa Park.",
		ja: "荒川公園の水下メトロ博物館へぜひお越しください。",
	},
	{
		type: "ad",
		en: "Plan your trip and save favourites in the Shuika Metro app.",
		ja: "水下メトロアプリで経路検索とよく使う駅の登録ができます。",
	},
	{
		type: "notice",
		en: "Please keep backpacks in front of you when the train is crowded.",
		ja: "車内混雑時は、リュックを前にお持ちください。",
	},
	{
		type: "notice",
		en: "Priority seats are available for passengers who need them.",
		ja: "優先席を必要とされるお客さまにお譲りください。",
	},
	{
		type: "notice",
		en: "For service updates, please check the Shuika Metro website or app.",
		ja: "運行情報は水下メトロのウェブサイトまたはアプリでご確認ください。",
	},
];
