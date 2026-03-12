import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BrowserRouter, Routes, Route, Navigate, useLocation,
} from 'react-router-dom';

import useGoogleAuth  from './hooks/useGoogleAuth';
import useLiveEntries from './hooks/useLiveEntries';

import { 
  subscribeToConfig, 
  saveConfig,
  subscribeToHistory,
  archiveCompetition,
  deleteCompetition as deleteCompetitionFromFirebase
} from './utils/firebase';

import AuthScreen  from './components/AuthScreen';
import Nav         from './components/Nav';
import InputPage   from './pages/InputPage';
import ViewingPage from './pages/ViewingPage';
import ConfigPage  from './pages/ConfigPage';
import HistoryPage from './pages/HistoryPage';
import DisplayPage from './pages/DisplayPage';
import MonitorPage from './pages/MonitorPage';

import './styles/global.css';
import './styles/pages.css';

const DEFAULT_CONFIG = { competitionName: '', teams: [] };

// Toast component
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`${type}-toast`}>
      <span>{message}</span>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  );
}

// ── Inner app — has access to router hooks ─────────────────────────────────
// Change this line (around line 43):
function AppInner({ user, authLoaded, authError, signIn, signOut, signInAsGuest }) {  const location = useLocation();
  const { entries, addEntry, updateEntry, clearEntries, deleteEntry, clearEntriesByTeam } = useLiveEntries(user);

  const [config,  setConfig]  = useState(DEFAULT_CONFIG);
  const [history, setHistory] = useState([]);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [configDirty, setConfigDirty] = useState(false);
  const [prevLocation, setPrevLocation] = useState(location.pathname);
  const [importPopup, setImportPopup] = useState(null);

  const isSavingRef = useRef(false);
  const prevConfigRef = useRef(null);

  // Subscribe to Firebase config — gated on user being authenticated
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToConfig((firebaseConfig) => {
      if (!isSavingRef.current) {
        const configStr = JSON.stringify(firebaseConfig || DEFAULT_CONFIG);
        if (prevConfigRef.current !== configStr) {
          prevConfigRef.current = configStr;
          setConfig(firebaseConfig || DEFAULT_CONFIG);
        }
      }
      setConfigLoaded(true);
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user]);

  // Subscribe to Firebase history — gated on user being authenticated
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToHistory((firebaseHistory) => {
      setHistory(firebaseHistory || []);
      setHistoryLoaded(true);
    });

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user]);

  // Show toast when leaving config page after making changes
  useEffect(() => {
    const wasOnConfig = prevLocation === '/config';
    const isOnConfig = location.pathname === '/config';
    
    if (wasOnConfig && !isOnConfig && configDirty) {
      setConfigDirty(false);
    }
    setPrevLocation(location.pathname);
  }, [location.pathname, configDirty, prevLocation]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleSaveConfig = useCallback(async (cfg) => {
    const hasChanges = JSON.stringify(cfg) !== JSON.stringify(config);
    
    if (config.teams) {
      const currentTeamNumbers = config.teams.map(t => t.number);
      const newTeamNumbers = cfg.teams ? cfg.teams.map(t => t.number) : [];
      const removedTeams = currentTeamNumbers.filter(t => !newTeamNumbers.includes(t));
      removedTeams.forEach(teamNum => {
        clearEntriesByTeam(teamNum);
      });
    }
    
    isSavingRef.current = true;
    setConfig(cfg);
    
    try {
      await saveConfig(cfg);
      if (hasChanges) {
        setConfigDirty(true);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      showToast('Error saving configuration', 'error');
    } finally {
      setTimeout(() => {
        isSavingRef.current = false;
      }, 100);
    }
  }, [config, clearEntriesByTeam]);

  const findArchivedTeamEntry = (teamNumber) => {
    for (const comp of history) {
      const teamEntries = comp.entries ? comp.entries.filter(e => e.teamNumber === teamNumber) : [];
      if (teamEntries.length > 0) {
        return { compName: comp.name, entry: teamEntries[teamEntries.length - 1] };
      }
    }
    return null;
  };

  const handleAddTeamWithArchive = (teamNumber, teamName) => {
    const archived = findArchivedTeamEntry(teamNumber);
    if (archived) {
      setImportPopup({ teamNumber, teamName, ...archived });
    }
  };

  const handleImportEntry = (archivedEntry) => {
    sessionStorage.setItem('importedEntry', JSON.stringify(archivedEntry));
    setImportPopup(null);
    window.location.href = '/input';
  };

  const handleViewArchive = () => {
    if (importPopup) {
      setImportPopup(null);
      window.location.href = '/history';
    }
  };

  const handleArchive = async (name) => {
    try {
      await archiveCompetition(name, entries);
      await clearEntries();
      showToast(`Archived "${name}" to History`, 'success');
    } catch (error) {
      console.error('Error archiving competition:', error);
      showToast('Error archiving competition', 'error');
    }
  };

  const handleDeleteArchivedCompetition = async (compId) => {
    try {
      await deleteCompetitionFromFirebase(compId);
      showToast('Competition deleted from history', 'success');
    } catch (error) {
      console.error('Error deleting competition:', error);
      showToast('Error deleting competition', 'error');
    }
  };

  // Change this:
// Around line 175 in your original file:
if (!user) {
  return (
    <AuthScreen 
      signIn={signIn} 
      authError={authError} 
      authLoaded={authLoaded} 
      signInAsGuest={signInAsGuest} // Make sure this is passed!
    />
  );
}

  const pathParts = location.pathname.replace('/', '').split('/');
  const currentPage = pathParts[0] || 'entries';

  // Show loading while Firebase is connecting
  if (!configLoaded || !historyLoaded) {
    return (
      <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const isMonitorPage = location.pathname === '/monitor';

  return (
    <div className="app">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {!isMonitorPage && <Nav currentPage={currentPage} user={user} signOut={signOut} showLiveIndicator={false} />}
      <main className="main" style={isMonitorPage ? { margin: 0, padding: 0 } : {}}>
        <Routes>
          <Route path="/"        element={<Navigate to="/entries" replace />} />
          <Route path="/entries" element={<ViewingPage teams={config.teams} entries={entries} user={user} updateEntry={updateEntry} deleteEntry={deleteEntry} />} />
          <Route path="/entries/:teamNumber" element={<ViewingPage teams={config.teams} entries={entries} user={user} updateEntry={updateEntry} deleteEntry={deleteEntry} />} />
          <Route path="/input"   element={<InputPage onSubmit={addEntry} showToast={showToast} user={user} />} />
          <Route path="/history" element={<HistoryPage history={history} user={user} onDeleteCompetition={handleDeleteArchivedCompetition} />} />
          <Route path="/history/:compId/:teamNumber" element={<HistoryPage history={history} user={user} onDeleteCompetition={handleDeleteArchivedCompetition} />} />
          <Route path="/display" element={<DisplayPage user={user} />} />
          <Route path="/monitor" element={<MonitorPage />} />
          <Route
            path="/config"
            element={
              user.isAdmin
                ? <ConfigPage 
                    config={config} 
                    onSaveConfig={handleSaveConfig} 
                    entries={entries} 
                    onArchive={handleArchive} 
                    showToast={showToast}
                    onAddTeamWithArchive={handleAddTeamWithArchive}
                  />
                : <div className="page-content"><div className="empty-state">⛔ Access denied. Only admins can access this page.</div></div>
            }
          />
          <Route path="*" element={<Navigate to="/entries" replace />} />
        </Routes>
      </main>

      {importPopup && (
        <div className="modal-overlay" onClick={() => setImportPopup(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2>Archived Data Found</h2>
              <button className="modal-close" onClick={() => setImportPopup(null)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ marginBottom: 16 }}>
                Team <strong>{importPopup.teamNumber}</strong> ({importPopup.teamName}) has archived scouting data from <strong>"{importPopup.compName}"</strong>.
              </p>
              <p style={{ marginBottom: 20, color: 'var(--muted)' }}>
                What would you like to do?
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button 
                  className="archive-btn" 
                  onClick={() => handleImportEntry(importPopup.entry)}
                  style={{ flex: 1 }}
                >
                  Import Data
                </button>
                <button 
                  className="cancel-btn" 
                  onClick={handleViewArchive}
                  style={{ flex: 1 }}
                >
                  View Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
// ── Root ───────────────────────────────────────────────────────────────────
function App() {
  const auth = useGoogleAuth();
  const [manualUser, setManualUser] = useState(null);

  // This function mimics the Google login but stays local
  const signInAsGuest = () => {
    setManualUser({
      uid: 'guest-123',
      displayName: 'Guest Developer',
      email: 'guest@example.com',
      isAdmin: true // Setting this to true so you can see the ConfigPage
    });
  };

  // If manualUser exists, we use that. Otherwise, we use the real Google Auth.
  const activeAuth = manualUser 
    ? { user: manualUser, authLoaded: true, authError: null, signIn: signInAsGuest, signOut: () => setManualUser(null) }
    : { ...auth, signInAsGuest }; // Pass the guest function down

  return (
    <BrowserRouter>
      <AppInner {...activeAuth} />
    </BrowserRouter>
  );
}

export default App;