// App.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import UptimeChart from "./UptimeChart";
import axios from "axios";

function App() {
  const [monitors, setMonitors] = useState([]);
  
  // State for adding monitors
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  // State for Subscribers
  const [email, setEmail] = useState("");
  const [subscribers, setSubscribers] = useState([]); // List of actual emails
  const [subMessage, setSubMessage] = useState("");
  const [showSubModal, setShowSubModal] = useState(false); // Toggle Manager

  // UI State
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Alert System
  const prevStatusRef = useRef({});
  const [permission, setPermission] = useState('default');

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  // 1. Request Notification Permission
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(perm => setPermission(perm));
    }
  }, []);

  // 2. Alert Logic
  useEffect(() => {
    if (!monitors || monitors.length === 0) return;

    monitors.forEach(monitor => {
      const id = monitor._id; 
      const currentStatus = monitor.status; 
      const prev = prevStatusRef.current[id];

      if (prev && prev === 'up' && currentStatus === 'down') {
         triggerAlert(monitor.name, 'down');
      }
      if (prev && prev === 'down' && currentStatus === 'up') {
         triggerAlert(monitor.name, 'up');
      }
      prevStatusRef.current[id] = currentStatus;
    });
  }, [monitors]);

  // 3. Helper to play sound
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

  // Fetch Data (Monitors + Subscribers List)
  const fetchData = useCallback(async () => {
    try {
      const [monRes, subRes] = await Promise.all([
        axios.get(`${API_URL}/monitors`),
        axios.get(`${API_URL}/subscribers`)
      ]);
      setMonitors(monRes.data);
      setSubscribers(subRes.data); // Store full list
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, [API_URL]);

  // Add Monitor
  const addMonitor = async () => {
    if (!newName || !newUrl) return alert("Please enter both a name and a URL");
    let formattedUrl = newUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = 'https://' + formattedUrl;

    try {
      await axios.post(`${API_URL}/monitors`, { name: newName, url: formattedUrl });
      setNewName("");
      setNewUrl("");
      fetchData(); 
    } catch (err) {
      alert("Failed to add monitor.");
    }
  };

  // Delete Monitor
  const deleteMonitor = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await axios.delete(`${API_URL}/monitors/${id}`);
      fetchData(); 
    } catch (err) {
      alert("Failed to delete.");
    }
  };

  // Add Subscriber
  const addSubscriber = async () => {
    if (!email) return;
    try {
      await axios.post(`${API_URL}/subscribers`, { email });
      setEmail("");
      setSubMessage("✅ Subscribed!");
      fetchData();
    } catch (err) {
      setSubMessage("❌ Error.");
    }
    setTimeout(() => setSubMessage(""), 4000);
  };

  // Delete Subscriber (NEW)
  const deleteSubscriber = async (emailToDelete) => {
    if(!window.confirm(`Remove ${emailToDelete} from alerts?`)) return;
    try {
        await axios.delete(`${API_URL}/subscribers`, { data: { email: emailToDelete } });
        fetchData();
    } catch(err) {
        alert("Failed to remove subscriber");
    }
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

          {/* Admin Panel */}
          <div className="admin-panel">
            <h3>Add New Service</h3>
            <div className="input-row">
              <input type="text" placeholder="Name (e.g. Google)" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input type="text" placeholder="URL (e.g. google.com)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              <button className="add-btn" onClick={addMonitor}>+ Add</button>
            </div>
          </div>

          <div className="controls">
            <button className="fs-btn" onClick={toggleFullscreen}>⛶ Fullscreen</button>
          </div>

          {/* Subscriber Section */}
          <div className="subscriber-section">
            <div className="sub-input-group">
              <input
                type="email"
                placeholder="Enter email for alerts"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="add-btn" onClick={addSubscriber}>Subscribe</button>
              
              {/* Manage Button */}
              <button 
                className="add-btn" 
                style={{backgroundColor: '#64748b', marginLeft:'5px'}}
                onClick={() => setShowSubModal(true)}
              >
                Manage ({subscribers.length})
              </button>
            </div>
            {subMessage && <span style={{display:'block', marginTop:'10px', color: '#34d399'}}>{subMessage}</span>}
          </div>
        </header>
      )}

      {/* Grid Layout */}
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

      {/* Monitor Detail Modal */}
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

      {/* Subscriber Manager Modal (NEW) */}
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
                     <button 
                       onClick={() => deleteSubscriber(sub.email)}
                       style={{background:'#ef4444', color:'white', border:'none', borderRadius:'4px', padding:'5px 10px', cursor:'pointer'}}
                     >
                       Remove
                     </button>
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

export default App;