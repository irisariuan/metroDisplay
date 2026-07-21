"use client";

import React from "react";

interface ManifestClip {
	url: string;
}

interface AnnouncementManifest {
	clips: Record<string, ManifestClip>;
}

export interface AnnouncementAudioHandle {
	playKeys: (keys: string[]) => Promise<void>;
	stop: () => void;
}

export interface AutoAudioSequence {
	id: string;
	keys: string[];
	priority?: boolean;
	onPlaybackChange?: (playing: boolean) => void;
}

interface AnnouncementAudioProps {
	autoSequences: AutoAudioSequence[];
	overrides: Record<string, string>;
	volume: number;
	/** Reports which clip keys the manifest resolved, once it loads. */
	onClipKeysChange?: (keys: string[]) => void;
	/** Reports the clip playing now and everything still waiting behind it. */
	onQueueChange?: (queue: AnnouncementQueue) => void;
}

export interface AnnouncementQueue {
	current: string | null;
	pending: string[];
}

/** How many past auto sequences stay deduplicated before the oldest is dropped. */
const PLAYED_HISTORY_LIMIT = 64;

interface PendingSequence {
	keys: string[];
	onPlaybackChange?: (playing: boolean) => void;
}

/** Keys drop out of the queue when neither an upload nor the manifest resolves them. */
const playableKeys = (
	keys: string[],
	overrides: Record<string, string>,
	manifest: AnnouncementManifest,
) =>
	keys
		.map((key) => ({
			key,
			url: overrides[key] ?? manifest.clips[key]?.url,
		}))
		.filter((clip): clip is { key: string; url: string } => Boolean(clip.url));

/** Resolves generated/uploaded clips and plays each announcement as one queue. */
export const AnnouncementAudio = React.forwardRef<
	AnnouncementAudioHandle,
	AnnouncementAudioProps
