// WebSocket connection
let ws = null;
let monitors = new Map();
let charts = new Map();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    loadMonitors();
    setupEventListeners();
});

// WebSocket
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionStatus(false);
        // Reconnect after 3 seconds
        setTimeout(initWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
    };
}

function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('wsStatus');
    const statusText = document.getElementById('wsStatusText');

    if (connected) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = '已连接';
    } else {
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = '未连接';
    }
}

function handleWebSocketMessage(message) {
    if (message.type === 'init') {
        message.data.forEach(monitor => {
            monitors.set(monitor.id, monitor);
            renderMonitor(monitor);
        });
        updateStats();
    } else if (message.type === 'update') {
        monitors.set(message.data.id, message.data);
        updateMonitor(message.data);
        updateStats();
    }
}

// Event Listeners
function setupEventListeners() {
    const addForm = document.getElementById('addMonitorForm');
    addForm.addEventListener('submit', handleAddMonitor);

    const editForm = document.getElementById('editMonitorForm');
    editForm.addEventListener('submit', handleEditMonitor);

    const settingsForm = document.getElementById('settingsForm');
    settingsForm.addEventListener('submit', handleSaveSettings);
}

async function handleAddMonitor(e) {
    e.preventDefault();

    const host = document.getElementById('host').value.trim();
    const port = parseInt(document.getElementById('port').value);
    const interval = parseInt(document.getElementById('interval').value) * 1000;

    try {
        const response = await fetch('/api/monitors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ host, port, interval })
        });

        if (response.ok) {
            const monitor = await response.json();
            monitors.set(monitor.id, monitor);
            renderMonitor(monitor);
            updateStats();

            // Reset form
            e.target.reset();
            document.getElementById('interval').value = '5';

            // Show success feedback
            showNotification('监控已添加', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || '添加失败', 'error');
        }
    } catch (error) {
        console.error('Error adding monitor:', error);
        showNotification('网络错误', 'error');
    }
}

// Load monitors
async function loadMonitors() {
    try {
        const response = await fetch('/api/monitors');
        const data = await response.json();

        data.forEach(monitor => {
            monitors.set(monitor.id, monitor);
            renderMonitor(monitor);
        });

        updateStats();
    } catch (error) {
        console.error('Error loading monitors:', error);
    }
}

// Render monitor card
function renderMonitor(monitor) {
    const grid = document.getElementById('monitorsGrid');
    const emptyState = grid.querySelector('.empty-state');

    if (emptyState) {
        emptyState.remove();
    }

    // Check if card already exists
    let card = document.querySelector(`[data-id="${monitor.id}"]`);

    if (!card) {
        const template = document.getElementById('monitorCardTemplate');
        card = template.content.cloneNode(true).querySelector('.monitor-card');
        card.dataset.id = monitor.id;

        // Set up event listeners
        const detailsBtn = card.querySelector('[data-action="details"]');
        const editBtn = card.querySelector('[data-action="edit"]');
        const toggleBtn = card.querySelector('[data-action="toggle"]');
        const deleteBtn = card.querySelector('[data-action="delete"]');

        detailsBtn.addEventListener('click', () => openDetailsModal(monitor.id));
        editBtn.addEventListener('click', () => openEditModal(monitor.id));
        toggleBtn.addEventListener('click', () => toggleMonitor(monitor.id));
        deleteBtn.addEventListener('click', () => deleteMonitor(monitor.id));

        // Initialize chart
        const canvas = card.querySelector('.latency-chart');
        const ctx = canvas.getContext('2d');
        charts.set(monitor.id, {
            canvas,
            ctx,
            data: []
        });

        grid.appendChild(card);
    }

    updateMonitor(monitor);
}

