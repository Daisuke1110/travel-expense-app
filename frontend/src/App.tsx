import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import TripDetailPage from "./pages/TripDetailPage";
import AddExpensePage from "./pages/AddExpensePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/trips/:tripId" element={<TripDetailPage />} />
      <Route path="/trips/:tripId/add" element={<AddExpensePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
