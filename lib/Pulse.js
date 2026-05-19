const net = require('net');
const fs = require('fs');
const path = require('path');
const Router = require('./router');
const { parseRequest } = require('./request');
const { createResponse } = require('./response');
const { getErrorPage } = require('./errorPage');
const logger = require('./logger');

/**
 * Pulse HTTP server application framework instance.
 */
class PulseApplication {
  constructor() {
    this.router = new Router();
    this.settings = new Map();
    this.server = null;
    
    // Set default views directory
    this.set('views', path.join(process.cwd(), 'views'));
    this.set('env', process.env.NODE_ENV || 'development');
  }

  /**
   * Set configuration values.
   */
  set(name, value) {
    this.settings.set(name, value);
    return this;
  }

  /**
   * Get configuration values.
   */
  get(name) {
    return this.settings.get(name);
  }

  /**
   * Register a global or path-specific middleware.
   */
  use(pathOrFn, fn) {
    this.router.use(pathOrFn, fn);
    return this;
  }

  // Routing Proxy Methods
  get(path, ...handlers) {
    // If only path/setting is retrieved (Express syntax: app.get('setting'))
    if (handlers.length === 0 && typeof path === 'string') {
      return this.settings.get(path);
    }
    this.router.get(path, ...handlers);
    return this;
  }

  post(path, ...handlers) { this.router.post(path, ...handlers); return this; }
  put(path, ...handlers) { this.router.put(path, ...handlers); return this; }
  delete(path, ...handlers) { this.router.delete(path, ...handlers); return this; }
  patch(path, ...handlers) { this.router.patch(path, ...handlers); return this; }

  /**
   * Internal Error Handler. Generates a premium error page and closes socket.
   */
  handleError(error, code, socket, req = {}) {
    try {
      const isDev = this.get('env') === 'development';
      const statusTitle = code === 400 ? 'Bad Request' : (code === 403 ? 'Forbidden' : (code === 404 ? 'Not Found' : 'Internal Server Error'));
      
      const defaultMsg = code === 404 
        ? `The resource you are looking for at <code style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-family: monospace;">${req.path || ''}</code> could not be located on this server. Please check the URL and try again.` 
        : (code === 400 
          ? 'The request parameters or payload did not satisfy the server validation constraints.'
          : 'Something went wrong on our end while processing your request. Please try again later.');
      
      // Use the pretty defaultMsg as the main description for standard client errors, raw message for other throws
      const message = (code === 404 || code === 400) ? defaultMsg : (error ? error.message : defaultMsg);
      
      const reqInfo = {
        method: req.method || 'GET',
        path: req.path || '/',
        headers: req.headers || {},
        error: isDev ? error : null
      };

      const errorHtml = getErrorPage(code, statusTitle, message, reqInfo);
      
      // Fix: Ensure we have two empty lines (double CRLF) to terminate response headers properly
      const responseHeaders = [
        `HTTP/1.1 ${code} ${statusTitle}`,
        'Content-Type: text/html; charset=utf-8',
        `Content-Length: ${Buffer.byteLength(errorHtml)}`,
        'Connection: close',
        `Date: ${new Date().toUTCString()}`,
        '',
        ''
      ].join('\r\n');

      socket.write(responseHeaders + errorHtml);
      socket.end();
      
      // Log error in terminal
      logger.error(`${code} Error served for ${reqInfo.method} ${reqInfo.path}: ${error ? error.message : statusTitle}`, error);
    } catch (err) {
      // Fallback if error rendering fails
      logger.error('Failed to render error page, executing raw response', err);
      socket.end(`HTTP/1.1 500 Internal Server Error\r\n\r\nFailed to render error page.`);
    }
  }

  /**
   * Default 404 Page Dispatcher.
   */
  handle404(req, res) {
    res.status(404);
    if (this.handleError) {
      const err = new Error(`Cannot ${req.method} ${req.path}`);
      this.handleError(err, 404, res._socket || req._socket, req);
    } else {
      res.send('404 Not Found');
    }
  }

  /**
   * Starts a TCP listener, accumulates data streams, parses requests, and routes them.
   */
  listen(port, callback) {
    this.server = net.createServer((socket) => {
      const startTime = process.hrtime();
      const socketBuffers = [];
      let accumulatedLength = 0;
      let headersParsed = false;
      let contentLength = 0;
      let headerEndIndex = -1;
      let requestProcessed = false;

      // Handle raw incoming network data chunks
      socket.on('data', (chunk) => {
        socketBuffers.push(chunk);
        accumulatedLength += chunk.length;
        
        const tempBuffer = Buffer.concat(socketBuffers);
        
        // Parse HTTP headers block if not done yet
        if (!headersParsed) {
          headerEndIndex = tempBuffer.indexOf('\r\n\r\n');
          if (headerEndIndex !== -1) {
            headersParsed = true;
            const headerSection = tempBuffer.slice(0, headerEndIndex).toString('utf8');
            
            // Extract Content-Length to determine if body is complete
            const clMatch = headerStringMatch(headerSection, 'content-length');
            contentLength = clMatch ? parseInt(clMatch, 10) : 0;
          }
        }

        // Once headers are parsed, wait until we have received the full body payload
        if (headersParsed) {
          const requiredLength = headerEndIndex + 4 + contentLength;
          if (accumulatedLength >= requiredLength && !requestProcessed) {
            requestProcessed = true;
            const fullBuffer = tempBuffer;
            const headerSection = fullBuffer.slice(0, headerEndIndex).toString('utf8');
            const bodyBuffer = fullBuffer.slice(headerEndIndex + 4, requiredLength);
            
            try {
              // 1. Parse Request
              const req = parseRequest(headerSection, bodyBuffer);
              req._socket = socket; // Keep reference to socket

              // 2. Create Response
              const res = createResponse(socket, this);
              res._socket = socket; // Keep reference to socket

              // 3. Resolve Middleware list & Matched route handlers
              const matched = this.router.match(req.method, req.path);
              const globalMiddlewares = this.router.getApplicableMiddlewares(req.path);
              
              let handlers = [];
              if (matched) {
                req.params = matched.params;
                handlers = [...globalMiddlewares, ...matched.handlers];
              } else {
                // Execute global middlewares, then fall to 404
                handlers = [...globalMiddlewares, (q, s) => this.handle404(q, s)];
              }

              // 4. Run through Express-style next() chain
              let index = 0;
              const next = (err) => {
                if (err) {
                  return this.handleError(err, 500, socket, req);
                }

                if (index < handlers.length) {
                  const currentHandler = handlers[index++];
                  try {
                    currentHandler(req, res, next);
                  } catch (handlerErr) {
                    next(handlerErr);
                  }
                }
              };

              // Start request pipeline
              next();

              // 5. Audit & Log request details to terminal on socket close
              socket.on('close', () => {
                const diff = process.hrtime(startTime);
                const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;
                const status = socket.writableEnded || res.headersSent ? (res.statusCode || 200) : 404;
                logger.request(req, status, durationMs);
              });

            } catch (err) {
              this.handleError(err, 400, socket, { method: 'RAW', path: 'PARSING', headers: {} });
            }
          }
        }
      });

      socket.on('error', (err) => {
        if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
          logger.error('TCP Socket Error', err);
        }
      });
    });

