import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ApplicationDetail from './components/ApplicationDetail';
import AdminPanel from './components/AdminPanel';
import Header from './components/Header';
import Footer from './components/Footer';

axios.defaults.baseURL = '/api';
axios.defaults.withCredentials = true;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data.user);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (username, password) => {
    const response = await axios.post('/auth/login', { username, password });
    setUser(response.data.user);
    return response.data;
  };

  const handleLogout = async () => {
    await axios.post('/auth/logout');
    setUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <div className="App" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {user && <Header user={user} onLogout={handleLogout} />}
        <div style={{ flex: 1 }}>
          <Routes>
            <Route
              path="/login"
              element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />}
            />
            <Route
              path="/"
              element={user ? <Dashboard user={user} /> : <Navigate to="/login" />}
            />
            <Route
              path="/app/:id"
              element={user ? <ApplicationDetail user={user} /> : <Navigate to="/login" />}
            />
            <Route
              path="/admin"
              element={user?.is_admin ? <AdminPanel currentUserId={user.id} /> : <Navigate to="/" />}
            />
          </Routes>
        </div>
        {user && <Footer />}
      </div>
    </Router>
  );
}

export default App;
