/**
 * Router implementation for the Pulse HTTP framework.
 * Supports standard HTTP methods, dynamic route parameters (e.g., /users/:id),
 * and sequential Express-style middleware pipelines.
 */
class Router {
  constructor() {
    this.routes = {
      GET: [],
      POST: [],
      PUT: [],
      DELETE: [],
      PATCH: []
    };
    // Global or prefix-based middlewares
    this.middlewares = [];
  }

  /**
   * Adds a global middleware or prefix-based middleware.
   * @param {string|Function} pathOrFn - Optional path prefix, or the middleware function.
   * @param {Function} [fn] - The middleware function if a prefix was provided.
   */
  use(pathOrFn, fn) {
    let prefix = '/';
    let middlewareFn = pathOrFn;

    if (typeof pathOrFn === 'string') {
      prefix = pathOrFn;
      middlewareFn = fn;
    }

    if (typeof middlewareFn !== 'function') {
      throw new Error('Middleware must be a function');
    }

    this.middlewares.push({
      prefix,
      fn: middlewareFn
    });
    return this;
  }

  /**
   * Registers a route with its handlers (middlewares + final handler).
   */
  addRoute(method, pathPattern, ...handlers) {
    if (handlers.length === 0) {
      throw new Error(`Route registration for ${method} ${pathPattern} requires at least one handler`);
    }

    const paramNames = [];
    
    // Convert Express-like route (/users/:id) to regex
    // Escape standard regex characters except parameters
    let escapedPattern = pathPattern
      .replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&') // escape special characters
      .replace(/:([^/\\:]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)'; // Capture path segment
      });

    // Support wildcard at the end (e.g., /static/*)
    escapedPattern = escapedPattern.replace(/\\\*/g, '(.*)');

    const regex = new RegExp(`^${escapedPattern}$`);

    this.routes[method].push({
      pathPattern,
      regex,
      paramNames,
      handlers
    });
  }

  get(path, ...handlers) { this.addRoute('GET', path, ...handlers); return this; }
  post(path, ...handlers) { this.addRoute('POST', path, ...handlers); return this; }
  put(path, ...handlers) { this.addRoute('PUT', path, ...handlers); return this; }
  delete(path, ...handlers) { this.addRoute('DELETE', path, ...handlers); return this; }
  patch(path, ...handlers) { this.addRoute('PATCH', path, ...handlers); return this; }

  /**
   * Matches a request against all defined routes, extracting params if matched.
   * @param {string} method - HTTP method
   * @param {string} path - Request URL pathname
   * @returns {Object|null} Match details including handlers and route params.
   */
  match(method, path) {
    const methodRoutes = this.routes[method.toUpperCase()];
    if (!methodRoutes) return null;

    for (const route of methodRoutes) {
      const match = path.match(route.regex);
      if (match) {
        // Extract route parameters
        const params = {};
        route.paramNames.forEach((name, index) => {
          // If wildcard match, it will be the last element
          if (name === '') return;
          params[name] = decodeURIComponent(match[index + 1] || '');
        });
        
        // Return match result
        return {
          handlers: route.handlers,
          params,
          pathPattern: route.pathPattern
        };
      }
    }
    return null;
  }

  /**
   * Finds all global and path-specific middlewares that apply to the request path.
   * @param {string} path - The request path.
   * @returns {Array<Function>} Array of applicable middleware functions.
   */
  getApplicableMiddlewares(path) {
    return this.middlewares
      .filter(mw => {
        if (mw.prefix === '/') return true;
        // Prefix match check: e.g. /static fits /static/css/styles.css
        return path === mw.prefix || path.startsWith(mw.prefix + '/');
      })
      .map(mw => mw.fn);
  }
}

module.exports = Router;
