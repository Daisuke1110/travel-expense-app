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
      .catch((err) => setError(err.message ?? "メンバーの読み込みに失敗しました。"));
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
      setError("旅行 ID がありません。");
      setLoading(false);
      return;
    }

    let mounted = true;
    fetchTripMembers(tripId)
      .then((res) => {
        if (mounted) setData(res.members);
      })
      .catch((err) => {
        if (mounted) setError(err.message ?? "メンバーの読み込みに失敗しました。");
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
        setError((err as Error).message ?? "メンバーの削除に失敗しました。");
        await refresh();
      }
    },
    [tripId, refresh]
  );

  return { data, error, loading, refresh, remove };
}
