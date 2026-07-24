"use client";

import React from "react";
import { announcementQueueLabel } from "@/lib/announcementAudio";

interface ManifestClip {
	url: string;
	text?: string;
	lang?: string;
	category?: string;
}

interface AnnouncementManifest {
	clips: Record<string, ManifestClip>;
}

/** Where a queued sequence came from: a manual control press or the journey. */
export type AnnouncementSource = "user" | "auto";

export interface PlayKeysOptions {
	/** Human-readable name shown for this announcement in the queue. */
	label?: string;
	/** Notified as this sequence starts (true) and finishes/aborts (false). */
	onPlaybackChange?: (playing: boolean) => void;
}

export interface AnnouncementAudioHandle {
	playKeys: (keys: string[], opts?: PlayKeysOptions) => Promise<void>;
	/** Move a pending sequence to a new slot in the queue (drag reorder). */
	moveSequence: (id: string, toIndex: number) => void;
	/** Remove one pending sequence without interrupting the active one. */
	removeSequence: (id: string) => void;
	/** Move a pending clip, including an upcoming clip in the active sequence. */
	moveClip: (sequenceId: string, fromIndex: number, toIndex: number) => void;
	/** Remove a pending clip, including an upcoming clip in the active sequence. */
	removeClip: (sequenceId: string, clipIndex: number) => void;
	stop: () => void;
}

export interface AutoAudioSequence {
	id: string;
	keys: string[];
	priority?: boolean;
	label?: string;
	onPlaybackChange?: (playing: boolean) => void;
}

interface AnnouncementAudioProps {
	autoSequences: AutoAudioSequence[];
	overrides: Record<string, string>;
	volume: number;
	/** When false, automatic announcements never cut off user-triggered audio;
	 * they wait behind it in the queue instead. */
	autoInterrupts: boolean;
	/** Reports which clip keys the manifest resolved, once it loads. */
	onClipKeysChange?: (keys: string[]) => void;
	/** Reports the announcement playing now and everything still queued behind it. */
	onQueueChange?: (queue: AnnouncementQueue) => void;
}

/** One whole announcement in the queue — the reorderable unit shown in the UI. */
export interface AnnouncementQueueItem {
	id: string;
	label: string;
	source: AnnouncementSource;
	/** How many of its clips actually resolved to a playable URL. */
	clipCount: number;
	clips: AnnouncementQueueClip[];
}

export interface AnnouncementQueueClip {
	/** Position in the underlying sequence, including unavailable clips. */
	index: number;
	key: string;
	label: string;
	lang?: string;
	category?: string;
	playable: boolean;
	state: "played" | "playing" | "upcoming";
	/** Active playback locks completed/current clips; future clips stay editable. */
	editable: boolean;
}

export interface AnnouncementQueue {
	current: AnnouncementQueueItem | null;
	pending: AnnouncementQueueItem[];
}

/** How many past auto sequences stay deduplicated before the oldest is dropped. */
const PLAYED_HISTORY_LIMIT = 64;

/** Preload resilience: a transient failure to fetch the manifest or decode a
 * clip shouldn't silently disable audio for the rest of the session. */
const MANIFEST_MAX_ATTEMPTS = 5;
const PRELOAD_MAX_ATTEMPTS = 3;
const PRELOAD_RETRY_MS = 1500;
interface DecodeEntry {
	buffer: AudioBuffer | null;
	attempts: number;
	/** In-flight decode, shared by concurrent callers; null once settled. */
	promise: Promise<AudioBuffer | null> | null;
}

