const path = require('path');
const Pulse = require('./lib/Pulse');

// 1. Initialize Pulse server framework instance
const app = Pulse();

// 2. Configure View Engine settings (analogous to app.set('views', ...))
app.set('views', path.join(__dirname, 'views'));
app.set('env', 'development'); // Enable stack traces in error page

// ========================================================
// DEMO REQUIREMENT: Static file serving (like express.static)
// ========================================================
// Mounts a static handler at the root level serving everything in /public
app.use(Pulse.static(path.join(__dirname, 'public')));

// Custom header injector middleware demo
app.use((req, res, next) => {
  res.set('X-Powered-By', 'Pulse Core Web Engine');
  next();
});

// ========================================================
// DEMO REQUIREMENT: Route Handlers (GET / POST)
// ========================================================

// GET Endpoint with dynamic URL path parameters (e.g., /api/users/25)
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  
  const payload = {
    success: true,
    source: 'Dynamic Route Params Handler',
    user: {
      id: userId,
      name: `Developer #${userId}`,
      email: `dev.pulse.${userId}@runi.ac.il`,
      joined: new Date(Date.now() - 1000 * 60 * 60 * 24 * Number(userId)).toLocaleDateString(),
      score: Math.floor(Math.random() * 1000) + 100
    }
  };

  // Content negotiation: serve a gorgeous HTML dashboard page for browser navigation,
  // or return raw JSON for programmatic client fetches.
  const acceptHeader = req.headers['accept'] || '';
  if (acceptHeader.includes('text/html')) {
    const { getApiVisualizerPage } = require('./lib/apiVisualizerPage');
    const html = getApiVisualizerPage(req.path, req.method, payload, req.headers);
    res.set('Content-Type', 'text/html');
    res.send(html);
  } else {
    res.json(payload);
  }
});

// POST Endpoint with CREATIVE FEATURE: Built-in body validation middleware!
app.post('/api/users', Pulse.validate({
  body: {
    username: 'string',
    email: 'string',
    age: 'number'
  }
}), (req, res) => {
  const { username, email, age } = req.body;

  res.status(201).json({
    success: true,
    message: 'Pulse validated request successfully!',
    timestamp: new Date().toISOString(),
    registeredUser: {
      id: Date.now(),
      username,
      email,
      age,
      canVote: age >= 18,
      securityRole: age >= 25 ? 'Principal Architect' : 'Associate Engineer'
    }
  });
});

// GET Dynamic rendering template page (MVC template engine demo)
app.get('/profile', (req, res) => {
  const username = req.query.username || 'Guest_Hacker';
  const role = req.query.role || 'Visitor';
  const initial = username.charAt(0).toUpperCase();

  res.render('profile', {
    username,
    role,
    initial,
    bio: 'An enthusiastic programmer exploring Reichman University\'s Fullstack class homework. Leveraging Pulse\'s network sockets pipeline to write super scalable backend nodes.',
    showBanner: true,
    bannerMessage: 'Pulse Dynamic Template Engine compiled this view instantly!',
    skills: [
      'Node.js TCP Net Streams API',
      'Regular Expressions Route Matching',
      'Express-Like Middleware Pipes',
      'HTML/CSS Glassmorphism UI Systems',
      'Query and Path params parsing validation'
    ]
  });
});

// GET Trigger intentional 500 error to showcase the custom error display console
app.get('/trigger-error', (req, res) => {
  throw new Error('This exception was thrown intentionally on the server to demonstrate Pulse\'s 500 error display console.');
});

// 3. Start listening on Port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // Console welcome message is handled automatically by logger.startup inside app.listen
});
