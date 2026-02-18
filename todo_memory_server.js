const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const ROOT = process.cwd();
const HTML_FILE = 'SG_ToDo_List_Operativa.bilingual.html';
const MEMORY_FILE = 'SG_ToDo_List_Operativa.memory.json';
const memoryPath = path.join(ROOT, MEMORY_FILE);

function ensureMemoryFile() {
  if (!fs.existsSync(memoryPath)) {
    const init = {
      version: 1,
      source: HTML_FILE,
      updatedAt: null,
      checked: {}
    };
    fs.writeFileSync(memoryPath, JSON.stringify(init, null, 2) + '\n', 'utf8');
  }
}

function json(res, code, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function text(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(msg);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  return 'application/octet-stream';
}

function safeResolve(urlPath) {
  const cleaned = decodeURIComponent(urlPath.split('?')[0]);
  const rel = cleaned === '/' ? `/${HTML_FILE}` : cleaned;
  const resolved = path.resolve(ROOT, '.' + rel);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

ensureMemoryFile();

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  const reqUrl = req.url || '/';

  if (reqUrl.startsWith('/memory')) {
    if (method === 'GET') {
      try {
        ensureMemoryFile();
        const raw = fs.readFileSync(memoryPath, 'utf8');
        const parsed = JSON.parse(raw);
        return json(res, 200, parsed);
      } catch (err) {
        return json(res, 500, { error: 'failed_to_read_memory', detail: String(err.message || err) });
      }
    }

    if (method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1_000_000) {
          req.destroy();
        }
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const normalized = {
            version: 1,
            source: HTML_FILE,
            updatedAt: parsed.updatedAt || new Date().toISOString(),
            checked: (parsed && typeof parsed.checked === 'object' && parsed.checked) ? parsed.checked : {}
          };
          fs.writeFileSync(memoryPath, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
          return json(res, 200, { ok: true, updatedAt: normalized.updatedAt, saved: Object.keys(normalized.checked).length });
        } catch (err) {
          return json(res, 400, { error: 'invalid_json', detail: String(err.message || err) });
        }
      });
      return;
    }

    return text(res, 405, 'Method not allowed');
  }

  if (method !== 'GET' && method !== 'HEAD') {
    return text(res, 405, 'Method not allowed');
  }

  const filePath = safeResolve(reqUrl);
  if (!filePath) return text(res, 403, 'Forbidden');

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (_) {
    return text(res, 404, 'Not found');
  }

  if (stat.isDirectory()) {
    return text(res, 403, 'Directory listing disabled');
  }

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType(filePath),
      'Content-Length': data.length,
      'Cache-Control': 'no-store'
    });
    if (method === 'HEAD') return res.end();
    return res.end(data);
  } catch (err) {
    return text(res, 500, `Failed to read file: ${String(err.message || err)}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Todo memory server running at http://${HOST}:${PORT}`);
  console.log(`Open: http://${HOST}:${PORT}/${HTML_FILE}`);
  console.log(`Memory file: ${memoryPath}`);
});
