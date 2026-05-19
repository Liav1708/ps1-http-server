const fs = require('fs');
const path = require('path');

const STATUS_TEXTS = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  500: 'Internal Server Error'
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Creates a Pulse Response object bound to a TCP socket.
 * @param {net.Socket} socket - The active TCP socket.
 * @param {Object} app - The Pulse app instance for settings like views directory.
 * @returns {Object} Pulse Response object.
 */
function createResponse(socket, app) {
  let statusCode = 200;
  let statusText = 'OK';
  const headers = {
    'Server': 'Pulse/1.0.0',
    'Connection': 'keep-alive',
    'Date': new Date().toUTCString()
  };
  let headersSent = false;

  const res = {
    // 1. Chaining Status
    status(code) {
      if (headersSent) return this;
      statusCode = code;
      statusText = STATUS_TEXTS[code] || 'Unknown';
      return this;
    },

    // 2. Chaining Headers
    set(key, value) {
      if (headersSent) return this;
      headers[key] = value;
      return this;
    },

    header(key, value) {
      return this.set(key, value);
    },

    // 3. Send raw data (Buffer/String/JSON)
    send(body) {
      if (headersSent) return;

      if (body === null || body === undefined) {
        body = '';
      }

      // Automatically determine content type and parse objects
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        return this.json(body);
      }

      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'text/html; charset=utf-8';
      }

      const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
      headers['Content-Length'] = bodyBuffer.length;

      this.sendHeaders();
      socket.write(bodyBuffer);
      socket.end(); // We close connection for standard responses unless we do keep-alive optimizations
      headersSent = true;
    },

    // 4. Send JSON
    json(data) {
      if (headersSent) return;
      
      const jsonString = JSON.stringify(data, null, 2);
      this.set('Content-Type', 'application/json; charset=utf-8');
      this.send(jsonString);
    },

    // 5. Send HTML
    html(htmlString) {
      this.set('Content-Type', 'text/html; charset=utf-8');
      this.send(htmlString);
    },

    // 6. Redirect
    redirect(url, status = 302) {
      if (headersSent) return;
      this.status(status);
      this.set('Location', url);
      this.send(`Redirecting to ${url}...`);
    },

    // 7. Serve Static Files manually
    sendFile(filePath, options = {}) {
      if (headersSent) return;

      const absolutePath = path.resolve(filePath);
      
      // Basic security check: if a root directory is provided, prevent directory traversal
      if (options.root) {
        const rootPath = path.resolve(options.root);
        if (!absolutePath.startsWith(rootPath)) {
          return this.status(403).send('Forbidden: Access denied');
        }
      }

      fs.stat(absolutePath, (err, stats) => {
        if (err || !stats.isFile()) {
          // Trigger a beautiful 404 page through the app or directly
          if (app && app.handleError) {
            return app.handleError(new Error('File Not Found'), 404, socket, { path: filePath });
          }
          return this.status(404).send('404 Not Found: File not found');
        }

        const mimeType = getMimeType(absolutePath);
        this.set('Content-Type', mimeType);
        this.set('Content-Length', stats.size);
        this.status(200);

        this.sendHeaders();

        const readStream = fs.createReadStream(absolutePath);
        readStream.pipe(socket);
        headersSent = true;
      });
    },

    // 8. Render Dynamic HTML Templates
    render(viewName, data = {}) {
      if (headersSent) return;

      const viewsDir = app.get('views') || path.join(process.cwd(), 'views');
      let viewPath = path.join(viewsDir, viewName);
      if (!path.extname(viewPath)) {
        viewPath += '.html';
      }

      fs.readFile(viewPath, 'utf8', (err, content) => {
        if (err) {
          if (app && app.handleError) {
            return app.handleError(new Error(`Failed to render view: ${viewName}`), 500, socket, { path: viewName });
          }
          return this.status(500).send(`500 Internal Server Error: Failed to render view '${viewName}'`);
        }

        // Render template placeholders: {{variable}}
        let rendered = content;

        // Custom template logic: loop items {{#each array}}...{{/each}}
        const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
        rendered = rendered.replace(eachRegex, (match, arrayKey, loopBody) => {
          const list = data[arrayKey];
          if (!Array.isArray(list)) return '';
          
          return list.map(item => {
            let tempBody = loopBody;
            if (typeof item === 'object') {
              for (const [k, v] of Object.entries(item)) {
                tempBody = tempBody.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
              }
            } else {
              tempBody = tempBody.replace(/\{\{this\}\}/g, item);
            }
            return tempBody;
          }).join('');
        });

        // Simple conditional: {{#if condition}}...{{/if}}
        const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
        rendered = rendered.replace(ifRegex, (match, conditionKey, bodyContent) => {
          return data[conditionKey] ? bodyContent : '';
        });

        // Simple value replacement: {{var}}
        for (const [key, value] of Object.entries(data)) {
          if (typeof value !== 'object') {
            rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          }
        }

        this.html(rendered);
      });
    },

    // Internal Helper to construct and write HTTP response headers block
    sendHeaders() {
      if (headersSent) return;
      let headerBlock = `HTTP/1.1 ${statusCode} ${statusText}\r\n`;
      for (const [key, value] of Object.entries(headers)) {
        headerBlock += `${key}: ${value}\r\n`;
      }
      headerBlock += '\r\n';
      socket.write(headerBlock);
    }
  };

  return res;
}

module.exports = { createResponse };
