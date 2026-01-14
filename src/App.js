import React, { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import UptimeChart from "./UptimeChart";
import axios from "axios";

// --- LOGIN COMPONENT (Internal) ---
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    try {
      const res = await axios.post(`${API_URL}${endpoint}`, { email, password });
      onLogin(res.data.token);
    } catch (err) {
      setError(err.response?.data?.msg || "Authentication failed");
    }
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginBox}>
        <h2 style={{ marginBottom: "20px", color:"red" }}>{isRegister ? "Create Admin Account" : "Admin Login"}</h2>
        {error && <div style={{ color: "red", marginBottom: "15px" }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <input 
            type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} 
            style={styles.input}
          />
          <input 
            type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} 
            style={styles.input}
          />
          <button type="submit" style={styles.button}>{isRegister ? "Register" : "Login"}</button>
        </form>
        <p onClick={() => setIsRegister(!isRegister)} style={styles.link}>
          {isRegister ? "Already have an account? Login" : "Need an account? Register"}
        </p>
      </div>
    </div>
  );
};

// --- MAIN WEBSITE COMPONENT ---
function App() {
  // 🔐 Auth State
  const [token, setToken] = useState(localStorage.getItem("token"));
  
  // Dashboard State
  const [monitors, setMonitors] = useState([]);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [email, setEmail] = useState("");
  const [subscribers, setSubscribers] = useState([]); 
  const [subMessage, setSubMessage] = useState("");
  const [showSubModal, setShowSubModal] = useState(false); 
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const prevStatusRef = useRef({});
  const [permission, setPermission] = useState('default');
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  // --- LOGOUT FUNCTION ---
  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  // --- 1. Notification Permission ---
  useEffect(() => {
    if ('Notification' in window) Notification.requestPermission().then(perm => setPermission(perm));
  }, []);

  // --- 2. Alert Logic ---
  useEffect(() => {
    if (!monitors || monitors.length === 0) return;
    monitors.forEach(monitor => {
      const id = monitor._id; 
      const currentStatus = monitor.status; 
      const prev = prevStatusRef.current[id];

      if (prev && prev === 'up' && currentStatus === 'down') triggerAlert(monitor.name, 'down');
      if (prev && prev === 'down' && currentStatus === 'up') triggerAlert(monitor.name, 'up');
      
      prevStatusRef.current[id] = currentStatus;
    });
  }, [monitors]);

  const triggerAlert = (siteName, type) => {
    const soundFile = type === 'down' 
      ? 'https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3' 
      : 'https://www.soundjay.com/buttons/button-09.mp3';
    const audio = new Audio(soundFile);
    audio.play().catch(e => console.log("Audio blocked"));
    if (permission === 'granted') {
      new Notification(type === 'down' ? `🚨 ${siteName} is DOWN` : `✅ ${siteName} is UP`, {
          body: `Status changed at ${new Date().toLocaleTimeString()}`,
          silent: true 
      });
    }
  };

  // --- Fetch Data ---
  const fetchData = useCallback(async () => {
    try {
      const [monRes, subRes] = await Promise.all([
        axios.get(`${API_URL}/monitors`),
        axios.get(`${API_URL}/subscribers`)
      ]);
      setMonitors(monRes.data);
      setSubscribers(subRes.data);
      setLastUpdated(new Date());
    } catch (err) { console.error("Fetch error:", err); }
  }, [API_URL]);

  // --- Poll Data (Only if Logged in) ---
  useEffect(() => {
    if (token) {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }
  }, [fetchData, token]);

  // --- Actions (Protected) ---
  const addMonitor = async () => {
    if (!newName || !newUrl) return alert("Please enter both a name and a URL");
    let formattedUrl = newUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = 'https://' + formattedUrl;

    try {
      // 🔐 Attach Token
      await axios.post(`${API_URL}/monitors`, { name: newName, url: formattedUrl }, { headers: { 'x-auth-token': token } });
      setNewName("");
      setNewUrl("");
      fetchData(); 
    } catch (err) {
       if(err.response?.status === 401) handleLogout();
       else alert("Failed to add monitor.");
    }
  };

  const deleteMonitor = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      // 🔐 Attach Token
      await axios.delete(`${API_URL}/monitors/${id}`, { headers: { 'x-auth-token': token } });
      fetchData(); 
    } catch (err) {
       if(err.response?.status === 401) handleLogout();
       else alert("Failed to delete.");
    }
  };

  const addSubscriber = async () => {
    if (!email) return;
    try {
      await axios.post(`${API_URL}/subscribers`, { email });
      setEmail("");
      setSubMessage("✅ Subscribed!");
      fetchData();
    } catch (err) { setSubMessage("❌ Error."); }
    setTimeout(() => setSubMessage(""), 4000);
  };

  const deleteSubscriber = async (emailToDelete) => {
    if(!window.confirm(`Remove ${emailToDelete}?`)) return;
    try {
        await axios.delete(`${API_URL}/subscribers`, { data: { email: emailToDelete } });
        fetchData();
    } catch(err) { alert("Failed to remove subscriber"); }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  useEffect(() => {
    const handleFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFs);
    return () => document.removeEventListener("fullscreenchange", handleFs);
  }, []);

  // 🛑 RENDER LOGIN IF NO TOKEN
  if (!token) {
      return <LoginScreen onLogin={(t) => { localStorage.setItem("token", t); setToken(t); }} />;
  }

  // 🟢 RENDER DASHBOARD IF LOGGED IN
  return (
    <div className={`App ${fullscreen ? "fs-mode" : ""}`}>
      {/* Logout Button */}
      <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>

      {!fullscreen && (
        <header>
          <div className="header-top">
            <h1>System Status</h1>
            <div className="live-indicator">
               <span className="dot"></span>
               Live {lastUpdated && `(${lastUpdated.toLocaleTimeString()})`}
            </div>
          </div>

          <div className="admin-panel">
            <h3>Add New Service</h3>
            <div className="input-row">
              <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input type="text" placeholder="URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              <button className="add-btn" onClick={addMonitor}>+ Add</button>
            </div>
          </div>

          <div className="controls">
            <button className="fs-btn" onClick={toggleFullscreen}>⛶ Fullscreen</button>
          </div>

          <div className="subscriber-section">
            <div className="sub-input-group">
              <input type="email" placeholder="Enter email for alerts" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="add-btn" onClick={addSubscriber}>Subscribe</button>
              <button className="add-btn" style={{backgroundColor: '#64748b', marginLeft:'5px'}} onClick={() => setShowSubModal(true)}>
                Manage ({subscribers.length})
              </button>
            </div>
            {subMessage && <span style={{display:'block', marginTop:'10px', color: '#34d399'}}>{subMessage}</span>}
          </div>
        </header>
      )}

      <div className="monitors-grid">
        {monitors.map((m) => (
          <div key={m._id} className={`monitor-card ${m.status}`}>
            <button className="delete-card-btn" onClick={(e) => { e.stopPropagation(); deleteMonitor(m._id, m.name); }}>🗑️</button>
            <div className="status-badge">{m.status}</div>
            <div className="monitor-details">
              <h3>{m.name}</h3>
              <a href={m.url} target="_blank" rel="noreferrer" className="monitor-link">{m.url}</a>
            </div>
            <div className="mini-chart"> <UptimeChart history={m.history} /> </div>
            <button className="details-btn" onClick={() => setSelectedMonitor(m)}>View Analytics</button>
          </div>
        ))}
      </div>

      {selectedMonitor && (
        <div className="modal-overlay" onClick={() => setSelectedMonitor(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedMonitor(null)}>×</button>
            <div className="modal-header">
              <h2>{selectedMonitor.name}</h2>
              <span className={`status-pill ${selectedMonitor.status}`}>{selectedMonitor.status.toUpperCase()}</span>
            </div>
            <div className="chart-wrapper"> <UptimeChart history={selectedMonitor.history} detailed /> </div>
          </div>
        </div>
      )}

      {showSubModal && (
        <div className="modal-overlay" onClick={() => setShowSubModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth:'400px'}}>
             <button className="close-btn" onClick={() => setShowSubModal(false)}>×</button>
             <h2>Manage Subscribers</h2>
             <p style={{color:'#666', fontSize:'0.9rem'}}>Remove invalid emails to fix alerts.</p>
             {subscribers.length === 0 ? <p>No subscribers yet.</p> : (
               <ul style={{listStyle:'none', padding:0, marginTop:'20px'}}>
                 {subscribers.map(sub => (
                   <li key={sub._id} style={{display:'flex', justifyContent:'space-between', padding:'10px', borderBottom:'1px solid #eee'}}>
                     <span>{sub.email}</span>
                     <button onClick={() => deleteSubscriber(sub.email)} style={{background:'#ef4444', color:'white', border:'none', borderRadius:'4px', padding:'5px 10px', cursor:'pointer'}}>Remove</button>
                   </li>
                 ))}
               </ul>
             )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- STYLES FOR LOGIN SCREEN ---
const styles = {
  loginContainer: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f0f2f5" },
  loginBox: { padding: "40px", backgroundColor: "white", borderRadius: "10px", boxShadow: "0 4px 10px rgba(0,0,0,0.1)", textAlign: "center", width: "350px" },
  input: { padding: "12px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "16px" },
  button: { padding: "12px", backgroundColor: "#1e293b", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" },
  link: { marginTop: "15px", color: "#3b82f6", cursor: "pointer", fontSize: "14px" },
  logoutBtn: { position: 'fixed', top: '15px', right: '15px', zIndex: 9999, background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};

export default App;