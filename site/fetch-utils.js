// Utility function to wrap fetch calls with default options
export async function apiFetch(url, options = {}) {
  // Robustly retrieve auth token from localStorage or cookies.
  // Many browsers (Chrome, Edge, Safari, Android WebView) expose document.cookie as a string
  // and localStorage may throw in privacy/restricted modes — use try/catch and feature detection.
  const getAuthToken = () => {
    // Read localStorage if available and permitted
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const stored = window.localStorage.getItem('authToken');
        if (stored) return stored;
      }
    } catch (e) {
      // localStorage access can throw (private mode, blocked storage). Fall back to cookies.
    }

    // Parse document.cookie (string) to find actsix cookie
    try {
      if (typeof document !== 'undefined' && typeof document.cookie === 'string') {
        const name = 'actsix=';
        const parts = document.cookie.split(';');
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i].trim();
          if (part.indexOf(name) === 0) {
            return decodeURIComponent(part.substring(name.length));
          }
        }
      }
    } catch (e) {
      // document or document.cookie access could fail in some embeded contexts — ignore and return ''
    }

    return '';
  };

  const authToken = getAuthToken();

  // Build headers; only include Authorization when we have a token. Keep existing behavior where
  // options.headers can override defaults by spreading them last.
  var defaultHeaders = {};
  if (authToken) {
    defaultHeaders['Authorization'] = 'Bearer ' + authToken;
  }

  var defaultOptions = {
    credentials: 'include', // Send cookies with requests
    headers: Object.assign({}, defaultHeaders, options.headers || {})
  };

  const mergedOptions = { ...defaultOptions, ...options, headers: defaultOptions.headers };

  // Perform the fetch and await the response so we can inspect cookies/localStorage after.
  const response = await fetch(url, mergedOptions);

  const responseBody = await response.text();

  if (!response.ok) {
    let errorPayload = { message: `API request failed with status ${response.status}` };
    try {
      const parsed = JSON.parse(responseBody);
      errorPayload = { ...errorPayload, ...parsed };
    } catch (e) {
      // Not a JSON response, use the raw text
      errorPayload.details = responseBody;
    }
    throw new Error(errorPayload.message, { cause: errorPayload });
  }

  try {
    const json = JSON.parse(responseBody);
    json.ok = true;
    json.json = () => json;
    return json;
  } catch (e) {
    // If parsing fails, it might be a plain text response
    return responseBody;
  }
}
