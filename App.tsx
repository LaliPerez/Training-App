import React, { useState, useEffect } from 'react';
import type { Training, UserSubmission, TrainingLink } from './types';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import UserPortal from './components/UserPortal';
import { ShieldCheck, User } from 'lucide-react';

type View = 'selector' | 'login' | 'admin' | 'user';

const App: React.FC = () => {
  const [view, setView] = useState<View>('selector');
  
  const [trainings, setTrainings] = useState<Training[]>([]);

  const [userSubmissions, setUserSubmissions] = useState<UserSubmission[]>(() => {
    try {
      const savedSubmissions = localStorage.getItem('userSubmissions');
      return savedSubmissions ? JSON.parse(savedSubmissions) : [];
    } catch (error) {
      console.error("Failed to parse user submissions from localStorage", error);
      return [];
    }
  });
  
  useEffect(() => {
    // On initial load, check for data in URL
    try {
      const params = new URLSearchParams(window.location.search);
      const data = params.get('data');
      const viewParam = params.get('view');
      let urlWasModified = false;

      // Check if we should switch view from URL
      if (viewParam === 'user') {
        setView('user');
        urlWasModified = true;
      }

      // Check for shared training data
      if (data) {
        // Decode base64 to unicode string
        const decodedTrainings = JSON.parse(decodeURIComponent(escape(atob(data))));
        
        // Basic validation
        if (Array.isArray(decodedTrainings)) {
          setTrainings(decodedTrainings);
          localStorage.setItem('trainings', JSON.stringify(decodedTrainings));
          // When data is loaded via link, it's for a user. Go to user view.
          setView('user');
          urlWasModified = true;
        }
      } else {
         // If no data in URL, try localStorage
         const savedTrainings = localStorage.getItem('trainings');
         if (savedTrainings) {
            setTrainings(JSON.parse(savedTrainings));
         }
      }

      // Clean up URL if we used params from it
      if (urlWasModified) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
       console.error("Failed to load trainings from URL or localStorage", error);
       // Fallback to localStorage if URL parsing fails
       try {
            const savedTrainings = localStorage.getItem('trainings');
            if (savedTrainings) {
                setTrainings(JSON.parse(savedTrainings));
            }
       } catch (e) {
            console.error("Failed to load trainings from localStorage as fallback", e);
       }
    }
  }, []);

  useEffect(() => {
    // This effect runs whenever 'trainings' state changes, saving it to localStorage.
    // We avoid saving empty initial array over existing data by checking length.
    if (trainings.length > 0) {
        try {
          localStorage.setItem('trainings', JSON.stringify(trainings));
        } catch (error) {
          console.error("Failed to save trainings to localStorage", error);
        }
    }
  }, [trainings]);

  useEffect(() => {
    try {
      localStorage.setItem('userSubmissions', JSON.stringify(userSubmissions));
    } catch (error) {
      console.error("Failed to save user submissions to localStorage", error);
    }
  }, [userSubmissions]);

  const addTraining = (name: string, urls: string[]) => {
    const newTraining: Training = {
      id: `training-${Date.now()}`,
      name,
      links: urls.map((url, index) => ({
        id: `link-${Date.now()}-${index}`,
        url,
        viewed: false,
      })),
    };
    setTrainings(prev => [...prev, newTraining]);
  };

  const updateTraining = (id: string, name: string, urls: string[]) => {
    setTrainings(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          name,
          links: urls.map((url, index) => {
            const existingLink = t.links.find(l => l.url === url);
            return existingLink || { id: `link-${Date.now()}-${index}`, url, viewed: false };
          }),
        };
      }
      return t;
    }));
  };

  const deleteTraining = (id: string) => {
    setTrainings(prev => prev.filter(t => t.id !== id));
    // Optional: Also remove submissions related to this training
    // setUserSubmissions(prev => prev.filter(sub => sub.trainingId !== id));
  };

  const addUserSubmission = (submission: Omit<UserSubmission, 'id'>) => {
    const newSubmission: UserSubmission = {
      ...submission,
      id: `sub-${Date.now()}`,
    };
    setUserSubmissions(prev => [...prev, newSubmission]);
  };
  
  const renderView = () => {
    switch (view) {
      case 'login':
        return <AdminLogin onLoginSuccess={() => setView('admin')} onBack={() => setView('selector')} />;
      case 'admin':
        return <AdminDashboard 
                    trainings={trainings}
                    userSubmissions={userSubmissions} 
                    addTraining={addTraining}
                    updateTraining={updateTraining}
                    deleteTraining={deleteTraining}
                    onLogout={() => setView('selector')} 
                />;
      case 'user':
        return <UserPortal 
                    trainings={trainings} 
                    setTrainings={setTrainings} 
                    addUserSubmission={addUserSubmission}
                    onBack={() => setView('selector')}
                />;
      case 'selector':
      default:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">Bienvenido a Trainer App</h1>
            <p className="mt-4 max-w-xl mx-auto text-lg text-gray-500">Por favor, selecciona tu rol para continuar.</p>
            <div className="mt-8 flex justify-center gap-4 md:gap-8">
              <button
                onClick={() => setView('login')}
                className="flex flex-col items-center justify-center w-48 h-48 p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-200"
              >
                <ShieldCheck className="h-16 w-16 text-indigo-600 mb-4" />
                <span className="text-lg font-semibold text-gray-800">Soy Administrador</span>
              </button>
              <button
                onClick={() => setView('user')}
                className="flex flex-col items-center justify-center w-48 h-48 p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-200"
              >
                <User className="h-16 w-16 text-sky-500 mb-4" />
                <span className="text-lg font-semibold text-gray-800">Soy Usuario</span>
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {renderView()}
    </div>
  );
};

export default App;