// codeauthor chetas karnam
import { Routes, Route } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { HomePage } from './pages/HomePage';
import { ProblemPage } from './pages/ProblemPage';
import { SolutionPage } from './pages/SolutionPage';
import { DashboardPage } from './pages/DashboardPage';
import DatasetExplorerPage from './pages/DatasetExplorerPage';
import { ResearchPage } from './pages/ResearchPage';
import { AwardsPage } from './pages/AwardsPage';
import { TeamPage } from './pages/TeamPage';
import { ContactPage } from './pages/ContactPage';
import { MissionOpsPage } from './pages/MissionOpsPage';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><HomePage /></motion.div>} />
          <Route path="/problem" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ProblemPage /></motion.div>} />
          <Route path="/solution" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><SolutionPage /></motion.div>} />
          <Route path="/dashboard" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><DashboardPage /></motion.div>} />
          <Route path="/datasets" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><DatasetExplorerPage /></motion.div>} />
          <Route path="/research" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ResearchPage /></motion.div>} />
          <Route path="/awards" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><AwardsPage /></motion.div>} />
          <Route path="/team" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><TeamPage /></motion.div>} />
          <Route path="/contact" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ContactPage /></motion.div>} />
          <Route path="/mission-ops" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><MissionOpsPage /></motion.div>} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}

export default App;