>(function AnnouncementAudio(
	{
		autoSequences,
		overrides,
		volume,
		onClipKeysChange,
		onQueueChange,
	},
	ref,
) {
	const audioRef = React.useRef<HTMLAudioElement>(null);
	const [manifest, setManifest] = React.useState<AnnouncementManifest | null>(null);
	const pendingSequences = React.useRef<PendingSequence[]>([]);
	const queueGeneration = React.useRef(0);
	const activeGeneration = React.useRef<number | null>(null);
	const finishCurrentClip = React.useRef<(() => void) | null>(null);
	// Insertion-ordered history of auto sequences already played. Kept as a
	// bounded backlog rather than pruned to the currently active ids, so an id
	// that briefly leaves `autoSequences` and returns is never played twice.
	const playedAutoSequenceIds = React.useRef(new Set<string>());
	// Remaining keys of the sequence being drained; index 0 is the audible clip.
	const activeClipKeys = React.useRef<string[]>([]);
	// Warmed clips, keyed by URL, so a clip about to play is already in the
	// browser cache and starts without a network round-trip. Kept in a ref so
	// the elements survive re-renders and are not garbage collected.
	const preloadedClips = React.useRef(new Map<string, HTMLAudioElement>());
	// Held in refs so publishing the queue never re-creates the drain loop.
	const queueListener = React.useRef(onQueueChange);
	const clipResolver = React.useRef({ manifest, overrides });
	queueListener.current = onQueueChange;
	clipResolver.current = { manifest, overrides };

	// Warm the browser cache for the given keys so playback is instant. Each
	// unique URL is fetched once via a detached <audio preload="auto">.
	const preloadKeys = React.useCallback((keys: string[]) => {
		if (typeof Audio === "undefined") return;
		const { manifest: current, overrides: currentOverrides } =
			clipResolver.current;
		for (const key of keys) {
			const url = currentOverrides[key] ?? current?.clips[key]?.url;
			if (!url || preloadedClips.current.has(url)) continue;
			const clip = new Audio();
			clip.preload = "auto";
			clip.src = url;
			preloadedClips.current.set(url, clip);
		}
	}, []);

	const publishQueue = React.useCallback(() => {
		const listener = queueListener.current;
		if (!listener) return;
		const { manifest: current, overrides: currentOverrides } =
			clipResolver.current;
		const [playing = null, ...rest] = activeClipKeys.current;
		const queued = current
			? pendingSequences.current.flatMap((sequence) =>
					playableKeys(sequence.keys, currentOverrides, current).map(
						(clip) => clip.key,
					),
				)
			: pendingSequences.current.flatMap((sequence) => sequence.keys);
		listener({ current: playing, pending: [...rest, ...queued] });
	}, []);

	React.useEffect(() => {
		let active = true;
		void fetch("/audio/manifest.json")
			.then((response) => {
				if (!response.ok) throw new Error("Announcement manifest unavailable");
				return response.json() as Promise<AnnouncementManifest>;
			})
			.then((nextManifest) => {
				if (active) setManifest(nextManifest);
			})
			.catch(() => {
				if (active) setManifest({ clips: {} });
			});
		return () => {
			active = false;
		};
	}, []);

	const drainQueue = React.useCallback(
		async (generation: number) => {
			const audio = audioRef.current;
			if (!audio || !manifest || activeGeneration.current === generation)
				return;
			activeGeneration.current = generation;

			while (
				generation === queueGeneration.current &&
				pendingSequences.current.length
			) {
				const pending = pendingSequences.current.shift();
				if (!pending) continue;
				const { keys, onPlaybackChange } = pending;
				const clips = playableKeys(keys, overrides, manifest);
				if (clips.length) onPlaybackChange?.(true);
				activeClipKeys.current = clips.map((clip) => clip.key);
				for (const { url } of clips) {
					if (generation !== queueGeneration.current) break;
					publishQueue();
					audio.src = url;
					audio.currentTime = 0;
					await new Promise<void>((resolve) => {
						let finished = false;
						const finish = () => {
							if (finished) return;
							finished = true;
							audio.removeEventListener("ended", finish);
							audio.removeEventListener("error", finish);
							if (finishCurrentClip.current === finish)
								finishCurrentClip.current = null;
							resolve();
						};
						finishCurrentClip.current = finish;
						audio.addEventListener("ended", finish, { once: true });
						audio.addEventListener("error", finish, { once: true });
						void audio.play().catch(finish);
					});
					activeClipKeys.current = activeClipKeys.current.slice(1);
				}
				activeClipKeys.current = [];
				onPlaybackChange?.(false);
				publishQueue();
			}
			if (activeGeneration.current === generation)
				activeGeneration.current = null;
		},
		[manifest, overrides, publishQueue],
	);

	const enqueueKeys = React.useCallback(
		(keys: string[], onPlaybackChange?: (playing: boolean) => void) => {
			if (!manifest || !keys.length) return;
			preloadKeys(keys);
			pendingSequences.current.push({ keys, onPlaybackChange });
			publishQueue();
			void drainQueue(queueGeneration.current);
		},
		[drainQueue, manifest, preloadKeys, publishQueue],
	);

	// User-triggered playback always takes control immediately.
	const playKeys = React.useCallback(
		async (keys: string[]) => {
			if (!manifest || !keys.length) return;
			preloadKeys(keys);
			const generation = ++queueGeneration.current;
			pendingSequences.current = [{ keys }];
			activeClipKeys.current = [];
			publishQueue();
			audioRef.current?.pause();
			finishCurrentClip.current?.();
			await drainQueue(generation);
		},
		[drainQueue, manifest, preloadKeys, publishQueue],
	);

	const stop = React.useCallback(() => {
		queueGeneration.current += 1;
		pendingSequences.current = [];
		activeClipKeys.current = [];
		audioRef.current?.pause();
		finishCurrentClip.current?.();
		publishQueue();
	}, [publishQueue]);

	React.useImperativeHandle(ref, () => ({ playKeys, stop }), [playKeys, stop]);

	React.useEffect(() => {
		if (!manifest) return;
		for (const entry of autoSequences) {
			if (playedAutoSequenceIds.current.has(entry.id)) continue;
			playedAutoSequenceIds.current.add(entry.id);
			while (playedAutoSequenceIds.current.size > PLAYED_HISTORY_LIMIT) {
				const oldest = playedAutoSequenceIds.current
					.values()
					.next().value;
				if (oldest === undefined) break;
				playedAutoSequenceIds.current.delete(oldest);
			}
			if (entry.priority) {
				entry.onPlaybackChange?.(true);
				void playKeys(entry.keys).finally(() =>
					entry.onPlaybackChange?.(false),
				);
			} else enqueueKeys(entry.keys, entry.onPlaybackChange);
		}
	}, [autoSequences, enqueueKeys, manifest, playKeys]);

	React.useEffect(() => {
		if (manifest) onClipKeysChange?.(Object.keys(manifest.clips));
	}, [manifest, onClipKeysChange]);

	// Framework clips are the connective phrases every announcement leans on, so
	// warm them all as soon as the manifest resolves.
	React.useEffect(() => {
		if (!manifest) return;
		preloadKeys(
			Object.keys(manifest.clips).filter((key) =>
				key.startsWith("framework."),
			),
		);
	}, [manifest, preloadKeys]);

	// Auto sequences are the announcements about to fire; warm their station and
	// line clips ahead of playback so nothing stalls mid-sentence.
	React.useEffect(() => {
		if (!manifest) return;
		preloadKeys(autoSequences.flatMap((sequence) => sequence.keys));
	}, [autoSequences, manifest, preloadKeys]);

	React.useEffect(() => {
		if (audioRef.current)
			audioRef.current.volume = Math.min(1, Math.max(0, volume));
	}, [volume]);

	return <audio ref={audioRef} preload="auto" />;
});
