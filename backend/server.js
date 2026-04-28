const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET_KEY = 'super_secret_brainygrasp_key';
const app = express();
const port = 3000;

app.use(cors({
  origin: ['http://localhost:4000','http://localhost:5500','http://localhost:5000','http://127.0.0.1:5500','http://127.0.0.1:5000','null'],
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());

const pool = new Pool({ user:'postgres', host:'localhost', database:'brainygras', password:'password', port:5432 });

// ── Seed data ──────────────────────────────────────────────────────────────
const initialData = {
  trending:[
    {id:1,name:"Brain Builder Puzzle Set",age:"3-7 Years",ageGroup:"3+",price:649,originalPrice:699,save:"7%",reviews:423,badge:"bestseller",image:"https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Puzzles & Pretend",skills:["Logical Reasoning","Focus & Attention"],theme:"Animals",type:"Single Products",launchDate:"2025-01-15",sales:1500},
    {id:2,name:"STEM Explorer Kit | Science Experiments",age:"6-12 Years",ageGroup:"6+",price:899,originalPrice:999,save:"10%",reviews:287,badge:"bestseller",image:"https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Learning Products",skills:["Logical Reasoning","Fine Motor"],theme:"Science",type:"Single Products",launchDate:"2025-05-20",sales:1200},
    {id:3,name:"Baby Sensory Touch & Feel Book",age:"0-24 Months",ageGroup:"0-3",price:549,originalPrice:599,save:"8%",reviews:512,badge:"bestseller",image:"https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Infant Toys",skills:["Sensory Development","Focus & Attention"],theme:"Animals",type:"Single Products",launchDate:"2024-11-10",sales:2000},
    {id:4,name:"Sparkle Art Studio | Mess-Free Craft Kit",age:"3-7 Years",ageGroup:"3+",price:749,originalPrice:799,save:"6%",reviews:345,badge:"new",image:"https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Arts & Crafts",skills:["Fine Motor","Creativity"],theme:"Magic",type:"Single Products",launchDate:"2026-02-01",sales:500},
    {id:5,name:"Word Wizard | Vocabulary Flash Cards",age:"8+ Years",ageGroup:"8+",price:354,originalPrice:374,save:"5%",reviews:665,badge:"bestseller",image:"https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Learning Products",skills:["Social & Communication","Focus & Attention"],theme:"Classics",type:"Single Products",launchDate:"2024-08-25",sales:2500},
    {id:6,name:"Ocean Adventures Floor Puzzle",age:"3-6 Years",ageGroup:"3+",price:499,originalPrice:549,save:"9%",reviews:198,badge:"new",image:"https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Puzzles & Pretend",skills:["Logical Reasoning","Focus & Attention"],theme:"Ocean",type:"Single Products",launchDate:"2026-03-15",sales:300},
    {id:7,name:"Number Ninjas | Math Learning Game",age:"6-10 Years",ageGroup:"6+",price:599,originalPrice:649,save:"8%",reviews:312,badge:"bestseller",image:"https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Card & Board Games",skills:["Logical Reasoning","Focus & Attention"],theme:"Classics",type:"Single Products",launchDate:"2025-09-10",sales:1100},
    {id:8,name:"High Contrast Baby Flash Cards",age:"0-12 Months",ageGroup:"0-3",price:349,originalPrice:399,save:"13%",reviews:478,badge:"bestseller",image:"https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Infant Toys",skills:["Sensory Development","Focus & Attention"],theme:"Animals",type:"Single Products",launchDate:"2024-12-05",sales:1800}
  ],
  bestsellers:[
    {id:9,name:"BrainQuiz Family Card Game",age:"8+ Years",ageGroup:"8+",price:449,originalPrice:499,save:"10%",reviews:892,badge:"bestseller",image:"https://images.unsplash.com/photo-1632501641765-e568d28b0015?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Card & Board Games",skills:["Logical Reasoning","Social & Communication"],theme:"Classics",type:"Single Products",launchDate:"2023-10-10",sales:5000},
    {id:10,name:"Magnetic Discovery Board",age:"3-8 Years",ageGroup:"3+",price:799,originalPrice:899,save:"11%",reviews:567,badge:"bestseller",image:"https://images.unsplash.com/photo-1560421683-6856ea585c78?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Learning Products",skills:["Fine Motor","Creativity"],theme:"Classics",type:"Single Products",launchDate:"2024-05-15",sales:2200},
    {id:11,name:"Sensory Rainbow Stacker",age:"1-3 Years",ageGroup:"0-3",price:649,originalPrice:699,save:"7%",reviews:734,badge:"bestseller",image:"https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Infant Toys",skills:["Sensory Development","Fine Motor"],theme:"Rainbow",type:"Single Products",launchDate:"2024-02-20",sales:3100},
    {id:12,name:"Creative Origami Adventure Kit",age:"6+ Years",ageGroup:"6+",price:399,originalPrice:449,save:"11%",reviews:423,badge:"bestseller",image:"https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Arts & Crafts",skills:["Fine Motor","Focus & Attention"],theme:"Animals",type:"Single Products",launchDate:"2025-07-08",sales:1600}
  ],
  newlaunches:[
    {id:13,name:"Chess Champions | Beginner Chess Kit",age:"4+ Years",ageGroup:"3+",price:569,originalPrice:599,save:"5%",reviews:0,badge:"new",image:"https://images.unsplash.com/photo-1529220502050-f15e43e15270?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Card & Board Games",skills:["Logical Reasoning","Focus & Attention"],theme:"Classics",type:"Single Products",launchDate:"2026-04-01",sales:50},
    {id:14,name:"Handwriting Hero Practice Kit",age:"4-7 Years",ageGroup:"3+",price:759,originalPrice:799,save:"5%",reviews:0,badge:"new",image:"https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Learning Products",skills:["Fine Motor","Focus & Attention"],theme:"Classics",type:"Single Products",launchDate:"2026-04-10",sales:80},
    {id:15,name:"Space Explorer 3D Art Kit",age:"5-10 Years",ageGroup:"6+",price:664,originalPrice:699,save:"5%",reviews:0,badge:"new",image:"https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Arts & Crafts",skills:["Creativity","Fine Motor"],theme:"Space",type:"Single Products",launchDate:"2026-03-25",sales:120},
    {id:16,name:"Dino Discovery Sand Play Set",age:"3-7 Years",ageGroup:"3+",price:549,originalPrice:599,save:"8%",reviews:0,badge:"new",image:"https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=400&h=300&fit=crop",offer:"Buy any 2 | Get FLAT 10% OFF",category:"Puzzles & Pretend",skills:["Sensory Development","Creativity"],theme:"Dinosaurs",type:"Single Products",launchDate:"2026-03-28",sales:90}
  ],
  bundles:[
    {id:17,name:"Vocabulary Champions Bundle",age:"8+ Years",ageGroup:"8+",price:953,originalPrice:1122,save:"15%",reviews:234,badge:"bundle",image:"https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop",offer:"BUNDLE DEAL - 15% OFF",category:"Learning Products",skills:["Social & Communication","Focus & Attention"],theme:"Classics",type:"Bundles",launchDate:"2025-11-01",sales:600},
    {id:18,name:"Baby Essentials Starter Bundle",age:"0-18 Months",ageGroup:"0-3",price:1601,originalPrice:1779,save:"10%",reviews:156,badge:"bundle",image:"https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&h=300&fit=crop",offer:"BUNDLE DEAL - 10% OFF",category:"Infant Toys",skills:["Sensory Development","Fine Motor"],theme:"Animals",type:"Bundles",launchDate:"2025-10-15",sales:800},
    {id:19,name:"Creative Colors Sticker Bundle",age:"3-7 Years",ageGroup:"3+",price:1403,originalPrice:1650,save:"15%",reviews:312,badge:"bundle",image:"https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop",offer:"BUNDLE DEAL - 15% OFF",category:"Arts & Crafts",skills:["Creativity","Fine Motor"],theme:"Classics",type:"Bundles",launchDate:"2025-08-20",sales:450},
    {id:20,name:"Touch & Tickle Time Bundle",age:"0-3 Years",ageGroup:"0-3",price:1956,originalPrice:2249,save:"13%",reviews:189,badge:"bundle",image:"https://images.unsplash.com/photo-1587654780291-39c9404d7dd0?w=400&h=300&fit=crop",offer:"BUNDLE DEAL - 13% OFF",category:"Infant Toys",skills:["Sensory Development","Social & Communication"],theme:"Animals",type:"Bundles",launchDate:"2026-01-10",sales:300}
  ]
};

// ── DB Init ────────────────────────────────────────────────────────────────
async function initDB() {
  let client;
  try {
    client = await pool.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY, group_name VARCHAR(50), name VARCHAR(255),
        age VARCHAR(50), age_group VARCHAR(50), price INTEGER, original_price INTEGER,
        save VARCHAR(20), reviews INTEGER, badge VARCHAR(50), image TEXT, offer TEXT,
        category VARCHAR(100), skills JSONB, theme VARCHAR(100), type VARCHAR(100),
        launch_date DATE, sales INTEGER
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE, password VARCHAR(255)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(150) UNIQUE,
        phone VARCHAR(20) UNIQUE,
        otp VARCHAR(10),
        otp_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        full_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        line1 VARCHAR(255) NOT NULL,
        line2 VARCHAR(255),
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        pincode VARCHAR(10) NOT NULL,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        address_id INTEGER REFERENCES addresses(id),
        items JSONB NOT NULL,
        subtotal INTEGER NOT NULL,
        total INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'Placed',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const adminRes = await client.query('SELECT COUNT(*) FROM admin_users');
    if (parseInt(adminRes.rows[0].count) === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query('INSERT INTO admin_users (username,password) VALUES ($1,$2)',['admin',hashedPassword]);
    }

    const res = await client.query('SELECT COUNT(*) FROM products');
    if (parseInt(res.rows[0].count) === 0) {
      for (const [groupName, groupProducts] of Object.entries(initialData)) {
        for (const p of groupProducts) {
          await client.query(`
            INSERT INTO products (group_name,name,age,age_group,price,original_price,save,reviews,badge,image,offer,category,skills,theme,type,launch_date,sales)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          `,[groupName,p.name,p.age,p.ageGroup,p.price,p.originalPrice,p.save,p.reviews,p.badge,p.image,p.offer,p.category,JSON.stringify(p.skills||[]),p.theme,p.type,p.launchDate,p.sales]);
        }
      }
    }
  } catch (err) {
    console.error('DB init error:', err);
  } finally {
    if (client) client.release();
  }
}

pool.on('error',(err)=>console.error('Idle client error',err));
setTimeout(initDB, 2000);

// ── Helpers ────────────────────────────────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err || user.role !== 'admin') return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ── Products API ───────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    const grouped = { trending:[], bestsellers:[], newlaunches:[], bundles:[] };
    result.rows.forEach(p => {
      const mapped = {
        id:p.id, name:p.name, age:p.age, ageGroup:p.age_group,
        price:p.price, originalPrice:p.original_price, save:p.save,
        reviews:p.reviews, badge:p.badge, image:p.image, offer:p.offer,
        category:p.category, skills:p.skills, theme:p.theme, type:p.type,
        launchDate:p.launch_date, sales:p.sales
      };
      if (grouped[p.group_name]) grouped[p.group_name].push(mapped);
    });
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error:'Internal Server Error' });
  }
});

