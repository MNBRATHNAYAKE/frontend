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

  // State for UI & Subscriptions
  const [email, setEmail] = useState("");
  const [subCount, setSubCount] = useState(0);
  const [subMessage, setSubMessage] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // --- NEW: Alert System State ---
  const prevStatusRef = useRef({}); // Remembers the previous status
  const [permission, setPermission] = useState('default');
  // -------------------------------

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  // --- NEW: 1. Request Notification Permission on Load ---
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(perm => setPermission(perm));
    }
  }, []);

  // --- NEW: 2. Alert Logic (Runs whenever 'monitors' updates) ---
  useEffect(() => {
    if (!monitors || monitors.length === 0) return;

    monitors.forEach(monitor => {
      // Use _id because that is what MongoDB uses
      const id = monitor._id; 
      const currentStatus = monitor.status; // "up" or "down"
      const prev = prevStatusRef.current[id];

      // A. If it WAS 'up' and now is 'down' -> BAD SOUND
      if (prev && prev === 'up' && currentStatus === 'down') {
         triggerAlert(monitor.name, 'down');
      }

      // B. If it WAS 'down' and now is 'up' -> GOOD SOUND
      if (prev && prev === 'down' && currentStatus === 'up') {
         triggerAlert(monitor.name, 'up');
      }

      // Update memory for next check
      prevStatusRef.current[id] = currentStatus;
    });
  }, [monitors]);

  // --- NEW: 3. Helper to play sound & show popup ---
  const triggerAlert = (siteName, type) => {
    // 1. Play Sound
    const soundFile = type === 'down' 
      ? 'https://www.soundjay.com/buttons/beep-03.mp3' 
      : 'https://www.soundjay.com/buttons/button-09.mp3';
    
    const audio = new Audio(soundFile);
    audio.play().catch(e => console.log("Audio blocked until user interacts"));

    // 2. Show Notification (if allowed)
    if (permission === 'granted') {
      const title = type === 'down' ? `🚨 ${siteName} is DOWN` : `✅ ${siteName} is UP`;
      new Notification(title, {
          body: `Status changed at ${new Date().toLocaleTimeString()}`,
          icon: '/logo192.png', // Optional: Ensure this image exists in public folder
          silent: true // We play our own sound above
      });
    }
  };
  // ---------------------------------------------------------


  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Fetch Data
  const fetchData = useCallback(async () => {
    try {
      const [monRes, subRes] = await Promise.all([
        axios.get(`${API_URL}/monitors`),
        axios.get(`${API_URL}/subscribers`)
      ]);
      setMonitors(monRes.data);
      setSubCount(subRes.data.count);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, [API_URL]);

  // Add Monitor Function
  const addMonitor = async () => {
    if (!newName || !newUrl) return alert("Please enter both a name and a URL");
    
    // Basic URL validation
    let formattedUrl = newUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    try {
      await axios.post(`${API_URL}/monitors`, { 
        name: newName, 
        url: formattedUrl 
      });
      setNewName("");
      setNewUrl("");
      fetchData(); // Refresh immediately
    } catch (err) {
      alert("Failed to add monitor. Check console.");
      console.error(err);
    }
  };

  // Delete Monitor Function
  const deleteMonitor = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/monitors/${id}`);
      fetchData(); // Refresh grid immediately
    } catch (err) {
      alert("Failed to delete monitor.");
      console.error(err);
    }
  };

  // Add Subscriber Function
  const addSubscriber = async () => {
    if (!email) return;
    try {
      await axios.post(`${API_URL}/subscribers`, { email });
      setEmail("");
      setSubMessage("✅ Subscribed successfully!");
      fetchData();
    } catch (err) {
      setSubMessage("❌ Error subscribing.");
    }
    setTimeout(() => setSubMessage(""), 4000);
  };

  // Polling Effect
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fullscreen Listener
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

          {/* Admin Panel (Add Monitor) */}
          <div className="admin-panel">
            <h3>Add New Service</h3>
            <div className="input-row">
              <input 
                type="text" 
                placeholder="Name (e.g. Google)" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input 
                type="text" 
                placeholder="URL (e.g. google.com)" 
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
              <button className="add-btn" onClick={addMonitor}>+ Add</button>
            </div>
          </div>

          {/* Controls */}
          <div className="controls">
            <button className="fs-btn" onClick={toggleFullscreen}>
              ⛶ Fullscreen View
            </button>
          </div>

          {/* Subscribers */}
          <div className="subscriber-section">
            <div className="sub-input-group">
              <input
                type="email"
                placeholder="Enter email for alerts"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="add-btn" onClick={addSubscriber}>Subscribe</button>
            </div>
            {subMessage && <span style={{display:'block', marginTop:'10px', color: '#34d399'}}>{subMessage}</span>}
            <small style={{display:'block', marginTop:'10px', color: '#94a3b8'}}>{subCount} active subscribers</small>
          </div>
        </header>
      )}

      {/* Grid Layout */}
      <div className="monitors-grid">
        {monitors.map((m) => (
          <div key={m._id} className={`monitor-card ${m.status}`}>
            
            <button 
              className="delete-card-btn" 
              onClick={(e) => { e.stopPropagation(); deleteMonitor(m._id, m.name); }}
              title="Delete Monitor"
            >
              🗑️
            </button>

            <div className="status-badge">{m.status}</div>
            
            <div className="monitor-details">
              <h3>{m.name}</h3>
              <a href={m.url} target="_blank" rel="noreferrer" className="monitor-link">{m.url}</a>
            </div>
            
            <div className="mini-chart">
               <UptimeChart history={m.history} /> 
            </div>
            
            <button className="details-btn" onClick={() => setSelectedMonitor(m)}>
              View Analytics
            </button>
          </div>
        ))}
      </div>

      {/* Modal Popup */}
      {selectedMonitor && (
        <div className="modal-overlay" onClick={() => setSelectedMonitor(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedMonitor(null)}>×</button>
            
            <div className="modal-header">
              <h2 style={{margin:0}}>{selectedMonitor.name}</h2>
              <span className={`status-pill ${selectedMonitor.status}`}>
                {selectedMonitor.status.toUpperCase()}
              </span>
              <a href={selectedMonitor.url} target="_blank" rel="noreferrer" className="modal-url">{selectedMonitor.url}</a>
            </div>
            
            <div className="chart-wrapper">
              <UptimeChart history={selectedMonitor.history} detailed />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;