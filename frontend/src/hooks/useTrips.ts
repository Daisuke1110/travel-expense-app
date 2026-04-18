import { useEffect, useState } from "react";
import { fetchMyTrips } from "../api/trips";
import type { TripsResponse } from "../api/trips";

export function useTrips() {
  const [data, setData] = useState<TripsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchMyTrips()
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch((err) => {
        if (mounted) setError(err.message ?? "旅行の読み込みに失敗しました。");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { data, error, loading };
}

