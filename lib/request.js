const { URL } = require('url');

/**
 * Parses raw HTTP/1.1 request data into a clean, developer-friendly Request object.
 * @param {string} headerSection - The raw headers block of the HTTP request.
 * @param {Buffer} bodyBuffer - The raw body buffer of the HTTP request.
 * @return {Object} The parsed Pulse Request object.
 */
function parseRequest(headerSection, bodyBuffer) {
  const lines = headerSection.split('\r\n');
  
  // 1. Parse Request Line
  const requestLine = lines[0];
  const [method, rawUrl, version] = requestLine.split(' ');

  if (!method || !rawUrl || !version) {
    throw new Error('Invalid HTTP request line');
  }

  // 2. Parse URL and Query Parameters
  // Using native URL API by passing a dummy base URL
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const path = decodeURIComponent(parsedUrl.pathname);
  const query = {};
  for (const [key, value] of parsedUrl.searchParams.entries()) {
    query[key] = value;
  }

  // 3. Parse Headers
  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue; // Skip empty lines if any
    
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).toLowerCase().trim();
      const value = line.slice(colonIndex + 1).trim();
      headers[key] = value;
    }
  }

  // 4. Parse Body
  const bodyString = bodyBuffer.toString('utf8');
  let body = bodyString;

  if (headers['content-type'] && bodyString.length > 0) {
    const contentType = headers['content-type'].toLowerCase();
    
    if (contentType.includes('application/json')) {
      try {
        body = JSON.parse(bodyString);
      } catch (err) {
        // Leave body as string if it fails to parse as JSON
        body = { _raw: bodyString, _error: 'Invalid JSON body' };
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      body = {};
      const params = new URLSearchParams(bodyString);
      for (const [key, value] of params.entries()) {
        body[key] = value;
      }
    }
  }

  return {
    method: method.toUpperCase(),
    url: rawUrl,
    path,
    query,
    headers,
    body,
    version,
    raw: {
      headers: headerSection,
      body: bodyString
    },
    // Placeholders for route params to be filled by the router
    params: {}
  };
}

module.exports = { parseRequest };
