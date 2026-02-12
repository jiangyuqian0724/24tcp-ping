const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const net = require('net');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Data directory
const DATA_DIR = path.join(__dirname, 'data');
const MONITORS_FILE = path.join(DATA_DIR, 'monitors.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('Created data directory:', DATA_DIR);
}

// Data storage
const monitors = new Map();
const pingHistory = new Map();
const MAX_HISTORY = 1000;

class TCPMonitor {
  constructor(id, host, port, interval = 5000) {
    this.id = id;
    this.host = host;
    this.port = port;
    this.interval = interval;
    this.isRunning = false;
    this.timer = null;
    this.stats = {
      totalPings: 0,
      successfulPings: 0,
      failedPings: 0,
      averageLatency: 0,
      lastStatus: 'unknown',
      lastLatency: 0,
      lastCheck: null,
      uptime: 0,
      downtime: 0
    };
  }

  async ping() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const socket = new net.Socket();
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({ success: false, latency: 0, error: 'Timeout' });
        }
      }, 5000);

      socket.connect(this.port, this.host, () => {
        if (!resolved) {
          resolved = true;
          const latency = Date.now() - startTime;
          clearTimeout(timeout);
          socket.destroy();
          resolve({ success: true, latency, error: null });
        }
      });

      socket.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.destroy();
          resolve({ success: false, latency: 0, error: err.message });
        }
      });
    });
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const doPing = async () => {
      if (!this.isRunning) return;

      const result = await this.ping();
      const timestamp = Date.now();

      // Update stats
      this.stats.totalPings++;
      this.stats.lastCheck = timestamp;
      this.stats.lastLatency = result.latency;

      if (result.success) {
        this.stats.successfulPings++;
        this.stats.lastStatus = 'online';
        this.stats.uptime++;

        // Update average latency
        const totalLatency = this.stats.averageLatency * (this.stats.successfulPings - 1) + result.latency;
        this.stats.averageLatency = Math.round(totalLatency / this.stats.successfulPings);
      } else {
        this.stats.failedPings++;
        this.stats.lastStatus = 'offline';
        this.stats.downtime++;
      }

      // Store in history
      const history = pingHistory.get(this.id) || [];
      history.push({
        timestamp,
        success: result.success,
        latency: result.latency,
        error: result.error
      });

      // Keep only last MAX_HISTORY entries
      if (history.length > MAX_HISTORY) {
        history.shift();
      }
      pingHistory.set(this.id, history);

      // Broadcast to all connected clients
      broadcastUpdate(this.id);

      // Schedule next ping
      this.timer = setTimeout(doPing, this.interval);
    };

    doPing();
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getInfo() {
    return {
      id: this.id,
      host: this.host,
      port: this.port,
      interval: this.interval,
      isRunning: this.isRunning,
      stats: this.stats
    };
  }

  toJSON() {
    return {
      id: this.id,
      host: this.host,
      port: this.port,
      interval: this.interval,
      stats: this.stats
    };
  }

  static fromJSON(data) {
    const monitor = new TCPMonitor(data.id, data.host, data.port, data.interval);
    monitor.stats = data.stats || monitor.stats;
    return monitor;
  }
}

// Data persistence functions
function saveData() {
  try {
    // Save monitors
    const monitorsData = Array.from(monitors.values()).map(m => m.toJSON());
    fs.writeFileSync(MONITORS_FILE, JSON.stringify(monitorsData, null, 2));

    // Save history
    const historyData = {};
    pingHistory.forEach((value, key) => {
      historyData[key] = value;
    });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2));

    console.log('Data saved successfully');
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