// Update monitor card
function updateMonitor(monitor) {
    const card = document.querySelector(`[data-id="${monitor.id}"]`);
    if (!card) return;

    // Update status class
    card.className = `monitor-card status-${monitor.stats.lastStatus}`;

    // Update title
    card.querySelector('.monitor-title').textContent = monitor.id;

    // Update status badge
    const statusBadge = card.querySelector('.monitor-status');
    statusBadge.className = `monitor-status ${monitor.stats.lastStatus}`;
    statusBadge.textContent = monitor.stats.lastStatus === 'online' ? '在线' :
        monitor.stats.lastStatus === 'offline' ? '离线' : '未知';

    // Update toggle button
    const toggleBtn = card.querySelector('[data-action="toggle"]');
    const playIcon = toggleBtn.querySelector('.play-icon');
    const pauseIcon = toggleBtn.querySelector('.pause-icon');

    if (monitor.isRunning) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        toggleBtn.title = '停止';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        toggleBtn.title = '启动';
    }

    // Update stats
    const latencyValue = card.querySelector('.latency-value');
    latencyValue.textContent = monitor.stats.lastLatency > 0 ?
        `${monitor.stats.lastLatency}ms` : '-';

    const successRate = monitor.stats.totalPings > 0 ?
        ((monitor.stats.successfulPings / monitor.stats.totalPings) * 100).toFixed(1) : 0;
    card.querySelector('.success-rate').textContent = `${successRate}%`;

    card.querySelector('.avg-latency').textContent = monitor.stats.averageLatency > 0 ?
        `${monitor.stats.averageLatency}ms` : '-';

    card.querySelector('.total-pings').textContent = monitor.stats.totalPings;

    // Update last check
    if (monitor.stats.lastCheck) {
        const lastCheck = new Date(monitor.stats.lastCheck);
        card.querySelector('.last-check').textContent =
            `最后检测: ${lastCheck.toLocaleTimeString('zh-CN')}`;
    }

    // Update uptime
    const uptimePercent = monitor.stats.totalPings > 0 ?
        ((monitor.stats.uptime / monitor.stats.totalPings) * 100).toFixed(1) : 0;
    card.querySelector('.uptime-value').textContent = `${uptimePercent}%`;

    // Update chart
    updateChart(monitor.id, monitor.stats.lastLatency, monitor.stats.lastStatus === 'online');
}

