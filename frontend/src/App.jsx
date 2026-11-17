import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import { useAuth } from './lib/auth.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Register } from './pages/Auth.jsx';
import NotFound from './pages/NotFound.jsx';

// Pages load on first visit, so the initial download stays small.
const Activities = lazy(() => import('./pages/Activities.jsx'));
const AnalysisDetail = lazy(() => import('./pages/AnalysisDetail.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Farms = lazy(() => import('./pages/Farms.jsx'));
const HistoryPage = lazy(() => import('./pages/History.jsx'));
const Library = lazy(() => import('./pages/Library.jsx'));
const Market = lazy(() => import('./pages/Market.jsx'));
const ProduceGrader = lazy(() => import('./pages/ProduceGrader.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Scan = lazy(() => import('./pages/Scan.jsx'));
const SoilDoctor = lazy(() => import('./pages/SoilDoctor.jsx'));
const VoiceAssistant = lazy(() => import('./pages/VoiceAssistant.jsx'));
const Weather = lazy(() => import('./pages/Weather.jsx'));
const AdminAdvisories = lazy(() => import('./pages/admin/AdminAdvisories.jsx'));
const AdminFarms = lazy(() => import('./pages/admin/AdminFarms.jsx'));
const AdminLog = lazy(() => import('./pages/admin/AdminLog.jsx'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview.jsx'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));

/** Signed-in users only. Remembers where the visitor was heading. */
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Hides admin pages from farmers. The API enforces this too; this is only for the UI. */
function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/app" replace />;
}

/** Login and register pages bounce signed-in users straight to the app. */
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Navigate to="/app" replace /> : children;
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

      <Route path="/app" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="assistant" element={<VoiceAssistant />} />
        <Route path="soil" element={<SoilDoctor />} />
        <Route path="produce" element={<ProduceGrader />} />
        <Route path="scan" element={<Scan />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/:id" element={<AnalysisDetail />} />
        <Route path="farms" element={<Farms />} />
        <Route path="activities" element={<Activities />} />
        <Route path="weather" element={<Weather />} />
        <Route path="market" element={<Market />} />
        <Route path="library" element={<Library />} />
        <Route path="profile" element={<Profile />} />

        <Route path="admin" element={<RequireAdmin><AdminOverview /></RequireAdmin>} />
        <Route path="admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
        <Route path="admin/farms" element={<RequireAdmin><AdminFarms /></RequireAdmin>} />
        <Route path="admin/reports" element={<RequireAdmin><AdminReports /></RequireAdmin>} />
        <Route path="admin/reports/:id" element={<RequireAdmin><AnalysisDetail admin /></RequireAdmin>} />
        <Route path="admin/advisories" element={<RequireAdmin><AdminAdvisories /></RequireAdmin>} />
        <Route path="admin/log" element={<RequireAdmin><AdminLog /></RequireAdmin>} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