function loadData() {
  try {
    // Load monitors
    if (fs.existsSync(MONITORS_FILE)) {
      const monitorsData = JSON.parse(fs.readFileSync(MONITORS_FILE, 'utf8'));
      monitorsData.forEach(data => {
        const monitor = TCPMonitor.fromJSON(data);
        monitors.set(monitor.id, monitor);
        monitor.start(); // Auto-start loaded monitors
      });
      console.log(`Loaded ${monitorsData.length} monitors from disk`);
    }

    // Load history
    if (fs.existsSync(HISTORY_FILE)) {
      const historyData = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      Object.keys(historyData).forEach(key => {
        pingHistory.set(key, historyData[key]);
      });
      console.log('Loaded ping history from disk');
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Auto-save data every 60 seconds
setInterval(saveData, 60000);

// Save data on process exit
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  saveData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  saveData();
  process.exit(0);
});

// WebSocket broadcast
function broadcastUpdate(monitorId) {
  const monitor = monitors.get(monitorId);
  if (!monitor) return;

  const data = JSON.stringify({
    type: 'update',
    data: monitor.getInfo()
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');

  // Send current monitors state
  const allMonitors = Array.from(monitors.values()).map(m => m.getInfo());
  ws.send(JSON.stringify({
    type: 'init',
    data: allMonitors
  }));

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// REST API Routes

// Get all monitors
app.get('/api/monitors', (req, res) => {
  const allMonitors = Array.from(monitors.values()).map(m => m.getInfo());
  res.json(allMonitors);
});

// Get specific monitor
app.get('/api/monitors/:id', (req, res) => {
  const monitor = monitors.get(req.params.id);
  if (!monitor) {
    return res.status(404).json({ error: 'Monitor not found' });
  }
  res.json(monitor.getInfo());
});

// Get monitor history
app.get('/api/monitors/:id/history', (req, res) => {
  let history = pingHistory.get(req.params.id) || [];

  // Time range filter
  const range = req.query.range;
  const now = Date.now();

  if (range) {
    const rangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    if (rangeMs[range]) {
      const cutoff = now - rangeMs[range];
      history = history.filter(h => h.timestamp >= cutoff);
    }
  }

  // Limit (default to all if not specified)
  const limit = parseInt(req.query.limit);
  if (limit && limit > 0) {
    history = history.slice(-limit);
  }

  res.json(history);
});

// Create new monitor
app.post('/api/monitors', (req, res) => {
  const { host, port, interval } = req.body;

  if (!host || !port) {
    return res.status(400).json({ error: 'Host and port are required' });
  }

  const id = `${host}:${port}`;

  if (monitors.has(id)) {
    return res.status(409).json({ error: 'Monitor already exists' });
  }

  const monitor = new TCPMonitor(id, host, parseInt(port), interval || 5000);
  monitors.set(id, monitor);
  monitor.start();
  saveData(); // Persist new monitor

  res.status(201).json(monitor.getInfo());
});

// Delete monitor
app.delete('/api/monitors/:id', (req, res) => {
  const monitor = monitors.get(req.params.id);

  if (!monitor) {
    return res.status(404).json({ error: 'Monitor not found' });
  }

  monitor.stop();
  monitors.delete(req.params.id);
  pingHistory.delete(req.params.id);
  saveData(); // Persist deletion

  res.json({ message: 'Monitor deleted' });
});

// Start/stop monitor
app.post('/api/monitors/:id/:action', (req, res) => {
  const monitor = monitors.get(req.params.id);

  if (!monitor) {
    return res.status(404).json({ error: 'Monitor not found' });
  }

  const action = req.params.action;

  if (action === 'start') {
    monitor.start();
  } else if (action === 'stop') {
    monitor.stop();
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }
  saveData(); // Persist state change

  res.json(monitor.getInfo());
});

// Update monitor
app.patch('/api/monitors/:id', (req, res) => {
  const monitor = monitors.get(req.params.id);

  if (!monitor) {
    return res.status(404).json({ error: 'Monitor not found' });
  }

  const { interval } = req.body;

  if (interval !== undefined) {
    monitor.interval = parseInt(interval);
    if (monitor.isRunning) {
      monitor.stop();
      monitor.start();
    }
    saveData();
  }

  res.json(monitor.getInfo());
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Load saved data on startup
loadData();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`TCP Ping Monitor running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready for real-time updates`);
  console.log(`Data will be saved to: ${DATA_DIR}`);
});