app.post('/api/products', authenticateAdmin, async (req, res) => {
  const { group_name,name,age,ageGroup,price,originalPrice,save,reviews,badge,image,offer,category,theme,type,launchDate,sales,skills } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO products (group_name,name,age,age_group,price,original_price,save,reviews,badge,image,offer,category,skills,theme,type,launch_date,sales)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *
    `,[group_name,name,age,ageGroup,price,originalPrice,save,reviews,badge,image,offer,category,JSON.stringify(skills||[]),theme,type,launchDate,sales||0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error:'Failed to add product' });
  }
});

app.delete('/api/products/:id', authenticateAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1',[req.params.id]);
    res.json({ success:true });
  } catch (err) {
    res.status(500).json({ error:'Failed to delete product' });
  }
});

// ── Admin Auth ─────────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM admin_users WHERE username=$1',[username]);
    if (result.rows.length === 0) return res.status(401).json({ error:'Invalid credentials' });
    const match = await bcrypt.compare(password, result.rows[0].password);
    if (!match) return res.status(401).json({ error:'Invalid credentials' });
    const token = jwt.sign({ id:result.rows[0].id, username, role:'admin' }, SECRET_KEY, { expiresIn:'12h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error:'Internal Server Error' });
  }
});

// ── User Auth ──────────────────────────────────────────────────────────────
// Request OTP (phone or email)
app.post('/api/auth/request-otp', async (req, res) => {
  const { method, value } = req.body; // method: "phone" | "email"
  if (!method || !value) return res.status(400).json({ error:'method and value are required' });

  const otp = generateOTP();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    const field = method === 'phone' ? 'phone' : 'email';
    // Upsert user
    await pool.query(`
      INSERT INTO users (${field}, otp, otp_expires)
      VALUES ($1, $2, $3)
      ON CONFLICT (${field}) DO UPDATE SET otp=$2, otp_expires=$3
    `,[value, otp, expires]);

    // In production: send SMS/email. For demo, return OTP in response.
    res.json({ success:true, message:'OTP sent', otp_demo:otp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Failed to send OTP' });
  }
});

// Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  const { method, value, otp } = req.body;
  if (!method || !value || !otp) return res.status(400).json({ error:'method, value and otp are required' });

  const field = method === 'phone' ? 'phone' : 'email';
  try {
    const result = await pool.query(`SELECT * FROM users WHERE ${field}=$1`,[value]);
    if (result.rows.length === 0) return res.status(401).json({ error:'User not found' });

    const user = result.rows[0];
    if (user.otp !== otp) return res.status(401).json({ error:'Invalid OTP' });
    if (new Date() > new Date(user.otp_expires)) return res.status(401).json({ error:'OTP expired' });

    // Clear OTP
    await pool.query('UPDATE users SET otp=NULL, otp_expires=NULL WHERE id=$1',[user.id]);

    const token = jwt.sign({ id:user.id, role:'user' }, SECRET_KEY, { expiresIn:'7d' });
    res.json({
      token,
      user: { id:user.id, name:user.name, email:user.email, phone:user.phone }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Failed to verify OTP' });
  }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id,name,email,phone,created_at FROM users WHERE id=$1',[req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error:'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error:'Internal Server Error' });
  }
});

// Update profile name
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('UPDATE users SET name=$1 WHERE id=$2',[name, req.user.id]);
    res.json({ success:true });
  } catch (err) {
    res.status(500).json({ error:'Failed to update profile' });
  }
});

// ── Addresses ──────────────────────────────────────────────────────────────
app.get('/api/addresses', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM addresses WHERE user_id=$1 ORDER BY is_default DESC, created_at DESC',[req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error:'Internal Server Error' });
  }
});

app.post('/api/addresses', authenticateToken, async (req, res) => {
  const { full_name, phone, line1, line2, city, state, pincode, is_default } = req.body;
  try {
    if (is_default) {
      await pool.query('UPDATE addresses SET is_default=false WHERE user_id=$1',[req.user.id]);
    }
    const result = await pool.query(`
      INSERT INTO addresses (user_id,full_name,phone,line1,line2,city,state,pincode,is_default)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `,[req.user.id, full_name, phone, line1, line2||'', city, state, pincode, is_default||false]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error:'Failed to save address' });
  }
});

app.put('/api/addresses/:id', authenticateToken, async (req, res) => {
  const { full_name, phone, line1, line2, city, state, pincode, is_default } = req.body;
  try {
    if (is_default) {
      await pool.query('UPDATE addresses SET is_default=false WHERE user_id=$1',[req.user.id]);
    }
    await pool.query(`
      UPDATE addresses SET full_name=$1,phone=$2,line1=$3,line2=$4,city=$5,state=$6,pincode=$7,is_default=$8
      WHERE id=$9 AND user_id=$10
    `,[full_name,phone,line1,line2||'',city,state,pincode,is_default||false,req.params.id,req.user.id]);
    res.json({ success:true });
  } catch (err) {
    res.status(500).json({ error:'Failed to update address' });
  }
});

app.delete('/api/addresses/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM addresses WHERE id=$1 AND user_id=$2',[req.params.id, req.user.id]);
    res.json({ success:true });
  } catch (err) {
    res.status(500).json({ error:'Failed to delete address' });
  }
});

// ── Orders ─────────────────────────────────────────────────────────────────
app.post('/api/orders', authenticateToken, async (req, res) => {
  const { address_id, items, subtotal, total } = req.body;
  if (!address_id || !items || !total) return res.status(400).json({ error:'address_id, items and total are required' });
  try {
    const result = await pool.query(`
      INSERT INTO orders (user_id,address_id,items,subtotal,total,status)
      VALUES ($1,$2,$3,$4,$5,'Placed') RETURNING *
    `,[req.user.id, address_id, JSON.stringify(items), subtotal||total, total]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Failed to place order' });
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, a.full_name, a.line1, a.city, a.state, a.pincode
      FROM orders o
      LEFT JOIN addresses a ON o.address_id=a.id
      WHERE o.user_id=$1
      ORDER BY o.created_at DESC
    `,[req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error:'Internal Server Error' });
  }
});

app.listen(port, () => console.log(`Backend API running on http://localhost:${port}`));
