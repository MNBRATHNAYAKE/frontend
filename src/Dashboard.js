// src/Dashboard.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import UptimeChart from "./UptimeChart";
import axios from "axios";

// ✅ Receives 'token' from App.js
function Dashboard({ token }) {
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
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

  // ✅ UPDATED ADD MONITOR (Send Token)
  const addMonitor = async () => {
    if (!newName || !newUrl) return alert("Please enter both a name and a URL");
    let formattedUrl = newUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = 'https://' + formattedUrl;

    try {
      await axios.post(`${API_URL}/monitors`, 
        { name: newName, url: formattedUrl },
        { headers: { 'x-auth-token': token } } // 🔒 Security Header
      );
      setNewName("");
      setNewUrl("");
      fetchData(); 
    } catch (err) {
      if (err.response && err.response.status === 401) alert("Session expired. Please login again.");
      else alert("Failed to add monitor.");
    }
  };

  // ✅ UPDATED DELETE MONITOR (Send Token)
  const deleteMonitor = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await axios.delete(`${API_URL}/monitors/${id}`, {
        headers: { 'x-auth-token': token } // 🔒 Security Header
      });
      fetchData(); 
    } catch (err) {
      if (err.response && err.response.status === 401) alert("Session expired. Please login again.");
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
    if(!window.confirm(`Remove ${emailToDelete} from alerts?`)) return;
    try {
        // Note: We didn't protect this route in backend, but you can if you want!
        await axios.delete(`${API_URL}/subscribers`, { data: { email: emailToDelete } });
        fetchData();
    } catch(err) { alert("Failed to remove subscriber"); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const handleFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFs);
    return () => document.removeEventListener("fullscreenchange", handleFs);
  }, []);

  return (
    <div className={`App ${fullscreen ? "fs-mode" : ""}`}>
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
export default Dashboard;