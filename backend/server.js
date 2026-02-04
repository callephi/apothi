require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { pool, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true only if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// File upload configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = '/app/uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5GB limit
});

// Extras upload configuration (separate directory)
const extrasStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = '/app/uploads/extras';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const extrasUpload = multer({
  storage: extrasStorage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5GB limit
});

// Image upload configuration
const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

const requireAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows[0]?.is_admin) {
      next();
    } else {
      res.status(403).json({ error: 'Admin access required' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin;
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        is_admin: user.is_admin
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, display_name, is_admin FROM users WHERE id = $1', [req.session.userId]);
    const user = result.rows[0];
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// User management (admin only)
app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, password, displayName, isAdmin } = req.body;
  
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, display_name, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, is_admin',
      [username, passwordHash, displayName || null, isAdmin || false]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, display_name, is_admin, created_at FROM users ORDER BY created_at DESC');
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
  const { username, password, displayName, isAdmin } = req.body;
  
  try {
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (username) {
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }
    
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(passwordHash);
    }
    
    if (displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(displayName || null);
    }
    
    if (isAdmin !== undefined) {
      updates.push(`is_admin = $${paramCount++}`);
      values.push(isAdmin);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, display_name, is_admin`,
      values
    );
    
    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    // Prevent deleting self
    if (parseInt(req.params.id) === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Applications routes
app.get('/api/applications', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, 
        (SELECT COUNT(*) FROM versions WHERE application_id = a.id) as version_count,
        (SELECT version_number FROM versions WHERE application_id = a.id ORDER BY sort_order DESC, uploaded_at DESC LIMIT 1) as latest_version
      FROM applications a
      ORDER BY a.created_at DESC
    `);
    res.json({ applications: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/applications/:id', requireAuth, async (req, res) => {
  try {
    const appResult = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appResult.rows[0]) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const versionsResult = await pool.query(
      'SELECT * FROM versions WHERE application_id = $1 ORDER BY sort_order DESC, uploaded_at DESC',
      [req.params.id]
    );
    
    // Debug: Log architecture data
    if (versionsResult.rows.length > 0) {
      console.log('Sample version architecture:', versionsResult.rows[0].architecture, 'Type:', typeof versionsResult.rows[0].architecture);
    }
    
    res.json({
      application: appResult.rows[0],
      versions: versionsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/applications', requireAdmin, async (req, res) => {
  const { name, description, developer, publisher, iconUrl, homepage, tags } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO applications (name, description, developer, publisher, icon_url, homepage, tags) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, description, developer, publisher, iconUrl, homepage, tags || []]
    );
    res.json({ application: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/applications/:id', requireAdmin, async (req, res) => {
  const { name, description, developer, publisher, iconUrl, homepage, tags } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE applications SET name = $1, description = $2, developer = $3, publisher = $4, icon_url = $5, homepage = $6, tags = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8 RETURNING *',
      [name, description, developer, publisher, iconUrl, homepage, tags || [], req.params.id]
    );
    res.json({ application: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/applications/:id', requireAdmin, async (req, res) => {
  try {
    // Get all versions to delete files
    const versions = await pool.query('SELECT file_path FROM versions WHERE application_id = $1', [req.params.id]);
    
    // Delete files (only if they're uploads, not path references)
    for (const version of versions.rows) {
      if (version.file_path.startsWith('/app/uploads/')) {
        try {
          await fs.unlink(version.file_path);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      }
    }
    
    // Delete application (cascade will delete versions)
    await pool.query('DELETE FROM applications WHERE id = $1', [req.params.id]);
    res.json({ message: 'Application deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Versions routes
app.post('/api/applications/:id/versions', requireAdmin, upload.single('file'), async (req, res) => {
  let { versionNumber, notes, filePath, operatingSystem, versionType, releaseDate, sortOrder, architecture } = req.body;
  
  // Parse architecture - it might come as JSON string or array
  let archArray = null;
  if (architecture) {
    try {
      archArray = typeof architecture === 'string' ? JSON.parse(architecture) : architecture;
      // Ensure it's an array
      if (!Array.isArray(archArray)) {
        archArray = [archArray];
      }
    } catch (e) {
      // If parsing fails, treat as single value
      archArray = [architecture];
    }
  }
  
  // If version type is 'source', set OS to 'Source Code'
  if (versionType === 'source') {
    operatingSystem = 'Source Code';
  }
  
  // Support either file upload OR file path reference
  let finalFilePath;
  let fileSize;
  
  if (filePath) {
    // Using file path reference
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return res.status(400).json({ error: 'Path is not a file' });
      }
      finalFilePath = filePath;
      fileSize = stats.size;
    } catch (err) {
      return res.status(400).json({ error: 'File not found or not accessible: ' + err.message });
    }
  } else if (req.file) {
    // Using file upload
    finalFilePath = req.file.path;
    fileSize = req.file.size;
  } else {
    return res.status(400).json({ error: 'Either file upload or file path is required' });
  }
  
  // Validate version_type
  if (!versionType || !['installer', 'portable', 'source'].includes(versionType)) {
    return res.status(400).json({ error: 'Invalid version type. Must be installer, portable, or source' });
  }
  
  try {
    // Create a separate version row for EACH architecture
    const architectures = archArray && archArray.length > 0 ? archArray : [null];
    const results = [];
    
    for (const arch of architectures) {
      const result = await pool.query(
        'INSERT INTO versions (application_id, version_number, file_path, file_size, operating_system, version_type, release_date, notes, sort_order, architecture) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [req.params.id, versionNumber, finalFilePath, fileSize, operatingSystem || null, versionType, releaseDate || null, notes, sortOrder || 0, arch ? [arch] : null]
      );
      results.push(result.rows[0]);
    }
    
    // Update has_multiple_os flag if needed
    const osCheck = await pool.query(
      'SELECT DISTINCT operating_system FROM versions WHERE application_id = $1 AND operating_system IS NOT NULL',
      [req.params.id]
    );
    if (osCheck.rows.length > 1) {
      await pool.query('UPDATE applications SET has_multiple_os = TRUE WHERE id = $1', [req.params.id]);
    }
    
    res.json({ version: results[0] });  // Return first created version
  } catch (err) {
    // Clean up uploaded file if database insert fails (only for uploads, not path references)
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkErr) {
        console.error('Error deleting file:', unlinkErr);
      }
    }
    
    console.error('Version creation error:', err);
    
    // Check if it's a duplicate key error
    if (err.message && err.message.includes('duplicate key value violates unique constraint')) {
      return res.status(400).json({ error: 'This version already exists with these settings!' });
    }
    
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

app.delete('/api/versions/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT file_path, application_id FROM versions WHERE id = $1', [req.params.id]);
    const version = result.rows[0];
    
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    const appId = version.application_id;
    
    // Only delete file if it's in the uploads directory (was uploaded, not referenced)
    if (version.file_path.startsWith('/app/uploads/')) {
      try {
        await fs.unlink(version.file_path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }
    
    // Delete from database
    await pool.query('DELETE FROM versions WHERE id = $1', [req.params.id]);
    
    // Update has_multiple_os flag
    const osCheck = await pool.query(
      'SELECT DISTINCT operating_system FROM versions WHERE application_id = $1 AND operating_system IS NOT NULL',
      [appId]
    );
    const hasMultipleOS = osCheck.rows.length > 1;
    await pool.query('UPDATE applications SET has_multiple_os = $1 WHERE id = $2', [hasMultipleOS, appId]);
    
    res.json({ message: 'Version deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/versions/:id', requireAdmin, async (req, res) => {
  let { versionNumber, notes, filePath, operatingSystem, versionType, releaseDate, sortOrder, architecture } = req.body;
  
  // Parse architecture - it might come as JSON string or array
  let archArray = undefined;
  if (architecture !== undefined) {
    if (architecture === null || architecture === '') {
      archArray = null;
    } else {
      try {
        archArray = typeof architecture === 'string' ? JSON.parse(architecture) : architecture;
        // Ensure it's an array
        if (!Array.isArray(archArray)) {
          archArray = [archArray];
        }
      } catch (e) {
        // If parsing fails, treat as single value
        archArray = [architecture];
      }
    }
  }
  
  // If version type is 'source', set OS to 'Source Code'
  if (versionType === 'source') {
    operatingSystem = 'Source Code';
  }
  
  try {
    // If filePath is provided and changed, validate it
    if (filePath) {
      try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
          return res.status(400).json({ error: 'Path is not a file' });
        }
      } catch (err) {
        return res.status(400).json({ error: 'File not found or not accessible: ' + err.message });
      }
    }
    
    // Validate version_type if provided
    if (versionType !== undefined && !['installer', 'portable', 'source'].includes(versionType)) {
      return res.status(400).json({ error: 'Invalid version type. Must be installer, portable, or source' });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (versionNumber !== undefined) {
      updates.push(`version_number = $${paramCount++}`);
      values.push(versionNumber);
    }
    
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }
    
    if (operatingSystem !== undefined) {
      updates.push(`operating_system = $${paramCount++}`);
      values.push(operatingSystem || null);
    }
    
    if (versionType !== undefined) {
      updates.push(`version_type = $${paramCount++}`);
      values.push(versionType);
    }
    
    if (releaseDate !== undefined) {
      updates.push(`release_date = $${paramCount++}`);
      values.push(releaseDate || null);
    }
    
    if (sortOrder !== undefined) {
      updates.push(`sort_order = $${paramCount++}`);
      values.push(sortOrder);
    }
    
    if (archArray !== undefined) {
      updates.push(`architecture = $${paramCount++}`);
      values.push(archArray);
    }
    
    if (filePath) {
      const stats = await fs.stat(filePath);
      updates.push(`file_path = $${paramCount++}`);
      values.push(filePath);
      updates.push(`file_size = $${paramCount++}`);
      values.push(stats.size);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE versions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    // Update has_multiple_os flag if needed
    const versionData = result.rows[0];
    const osCheck = await pool.query(
      'SELECT DISTINCT operating_system FROM versions WHERE application_id = $1 AND operating_system IS NOT NULL',
      [versionData.application_id]
    );
    const hasMultipleOs = osCheck.rows.length > 1;
    await pool.query('UPDATE applications SET has_multiple_os = $1 WHERE id = $2', [hasMultipleOs, versionData.application_id]);
    
    res.json({ version: result.rows[0] });
  } catch (err) {
    console.error('Version update error:', err);
    
    // Check if it's a duplicate key error
    if (err.message && err.message.includes('duplicate key value violates unique constraint')) {
      return res.status(400).json({ error: 'This version already exists with these settings!' });
    }
    
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Extras routes
app.get('/api/applications/:id/extras', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM extras WHERE application_id = $1 ORDER BY uploaded_at DESC',
      [req.params.id]
    );
    res.json({ extras: result.rows });
  } catch (err) {
    console.error('Error fetching extras:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/applications/:id/extras', requireAdmin, extrasUpload.single('file'), async (req, res) => {
  const { description, filePath, useFilePath } = req.body;
  
  // Support either file upload OR file path reference
  let finalFilePath;
  let fileSize;
  let fileName;
  
  if (useFilePath && filePath) {
    // Using file path reference
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return res.status(400).json({ error: 'Path is not a file' });
      }
      finalFilePath = filePath;
      fileSize = stats.size;
      fileName = path.basename(filePath);
    } catch (err) {
      return res.status(400).json({ error: 'File not found or not accessible: ' + err.message });
    }
  } else if (req.file) {
    // Using file upload
    finalFilePath = req.file.path;
    fileSize = req.file.size;
    fileName = req.file.originalname;
  } else {
    return res.status(400).json({ error: 'Either file upload or file path is required' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO extras (application_id, file_name, description, file_path, file_size) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.id, fileName, description || null, finalFilePath, fileSize]
    );
    
    res.json({ extra: result.rows[0] });
  } catch (err) {
    // Clean up uploaded file if database insert fails
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkErr) {
        console.error('Error deleting file:', unlinkErr);
      }
    }
    console.error('Error creating extra:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/extras/:id', requireAdmin, async (req, res) => {
  try {
    // Get file path before deleting
    const extraResult = await pool.query('SELECT * FROM extras WHERE id = $1', [req.params.id]);
    if (extraResult.rows.length === 0) {
      return res.status(404).json({ error: 'Extra not found' });
    }
    
    const extra = extraResult.rows[0];
    
    // Delete from database
    await pool.query('DELETE FROM extras WHERE id = $1', [req.params.id]);
    
    // Delete file if it's in uploads directory
    if (extra.file_path.startsWith('/app/uploads/')) {
      try {
        await fs.unlink(extra.file_path);
      } catch (err) {
        console.log('Could not delete extra file:', err.message);
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting extra:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/download-extra/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM extras WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Extra not found' });
    }
    
    const extra = result.rows[0];
    const filePath = extra.file_path;
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    res.download(filePath, extra.file_name);
  } catch (err) {
    console.error('Error downloading extra:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Image upload routes
app.post('/api/upload-image', requireAdmin, imageUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }
  
  try {
    const uploadDir = '/app/uploads/images';
    await fs.mkdir(uploadDir, { recursive: true });
    
    const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.webp';
    const filepath = path.join(uploadDir, filename);
    
    // Optimize image without forcing square - preserve original aspect ratio
    await sharp(req.file.buffer)
      .resize({
        width: 512,
        height: 512,
        fit: 'inside',  // Preserve aspect ratio, no cropping
        withoutEnlargement: true  // Don't upscale small images
      })
      .webp({ quality: 90 })
      .toFile(filepath);
    
    res.json({ imageUrl: `/api/images/${filename}` });
  } catch (err) {
    console.error('Image processing error:', err);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

app.get('/api/images/:filename', (req, res) => {
  res.sendFile(`/app/uploads/images/${req.params.filename}`);
});

// Download route
app.get('/api/download/:versionId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM versions WHERE id = $1', [req.params.versionId]);
    const version = result.rows[0];
    
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    // Log download
    await pool.query(
      'INSERT INTO download_logs (user_id, version_id) VALUES ($1, $2)',
      [req.session.userId, req.params.versionId]
    );
    
    // Send file with original filename from path
    const originalFilename = path.basename(version.file_path);
    res.download(version.file_path, originalFilename);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();
    
    // Create default admin user if none exists
    const userCheck = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count) === 0) {
      const defaultPassword = await bcrypt.hash('admin', 10);
      await pool.query(
        'INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, $3)',
        ['admin', defaultPassword, true]
      );
      console.log('Default admin user created (username: admin, password: admin)');
      console.log('PLEASE CHANGE THE DEFAULT PASSWORD!');
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Apothi backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
