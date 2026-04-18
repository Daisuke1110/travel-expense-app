import { useEffect, useState } from "react";
import { fetchTripDetail } from "../api/trips";
import type { TripDetail } from "../api/trips";

export function useTrip(tripId: string | undefined) {
  const [data, setData] = useState<TripDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      setError("旅行 ID がありません。");
      setLoading(false);
      return;
    }

    let mounted = true;
    fetchTripDetail(tripId)
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch((err) => {
        if (mounted) setError(err.message ?? "旅行情報の読み込みに失敗しました。");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tripId]);

  return { data, error, loading };
}

