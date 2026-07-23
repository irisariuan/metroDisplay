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

/** Preload resilience: a transient failure to fetch the manifest or decode a
 * clip shouldn't silently disable audio for the rest of the session. */
const MANIFEST_MAX_ATTEMPTS = 5;
const PRELOAD_MAX_ATTEMPTS = 3;
const PRELOAD_RETRY_MS = 1500;
/** Lead time before the first clip of a sequence sounds, so every clip's start
 * is scheduled on the audio clock before playback begins (keeps it gapless). */
const SCHEDULE_LEAD_S = 0.06;

interface DecodeEntry {
	buffer: AudioBuffer | null;
	attempts: number;
	/** In-flight decode, shared by concurrent callers; null once settled. */
	promise: Promise<AudioBuffer | null> | null;
}

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
	const [manifest, setManifest] = React.useState<AnnouncementManifest | null>(null);
	const pendingSequences = React.useRef<PendingSequence[]>([]);
	const queueGeneration = React.useRef(0);
	const activeGeneration = React.useRef<number | null>(null);
	// Interrupts whatever is sounding now (used by stop() and playKeys()).
	const finishCurrentClip = React.useRef<(() => void) | null>(null);
	// Insertion-ordered history of auto sequences already played. Kept as a
	// bounded backlog rather than pruned to the currently active ids, so an id
	// that briefly leaves `autoSequences` and returns is never played twice.
	const playedAutoSequenceIds = React.useRef(new Set<string>());
	// Remaining keys of the sequence being drained; index 0 is the audible clip.
	const activeClipKeys = React.useRef<string[]>([]);
	// Web Audio graph: one shared context + a gain node carrying volume. Created
	// lazily on the client at first use, so there is nothing to build during SSR.
	const audioCtxRef = React.useRef<AudioContext | null>(null);
	const gainRef = React.useRef<GainNode | null>(null);
	const volumeRef = React.useRef(volume);
	// Decoded PCM buffers keyed by URL, so a clip about to play is already in
	// memory and starts sample-accurately — no fetch, no decode. Kept in a ref so
	// the buffers survive re-renders and are not garbage collected.
	const buffersRef = React.useRef(new Map<string, DecodeEntry>());
	// Held in refs so publishing the queue never re-creates the drain loop.
	const queueListener = React.useRef(onQueueChange);
	const clipResolver = React.useRef({ manifest, overrides });
	queueListener.current = onQueueChange;
	clipResolver.current = { manifest, overrides };

	const ensureContext = React.useCallback((): AudioContext | null => {
		if (typeof window === "undefined") return null;
		if (!audioCtxRef.current) {
			const Ctor =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext?: typeof AudioContext })
					.webkitAudioContext;
			if (!Ctor) return null;
			const ctx = new Ctor();
			const gain = ctx.createGain();
			gain.gain.value = Math.min(1, Math.max(0, volumeRef.current));
			gain.connect(ctx.destination);
			audioCtxRef.current = ctx;
			gainRef.current = gain;
		}
		return audioCtxRef.current;
	}, []);

	// Fetch + decode one clip URL into an in-memory AudioBuffer. Concurrent
	// callers share the in-flight decode; a failure retries in the background
	// (up to PRELOAD_MAX_ATTEMPTS) so a transient blip self-heals instead of
	// disabling that clip for the session. A caller awaiting a failed decode
	// gets null and simply skips the clip for now.
	const decodeUrl = React.useCallback(
		function decode(url: string): Promise<AudioBuffer | null> {
			const ctx = ensureContext();
			if (!ctx) return Promise.resolve(null);
			let entry = buffersRef.current.get(url);
			if (entry?.buffer) return Promise.resolve(entry.buffer);
			if (entry?.promise) return entry.promise;
			if (!entry) {
				entry = { buffer: null, attempts: 0, promise: null };
				buffersRef.current.set(url, entry);
			}
			if (entry.attempts >= PRELOAD_MAX_ATTEMPTS) return Promise.resolve(null);
			entry.attempts += 1;
			const attemptNo = entry.attempts;
			const settled = entry;
			const promise = fetch(url)
				.then((response) => {
					if (!response.ok) throw new Error("clip fetch failed");
					return response.arrayBuffer();
				})
				.then((raw) => ctx.decodeAudioData(raw))
				.then((decoded) => {
					settled.buffer = decoded;
					settled.promise = null;
					return decoded;
				})
				.catch(() => {
					settled.promise = null;
					if (attemptNo < PRELOAD_MAX_ATTEMPTS)
						setTimeout(() => {
							const current = buffersRef.current.get(url);
							if (current && !current.buffer) void decode(url);
						}, PRELOAD_RETRY_MS);
					return null;
				});
			entry.promise = promise;
			return promise;
		},
		[ensureContext],
	);

	// Decode every resolvable key into memory ahead of playback.
	const preloadKeys = React.useCallback(
		(keys: string[]) => {
			const { manifest: current, overrides: currentOverrides } =
				clipResolver.current;
			for (const key of keys) {
				const url = currentOverrides[key] ?? current?.clips[key]?.url;
				if (url) void decodeUrl(url);
			}
		},
		[decodeUrl],
	);

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
		let attempt = 0;
		let retryTimer: ReturnType<typeof setTimeout> | null = null;
		const load = () => {
			void fetch("/audio/manifest.json")
				.then((response) => {
					if (!response.ok)
						throw new Error("Announcement manifest unavailable");
					return response.json() as Promise<AnnouncementManifest>;
				})
				.then((nextManifest) => {
					if (active) setManifest(nextManifest);
				})
				.catch(() => {
					if (!active) return;
					attempt += 1;
					// Retry with backoff — a single failed fetch would otherwise
					// leave an empty manifest and disable audio for the whole
					// session. Give up gracefully only after several attempts.
					if (attempt < MANIFEST_MAX_ATTEMPTS)
						retryTimer = setTimeout(load, Math.min(8000, 500 * 2 ** attempt));
					else setManifest({ clips: {} });
				});
		};
		load();
		return () => {
			active = false;
			if (retryTimer) clearTimeout(retryTimer);
		};
	}, []);

	// Play one sequence's clips back-to-back on the audio clock so a multi-part
	// announcement (station name + number parts) has no seam between clips. All
	// buffers are decoded first, then every clip is scheduled ahead of time; the
	// returned promise resolves when the last clip ends or the sequence is
	// interrupted (stop()/playKeys() call finishCurrentClip).
	const playSequence = React.useCallback(
		async (
			clips: { key: string; url: string }[],
			generation: number,
		): Promise<void> => {
			const ctx = ensureContext();
			const gain = gainRef.current;
			if (!ctx || !gain) return;
			// A suspended context (no user gesture yet) can't play; try to resume
			// and, if it stays suspended, skip rather than hang forever.
			if (ctx.state === "suspended") {
				try {
					await ctx.resume();
				} catch {
					/* needs a user gesture; skip */
				}
			}
			if (ctx.state !== "running" || generation !== queueGeneration.current)
				return;
			const buffers = await Promise.all(
				clips.map((clip) => decodeUrl(clip.url)),
			);
			if (generation !== queueGeneration.current) return;
			const ready = clips
				.map((clip, index) => ({ key: clip.key, buffer: buffers[index] }))
				.filter(
					(clip): clip is { key: string; buffer: AudioBuffer } =>
						clip.buffer !== null,
				);
			if (!ready.length) return;
			activeClipKeys.current = ready.map((clip) => clip.key);
			publishQueue();
			const sources: AudioBufferSourceNode[] = [];
			await new Promise<void>((resolve) => {
				let done = false;
				const finish = () => {
					if (done) return;
					done = true;
					for (const source of sources) {
						source.onended = null;
						try {
							source.stop();
						} catch {
							/* already stopped */
						}
						source.disconnect();
					}
					if (finishCurrentClip.current === finish)
						finishCurrentClip.current = null;
					resolve();
				};
				finishCurrentClip.current = finish;
				let when = ctx.currentTime + SCHEDULE_LEAD_S;
				ready.forEach((clip, index) => {
					const source = ctx.createBufferSource();
					source.buffer = clip.buffer;
					source.connect(gain);
					source.onended = () => {
						if (done) return;
						// This clip left the "now playing" slot; the next is
						// already sounding thanks to the ahead-of-time schedule.
						activeClipKeys.current = activeClipKeys.current.slice(1);
						publishQueue();
						if (index === ready.length - 1) finish();
					};
					source.start(when);
					when += clip.buffer.duration;
					sources.push(source);
				});
			});
		},
		[decodeUrl, ensureContext, publishQueue],
	);

	const drainQueue = React.useCallback(
		async (generation: number) => {
			if (!manifest || activeGeneration.current === generation) return;
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
				await playSequence(clips, generation);
				activeClipKeys.current = [];
				onPlaybackChange?.(false);
				publishQueue();
			}
			if (activeGeneration.current === generation)
				activeGeneration.current = null;
		},
		[manifest, overrides, playSequence, publishQueue],
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
			finishCurrentClip.current?.();
			await drainQueue(generation);
		},
		[drainQueue, manifest, preloadKeys, publishQueue],
	);

	const stop = React.useCallback(() => {
		queueGeneration.current += 1;
		pendingSequences.current = [];
		activeClipKeys.current = [];
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
		volumeRef.current = volume;
		if (gainRef.current)
			gainRef.current.gain.value = Math.min(1, Math.max(0, volume));
	}, [volume]);

	// Browsers start an AudioContext suspended until a user gesture. Resume on
	// the first interaction (and any later one, in case the OS re-suspends it)
	// so announcements can sound.
	React.useEffect(() => {
		const unlock = () => {
			const ctx = audioCtxRef.current;
			if (ctx && ctx.state === "suspended") void ctx.resume();
		};
		const options: AddEventListenerOptions = { passive: true };
		window.addEventListener("pointerdown", unlock, options);
		window.addEventListener("keydown", unlock, options);
		window.addEventListener("touchstart", unlock, options);
		return () => {
			window.removeEventListener("pointerdown", unlock);
			window.removeEventListener("keydown", unlock);
			window.removeEventListener("touchstart", unlock);
		};
	}, []);

	// Release the audio context when this surface unmounts.
	React.useEffect(
		() => () => {
			void audioCtxRef.current?.close();
			audioCtxRef.current = null;
			gainRef.current = null;
		},
		[],
	);

	// Nothing to render: playback is driven entirely through the Web Audio graph.
	return null;
});
