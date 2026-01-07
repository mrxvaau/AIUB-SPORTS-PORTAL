# AIUB Sports Portal – Version 1.1

Full-stack web application for **AIUB Sports Management**.

This README is written so that **anyone can clone the repository and run the project step by step** on a modern system. The project now uses **Supabase (PostgreSQL)** instead of Oracle, meaning **all data is securely stored in the cloud**.

---

## 🚀 Key Update (Important)

* ✅ **Supabase (PostgreSQL) is now used as the primary database**
* ☁️ Cloud-based, scalable, and modern
* 🔐 Row Level Security (RLS) enabled

All Oracle-related setup, drivers, dumps, and configuration have been removed.

---

## 🧰 Tech Stack

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Node.js, Express.js
* **Database:** Supabase (PostgreSQL)
* **Authentication:** Microsoft Azure AD (OAuth 2.0)
* **Hosting Ready:** Any Node-compatible platform

---

## 📁 Project Structure

```
aiub-sports-portal/
├── backend/          # Node.js backend (Express + Supabase)
├── frontend/         # HTML / CSS / JS frontend
├── database/         # Supabase SQL schema
│   ├── schema.sql
│   └── teams_and_features.sql
├── docs/
└── README.md
```

---

## ✅ Prerequisites

Make sure you have the following installed:

* **Node.js** (v16 or higher recommended)
* **npm**
* **Git**
* A **Supabase account**
* A **Microsoft Azure account** (for Azure AD OAuth)

---

## 📥 Step 1: Clone the Repository

```bash
git clone https://github.com/mrxvaau/AIUB-SPORTS-PORTAL
cd aiub-sports-portal
```

---

## 🌐 Step 2: Create a Supabase Project

1. Go to **[https://supabase.com](https://supabase.com)**
2. Create a new project
3. Choose a project name and password
4. Wait for the database to be provisioned

Once ready, go to:

**Project Settings → API**

You will need:

* `SUPABASE_URL`
* `SUPABASE_ANON_KEY`
* `SUPABASE_SERVICE_ROLE_KEY`

---

## 🗄️ Step 3: Set Up Database Schema (Supabase)

1. Open your Supabase project
2. Go to **SQL Editor**
3. Run the following scripts **in order**

### 1️⃣ Core Schema

```sql
-- Supabase Schema for AIUB Sports Portal
-- PostgreSQL compatible

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    gender VARCHAR(20),
    phone_number VARCHAR(20),
    blood_group VARCHAR(5),
    program_level VARCHAR(50),
    department VARCHAR(100),
    name_edit_count INTEGER DEFAULT 0,
    is_first_login BOOLEAN DEFAULT TRUE,
    profile_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS tournaments (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    photo_url TEXT,
    registration_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    description TEXT,
    created_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_games (
    id BIGSERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    game_name VARCHAR(255) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    fee_per_person DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS game_registrations (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    game_id INTEGER REFERENCES tournament_games(id) ON DELETE CASCADE,
    payment_status VARCHAR(20) DEFAULT 'PENDING',
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, game_id)
);

CREATE TABLE IF NOT EXISTS admins (
    id BIGSERIAL PRIMARY KEY,
    admin_id VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2️⃣ Teams, Notifications & Cart

```sql
CREATE TABLE IF NOT EXISTS teams (
    id BIGSERIAL PRIMARY KEY,
    tournament_game_id INTEGER REFERENCES tournament_games(id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    leader_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id BIGSERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'MEMBER',
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO',
    status VARCHAR(20) DEFAULT 'UNREAD',
    related_id INTEGER,
    related_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    item_id INTEGER,
    tournament_game_id INTEGER REFERENCES tournament_games(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tournament_game_id)
);
```

### 3️⃣ Enable Row Level Security (Development Mode)

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tournaments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tournament_games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON game_registrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON team_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON cart FOR ALL USING (true) WITH CHECK (true);
```

---

## 🔐 Step 4: Backend Environment Configuration (.env)

Create a `.env` file inside the **backend/** directory.

⚠️ **Never commit `.env` to GitHub**

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_public_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT Configuration
JWT_SECRET=change_this_secret_in_production

# Session Configuration
SESSION_TIMEOUT=3600000

# CORS Configuration
CORS_ORIGIN=http://localhost:3001

# Logging
LOG_LEVEL=debug

# Application Settings
APP_NAME=AIUB Sports Portal
APP_VERSION=1.1

# Microsoft Azure AD OAuth Configuration
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_REDIRECT_URI=http://localhost:3001/callback

# Allowed Email Domains
ALLOWED_EMAIL_DOMAIN=@student.aiub.edu,aiub.edu
```

### 🔎 Environment Variable Explanation

| Variable                  | Description                       |
| ------------------------- | --------------------------------- |
| SUPABASE_URL              | Supabase project URL              |
| SUPABASE_ANON_KEY         | Public client key (frontend safe) |
| SUPABASE_SERVICE_ROLE_KEY | Backend-only admin key            |
| AZURE_CLIENT_ID           | Azure AD application ID           |
| AZURE_CLIENT_SECRET       | Azure AD secret                   |
| AZURE_TENANT_ID           | Azure tenant ID                   |

---

## ▶️ Step 5: Install Dependencies & Run Backend

```bash
cd backend
npm install
npm start
```

Backend will start at:

```
http://localhost:3000
```

---

## 🌐 Step 6: Run Frontend

Open the `frontend/` folder and serve it using:

* Live Server (VS Code)
* OR any static server

```bash
cd fronted
npx http-server -p 3001
```

Frontend runs at:

```
http://localhost:3001
```

---

## 🔒 Authentication Flow

* Users sign in using **Microsoft Azure AD**
* Only AIUB email domains are allowed
* User profile is auto-created on first login

---

## 📌 Notes

* RLS policies are **open for development**
* Restrict policies before production
* Service Role Key must **never** be exposed to frontend

---

## 👨‍💻 Author

**Mrxvaau**
Cybersecurity Enthusiast | CTF Player | Full-Stack Developer

---

## ⭐ Support

If you find this project useful, give it a ⭐ on GitHub!
