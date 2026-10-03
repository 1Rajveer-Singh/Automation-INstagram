import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function localAssetMiddlewarePlugin(): Plugin {
  return {
    name: 'local-asset-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const mimeMap: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.mp4': 'video/mp4',
          '.mov': 'video/quicktime',
          '.avi': 'video/x-msvideo',
        };

        if (req.url?.startsWith('/api/serve-local-asset') && req.method === 'GET') {
          try {
            const urlObj = new URL(req.url, 'http://localhost:3000');
            let cleanPath = (urlObj.searchParams.get('path') || '').trim();
            if (cleanPath.startsWith('file:///')) {
              cleanPath = decodeURIComponent(cleanPath.replace(/^file:\/\/\/?/, ''));
            }
            cleanPath = path.normalize(cleanPath);

            if (!fs.existsSync(cleanPath)) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `File not found on local disk: ${cleanPath}` }));
              return;
            }

            const ext = path.extname(cleanPath).toLowerCase();
            const mime = mimeMap[ext] || 'application/octet-stream';
            res.statusCode = 200;
            res.setHeader('Content-Type', mime);
            fs.createReadStream(cleanPath).pipe(res);
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err?.message || 'Error streaming local file' }));
            return;
          }
        }

        if (req.url === '/api/read-local-asset' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { filePath } = JSON.parse(body || '{}');
              if (!filePath || typeof filePath !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'filePath is required' }));
                return;
              }

              let cleanPath = filePath.trim();
              if (cleanPath.startsWith('file:///')) {
                cleanPath = decodeURIComponent(cleanPath.replace(/^file:\/\/\/?/, ''));
              }
              // Normalize Windows backslashes
              cleanPath = path.normalize(cleanPath);

              if (!fs.existsSync(cleanPath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `File not found on local disk: ${cleanPath}` }));
                return;
              }

              const ext = path.extname(cleanPath).toLowerCase();
              const mime = mimeMap[ext] || 'application/octet-stream';
              const fileBuffer = fs.readFileSync(cleanPath);
              const dataUri = `data:${mime};base64,${fileBuffer.toString('base64')}`;

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: true,
                  dataUri,
                  filename: path.basename(cleanPath),
                  mime,
                  size: fileBuffer.length,
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Failed to read local file' }));
            }
          });
          return;
        }

        // Local development support for /api/webhook
        if (req.url?.startsWith('/api/webhook')) {
          try {
            const mod = await server.ssrLoadModule('./api/webhook.ts');
            const urlObj = new URL(req.url, 'http://localhost:3000');
            const query: Record<string, string> = {};
            urlObj.searchParams.forEach((v, k) => { query[k] = v; });

            let bodyData: any = {};
            let rawBodyStr = '';
            if (req.method === 'POST') {
              const buffers: any[] = [];
              for await (const chunk of req) {
                buffers.push(chunk);
              }
              rawBodyStr = Buffer.concat(buffers).toString('utf-8');
              try { bodyData = JSON.parse(rawBodyStr); } catch { bodyData = {}; }
            }

            const mockReq = {
              method: req.method,
              query,
              headers: req.headers,
              body: bodyData,
              rawBody: rawBodyStr,
            };

            const mockRes = {
              statusCode: 200,
              headers: {} as Record<string, string>,
              status(code: number) { this.statusCode = code; return this; },
              setHeader(k: string, v: string) { this.headers[k] = v; return this; },
              send(data: any) {
                res.statusCode = this.statusCode;
                res.setHeader('Content-Type', 'text/plain');
                res.end(String(data));
              },
              json(data: any) {
                res.statusCode = this.statusCode;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              },
            };

            await mod.default(mockReq, mockRes);
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'API endpoint error' }));
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localAssetMiddlewarePlugin()],
  server: {
    port: 3000,
    host: true,
    open: false,
  },
});