// Update chart
function updateChart(monitorId, latency, success) {
    const chart = charts.get(monitorId);
    if (!chart) return;

    // Add data point
    chart.data.push({
        latency: success ? latency : 0,
        success
    });

    // Keep only last 50 points
    if (chart.data.length > 50) {
        chart.data.shift();
    }

    // Draw chart
    const { ctx, canvas, data } = chart;
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    ctx.clearRect(0, 0, width, height);

    if (data.length < 2) return;

    // Find max latency for scaling
    const maxLatency = Math.max(...data.map(d => d.latency), 100);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw line
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const pointWidth = width / (data.length - 1);

    data.forEach((point, index) => {
        const x = index * pointWidth;
        const y = height - (point.latency / maxLatency) * height;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    // Draw points
    data.forEach((point, index) => {
        const x = index * pointWidth;
        const y = height - (point.latency / maxLatency) * height;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = point.success ? '#10b981' : '#ef4444';
        ctx.fill();
    });
}

// Toggle monitor
async function toggleMonitor(id) {
    const monitor = monitors.get(id);
    if (!monitor) return;

    const action = monitor.isRunning ? 'stop' : 'start';

    try {
        const response = await fetch(`/api/monitors/${id}/${action}`, {
            method: 'POST'
        });

        if (response.ok) {
            const updatedMonitor = await response.json();
            monitors.set(id, updatedMonitor);
            updateMonitor(updatedMonitor);
        }
    } catch (error) {
        console.error('Error toggling monitor:', error);
        showNotification('操作失败', 'error');
    }
}

// Delete monitor
async function deleteMonitor(id) {
    if (!confirm('确定要删除这个监控吗？')) {
        return;
    }

    try {
        const response = await fetch(`/api/monitors/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            monitors.delete(id);
            charts.delete(id);

            const card = document.querySelector(`[data-id="${id}"]`);
            if (card) {
                card.style.animation = 'scaleOut 0.3s ease-out';
                setTimeout(() => {
                    card.remove();
                    updateStats();

                    // Show empty state if no monitors
                    const grid = document.getElementById('monitorsGrid');
                    if (grid.children.length === 0) {
                        showEmptyState();
                    }
                }, 300);
            }

            showNotification('监控已删除', 'success');
        }
    } catch (error) {
        console.error('Error deleting monitor:', error);
        showNotification('删除失败', 'error');
    }
}

// Update stats summary
function updateStats() {
    const total = monitors.size;
    let online = 0;
    let offline = 0;

    monitors.forEach(monitor => {
        if (monitor.stats.lastStatus === 'online') {
            online++;
        } else if (monitor.stats.lastStatus === 'offline') {
            offline++;
        }
    });

    document.getElementById('totalMonitors').textContent = total;
    document.getElementById('onlineMonitors').textContent = online;
    document.getElementById('offlineMonitors').textContent = offline;
}

// Show empty state
function showEmptyState() {
    const grid = document.getElementById('monitorsGrid');
    grid.innerHTML = `
        <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" stroke="#e0e7ff" stroke-width="2"/>
                <path d="M32 20V44M20 32H44" stroke="#a5b4fc" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p>暂无监控项目</p>
            <p class="empty-hint">请在上方添加新的监控目标</p>
        </div>
    `;
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
    
    @keyframes scaleOut {
        from {
            opacity: 1;
            transform: scale(1);
        }
        to {
            opacity: 0;
            transform: scale(0.9);
        }
    }
`;
document.head.appendChild(style);

// Details Modal Functions
let currentMonitorId = null;
let currentTimeRange = 'all';
let currentHistoryData = [];

function openDetailsModal(monitorId) {
    currentMonitorId = monitorId;
    currentTimeRange = 'all';

    const modal = document.getElementById('detailsModal');
    const title = document.getElementById('modalTitle');

    title.textContent = `监控详情 - ${monitorId}`;
    modal.classList.add('show');

    // Reset filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.range === 'all') {
            btn.classList.add('active');
        }
    });

    loadDetailedHistory(monitorId, 'all');
}

function closeDetailsModal() {
    const modal = document.getElementById('detailsModal');
    modal.classList.remove('show');
    currentMonitorId = null;
}

async function loadDetailedHistory(monitorId, range) {
    try {
        const url = range === 'all'
            ? `/api/monitors/${monitorId}/history`
            : `/api/monitors/${monitorId}/history?range=${range}`;

        const response = await fetch(url);
        const history = await response.json();
        currentHistoryData = history;

        // Calculate statistics
        const stats = calculateDetailedStats(history);
        updateDetailedStats(stats);

        // Update history table
        updateHistoryTable(history);

        // Draw trend chart
        drawDetailChart(history);

        // Update count
        document.getElementById('historyCount').textContent = `(${history.length} 条记录)`;
    } catch (error) {
        console.error('Error loading detailed history:', error);
        showNotification('加载历史数据失败', 'error');
    }
}

function calculateDetailedStats(history) {
    if (history.length === 0) {
        return {
            total: 0,
            success: 0,
            failed: 0,
            avgLatency: 0,
            minLatency: 0,
            maxLatency: 0
        };
    }

    const successHistory = history.filter(h => h.success);
    const latencies = successHistory.map(h => h.latency).filter(l => l > 0);

    return {
        total: history.length,
        success: successHistory.length,
        failed: history.length - successHistory.length,
        avgLatency: latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : 0,
        minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
        maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0
    };
}

function updateDetailedStats(stats) {
    document.getElementById('detailTotalPings').textContent = stats.total;
    document.getElementById('detailSuccessPings').textContent = stats.success;
    document.getElementById('detailFailedPings').textContent = stats.failed;
    document.getElementById('detailAvgLatency').textContent = stats.avgLatency > 0
        ? `${stats.avgLatency}ms` : '-';
    document.getElementById('detailMinLatency').textContent = stats.minLatency > 0
        ? `${stats.minLatency}ms` : '-';
    document.getElementById('detailMaxLatency').textContent = stats.maxLatency > 0
        ? `${stats.maxLatency}ms` : '-';
}

function updateHistoryTable(history) {
    const tbody = document.getElementById('historyTableBody');

    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">暂无数据</td></tr>';
        return;
    }

    // Reverse to show newest first
    const reversedHistory = [...history].reverse();

    tbody.innerHTML = reversedHistory.map(record => {
        const date = new Date(record.timestamp);
        const timeStr = date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const statusBadge = record.success
            ? '<span class="status-badge success">成功</span>'
            : '<span class="status-badge failed">失败</span>';

        const latency = record.success && record.latency > 0
            ? `${record.latency}ms`
            : '-';

        const error = record.error || '-';

        return `
            <tr>
                <td>${timeStr}</td>
                <td>${statusBadge}</td>
                <td>${latency}</td>
                <td style="color: var(--text-muted); font-size: 0.8125rem;">${error}</td>
            </tr>
        `;
    }).join('');
}

// Setup filter buttons
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners to filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!currentMonitorId) return;

            // Update active state
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Load filtered data
            const range = btn.dataset.range;
            currentTimeRange = range;
            loadDetailedHistory(currentMonitorId, range);
        });
    });
    // Close settings modal on background click
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target.id === 'settingsModal') {
            closeSettingsModal();
        }
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (currentMonitorId) closeDetailsModal();
            if (editMonitorId) closeEditModal();
            if (document.getElementById('settingsModal').classList.contains('show')) closeSettingsModal();
        }
    });
});

// Settings Modal Functions
async function openSettingsModal() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();

        document.getElementById('pingTimeout').value = settings.pingTimeout;
        document.getElementById('maxHistory').value = settings.maxHistory;

        const modal = document.getElementById('settingsModal');
        modal.classList.add('show');
    } catch (error) {
        console.error('Error loading settings:', error);
        showNotification('加载设置失败', 'error');
    }
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('show');
}

