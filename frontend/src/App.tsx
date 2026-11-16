import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { ClassItem } from './types';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClassesPage } from './pages/ClassesPage';
import { ClassDetailPage } from './pages/ClassDetailPage';
import { BottomNav } from './components/common/BottomNav';
import { AnimatePresence, motion } from 'framer-motion';

type Page = 'dashboard' | 'classes' | 'classDetail';

export const App: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleSelectClass = (cls: ClassItem) => {
    setSelectedClass(cls);
    setCurrentPage('classDetail');
  };

  const handleNavigate = (page: 'dashboard' | 'classes') => {
    setSelectedClass(null);
    setCurrentPage(page);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {currentPage === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <DashboardPage
              onNavigateClasses={() => setCurrentPage('classes')}
              onSelectClass={handleSelectClass}
            />
          </motion.div>
        )}

        {currentPage === 'classes' && (
          <motion.div
            key="classes"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <ClassesPage onSelectClass={handleSelectClass} />
          </motion.div>
        )}

        {currentPage === 'classDetail' && selectedClass && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <ClassDetailPage
              classItem={selectedClass}
              onBack={() => setCurrentPage('classes')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav currentPage={currentPage} onNavigate={handleNavigate} />
    </>
  );
};

export default App;
