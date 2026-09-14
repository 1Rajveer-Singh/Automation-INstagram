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
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localAssetMiddlewarePlugin()],
  server: {
    port: 3000,
    open: false,
  },
});
