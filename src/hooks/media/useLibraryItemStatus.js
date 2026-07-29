import { useEffect, useState } from "react";
import { normalizeWatchStatus, toDisplayWatchStatus } from "../../util/library/watchStatus";
import { libraryAdapter } from "../../domain/library/libraryAdapter";

/**
 * Hook to fetch and sync library item status (Watchlist, Completed, etc.)
 * Hydrates UI state on mount and provides real-time updates.
 *
 * @param {Object} options
 * @param {string} options.userId - Firebase UID
 * @param {Object|null} options.libraryIdentity - { titleKey, mediaType, tmdbId }
 * @param {boolean} options.realtime - whether to use onSnapshot
 */
export const useLibraryItemStatus = ({ userId, libraryIdentity, realtime = false }) => {
	const [status, setStatus] = useState(null);
	const [trackingData, setTrackingData] = useState(null);
	const [loading, setLoading] = useState(Boolean(userId && libraryIdentity?.titleKey));
	const [error, setError] = useState(null);

	useEffect(() => {
		if (!userId || !libraryIdentity?.titleKey) {
			setStatus(null);
			setTrackingData(null);
			setLoading(false);
			setError(null);
			return;
		}

		setLoading(true);
		setError(null);

		if (realtime) {
			const unsub = libraryAdapter.subscribeToLibraryStatus(
				userId,
				libraryIdentity,
				(trackingStatus, trackData) => {
					setStatus(trackingStatus ? toDisplayWatchStatus(trackingStatus) : null);
					setTrackingData(trackData);
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

		libraryAdapter.getLibraryStatus(userId, libraryIdentity)
			.then(({ status: trackingStatus, tracking: trackData }) => {
				setStatus(trackingStatus ? toDisplayWatchStatus(trackingStatus) : null);
				setTrackingData(trackData);
			})
			.catch((err) => {
				console.warn("useLibraryItemStatus getLibraryStatus error:", err);
				setError(err);
			})
			.finally(() => setLoading(false));
	}, [
		userId,
		libraryIdentity,
		realtime,
	]);

	const normalizedStatus = normalizeWatchStatus(status);
	const isWatchlisted = normalizedStatus === "plan_to_watch";
	const isWatching = normalizedStatus === "watching";
	const isCompleted = normalizedStatus === "completed";
	const isDropped = normalizedStatus === "dropped";

	return {
		status,
		trackingData,
		isWatchlisted,
		isWatching,
		isCompleted,
		isDropped,
		loading,
		error,
	};
};

export default useLibraryItemStatus;