interface QueuedSequence {
	id: string;
	keys: string[];
	source: AnnouncementSource;
	label: string;
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
		autoInterrupts,
		onClipKeysChange,
		onQueueChange,
	},
	ref,
) {
	const [manifest, setManifest] = React.useState<AnnouncementManifest | null>(null);
	const pendingSequences = React.useRef<QueuedSequence[]>([]);
	const queueGeneration = React.useRef(0);
	const activeGeneration = React.useRef<number | null>(null);
	// Interrupts whatever is sounding now (used by stop() and interruptWith()).
	const finishCurrentClip = React.useRef<(() => void) | null>(null);
	// The sequence draining right now, or null while the queue is idle. Held in a
	// ref so publishing the queue and computing "is user audio active" never
	// depends on a re-render.
	const activeSequence = React.useRef<QueuedSequence | null>(null);
	// Position sounding inside activeSequence. Past/current clips are locked;
	// later clips may be reordered or removed before the drain reaches them.
	const activeClipIndex = React.useRef<number | null>(null);
	// Monotonic id source for queued sequences (stable across reorders).
	const sequenceCounter = React.useRef(0);
	// Insertion-ordered history of auto sequences already played. Kept as a
	// bounded backlog rather than pruned to the currently active ids, so an id
	// that briefly leaves `autoSequences` and returns is never played twice.
	const playedAutoSequenceIds = React.useRef(new Set<string>());
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
	// Read at fire time so flipping the switch doesn't re-run the auto effect.
	const autoInterruptsRef = React.useRef(autoInterrupts);
	queueListener.current = onQueueChange;
	clipResolver.current = { manifest, overrides };
	autoInterruptsRef.current = autoInterrupts;

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
		const toItem = (
			sequence: QueuedSequence,
			isActive: boolean,
		): AnnouncementQueueItem => {
			const playingIndex = isActive ? activeClipIndex.current : null;
			const clips = sequence.keys.map((key, index) => {
				const manifestClip = current?.clips[key];
				const state: AnnouncementQueueClip["state"] =
					playingIndex === null || index > playingIndex
						? "upcoming"
						: index === playingIndex
							? "playing"
							: "played";
				return {
					index,
					key,
					label: manifestClip?.text?.trim() || key,
					lang: manifestClip?.lang,
					category: manifestClip?.category,
					playable: Boolean(currentOverrides[key] ?? manifestClip?.url),
					state,
					editable: !isActive || state === "upcoming",
				};
			});
			return {
				id: sequence.id,
				label: sequence.label,
				source: sequence.source,
				clipCount: current
					? clips.filter((clip) => clip.playable).length
					: sequence.keys.length,
				clips,
			};
		};
		const active = activeSequence.current;
		listener({
			current: active ? toItem(active, true) : null,
			pending: pendingSequences.current.map((sequence) =>
				toItem(sequence, false),
			),
		});
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

	// Drain one sequence clip by clip. Keeping only the sounding clip scheduled
	// lets the expanded editor safely reorder/remove every later clip while this
	// announcement is active. Buffers are still decoded up front, so advancing
	// between clips only creates the minimal Web Audio handoff delay.
	const playSequence = React.useCallback(
		async (
			sequence: QueuedSequence,
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
			const { manifest: current, overrides: currentOverrides } =
				clipResolver.current;
			if (!current) return;
			const initialClips = playableKeys(
				sequence.keys,
				currentOverrides,
				current,
			);
			await Promise.all(initialClips.map((clip) => decodeUrl(clip.url)));
			if (generation !== queueGeneration.current) return;

			let clipIndex = 0;
			while (
				generation === queueGeneration.current &&
				activeSequence.current === sequence &&
				clipIndex < sequence.keys.length
			) {
				activeClipIndex.current = clipIndex;
				publishQueue();
				const key = sequence.keys[clipIndex];
				const resolver = clipResolver.current;
				const url =
					resolver.overrides[key] ?? resolver.manifest?.clips[key]?.url;
				const buffer = url ? await decodeUrl(url) : null;
				if (
					buffer &&
					generation === queueGeneration.current &&
					activeSequence.current === sequence
				) {
					await new Promise<void>((resolve) => {
						const source = ctx.createBufferSource();
						let done = false;
						const finish = () => {
							if (done) return;
							done = true;
							source.onended = null;
							try {
								source.stop();
							} catch {
								/* already stopped */
							}
							source.disconnect();
							if (finishCurrentClip.current === finish)
								finishCurrentClip.current = null;
							resolve();
						};
						finishCurrentClip.current = finish;
						source.buffer = buffer;
						source.connect(gain);
						source.onended = finish;
						source.start();
					});
				}
				clipIndex += 1;
			}
			activeClipIndex.current = null;
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
				activeSequence.current = pending;
				activeClipIndex.current = null;
				publishQueue();
				const clips = playableKeys(pending.keys, overrides, manifest);
				if (clips.length) pending.onPlaybackChange?.(true);
				await playSequence(pending, generation);
				pending.onPlaybackChange?.(false);
				// Only clear if a newer interrupt hasn't already taken the slot,
				// so a stale drain can't blank out the sequence now playing.
				if (activeSequence.current === pending) {
					activeSequence.current = null;
					activeClipIndex.current = null;
					publishQueue();
				}
			}
			if (activeGeneration.current === generation)
				activeGeneration.current = null;
		},
		[manifest, overrides, playSequence, publishQueue],
	);

	const makeSequence = React.useCallback(
		(
			keys: string[],
			source: AnnouncementSource,
			opts?: PlayKeysOptions,
		): QueuedSequence => ({
			id: `seq-${(sequenceCounter.current += 1)}`,
			keys,
			source,
			label: opts?.label ?? announcementQueueLabel(keys),
			onPlaybackChange: opts?.onPlaybackChange,
		}),
		[],
	);

	// Append a sequence to the back of the queue; play it after whatever is ahead.
	const appendSequence = React.useCallback(
		(sequence: QueuedSequence) => {
			if (!manifest) return;
			preloadKeys(sequence.keys);
			pendingSequences.current.push(sequence);
			publishQueue();
			void drainQueue(queueGeneration.current);
		},
		[drainQueue, manifest, preloadKeys, publishQueue],
	);

	// Take over immediately: drop the queue, cut the current clip, play this now.
	const interruptWith = React.useCallback(
		async (sequence: QueuedSequence) => {
			if (!manifest) return;
			preloadKeys(sequence.keys);
			const generation = ++queueGeneration.current;
			pendingSequences.current = [sequence];
			activeSequence.current = null;
			activeClipIndex.current = null;
			publishQueue();
			finishCurrentClip.current?.();
			await drainQueue(generation);
		},
		[drainQueue, manifest, preloadKeys, publishQueue],
	);

	// True when a user-triggered announcement is playing or still waiting. New
	// user triggers then queue behind it; without this they would cut it off.
	const userAudioActive = React.useCallback(
		() =>
			activeSequence.current?.source === "user" ||
			pendingSequences.current.some((sequence) => sequence.source === "user"),
		[],
	);

	// User-triggered playback. It only takes over when nothing user-triggered is
	// already active; otherwise it joins the queue after the user's other items.
	const playKeys = React.useCallback(
		async (keys: string[], opts?: PlayKeysOptions) => {
			if (!manifest || !keys.length) return;
			const sequence = makeSequence(keys, "user", opts);
			if (userAudioActive()) appendSequence(sequence);
			else await interruptWith(sequence);
		},
		[appendSequence, interruptWith, makeSequence, manifest, userAudioActive],
	);

	const moveSequence = React.useCallback(
		(id: string, toIndex: number) => {
			const queue = pendingSequences.current;
			const from = queue.findIndex((sequence) => sequence.id === id);
			if (from === -1) return;
			const clamped = Math.max(0, Math.min(queue.length - 1, toIndex));
			if (clamped === from) return;
			const [moved] = queue.splice(from, 1);
			queue.splice(clamped, 0, moved);
			publishQueue();
		},
		[publishQueue],
	);

	const removeSequence = React.useCallback(
		(id: string) => {
			const nextQueue = pendingSequences.current.filter(
				(sequence) => sequence.id !== id,
			);
			if (nextQueue.length === pendingSequences.current.length) return;
			pendingSequences.current = nextQueue;
			publishQueue();
		},
		[publishQueue],
	);

	const moveClip = React.useCallback(
		(sequenceId: string, fromIndex: number, toIndex: number) => {
			let sequence = pendingSequences.current.find(
				(item) => item.id === sequenceId,
			);
			let firstEditableIndex = 0;
			if (!sequence && activeSequence.current?.id === sequenceId) {
				sequence = activeSequence.current;
				firstEditableIndex = (activeClipIndex.current ?? -1) + 1;
			}
			if (!sequence || fromIndex < 0 || fromIndex >= sequence.keys.length)
				return;
			if (fromIndex < firstEditableIndex || toIndex < firstEditableIndex)
				return;
			const clamped = Math.max(
				firstEditableIndex,
				Math.min(sequence.keys.length - 1, toIndex),
			);
			if (clamped === fromIndex) return;
			const [moved] = sequence.keys.splice(fromIndex, 1);
			sequence.keys.splice(clamped, 0, moved);
			preloadKeys(sequence.keys);
			publishQueue();
		},
		[preloadKeys, publishQueue],
	);

	const removeClip = React.useCallback(
		(sequenceId: string, clipIndex: number) => {
			const sequenceIndex = pendingSequences.current.findIndex(
				(item) => item.id === sequenceId,
			);
			const pending =
				sequenceIndex === -1
					? null
					: pendingSequences.current[sequenceIndex];
			const active =
				activeSequence.current?.id === sequenceId
					? activeSequence.current
					: null;
			const sequence = pending ?? active;
			if (!sequence) return;
			const firstEditableIndex = active
				? (activeClipIndex.current ?? -1) + 1
				: 0;
			if (clipIndex < firstEditableIndex) return;
			if (clipIndex < 0 || clipIndex >= sequence.keys.length) return;
			sequence.keys.splice(clipIndex, 1);
			if (pending && !sequence.keys.length)
				pendingSequences.current.splice(sequenceIndex, 1);
			publishQueue();
		},
		[publishQueue],
	);

	const stop = React.useCallback(() => {
		queueGeneration.current += 1;
		pendingSequences.current = [];
		activeSequence.current = null;
		activeClipIndex.current = null;
		finishCurrentClip.current?.();
		publishQueue();
	}, [publishQueue]);

	React.useImperativeHandle(
		ref,
		() => ({
			playKeys,
			moveSequence,
			removeSequence,
			moveClip,
			removeClip,
			stop,
		}),
		[playKeys, moveSequence, removeSequence, moveClip, removeClip, stop],
	);

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
			const sequence = makeSequence(entry.keys, "auto", {
				label: entry.label,
				onPlaybackChange: entry.onPlaybackChange,
			});
			// When user audio is active, the switch decides who yields: on, auto
			// takes over; off, auto waits behind the manual queue. With no user
			// audio in play, auto keeps its own pacing — the priority chime leads,
			// everything else queues in order.
			const shouldInterrupt = userAudioActive()
				? autoInterruptsRef.current
				: Boolean(entry.priority);
			if (shouldInterrupt) void interruptWith(sequence);
			else appendSequence(sequence);
		}
	}, [
		autoSequences,
		appendSequence,
		interruptWith,
		makeSequence,
		manifest,
		userAudioActive,
	]);

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
