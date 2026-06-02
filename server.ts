import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { PGlite } from '@electric-sql/pglite';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';

import pg from 'pg';

let db: {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  exec: (sql: string) => Promise<void>;
};

// Diagnostics to help identify available Railway/Supabase environment variables
console.log('[Server Startup] Scanning Environment Variables for Database Configurations:');
console.log('  - DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('  - POSTGRES_URL present:', !!process.env.POSTGRES_URL);
console.log('  - PGURL present:', !!process.env.PGURL);
const envKeys = Object.keys(process.env).filter(k => 
  k.includes('DB') || k.includes('URL') || k.includes('POSTGRES') || k.includes('PG')
);
console.log('  - Found related Keys:', envKeys);

let dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGURL;

// If individual DB variables are provided instead of a full URL, construct the URL automatically
if (!dbUrl && process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD) {
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'postgres';
  const encodedUser = encodeURIComponent(process.env.DB_USER);
  const encodedPassword = encodeURIComponent(process.env.DB_PASSWORD);
  dbUrl = `postgresql://${encodedUser}:${encodedPassword}@${process.env.DB_HOST}:${port}/${name}`;
  console.log('  - Constructed Database URL automatically from DB_ variables!');
}

const useSupabase = !!dbUrl;

if (useSupabase) {
  console.log('Connecting to Supabase PostgreSQL Database using detected connection string...');
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false } // Crucial for connection to hosted databases like Supabase
  });
  db = {
    query: async (sql: string, params?: any[]) => {
      const res = await pool.query(sql, params);
      return { rows: res.rows };
    },
    exec: async (sql: string) => {
      await pool.query(sql);
    }
  };
} else {
  console.log('Using local in-memory PGlite database.');
  const pglite = new PGlite();
  db = {
    query: async (sql: string, params?: any[]) => {
      const res = await pglite.query(sql, params);
      return { rows: res.rows };
    },
    exec: async (sql: string) => {
      await pglite.exec(sql);
    }
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer for file uploads (Datasets & PDFs)
const upload = multer({ dest: UPLOADS_DIR });

const app = express();
app.use(express.json());

// Strict Rate Limiting on document endpoints
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 5, // 5 requests per IP per timeframe
  message: { error: 'Too many downloads from this IP, please try again later.' }
});

// Setup Schema
async function initDb() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'basic'
    );
    CREATE TABLE IF NOT EXISTS portfolios (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      bio TEXT,
      credentials TEXT
    );
    CREATE TABLE IF NOT EXISTS publications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      abstract TEXT NOT NULL,
      pdf_url TEXT,
      dataset_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS co_authors (
      id SERIAL PRIMARY KEY,
      publication_id INTEGER REFERENCES publications(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      affiliation TEXT NOT NULL
    );
  `);
}

// Global Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) {
    req.user = null;
    return next();
  }
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) req.user = null;
    else req.user = user;
    next();
  });
};

app.use(authenticateToken);

// ----- API ENDPOINTS ----- //

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  const selectedRole = role || 'basic';
  const hashed = await bcrypt.hash(password, 10);
  try {
    const result = await db.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role`,
      [email, hashed, selectedRole]
    );
    const user = result.rows[0] as any;
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ user, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = result.rows[0] as any;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({
      user: { id: user.id, email: user.email, role: user.role },
      token 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req: any, res: any) => {
  console.log('[Upload Endpoint] Request received');
  if (!req.file) {
    console.log('[Upload Endpoint] No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  console.log(`[Upload Endpoint] File received: ${req.file.originalname} (${req.file.size} bytes)`);

  const hasCloudinaryUrl = process.env.CLOUDINARY_URL && process.env.CLOUDINARY_URL.startsWith('cloudinary://');
  const hasCloudinaryKeys = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

  if (hasCloudinaryUrl || hasCloudinaryKeys) {
    console.log('[Upload Endpoint] Cloudinary credentials detected. Starting Cloudinary upload...');
    const ext = path.extname(req.file.originalname);
    const tempPath = req.file.path + ext;
    try {
      // Rename file locally to preserve original extension for Cloudinary to detect properly
      fs.renameSync(req.file.path, tempPath);
      console.log(`[Upload Endpoint] Renamed file to temporary path: ${tempPath}`);

      const cloudinary = (await import('cloudinary')).v2;
      if (hasCloudinaryKeys) {
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
          secure: true
        });
      } else {
        cloudinary.config({ secure: true });
      }

      // Determine correct resource type: 'image' for images and PDFs, 'raw' for datasets (CSV, ZIP, etc.)
      const isImageOrPdf = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf'].includes(ext.toLowerCase());
      const resourceType = isImageOrPdf ? 'image' : 'raw';
      console.log(`[Upload Endpoint] Detected resource type for Cloudinary: ${resourceType}`);

      const result = await cloudinary.uploader.upload(tempPath, {
        resource_type: resourceType
      });

      console.log('[Upload Endpoint] Cloudinary upload successful:', result.secure_url);
      fs.unlinkSync(tempPath); // cleanup local
      return res.json({ url: result.secure_url });
    } catch (e: any) {
      console.error('[Upload Endpoint] Cloudinary Upload Error:', e);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return res.status(500).json({ error: 'Cloudinary upload failed: ' + e.message });
    }
  }

  // Fallback: return local path simulation setup
  console.log('[Upload Endpoint] No Cloudinary credentials found. Falling back to local file storage.');
  const url = `/api/files/${req.file.filename}`;
  res.json({ url });
});

