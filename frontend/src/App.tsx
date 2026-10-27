import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { PlanPage } from "./pages/PlanPage";

function LegacyPlanRedirect() {
  const [params] = useSearchParams();
  const slug = params.get("plan");
  if (slug) {
    return <Navigate to={`/plan/${encodeURIComponent(slug)}`} replace />;
  }
  return <HomePage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LegacyPlanRedirect />} />
      <Route path="/plan/:slug" element={<PlanPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
