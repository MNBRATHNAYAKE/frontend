// src/Login.js
import React, { useState } from 'react';
import axios from 'axios';
import './App.css'; 

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Login = ({ setToken }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await axios.post(`${API_URL}${endpoint}`, { email, password });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
    } catch (err) {
      setError(err.response?.data?.msg || 'Error occurred');
    }
  };

  return (
    <div className="login-container" style={styles.container}>
      <div className="login-box" style={styles.box}>
        <h2>{isRegister ? 'Create Admin Account' : 'Admin Login'}</h2>
        {error && <div style={{color:'red', marginBottom:'10px'}}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <input 
            type="email" placeholder="Email" required 
            value={email} onChange={e => setEmail(e.target.value)} 
            style={styles.input}
          />
          <input 
            type="password" placeholder="Password" required 
            value={password} onChange={e => setPassword(e.target.value)} 
            style={styles.input}
          />
          <button type="submit" style={styles.button}>{isRegister ? 'Register' : 'Login'}</button>
        </form>

        <p onClick={() => setIsRegister(!isRegister)} style={styles.link}>
          {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: { display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#f0f2f5' },
  box: { padding:'40px', background:'white', borderRadius:'8px', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', textAlign:'center' },
  form: { display:'flex', flexDirection:'column', gap:'15px', width:'300px' },
  input: { padding:'10px', borderRadius:'5px', border:'1px solid #ddd' },
  button: { padding:'10px', background:'#0f172a', color:'white', border:'none', borderRadius:'5px', cursor:'pointer' },
  link: { marginTop:'15px', color:'#3b82f6', cursor:'pointer', fontSize:'0.9rem' }
};

export default Login;