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

    return response;
  };
})();
