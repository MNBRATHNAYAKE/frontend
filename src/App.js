import React, { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import UptimeChart from "./UptimeChart";
import axios from "axios";

// --- LOGIN COMPONENT (Internal) ---
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState(""); // ✅ NEW: State for Secret Key
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    
    // ✅ NEW: Send Admin Key only if registering
    const payload = { email, password };
    if (isRegister) payload.adminKey = adminKey;

    try {
      const res = await axios.post(`${API_URL}${endpoint}`, payload);
      onLogin(res.data.token);
    } catch (err) {
      setError(err.response?.data?.msg || "Authentication failed");
    }
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginBox}>
        <h2 style={styles.title}>
          {isRegister ? "Create Admin Account" : "Admin Login"}
        </h2>
        
        {error && <div style={{ color: "red", marginBottom: "15px" }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* ✅ SECRET KEY INPUT (Only shows when Registering) */}
          {isRegister && (
            <input 
              type="password" 
              placeholder="Admin Secret Key" 
              required 
              value={adminKey} 
              onChange={(e) => setAdminKey(e.target.value)} 
              style={{...styles.input, border: '2px solid #3b82f6', background: 'white'}} 
            />
          )}

          <input 
            type="email" 
            placeholder="Email" 
            required 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            style={styles.input}
          />
          <input 
            type="password" 
            placeholder="Password" 
            required 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={styles.input}
          />
          <button type="submit" style={styles.button}>
            {isRegister ? "Register" : "Login"}
          </button>
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  useEffect(() => {
    if ('Notification' in window) Notification.requestPermission().then(perm => setPermission(perm));
  }, []);

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

  useEffect(() => {
    if (token) {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }
  }, [fetchData, token]);

  const addMonitor = async () => {
    if (!newName || !newUrl) return alert("Please enter both a name and a URL");
    let formattedUrl = newUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = 'https://' + formattedUrl;

    try {
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

  if (!token) {
      return <LoginScreen onLogin={(t) => { localStorage.setItem("token", t); setToken(t); }} />;
  }

  return (
    <div className={`App ${fullscreen ? "fs-mode" : ""}`}>
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

const styles = {
  loginContainer: { 
    display: "flex", 
    justifyContent: "center", 
    alignItems: "center", 
    height: "100vh", 
    backgroundColor: "#f0f2f5" 
  },
  loginBox: { 
    padding: "40px 30px", 
    backgroundColor: "white", 
    borderRadius: "12px", 
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)", 
    textAlign: "center", 
    width: "100%", 
    maxWidth: "400px" 
  },
  title: {
    color: "#1e293b", 
    marginBottom: "30px",
    fontSize: "26px",
    fontWeight: "bold",
    margin: "0 0 25px 0"
  },
  input: { 
    padding: "15px", 
    borderRadius: "8px", 
    border: "none", 
    backgroundColor: "#9ca3af", 
    color: "black",
    fontSize: "16px",
    outline: "none"
  },
  button: { 
    padding: "15px", 
    backgroundColor: "#1e293b", 
    color: "white", 
    border: "none", 
    borderRadius: "8px", 
    cursor: "pointer", 
    fontSize: "16px", 
    fontWeight: "bold",
    transition: "background 0.2s"
  },
  link: { 
    marginTop: "20px", 
    color: "#3b82f6", 
    cursor: "pointer", 
    fontSize: "14px",
    fontWeight: "500" 
  },
  logoutBtn: { 
    position: 'fixed', 
    top: '15px', 
    right: '15px', 
    zIndex: 9999, 
    background: '#ef4444', 
    color: 'white', 
    border: 'none', 
    padding: '8px 16px', 
    borderRadius: '4px', 
    cursor: 'pointer', 
    fontWeight: 'bold' 
  }
};

export default App;