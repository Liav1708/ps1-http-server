document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('api-form');
  const submitBtn = document.getElementById('submit-btn');
  const responseBox = document.getElementById('response-box');
  const responseStatus = document.getElementById('response-status');

  // Submit User (POST Handler / validator demo)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous responses
    responseBox.textContent = 'Awaiting server response...';
    responseStatus.style.display = 'none';

    const payload = {
      username: document.getElementById('input-username').value.trim(),
      email: document.getElementById('input-email').value.trim(),
      age: document.getElementById('input-age').value.trim() // will be validated on backend
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing request...';

    const startTime = performance.now();

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const duration = (performance.now() - startTime).toFixed(1);
      const data = await response.json();

      // Show Status Badge
      responseStatus.textContent = `${response.status} ${response.statusText}`;
      responseStatus.className = 'badge'; // reset
      if (response.status >= 200 && response.status < 300) {
        responseStatus.classList.add('success-badge');
      } else {
        responseStatus.classList.add('danger-badge');
      }
      responseStatus.style.display = 'inline-block';

      // Output JSON data nicely formatted
      responseBox.textContent = [
        `// RTT latency: ${duration}ms`,
        `// Headers: ${JSON.stringify([...response.headers], null, 2)}`,
        JSON.stringify(data, null, 2)
      ].join('\n\n');

    } catch (err) {
      responseStatus.textContent = 'NETWORK ERROR';
      responseStatus.className = 'badge danger-badge';
      responseStatus.style.display = 'inline-block';
      responseBox.textContent = `Error connecting to Pulse HTTP Server:\n${err.message}`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Register User (POST)';
    }
  });
});
