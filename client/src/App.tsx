// codeauthor chetas karnam
import { Routes, Route } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';

// Public Pages
import { HomePage } from './pages/HomePage';
import { ProblemPage } from './pages/ProblemPage';
import { SolutionPage } from './pages/SolutionPage';
import { ResearchPage } from './pages/ResearchPage';
import { AwardsPage } from './pages/AwardsPage';
import { TeamPage } from './pages/TeamPage';
import { ContactPage } from './pages/ContactPage';

// Auth Pages
import { LoginPage } from './pages/LoginPage';

// Protected Pages
import { DashboardPage } from './pages/DashboardPage';
import DatasetExplorerPage from './pages/DatasetExplorerPage';
import { MissionOpsPage } from './pages/MissionOpsPage';

// Error Pages
import { NotFoundPage } from './pages/NotFoundPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { ErrorPage } from './pages/ErrorPage';

function AppContent() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        {/* Public Routes - No Layout */}
        <Route
          path="/"
          element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <HomePage />
            </motion.div>
          }
        />
        <Route
          path="/login"
          element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoginPage />
            </motion.div>
          }
        />
        <Route
          path="/problem"
          element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProblemPage />
            </motion.div>
          }
        />
        <Route
          path="/solution"
          element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SolutionPage />
            </motion.div>
          }
        />
        <Route
          path="/research"
          element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ResearchPage />
            </motion.div>
          }
        />
        <Route
          path="/awards"
          element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AwardsPage />
            </motion.div>
          }
        />
        <Route
          path="/team"
          element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TeamPage />
            </motion.div>
          }
        />
        <Route
          path="/contact"
          element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ContactPage />
            </motion.div>
          }
        />

        {/* Protected Routes - With Layout */}
        <Route
          path="/dashboard"
          element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProtectedRoute>
                <AppLayout title="Dashboard">
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            </motion.div>
          }
        />
        <Route
          path="/datasets"
          element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProtectedRoute>
                <AppLayout title="Datasets">
                  <DatasetExplorerPage />
                </AppLayout>
              </ProtectedRoute>
            </motion.div>
          }
        />
        <Route
          path="/mission-ops"
          element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProtectedRoute requiredRole={['operations', 'admin']}>
                <AppLayout title="Mission Operations">
                  <MissionOpsPage />
                </AppLayout>
              </ProtectedRoute>
            </motion.div>
          }
        />

        {/* Error Routes */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/error" element={<ErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
