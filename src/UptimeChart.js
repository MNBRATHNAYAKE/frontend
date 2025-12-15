// UptimeChart.js
import React, { useState, useMemo } from "react";
import Chart from "react-apexcharts";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Helper: Generates consistent time-series data
// CHANGED: 'durationMinutes' argument instead of hours
const generateChartData = (history, durationMinutes) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - durationMinutes * 60 * 1000); // Convert minutes to ms
  const sortedHistory = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Filter points strictly inside the window
  let insideWindow = sortedHistory.filter(item => {
    const t = new Date(item.timestamp).getTime();
    return t >= cutoff.getTime() && t <= now.getTime();
  });

  // Find status immediately BEFORE the window starts to fill the gap
  const previousPoint = sortedHistory.reverse().find(item => new Date(item.timestamp).getTime() < cutoff.getTime());
  
  // Inject "Start" point at cutoff time
  if (previousPoint) {
    insideWindow.unshift({ status: previousPoint.status, timestamp: cutoff.toISOString(), fake: true });
  } else if (insideWindow.length === 0 && sortedHistory.length > 0) {
     insideWindow.push({ ...sortedHistory[0], timestamp: cutoff.toISOString() });
  }

  // Map to x/y coordinates
  let chartData = insideWindow.map(item => ({
    x: new Date(item.timestamp).getTime(),
    y: clamp(item.status === 'up' ? 100 : 0, 0, 100),
    status: item.status,
    timestamp: item.timestamp
  }));

  // Add Step Logic (Square Wave)
  const stepped = [];
  for (let i = 0; i < chartData.length; i++) {
    const curr = chartData[i];
    const prev = chartData[i - 1];
    if (prev && prev.status !== curr.status) {
      stepped.push({ x: curr.x - 1, y: prev.y, status: prev.status, timestamp: curr.timestamp });
    }
    stepped.push(curr);
  }

  // Stretch line to the right edge (NOW)
  if (stepped.length > 0) {
    const last = stepped[stepped.length - 1];
    if (last.x < now.getTime()) {
      stepped.push({ x: now.getTime(), y: last.y, status: last.status, timestamp: now.toISOString() });
    }
  }

  return Array.from(new Map(stepped.map(d => [d.x, d])).values()).sort((a, b) => a.x - b.x);
};