// Serve local files for preview without Cloudinary
app.get('/api/files/:filename', downloadLimiter, (req: any, res: any) => {
  const filepath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).send('Not Found');
  res.sendFile(filepath);
});

// Publications Endpoints
app.get('/api/publications', async (req: any, res: any) => {
  try {
    const pubQuery = await db.query(`
      SELECT p.*, u.email as researcher_email 
      FROM publications p 
      JOIN users u ON p.user_id = u.id 
      ORDER BY p.created_at DESC
    `);
    
    const authorsQuery = await db.query(`SELECT * FROM co_authors`);
    
    const authorsByPub = authorsQuery.rows.reduce((acc: any, author: any) => {
      acc[author.publication_id] = acc[author.publication_id] || [];
      acc[author.publication_id].push(author);
      return acc;
    }, {});

    const enriched = pubQuery.rows.map((pub: any) => {
      const isOwner = req.user && req.user.id === pub.user_id;
      const isReviewer = req.user && req.user.role === 'reviewer';
      
      const payload: any = {
        id: pub.id,
        user_id: pub.user_id,
        researcher_email: pub.researcher_email,
        title: pub.title,
        abstract: pub.abstract,
        created_at: pub.created_at,
        co_authors: authorsByPub[pub.id] || []
      };

      // OBJECT-LEVEL PERMISSION: Reveal full dataset & pdf links only to owner or verified reviewer.
      if (isOwner || isReviewer) {
        payload.pdf_url = pub.pdf_url;
        payload.dataset_url = pub.dataset_url;
      }
      return payload;
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/publications', async (req: any, res: any) => {
  if (!req.user || req.user.role !== 'researcher') {
    return res.status(403).json({ error: 'Strict Object-level permission: Only researchers can upload portfolios' });
  }
  const { title, abstract, pdf_url, dataset_url, co_authors } = req.body;
  if (!title || !abstract) return res.status(400).json({ error: 'Title and abstract are required' });

  try {
    const insertRes = await db.query(
      `INSERT INTO publications (user_id, title, abstract, pdf_url, dataset_url) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.user.id, title, abstract, pdf_url || null, dataset_url || null]
    );
    const pubId = (insertRes.rows[0] as any).id as number;

    // Inline formsets equivalent: attach co-authors multiple entries
    if (Array.isArray(co_authors)) {
      for (const author of co_authors) {
        if (author.name && author.affiliation) {
          await db.query(
            `INSERT INTO co_authors (publication_id, name, affiliation) VALUES ($1, $2, $3)`,
            [pubId, author.name, author.affiliation]
          );
        }
      }
    }

    res.json({ id: pubId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


async function startServer() {
  try {
    console.log('[Server Startup] Initializing Database...');
    await initDb();
    console.log('[Server Startup] Database initialized successfully.');
  } catch (dbErr) {
    console.error('[Server Startup] Database initialization failed. Check your DATABASE_URL credentials:', dbErr);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
