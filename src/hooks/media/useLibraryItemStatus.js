import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../util/firebase/firebase";

/**
 * Hook to fetch and sync library item status (Watchlist, Completed, etc.)
 * Hydrates UI state on mount and provides real-time updates.
 *
 * @param {Object} options
 * @param {string} options.userId - Firebase UID
 * @param {Object|null} options.mediaItem - { id, media_type }
 * @param {boolean} options.realtime - whether to use onSnapshot
 */
export const useLibraryItemStatus = ({ userId, mediaItem, realtime = false }) => {
	const [status, setStatus] = useState(null);
	const [loading, setLoading] = useState(Boolean(userId && mediaItem?.id));
	const [error, setError] = useState(null);

	useEffect(() => {
		if (!userId || !mediaItem?.id) {
			setStatus(null);
			setLoading(false);
			setError(null);
			return;
		}

		const titleKey = generateTitleKey(mediaItem.id, mediaItem.media_type || "movie");
		const ref = doc(db, "users", userId, "library_items", titleKey);

		setLoading(true);
		setError(null);

		if (realtime) {
			const unsub = onSnapshot(
				ref,
				(snap) => {
					if (snap.exists()) {
						const trackingStatus = readWatchStatus(snap.data());
						setStatus(trackingStatus);
					} else {
						setStatus(null);
					}
					setLoading(false);
				},
				(err) => {
					console.warn("useLibraryItemStatus onSnapshot error:", err);
					setError(err);
					setLoading(false);
				}
			);
			return () => unsub();
		}

		getDoc(ref)
			.then((snap) => {
				if (snap.exists()) {
					const trackingStatus = readWatchStatus(snap.data());
					setStatus(trackingStatus);
				} else {
					setStatus(null);
				}
			})
			.catch((err) => {
				console.warn("useLibraryItemStatus getDoc error:", err);
				setError(err);
			})
			.finally(() => setLoading(false));
	}, [userId, mediaItem?.id, mediaItem?.media_type, realtime]);

	const isWatchlisted = status === "Plan to Watch";
	const isWatching = status === "Watching";
	const isCompleted = status === "Completed";
	const isDropped = status === "Dropped";

	return {
		status,
		isWatchlisted,
		isWatching,
		isCompleted,
		isDropped,
		loading,
		error,
	};
};

function generateTitleKey(mediaId, mediaType = "movie") {
	const type = mediaType === "tv" ? "tv" : "movie";
	return `tmdb_${type}_${mediaId}`;
}

function readWatchStatus(data) {
	return (
		data?.tracking?.watchStatus ??
		data?.watchStatus ??
		data?.status ??
		null
	);
}

export default useLibraryItemStatus;
