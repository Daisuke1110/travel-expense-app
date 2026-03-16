import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import TripDetailPage from "./pages/TripDetailPage";
import AddExpensePage from "./pages/AddExpensePage";
import AddTripPage from "./pages/AddTripPage";
import { getIdToken, handleCallbackIfNeeded, login } from "./auth/cognito";

export default function App() {
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await handleCallbackIfNeeded();

        if (!getIdToken()) {
          await login();
          return;
        }

        if (mounted) setReady(true);
      } catch (err) {
        if (mounted) {
          setAuthError((err as Error).message ?? "Authentication failed");
          setReady(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className="page">
        <div className="status">Signing in...</div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page">
        <div className="status status--error">{authError}</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/trips/new" element={<AddTripPage />} />
      <Route path="/trips/:tripId" element={<TripDetailPage />} />
      <Route path="/trips/:tripId/add" element={<AddExpensePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
