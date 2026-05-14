import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import WelcomePage from './pages/WelcomePage';
import CompetitionSetup from './pages/CompetitionSetup';
import JudgeSelection from './pages/JudgeSelection';
import ScoringInterface from './pages/ScoringInterface';
import ResultsPage from './pages/ResultsPage';
import ArchivedCompetitions from './pages/ArchivedCompetitions';
import AdminDashboard from './pages/AdminDashboard';
import DataManagement from './pages/DataManagement';
import { isJudgeLocked } from './utils/accessControl';


const AdminProtectedRoute = ({ children }) => {
  if (isJudgeLocked()) {
    return <Navigate to="/scoring" replace />;
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminProtectedRoute><WelcomePage /></AdminProtectedRoute>} />
        <Route path="/setup" element={<AdminProtectedRoute><CompetitionSetup /></AdminProtectedRoute>} />
        <Route path="/judge-selection" element={<AdminProtectedRoute><JudgeSelection /></AdminProtectedRoute>} />
        <Route path="/scoring" element={<ScoringInterface />} />
        <Route path="/results" element={<AdminProtectedRoute><ResultsPage /></AdminProtectedRoute>} />
        <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
        <Route path="/data-management" element={<AdminProtectedRoute><DataManagement /></AdminProtectedRoute>} />
        <Route path="/archived-competitions" element={<AdminProtectedRoute><ArchivedCompetitions /></AdminProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
