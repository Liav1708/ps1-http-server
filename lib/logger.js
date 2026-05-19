// ANSI Escape Codes for stunning terminal logs
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Bright Foreground
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background Colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

const ICONS = {
  info: 'ℹ',
  success: '✔',
  warning: '⚠',
  error: '✖',
  sparkles: '✨',
  rocket: '🚀',
  clock: '⏱'
};

function getMethodStyled(method) {
  const m = method.toUpperCase();
  switch (m) {
    case 'GET':
      return `${COLORS.bgGreen}${COLORS.black}${COLORS.bold} GET ${COLORS.reset}`;
    case 'POST':
      return `${COLORS.bgBlue}${COLORS.white}${COLORS.bold} POST ${COLORS.reset}`;
    case 'PUT':
      return `${COLORS.bgYellow}${COLORS.black}${COLORS.bold} PUT ${COLORS.reset}`;
    case 'DELETE':
      return `${COLORS.bgRed}${COLORS.white}${COLORS.bold} DEL ${COLORS.reset}`;
    case 'PATCH':
      return `${COLORS.bgMagenta}${COLORS.white}${COLORS.bold} PAT ${COLORS.reset}`;
    default:
      return `${COLORS.bgWhite}${COLORS.black}${COLORS.bold} ${m} ${COLORS.reset}`;
  }
}

function getStatusStyled(code) {
  const s = Number(code);
  if (s >= 200 && s < 300) {
    return `${COLORS.green}${COLORS.bold}${s}${COLORS.reset}`;
  } else if (s >= 300 && s < 400) {
    return `${COLORS.cyan}${COLORS.bold}${s}${COLORS.reset}`;
  } else if (s >= 400 && s < 500) {
    return `${COLORS.yellow}${COLORS.bold}${s}${COLORS.reset}`;
  } else if (s >= 500) {
    return `${COLORS.red}${COLORS.bold}${s}${COLORS.reset}`;
  }
  return `${COLORS.white}${s}${COLORS.reset}`;
}

const logger = {
  info(msg) {
    console.log(`${COLORS.brightBlue}${ICONS.info} [Pulse]${COLORS.reset} ${msg}`);
  },
  
  success(msg) {
    console.log(`${COLORS.brightGreen}${ICONS.success} [Pulse]${COLORS.reset} ${COLORS.bold}${msg}${COLORS.reset}`);
  },

  warn(msg) {
    console.warn(`${COLORS.brightYellow}${ICONS.warning} [Pulse]${COLORS.reset} ${msg}`);
  },

  error(msg, err) {
    console.error(`${COLORS.brightRed}${ICONS.error} [Pulse]${COLORS.reset} ${COLORS.bold}${msg}${COLORS.reset}`);
    if (err && err.stack) {
      console.error(`${COLORS.dim}${err.stack}${COLORS.reset}`);
    }
  },

  startup(port) {
    console.log('\n' + '='.repeat(60));
    console.log(`  ${COLORS.brightMagenta}${COLORS.bold}${ICONS.sparkles} PULSE HTTP SERVER FRAMEWORK ${ICONS.sparkles}${COLORS.reset}`);
    console.log(`  ${COLORS.dim}Clean HTTP/1.1 from-scratch network engine${COLORS.reset}`);
    console.log('='.repeat(60));
    console.log(`  ${ICONS.rocket}  Server running at: ${COLORS.brightCyan}${COLORS.underline}http://localhost:${port}${COLORS.reset}`);
    console.log(`  ${ICONS.clock} Started at:        ${new Date().toLocaleString()}`);
    console.log('='.repeat(60) + '\n');
  },

  request(req, resCode, durationMs) {
    const timeStr = `${durationMs.toFixed(1)}ms`;
    const timeStyled = durationMs > 100 
      ? `${COLORS.red}${timeStr}${COLORS.reset}` 
      : durationMs > 20 
        ? `${COLORS.yellow}${timeStr}${COLORS.reset}`
        : `${COLORS.green}${timeStr}${COLORS.reset}`;

    const timestamp = `${COLORS.dim}[${new Date().toLocaleTimeString()}]${COLORS.reset}`;
    const methodStyled = getMethodStyled(req.method);
    const pathStyled = `${COLORS.white}${req.path}${COLORS.reset}`;
    const statusStyled = getStatusStyled(resCode);
    const queryStr = Object.keys(req.query).length > 0 
      ? ` ${COLORS.dim}?${JSON.stringify(req.query)}${COLORS.reset}` 
      : '';

    console.log(`${timestamp} ${methodStyled} ${pathStyled}${queryStr} -> ${statusStyled} (${timeStyled})`);
  }
};

module.exports = logger;
