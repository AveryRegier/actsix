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
  const defaultHeaders = {};
  if (authToken) {
    defaultHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const defaultOptions = {
    credentials: 'include', // Send cookies with requests
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  // Perform the fetch and await the response so we can inspect cookies/localStorage after.
  const response = await fetch(url, { ...defaultOptions, ...options });

  // If the server set a cookie via Set-Cookie, the browser will update document.cookie when allowed.
  // Try reading the cookie again and persist to localStorage if it changed/appeared.
  try {
    if (typeof document !== 'undefined' && typeof document.cookie === 'string') {
      const name = 'actsix=';
      const parts = document.cookie.split(';');
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (part.indexOf(name) === 0) {
          const cookieVal = decodeURIComponent(part.substring(name.length));
          try {
            if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
              const prev = window.localStorage.getItem('authToken');
              if (cookieVal && cookieVal !== prev) {
                window.localStorage.setItem('authToken', cookieVal);
                // keep this small console message for debug builds
                if (typeof console !== 'undefined' && console.log) console.log('Updated authToken from cookies');
              }
            }
          } catch (e) {
            // localStorage could throw; ignore.
          }
          break;
        }
      }
    }
  } catch (e) {
    // Ignore any errors reading document.cookie or syncing localStorage.
  }

  return response;
}
