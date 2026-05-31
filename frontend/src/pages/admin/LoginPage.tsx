import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext.js';

export function LoginPage() {
  const { login, isAuthenticated, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(password, rememberMe);
      navigate('/admin', { replace: true });
    } catch {
      setError('Invalid password');
    }
  }

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title">Admin</h1>
        {sessionExpired && !error && (
          <p className="login-notice">Your session expired. Please log in again.</p>
        )}
        {error && <p className="login-error">{error}</p>}
        <div className="login-field">
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
        </div>
        <label className="login-remember">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
          />
          Keep me logged in for 7 days
        </label>
        <button className="login-button" type="submit">Log in</button>
      </form>
    </div>
  );
}
