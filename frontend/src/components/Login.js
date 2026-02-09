import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestAllowed, setGuestAllowed] = useState(false);

  useEffect(() => {
    // Check if guest login is allowed
    const checkGuestStatus = async () => {
      try {
        const response = await axios.get('/auth/guest-allowed');
        setGuestAllowed(response.data.guestAllowed);
      } catch (err) {
        console.error('Failed to check guest status:', err);
        setGuestAllowed(false);
      }
    };
    checkGuestStatus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await onLogin('guest', 'guest');
    } catch (err) {
      setError('Guest login failed. Please contact administrator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>apothi.</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          {guestAllowed && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%', marginTop: '10px' }} 
              onClick={handleGuestLogin}
              disabled={loading}
            >
              View as Guest
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default Login;
