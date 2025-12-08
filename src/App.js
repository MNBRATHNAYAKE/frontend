// App.js
import React, { useEffect, useState, useCallback } from "react";
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

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

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
      
      {/* --- NEW: Import Modern Font (Outfit) --- */}
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');`}
      </style>
      {/* ---------------------------------------- */}

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
              <button className="add-btn" onClick={addMonitor}>+ Add Monitor</button>
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
              <button onClick={addSubscriber}>Subscribe</button>
            </div>
            {subMessage && <span style={{display:'block', marginTop:'10px', color: '#10b981'}}>{subMessage}</span>}
            <small style={{display:'block', marginTop:'10px', color: '#94a3b8'}}>{subCount} active subscribers</small>
          </div>
        </header>
      )}

      {/* Grid Layout */}
      <div className="monitors-grid">
        {monitors.map((m) => (
          <div key={m._id} className={`monitor-card ${m.status}`}>
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
              <h2>{selectedMonitor.name}</h2>
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