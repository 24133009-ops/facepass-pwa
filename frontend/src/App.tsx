import React, { useLayoutEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { ClassItem } from './types';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClassesPage } from './pages/ClassesPage';
import { ClassDetailPage } from './pages/ClassDetailPage';
import { BottomNav } from './components/common/BottomNav';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type Page = 'dashboard' | 'classes' | 'classDetail';
const pageOrder: Record<Page, number> = { dashboard: 0, classes: 1, classDetail: 2 };

export const App: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [direction, setDirection] = useState(1);
  const shouldReduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    document.getElementById('app-splash')?.remove();
  }, []);

  const navigateToPage = (page: Page) => {
    if (page !== currentPage) {
      setDirection(pageOrder[page] > pageOrder[currentPage] ? 1 : -1);
    }
    setCurrentPage(page);
  };

  const pageVariants = {
    enter: (travelDirection: number) => ({ opacity: 0, x: shouldReduceMotion ? 0 : travelDirection * 24 }),
    visible: { opacity: 1, x: 0 },
    exit: (travelDirection: number) => ({ opacity: 0, x: shouldReduceMotion ? 0 : travelDirection * -24 })
  };

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleSelectClass = (cls: ClassItem) => {
    setSelectedClass(cls);
    navigateToPage('classDetail');
  };

  const handleNavigate = (page: 'dashboard' | 'classes') => {
    setSelectedClass(null);
    navigateToPage(page);
  };

  return (
    <div className="lg:pl-64">
      <AnimatePresence mode="wait" custom={direction}>
        {currentPage === 'dashboard' && (
          <motion.div
            key="dashboard"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            <DashboardPage
              onNavigateClasses={() => navigateToPage('classes')}
              onSelectClass={handleSelectClass}
            />
          </motion.div>
        )}

        {currentPage === 'classes' && (
          <motion.div
            key="classes"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            <ClassesPage onSelectClass={handleSelectClass} />
          </motion.div>
        )}

        {currentPage === 'classDetail' && selectedClass && (
          <motion.div
            key="detail"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            <ClassDetailPage
              classItem={selectedClass}
              onBack={() => navigateToPage('classes')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav currentPage={currentPage} onNavigate={handleNavigate} />
    </div>
  );
};

export default App;
