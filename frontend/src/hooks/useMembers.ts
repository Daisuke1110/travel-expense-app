import { useCallback, useEffect, useState } from "react";
import { deleteTripMember, fetchTripMembers, type TripMemberResponse } from "../api/trips";

export function useMembers(tripId: string | undefined) {
  const [data, setData] = useState<TripMemberResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!tripId) return Promise.resolve();
    return fetchTripMembers(tripId)
      .then((res) => setData(res.members))
      .catch((err) => setError(err.message ?? "Failed to load members"));
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
      setError("Missing trip id");
      setLoading(false);
      return;
    }

    let mounted = true;
    fetchTripMembers(tripId)
      .then((res) => {
        if (mounted) setData(res.members);
      })
      .catch((err) => {
        if (mounted) setError(err.message ?? "Failed to load members");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tripId]);

  const remove = useCallback(
    async (memberUserId: string) => {
      if (!tripId) return;
      setData((prev) => prev.filter((item) => item.user_id !== memberUserId));
      try {
        await deleteTripMember(tripId, memberUserId);
      } catch (err) {
        setError((err as Error).message ?? "Failed to delete member");
        await refresh();
      }
    },
    [tripId, refresh]
  );

  return { data, error, loading, refresh, remove };
}
