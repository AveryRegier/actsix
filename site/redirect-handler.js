// Global fetch wrapper to handle API redirects
(function() {
  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    const response = await originalFetch(...args);

    // Check if the response is a redirect
    if (response.redirected) {
      console.log("Redirecting to:", response.url);
      window.location.href = response.url;
    }

    // Check if the response is HTML that contains a redirect (e.g., signout response)
    if (response.headers && response.headers.get('content-type')?.includes('text/html')) {
      try {
        const responseBody = await response.clone().text();
        // Look for window.location.href pattern in HTML
        const redirectMatch = responseBody.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (redirectMatch && redirectMatch[1]) {
          console.log("Redirecting via HTML redirect to:", redirectMatch[1]);
          window.location.href = redirectMatch[1];
        }
      } catch (e) {
        // Silently continue if we can't parse the response
      }
    }

    return response;
  };
})();
