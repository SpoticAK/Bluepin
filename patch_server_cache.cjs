const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldServe = `  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }`;

const newServe = `  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (path.match(/\\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'), {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    });
  }`;

if (code.includes(oldServe)) {
  fs.writeFileSync('server.ts', code.replace(oldServe, newServe));
  console.log('Patched server.ts successfully');
} else {
  console.log('Could not find target code in server.ts');
}
