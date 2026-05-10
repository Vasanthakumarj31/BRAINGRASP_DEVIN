const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'brainygras',
  password: 'password',
  port: 5432,
});

async function updateSchema() {
  console.log('🔧 Updating database schema...');
  
  try {
    // Check if profile_completed column exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'profile_completed'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('📝 Adding profile_completed column...');
      
      // Add profile_completed column
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN profile_completed BOOLEAN DEFAULT FALSE
      `);
      
      console.log('✅ profile_completed column added successfully');
    } else {
      console.log('✅ profile_completed column already exists');
    }
    
    // Check if other profile columns exist
    const profileColumns = ['gender', 'address', 'city', 'state', 'pincode', 'country', 'updated_at'];
    
    for (const column of profileColumns) {
      const checkColumn = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = $1
      `, [column]);
      
      if (checkColumn.rows.length === 0) {
        console.log(`📝 Adding ${column} column...`);
        
        let columnDefinition;
        switch (column) {
          case 'gender':
            columnDefinition = 'VARCHAR(10)';
            break;
          case 'address':
            columnDefinition = 'TEXT';
            break;
          case 'city':
            columnDefinition = 'VARCHAR(100)';
            break;
          case 'state':
            columnDefinition = 'VARCHAR(100)';
            break;
          case 'pincode':
            columnDefinition = 'VARCHAR(10)';
            break;
          case 'country':
            columnDefinition = 'VARCHAR(100)';
            break;
          case 'updated_at':
            columnDefinition = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
            break;
        }
        
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN ${column} ${columnDefinition}
        `);
        
        console.log(`✅ ${column} column added successfully`);
      } else {
        console.log(`✅ ${column} column already exists`);
      }
    }
    
    console.log('🎉 Database schema updated successfully!');
    
    // Test the schema by checking a user
    const testUser = await pool.query(`
      SELECT id, name, email, phone, gender, address, city, state, pincode, country, profile_completed, created_at, updated_at
      FROM users 
      WHERE email = $1
    `, ['vasanthvasanth4863@gmail.com']);
    
    if (testUser.rows.length > 0) {
      console.log('👤 Test user data:', testUser.rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Schema update failed:', error);
  } finally {
    await pool.end();
  }
}

updateSchema();