async function handleSaveSettings(e) {
    e.preventDefault();

    const pingTimeout = parseInt(document.getElementById('pingTimeout').value);
    const maxHistory = parseInt(document.getElementById('maxHistory').value);

    try {
        const response = await fetch('/api/settings', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pingTimeout, maxHistory })
        });

        if (response.ok) {
            closeSettingsModal();
            showNotification('配置已成功保存并应用', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('网络错误', 'error');
    }
}

// Export to CSV
function exportToCSV() {
    if (!currentHistoryData || currentHistoryData.length === 0) {
        showNotification('没有可导出的数据', 'error');
        return;
    }

    const headers = ['时间', '状态', '延迟(ms)', '错误信息'];
    const rows = currentHistoryData.map(record => {
        const date = new Date(record.timestamp);
        const timeStr = date.toLocaleString('zh-CN');
        const status = record.success ? '成功' : '失败';
        const latency = record.success ? record.latency : '-';
        const error = record.error || '-';
        return [timeStr, status, latency, `"${error.replace(/"/g, '""')}"`].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ping_history_${currentMonitorId}_${currentTimeRange}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('CSV 已开始下载', 'success');
}

// Edit Modal Functions
let editMonitorId = null;

function openEditModal(monitorId) {
    const monitor = monitors.get(monitorId);
    if (!monitor) return;

    editMonitorId = monitorId;
    document.getElementById('editHost').value = monitor.host;
    document.getElementById('editPort').value = monitor.port;
    document.getElementById('editInterval').value = monitor.interval / 1000;

    const modal = document.getElementById('editModal');
    modal.classList.add('show');
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.remove('show');
    editMonitorId = null;
}

async function handleEditMonitor(e) {
    e.preventDefault();

    const interval = parseInt(document.getElementById('editInterval').value) * 1000;

    try {
        const response = await fetch(`/api/monitors/${editMonitorId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ interval })
        });

        if (response.ok) {
            const updatedMonitor = await response.json();
            monitors.set(editMonitorId, updatedMonitor);
            updateMonitor(updatedMonitor);
            closeEditModal();
            showNotification('监控已修改', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || '修改失败', 'error');
        }
    } catch (error) {
        console.error('Error updating monitor:', error);
        showNotification('网络错误', 'error');
    }
}

// Draw detailed trend chart
function drawDetailChart(history) {
    const canvas = document.getElementById('detailChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    ctx.clearRect(0, 0, width, height);

    if (history.length < 2) {
        ctx.fillStyle = 'var(--text-muted)';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('数据不足，至少需要2个数据点', width / 2, height / 2);
        return;
    }

    const padding = { top: 40, right: 40, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Get latencies and timestamps
    const successData = history.filter(h => h.success && h.latency > 0);
    const latencies = successData.map(h => h.latency);
    const timestamps = successData.map(h => h.timestamp);

    if (latencies.length === 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('所有检测都失败了', width / 2, height / 2);
        return;
    }

    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);
    const latencyRange = maxLatency - minLatency || 1;

    // Draw background grid
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.1)';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        // Y-axis labels
        const latency = maxLatency - (latencyRange / 5) * i;
        ctx.fillStyle = '#a5b4fc';
        ctx.font = '12px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(latency)}ms`, padding.left - 10, y + 4);
    }

    // Vertical grid lines and X-axis labels
    const timeStep = Math.ceil(successData.length / 6);
    for (let i = 0; i <= 6; i++) {
        const index = Math.min(i * timeStep, successData.length - 1);
        const x = padding.left + (chartWidth / (successData.length - 1)) * index;

        ctx.strokeStyle = 'rgba(102, 126, 234, 0.1)';
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();

        // X-axis labels
        const date = new Date(timestamps[index]);
        const timeStr = date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        ctx.fillStyle = '#a5b4fc';
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(x, padding.top + chartHeight + 15);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(timeStr, 0, 0);
        ctx.restore();
    }

    // Draw area fill
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);

    successData.forEach((point, index) => {
        const x = padding.left + (chartWidth / (successData.length - 1)) * index;
        const y = padding.top + chartHeight - ((point.latency - minLatency) / latencyRange) * chartHeight;
        ctx.lineTo(x, y);
    });

    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, 'rgba(102, 126, 234, 0.3)');
    gradient.addColorStop(1, 'rgba(102, 126, 234, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    successData.forEach((point, index) => {
        const x = padding.left + (chartWidth / (successData.length - 1)) * index;
        const y = padding.top + chartHeight - ((point.latency - minLatency) / latencyRange) * chartHeight;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`延迟趋势 (${successData.length} 个数据点)`, width / 2, 20);

    // Draw stats
    const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '12px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(`平均: ${avgLatency}ms | 最小: ${minLatency}ms | 最大: ${maxLatency}ms`, width - 10, 20);
}
