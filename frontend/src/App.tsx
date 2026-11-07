import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { ClassItem } from './types';
import { LoginPage } from './pages/LoginPage';
import { ClassesPage } from './pages/ClassesPage';
import { ClassDetailPage } from './pages/ClassDetailPage';

export const App: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (selectedClass) {
    return (
      <ClassDetailPage
        classItem={selectedClass}
        onBack={() => setSelectedClass(null)}
      />
    );
  }

  return <ClassesPage onSelectClass={(cls) => setSelectedClass(cls)} />;
};

export default App;

