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

interface AnnouncementAudioProps {
	autoEnabled: boolean;
	sequence: string[];
	overrides: Record<string, string>;
	volume: number;
	statusKey: string;
	language: "ja" | "en";
	onAutoPlaybackChange?: (playing: boolean) => void;
}

interface PendingSequence {
	keys: string[];
	onPlaybackChange?: (playing: boolean) => void;
}

/** Resolves generated/uploaded clips and plays each announcement as one queue. */
export const AnnouncementAudio = React.forwardRef<
	AnnouncementAudioHandle,
	AnnouncementAudioProps
>(function AnnouncementAudio(
	{
		autoEnabled,
		sequence,
		overrides,
		volume,
		statusKey,
		language,
		onAutoPlaybackChange,
	},
	ref,
) {
	const audioRef = React.useRef<HTMLAudioElement>(null);
	const [manifest, setManifest] = React.useState<AnnouncementManifest | null>(null);
	const pendingSequences = React.useRef<PendingSequence[]>([]);
	const queueGeneration = React.useRef(0);
	const activeGeneration = React.useRef<number | null>(null);
	const finishCurrentClip = React.useRef<(() => void) | null>(null);
	const playedForStatus = React.useRef({
		statusKey: "",
		languages: new Set<string>(),
	});

	React.useEffect(() => {
		let active = true;
		void fetch("/audio/announcements/manifest.json")
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
				const urls = keys
					.map((key) => overrides[key] ?? manifest.clips[key]?.url)
					.filter((url): url is string => Boolean(url));
				if (urls.length) onPlaybackChange?.(true);
				for (const url of urls) {
					if (generation !== queueGeneration.current) break;
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
				}
				onPlaybackChange?.(false);
			}
			if (activeGeneration.current === generation)
				activeGeneration.current = null;
		},
		[manifest, overrides],
	);

	const enqueueKeys = React.useCallback(
		(keys: string[], onPlaybackChange?: (playing: boolean) => void) => {
			if (!manifest || !keys.length) return;
			pendingSequences.current.push({ keys, onPlaybackChange });
			void drainQueue(queueGeneration.current);
		},
		[drainQueue, manifest],
	);

	// User-triggered playback always takes control immediately.
	const playKeys = React.useCallback(
		async (keys: string[]) => {
			if (!manifest || !keys.length) return;
			const generation = ++queueGeneration.current;
			pendingSequences.current = [{ keys }];
			audioRef.current?.pause();
			finishCurrentClip.current?.();
			await drainQueue(generation);
		},
		[drainQueue, manifest],
	);

	const stop = React.useCallback(() => {
		queueGeneration.current += 1;
		pendingSequences.current = [];
		audioRef.current?.pause();
		finishCurrentClip.current?.();
	}, []);

	React.useImperativeHandle(ref, () => ({ playKeys, stop }), [playKeys, stop]);

	React.useEffect(() => {
		if (playedForStatus.current.statusKey !== statusKey) {
			playedForStatus.current = {
				statusKey,
				languages: new Set<string>(),
			};
		}
		if (
			!manifest ||
			!autoEnabled ||
			playedForStatus.current.languages.has(language)
		)
			return;
		playedForStatus.current.languages.add(language);
		enqueueKeys(sequence, onAutoPlaybackChange);
	}, [
		autoEnabled,
		enqueueKeys,
		language,
		manifest,
		onAutoPlaybackChange,
		sequence,
		statusKey,
	]);

	React.useEffect(() => {
		if (audioRef.current)
			audioRef.current.volume = Math.min(1, Math.max(0, volume));
	}, [volume]);

	return <audio ref={audioRef} preload="auto" />;
});