    this.server.listen(port, () => {
      logger.startup(port);
      if (typeof callback === 'function') {
        callback();
      }
    });

    return this.server;
  }
}

// Utility function to extract headers without complex parsing during accumulation
function headerStringMatch(headerBlock, name) {
  const regex = new RegExp(`^${name}:\\s*(.*)$`, 'im');
  const match = headerBlock.match(regex);
  return match ? match[1].trim() : null;
}

// ==========================================
// CREATIVE FEATURE: Static serving middleware
// ==========================================
PulseApplication.static = function(publicDir, prefix = '/') {
  return (req, res, next) => {
    // Static serving only supports GET and HEAD
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    let targetPath = req.path;
    if (prefix !== '/') {
      if (!targetPath.startsWith(prefix)) {
        return next();
      }
      targetPath = targetPath.slice(prefix.length);
    }

    // Default to index.html if pointing to a directory root
    if (targetPath.endsWith('/') || targetPath === '') {
      targetPath = path.join(targetPath, 'index.html');
    }

    const filePath = path.join(publicDir, targetPath);
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(publicDir);

    // Directory traversal security check
    if (!resolvedPath.startsWith(resolvedDir)) {
      return next(); // Fall through
    }

    fs.stat(resolvedPath, (err, stats) => {
      if (err || !stats.isFile()) {
        return next(); // Fall through to subsequent handlers or 404
      }

      res.sendFile(resolvedPath);
    });
  };
};

// ==========================================
// CREATIVE FEATURE: Declarative Request Validator
// ==========================================
PulseApplication.validate = function(schema) {
  return (req, res, next) => {
    const errors = [];

    // Validate body properties
    if (schema.body && typeof req.body === 'object') {
      for (const [key, expectedType] of Object.entries(schema.body)) {
        const val = req.body[key];
        if (val === undefined || val === null || val === '') {
          errors.push(`Body property '${key}' is required.`);
        } else if (expectedType === 'number') {
          const parsed = Number(val);
          if (isNaN(parsed)) {
            errors.push(`Body property '${key}' must be a valid number.`);
          } else {
            req.body[key] = parsed;
          }
        } else if (expectedType === 'boolean') {
          if (val !== 'true' && val !== 'false' && typeof val !== 'boolean') {
            errors.push(`Body property '${key}' must be a boolean.`);
          } else {
            req.body[key] = val === 'true' || val === true;
          }
        } else if (typeof val !== expectedType) {
          errors.push(`Body property '${key}' must be of type '${expectedType}' (got '${typeof val}').`);
        }
      }
    } else if (schema.body && typeof req.body !== 'object') {
      errors.push('Request body must be a valid JSON or URL-encoded object.');
    }

    // Validate query parameters
    if (schema.query) {
      for (const [key, expectedType] of Object.entries(schema.query)) {
        const val = req.query[key];
        if (val === undefined || val === null || val === '') {
          errors.push(`Query parameter '${key}' is required.`);
        } else if (expectedType === 'number') {
          const parsed = Number(val);
          if (isNaN(parsed)) {
            errors.push(`Query parameter '${key}' must be a number.`);
          } else {
            req.query[key] = parsed;
          }
        }
      }
    }

    if (errors.length > 0) {
      res.status(400);
      const app = req._socket.server ? req._socket.server.appInstance : null;
      
      const validationError = new Error(`Request Validation Failed: <br/><ul style="margin-left: 20px; margin-top: 10px;">${errors.map(e => `<li>${e}</li>`).join('')}</ul>`);
      
      if (app && app.handleError) {
        return app.handleError(validationError, 400, req._socket, req);
      }
      return res.json({ error: 'Validation Failed', details: errors });
    }

    next();
  };
};

/**
 * Pulse Factory Function. Creating an application instance.
 */
function createApplication() {
  const app = new PulseApplication();
  
  app.listenProxy = app.listen.bind(app);
  app.listen = function(port, callback) {
    const serverInstance = app.listenProxy(port, callback);
    serverInstance.appInstance = app; // Bind reference
    return serverInstance;
  };

  return app;
}

// Bind static methods to the factory function for developer-friendly imports
createApplication.static = PulseApplication.static;
createApplication.validate = PulseApplication.validate;

module.exports = createApplication;
