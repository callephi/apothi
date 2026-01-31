import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function Header({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Load dark mode preference from localStorage
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.body.classList.add('dark-mode');
    }
  }, []);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest('.menu-container')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode);
    if (newDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    setShowMenu(false);
  };

  return (
    <div className="header">
      <div className="header-content">
        <h1 style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          apothi.
        </h1>
        <div className="header-actions">
          <span className="username">Welcome, {user.display_name || user.username}</span>
          <div className="menu-container">
            <button className="hamburger-btn" onClick={() => setShowMenu(!showMenu)}>
              ☰
            </button>
            {showMenu && (
              <div className="dropdown-menu">
                {user.is_admin && location.pathname !== '/admin' && (
                  <button onClick={() => { navigate('/admin'); setShowMenu(false); }}>
                    Admin Panel
                  </button>
                )}
                {location.pathname === '/admin' && (
                  <button onClick={() => { navigate('/'); setShowMenu(false); }}>
                    Library
                  </button>
                )}
                <button onClick={toggleDarkMode}>
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <button onClick={() => { onLogout(); setShowMenu(false); }}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;
