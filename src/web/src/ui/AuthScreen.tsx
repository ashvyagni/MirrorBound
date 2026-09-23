import React, { useState, useEffect, useRef } from 'react';
import { setAppView } from './store';

function generateRandomString(length: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [captchaText, setCaptchaText] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawCaptcha = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const text = generateRandomString(6);
    setCaptchaText(text);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw noise lines
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.strokeStyle = `rgba(${Math.random()*255},${Math.random()*255},${Math.random()*255},0.5)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw text with distortion
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < text.length; i++) {
      ctx.save();
      const x = 30 + i * 35;
      const y = canvas.height / 2 + (Math.random() * 10 - 5);
      const rot = (Math.random() - 0.5) * 0.4;
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = '#0a0610';
      ctx.fillText(text[i] || '', 0, 0);
      ctx.restore();
    }

    // Draw noise dots
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(${Math.random()*255},${Math.random()*255},${Math.random()*255},0.5)`;
      ctx.fill();
    }
  };

  useEffect(() => {
    document.documentElement.classList.add('has-game-cursor');
    drawCaptcha();
    return () => {
      document.documentElement.classList.remove('has-game-cursor');
    };
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (captchaInput.toLowerCase() !== captchaText.toLowerCase()) {
      setError('Incorrect captcha. Are you a bot?');
      drawCaptcha();
      setCaptchaInput('');
      return;
    }
    
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login' 
        ? { username, password }
        : { username, password, display_name: displayName };

      const apiHost = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      const res = await fetch(`${apiHost}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      window.localStorage.setItem('mirrorbound.auth.token', data.token);
      window.localStorage.setItem('mirrorbound.auth.username', data.username);
      window.localStorage.setItem('mirrorbound.auth.admin', String(data.is_admin));
      setAppView('game');
    } catch (err: any) {
      setError(err.message);
      drawCaptcha();
      setCaptchaInput('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen neo-brutalist" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="auth-panel neo-auth">
        <div className="auth-head">
          <h2 className="dialog__title">
            {mode === 'login' ? 'RETURN' : 'AWAKEN'}
          </h2>
        </div>
        
        {error && <div className="auth-error" style={{ border: '4px solid #FF4F00', color: '#FF4F00', fontWeight: 'bold' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>USERNAME</label>
            <input 
              type="text" 
              className="auth-input" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              minLength={3}
            />
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label>DISPLAY NAME</label>
              <input 
                type="text" 
                className="auth-input" 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)} 
                required 
              />
            </div>
          )}

          <div className="auth-field">
            <label>PASSWORD</label>
            <input 
              type="password" 
              className="auth-input" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              minLength={6}
            />
          </div>
          
          <div className="auth-field">
            <label>PROVE YOU ARE HUMAN</label>
            <canvas ref={canvasRef} width="250" height="80" className="captcha-canvas" onClick={drawCaptcha} style={{ cursor: 'pointer' }} title="Click to refresh" />
            <input 
              type="text" 
              className="auth-input" 
              value={captchaInput} 
              onChange={e => setCaptchaInput(e.target.value)} 
              placeholder="Type the characters above"
              required 
            />
          </div>

          <div className="dialog__actions dialog__actions--between" style={{ marginTop: '24px' }}>
            <button 
              type="button" 
              className="btn btn--ghost" 
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
                setCaptchaInput('');
              }}
            >
              {mode === 'login' ? 'NEW HERE?' : 'ALREADY AWAKE?'}
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? '...' : (mode === 'login' ? 'LOGIN' : 'REGISTER')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
