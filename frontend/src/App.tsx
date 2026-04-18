import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import HomePage from "./pages/HomePage";
import TripDetailPage from "./pages/TripDetailPage";
import AddExpensePage from "./pages/AddExpensePage";
import AddTripPage from "./pages/AddTripPage";
import ProfileSetupPage from "./pages/ProfileSetupPage";
import { fetchMe } from "./api/me";
import {
  clearTokens,
  ensureValidSession,
  getIdToken,
  handleCallbackIfNeeded,
  login,
} from "./auth/cognito";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

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

        const valid = await ensureValidSession();
        if (!valid) {
          clearTokens();
          await login();
          return;
        }

        const me = await fetchMe();
        const hasName = !!me.name?.trim();

        if (!mounted) return;

        if (!hasName && location.pathname !== "/profile/setup") {
          navigate("/profile/setup", { replace: true });
        }

        if (hasName && location.pathname === "/profile/setup") {
          navigate("/", { replace: true });
        }

        setReady(true);
      } catch (err) {
        if (!mounted) return;
        const message = (err as Error).message ?? "Authentication failed";
        if (message.includes("Unauthorized")) {
          clearTokens();
          await login();
          return;
        }
        setAuthError(message);
        setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [location.pathname, navigate]);

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
      <Route path="/profile/setup" element={<ProfileSetupPage />} />
      <Route path="/trips/new" element={<AddTripPage />} />
      <Route path="/trips/:tripId" element={<TripDetailPage />} />
      <Route path="/trips/:tripId/add" element={<AddExpensePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
