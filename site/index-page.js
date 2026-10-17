
// API status logic.
const API_BASE_URL = '';

async function checkApiStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}api`);
    const data = await response.json();
    if (data.status === 'healthy') {
      document.getElementById('api-status').className = 'api-status connected';
      document.getElementById('api-status-text').textContent = 'Connected to server';
    } else {
      throw new Error('API unhealthy');
    }
  } catch {
    document.getElementById('api-status').className = 'api-status disconnected';
    document.getElementById('api-status-text').textContent = 'Disconnected - Make sure to run "npm run start"';
  }
}

checkApiStatus();
setInterval(checkApiStatus, 6000000);


