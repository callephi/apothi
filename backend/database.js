const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const initDatabase = async () => {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create applications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        developer VARCHAR(255),
        publisher VARCHAR(255),
        icon_url VARCHAR(500),
        homepage VARCHAR(500),
        tags TEXT[],
        has_multiple_os BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create versions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS versions (
        id SERIAL PRIMARY KEY,
        application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
        version_number VARCHAR(50) NOT NULL,
        version_type VARCHAR(20) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT,
        operating_system VARCHAR(50),
        release_date DATE,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        sort_order INTEGER DEFAULT 0
      )
    `);

    // Create download logs table (optional, for tracking)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS download_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        version_id INTEGER REFERENCES versions(id) ON DELETE CASCADE,
        downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate existing tables - add new columns if they don't exist
    try {
      await pool.query(`
        ALTER TABLE applications 
        ADD COLUMN IF NOT EXISTS developer VARCHAR(255),
        ADD COLUMN IF NOT EXISTS publisher VARCHAR(255),
        ADD COLUMN IF NOT EXISTS homepage VARCHAR(500),
        ADD COLUMN IF NOT EXISTS tags TEXT[],
        ADD COLUMN IF NOT EXISTS has_multiple_os BOOLEAN DEFAULT FALSE
      `);
      
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)
      `);
      
      await pool.query(`
        ALTER TABLE versions
        ADD COLUMN IF NOT EXISTS operating_system VARCHAR(50),
        ADD COLUMN IF NOT EXISTS version_type VARCHAR(20),
        ADD COLUMN IF NOT EXISTS release_date DATE,
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0
      `);
      
      // Drop old columns if they exist
      try {
        await pool.query(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'versions' AND column_name = 'is_installer'
            ) THEN
              UPDATE versions 
              SET version_type = CASE 
                WHEN is_installer = TRUE THEN 'installer'
                WHEN is_portable = TRUE THEN 'portable'
                ELSE 'installer'
              END
              WHERE version_type IS NULL;
              
              ALTER TABLE versions DROP COLUMN is_installer;
              ALTER TABLE versions DROP COLUMN is_portable;
            END IF;
          END $$;
        `);
      } catch (err) {
        console.log('Migration cleanup note:', err.message);
      }
      
      // Fix UNIQUE constraint to properly handle different OS/types
      try {
        await pool.query(`
          DO $$
          BEGIN
            -- Drop old constraint if it exists
            IF EXISTS (
              SELECT 1 FROM information_schema.table_constraints 
              WHERE constraint_name = 'versions_application_id_version_number_operating_system_vers_key' 
              AND table_name = 'versions'
            ) THEN
              ALTER TABLE versions 
              DROP CONSTRAINT versions_application_id_version_number_operating_system_vers_key;
            END IF;
            
            -- Create new constraint with COALESCE to handle NULLs
            -- This allows same version_number with different OS/types
            IF NOT EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE indexname = 'versions_unique_combo'
            ) THEN
              CREATE UNIQUE INDEX versions_unique_combo ON versions (
                application_id, 
                version_number, 
                COALESCE(operating_system, ''), 
                version_type
              );
            END IF;
          END $$;
        `);
      } catch (err) {
        console.log('UNIQUE constraint migration note:', err.message);
      }
    } catch (err) {
      // Columns might already exist or be dropped, that's fine
      console.log('Migration note:', err.message);
    }

    // Fix download_logs foreign key constraint if needed
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'download_logs_version_id_fkey' 
            AND table_name = 'download_logs'
          ) THEN
            ALTER TABLE download_logs 
            DROP CONSTRAINT download_logs_version_id_fkey,
            ADD CONSTRAINT download_logs_version_id_fkey 
              FOREIGN KEY (version_id) 
              REFERENCES versions(id) 
              ON DELETE CASCADE;
          END IF;
        END $$;
      `);
    } catch (err) {
      console.log('Foreign key update note:', err.message);
    }

    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
};

module.exports = { pool, initDatabase };