const UptimeChart = ({ history = [], detailed = false }) => {
  // CHANGED: Default range is now "20m"
  const [range, setRange] = useState("20m");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const chartId = useMemo(() => `chart-${Math.random().toString(36).substring(2, 9)}`, []);

  // --- 1. Mini Sparkline Mode (Dashboard Grid) ---
  if (!detailed) {
    // CHANGED: Generate Last 20 Minutes (20) instead of 24h
    const uniqueData = generateChartData(history, 20);
    const sparkOptions = {
      chart: { type: 'line', sparkline: { enabled: true }, animations: { enabled: false } },
      stroke: { curve: 'stepline', width: 2, colors: ['#10b981'] },
      tooltip: { fixed: { enabled: false }, x: { show: false }, y: { title: { formatter: () => '' } }, marker: { show: false } },
      yaxis: { min: 0, max: 100 },
      // CHANGED: X-axis spans 20 minutes
      xaxis: { type: "datetime", min: new Date().getTime() - 20 * 60 * 1000, max: new Date().getTime() },
      colors: ['#10b981']
    };
    
    // Change to Red if currently Down
    const isDown = history.length > 0 && history[history.length - 1].status === 'down';
    if (isDown) { sparkOptions.colors = ['#ef4444']; sparkOptions.stroke.colors = ['#ef4444']; }

    if (!history || history.length === 0) return <div style={{height: 50, background: 'rgba(255,255,255,0.05)', borderRadius: 4}} />;

    return (
      <div style={{ width: '100%', height: '100%' }}>
        <Chart options={sparkOptions} series={[{ data: uniqueData }]} type="line" height={50} width="100%" />
      </div>
    );
  }

  // --- 2. Detailed Mode (Popup Modal) ---
  
  // CHANGED: Logic for new ranges (20m, 1h, 3h)
  let minutes = 20; // Default 20m
  if (range === "1h") minutes = 60;
  if (range === "3h") minutes = 180;
  
  const uniqueData = generateChartData(history, minutes);
  const series = [{ name: "Uptime", data: uniqueData }];

  const chartOptions = {
    chart: {
      id: chartId,
      type: "line",
      background: "transparent",
      zoom: { enabled: true, type: "x", autoScaleYaxis: true },
      toolbar: { show: true, tools: { download: false, reset: true, zoom: true } },
      animations: { enabled: false },
    },
    stroke: { curve: "stepline", width: 2, colors: ["#10b981"] },
    theme: { mode: 'dark' },
    markers: {
      size: 4, strokeWidth: 1, hover: { size: 6 },
      discrete: uniqueData.filter(d => d.status === "down").map(d => ({
          seriesIndex: 0, dataPointIndex: uniqueData.indexOf(d), fillColor: "#ef4444", strokeColor: "#fff", size: 6, shape: "circle",
        })),
    },
    yaxis: { min: 0, max: 100, tickAmount: 1, labels: { formatter: val => (val === 100 ? "Up" : "Down"), style: { colors: "#aaa" } } },
    // CHANGED: X-axis uses 'minutes' logic
    xaxis: { type: "datetime", min: new Date().getTime() - minutes * 60 * 1000, max: new Date().getTime(), labels: { datetimeUTC: false, style: { colors: "#ccc", fontSize: "11px" } }, tooltip: { enabled: false } },
    grid: { borderColor: "rgba(255,255,255,0.06)", strokeDashArray: 4 },
    tooltip: { theme: "dark", x: { format: "HH:mm:ss" }, y: { formatter: val => (val === 100 ? "Online" : "Offline") } }, // Changed date format to show seconds
    legend: { show: false },
  };

  const downloadCSV = () => {
    // Keep CSV export for 6 days so users don't lose data access
    const sixDaysAgo = new Date(new Date().getTime() - 6 * 24 * 60 * 60 * 1000);
    const dataToExport = history.filter(item => new Date(item.timestamp) >= sixDaysAgo).map(item => ({ Timestamp: item.timestamp, Status: item.status }));
    const csvContent = "data:text/csv;charset=utf-8," + ["Timestamp,Status", ...dataToExport.map(e => `${e.Timestamp},${e.Status}`)].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "uptime_events_past_6_days.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // Filter & limit events for the table
  const recentEvents = history
    .filter(item => new Date(item.timestamp) >= new Date().getTime() - 6 * 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Logic: Show only 5 unless expanded
  const visibleEvents = showAllHistory ? recentEvents : recentEvents.slice(0, 5);

  return (
    <div style={{ width: "100%" }}>
      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: 'center' }}>
        <select value={range} onChange={e => setRange(e.target.value)} style={{ background: "#2c2c3c", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: 'pointer' }}>
          {/* CHANGED: New Options */}
          <option value="20m">Last 20 Minutes</option>
          <option value="1h">Last 1 Hour</option>
          <option value="3h">Last 3 Hours</option>
        </select>
        <button onClick={downloadCSV} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 10, cursor: "pointer", fontWeight: "bold" }}>Download Events (6 days)</button>
      </div>

      {/* Main Chart */}
      <div style={{ backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 8 }}>
        {uniqueData.length > 0 ? <Chart options={chartOptions} series={series} type="line" height={260} /> : <div style={{height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666'}}>No Data Available</div>}
      </div>

      {/* Events Table */}
      <div style={{ marginTop: 20, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 10 }}>
        <h4 style={{ margin: "0 0 10px 0", color: "#10b981", fontSize: "0.95rem" }}>Events (Past 6 Days)</h4>
        <div style={{ width: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#ddd" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333", textAlign: "left" }}>
                <th style={{ padding: "6px", color: "#888" }}>Timestamp</th>
                <th style={{ padding: "6px", color: "#888" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvents.map((e, i) => (
                <tr key={i} style={{ backgroundColor: e.status === "down" ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.05)", borderBottom: '1px solid #222' }}>
                  <td style={{ padding: "8px", color: "#ccc" }}>{new Date(e.timestamp).toLocaleString()}</td>
                  <td style={{ padding: "8px", color: e.status === "down" ? "#ef4444" : "#10b981", fontWeight: 600, textTransform: "capitalize" }}>{e.status}</td>
                </tr>
              ))}
              {recentEvents.length === 0 && <tr><td colSpan="2" style={{ textAlign: "center", padding: "15px", color: "#666" }}>No events found in the last 6 days.</td></tr>}
            </tbody>
          </table>
          
          {/* Show More Button */}
          {recentEvents.length > 5 && (
            <button 
              onClick={() => setShowAllHistory(!showAllHistory)}
              style={{ width: "100%", marginTop: "10px", padding: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#ccc", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}
            >
              {showAllHistory ? "Show Less ▲" : `Show All History (${recentEvents.length}) ▼`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UptimeChart;