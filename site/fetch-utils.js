// Utility function to wrap fetch calls with default options
export function apiFetch(url, options = {}) {
  const authToken = localStorage.getItem('authToken') || document.cookie('actsix') || '';
  const defaultOptions = {
    credentials: 'include', // Send cookies with requests
    headers: {
      'Authorization': `Bearer ${authToken}`, // Extract auth token from cookies
      ...options.headers, // Merge with custom headers
    },
  };

  return fetch(url, { ...defaultOptions, ...options });
}
