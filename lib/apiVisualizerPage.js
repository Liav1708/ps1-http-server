/**
 * Generates a stunning glassmorphism-themed light-mode HTML visualizer page for API responses.
 * @param {string} path - Request URL path
 * @param {string} method - HTTP method used
 * @param {Object} jsonPayload - The JSON response object to display inside the packet panel
 * @param {Object} headers - Request headers for deep inspection
 * @returns {string} Fully formed, beautifully styled HTML string
 */
function getApiVisualizerPage(path, method, jsonPayload, headers = {}) {
  // Beautify headers for presentation
  let headersHtml = '';
  for (const [key, value] of Object.entries(headers)) {
    headersHtml += `<div><strong>${key}:</strong> <span>${value}</span></div>`;
  }

  // Format the JSON data packet beautifully
  const formattedJson = JSON.stringify(jsonPayload, null, 2);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Explorer - ${path}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Space+Mono&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      --accent-color: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.15);
      --glass-bg: rgba(255, 255, 255, 0.75);
      --glass-border: rgba(255, 255, 255, 0.6);
      --text-main: #1f2937;
      --text-muted: #6b7280;
      --success-color: #10b981;
      --success-glow: rgba(16, 185, 129, 0.15);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background: var(--bg-gradient);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
      overflow-x: hidden;
    }

    .explorer-container {
      width: 100%;
      max-width: 680px;
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05), 
                  inset 0 1px 0 rgba(255, 255, 255, 0.8);
      position: relative;
      animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .explorer-container::before {
      content: '';
      position: absolute;
      width: 150px;
      height: 150px;
      background: var(--accent-glow);
      filter: blur(50px);
      top: -30px;
      right: -30px;
      border-radius: 50%;
      z-index: -1;
    }

    .explorer-header {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 24px;
    }

    .api-badge {
      font-size: 1.1rem;
      font-weight: 800;
      padding: 8px 16px;
      background: linear-gradient(135deg, var(--success-color), var(--accent-color));
      color: white;
      border-radius: 12px;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
    }

    .explorer-title {
      font-size: 1.8rem;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.5px;
    }

    .explorer-desc {
      font-size: 1.05rem;
      line-height: 1.6;
      color: var(--text-muted);
      margin-bottom: 28px;
    }

    .details-title {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--accent-color);
      margin-bottom: 12px;
      font-weight: 600;
    }

    .packet-box {
      background: #f8fafc;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.01);
    }

    .packet-details {
      font-family: 'Space Mono', monospace;
      font-size: 0.85rem;
      color: #4338ca;
      overflow-x: auto;
      white-space: pre;
    }

    .request-details {
      background: rgba(255, 255, 255, 0.4);
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
    }

    .route-info {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      font-family: 'Space Mono', monospace;
    }

    .method-tag {
      background: var(--accent-color);
      color: #fff;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .path-text {
      color: var(--text-main);
      font-size: 0.95rem;
      word-break: break-all;
    }

    .headers-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.85rem;
      max-height: 120px;
      overflow-y: auto;
      padding-right: 8px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      padding-top: 12px;
    }

    .headers-list div {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed rgba(0, 0, 0, 0.03);
      padding-bottom: 4px;
    }

    .headers-list div strong {
      color: var(--text-muted);
      font-weight: 400;
    }

    .headers-list div span {
      color: var(--text-main);
      word-break: break-all;
      text-align: right;
      padding-left: 16px;
    }

    .back-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--accent-color), #4f46e5);
      color: white;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 12px;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.2);
      border: none;
      cursor: pointer;
    }

    .back-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    }

    .back-btn:active {
      transform: translateY(0);
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Custom Scrollbar for list and code */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(0,0,0,0.05);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.1);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(0,0,0,0.2);
    }
  </style>
</head>
<body>
  <div class="explorer-container">
    <div class="explorer-header">
      <span class="api-badge">GET</span>
      <div>
        <h1 class="explorer-title">Route Parameter Inspector</h1>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Pulse Core Web Server</p>
      </div>
    </div>

    <p class="explorer-desc">The Pulse router analyzed the HTTP query line, matched the regex path pattern, and successfully captured the dynamic parameter value. Here is the response packet generated by the route handler:</p>

    <div class="packet-box">
      <h2 class="details-title" style="color: var(--success-color);">JSON Response Payload</h2>
      <div class="packet-details">${formattedJson}</div>
    </div>

    <div class="request-details">
      <h2 class="details-title">Request Execution Context</h2>
      <div class="route-info">
        <span class="method-tag">${method}</span>
        <span class="path-text">${path}</span>
      </div>
      ${headersHtml ? `<h2 class="details-title" style="margin-top: 16px; font-size: 0.8rem;">Client Request Headers</h2><div class="headers-list">${headersHtml}</div>` : ''}
    </div>

    <div style="margin-top: 32px; display: flex; justify-content: space-between; align-items: center;">
      <a href="/" class="back-btn">Return to Dashboard</a>
      <span style="font-size: 0.8rem; color: var(--text-muted);">Powered by Pulse Framework</span>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = { getApiVisualizerPage };
