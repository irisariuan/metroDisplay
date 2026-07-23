import {
	createPrompt,
	isBackspaceKey,
	isDownKey,
	isEnterKey,
	isUpKey,
	type KeypressEvent,
	useEffect,
	usePrefix,
	useRef,
	useState,
} from "@inquirer/core";

export interface SearchableCheckboxChoice {
	name: string;
	value: string;
	/** Additional searchable metadata that is kept out of the visible label. */
	searchTerms?: readonly string[];
	checked?: boolean;
}

interface SearchableCheckboxConfig {
	message: string;
	choices: readonly SearchableCheckboxChoice[];
	pageSize?: number;
}

const normalized = (value: string) => value.normalize("NFKC").toLowerCase();

// Keep the picker legible in plain redirected output, while giving interactive
// terminals a small, consistent transit-inspired colour theme.
const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);
const paint = (code: number, value: string) =>
	useColor ? `\u001B[${code}m${value}\u001B[0m` : value;
const theme = {
	accent: (value: string) => paint(36, value),
	active: (value: string) => paint(1, paint(96, value)),
	chosen: (value: string) => paint(92, value),
	muted: (value: string) => paint(90, value),
	query: (value: string) => paint(93, value),
};

/**
 * A checkbox picker with an always-visible search field. Filtering never clears
 * an item already selected, so a user can search and select across many groups.
 */
export const searchableCheckbox = createPrompt<
	string[],
	SearchableCheckboxConfig
>((config, done) => {
	const [status, setStatus] = useState<"idle" | "done">("idle");
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const [selected, setSelected] = useState(
		new Set(
			config.choices.filter((choice) => choice.checked).map((choice) => choice.value),
		),
	);
	const prefix = usePrefix({ status });
	const filtered = config.choices.filter((choice) =>
		normalized(
			[choice.name, choice.value, ...(choice.searchTerms ?? [])].join(" "),
		).includes(normalized(query)),
	);
	const pageSize = config.pageSize ?? 12;
	const cursor = filtered.length ? Math.min(active, filtered.length - 1) : 0;

	const handleKeypress = useRef<(input: string, key?: Partial<KeypressEvent>) => void>();
	handleKeypress.current = (input, rawKey) => {
		// IME composition commits can omit `key.name`. The raw `input` argument
		// still contains the completed Japanese (or other Unicode) text.
		const key: KeypressEvent = {
			name: rawKey?.name ?? "",
			ctrl: rawKey?.ctrl ?? false,
			shift: rawKey?.shift ?? false,
		};
		if (isEnterKey(key)) {
			setStatus("done");
			done(config.choices.filter((choice) => selected.has(choice.value)).map((choice) => choice.value));
			return;
		}
		if (isUpKey(key) || isDownKey(key)) {
			if (!filtered.length) return;
			setActive(
				(active + (isUpKey(key) ? -1 : 1) + filtered.length) %
					filtered.length,
			);
			return;
		}
		if (key.name === "left" || key.name === "right") {
			const choice = filtered[cursor];
			if (!choice) return;
			const next = new Set(selected);
			if (key.name === "left") next.delete(choice.value);
			else next.add(choice.value);
			setSelected(next);
			return;
		}
		if (isBackspaceKey(key)) {
			setQuery(query.slice(0, -1));
			setActive(0);
			return;
		}
		const committedText =
			!key.ctrl && !/[\u0000-\u001f\u007f]/.test(input) ? input : "";
		if (committedText) {
			setQuery(query + committedText);
			setActive(0);
		}
	};
	useEffect((rl) => {
		const listener = (input: string, key?: Partial<KeypressEvent>) =>
			handleKeypress.current?.(input, key);
		rl.input.on("keypress", listener);
		return () => rl.input.removeListener("keypress", listener);
	}, []);

	if (status === "done") {
		const picked = config.choices
			.filter((choice) => selected.has(choice.value))
			.map((choice) => choice.name)
			.join(", ");
		return `${prefix} ${theme.accent(config.message)} ${picked}`;
	}

	const start = Math.max(
		0,
		Math.min(cursor - Math.floor(pageSize / 2), Math.max(0, filtered.length - pageSize)),
	);
	const items = filtered
		.slice(start, start + pageSize)
		.map((choice, index) => {
			const itemIndex = start + index;
			const focused = itemIndex === cursor;
			const pointer = focused ? theme.accent("❯") : " ";
			const mark = selected.has(choice.value)
				? theme.chosen("◉")
				: theme.muted("○");
			const name = focused ? theme.active(choice.name) : choice.name;
			return `  ${pointer} ${mark} ${name}`;
		})
		.join("\n");
	const results = filtered.length
		? `${filtered.length}/${config.choices.length} matches`
		: "no matches";
	return [
		`${prefix} ${theme.accent(config.message)}`,
		`  ${theme.muted("Search:")} ${theme.query(query || "…")}  ${theme.muted(`(${results})`)}`,
		items || "  No choices match the search.",
		theme.muted(
			"  Type to search · backspace clear · ↑/↓ move · ← clear · → select · enter confirm",
		),
	].join("\n");
});
