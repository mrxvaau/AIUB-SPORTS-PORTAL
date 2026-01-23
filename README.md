# AIUB Sports Portal – Version 1.5

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
├── database/         # Database schemas (Oracle legacy & Supabase current)
│   ├── SQL/          # Contains Oracle schemas (deprecated)
│   │   ├── schema.sql
│   │   ├── enhanced_schema.sql
│   │   ├── admin-schema.sql
│   │   └── supabase_schema.sql  # ← Current schema for Supabase
│   └── moderator-schema.sql
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
3. Run the following script:

### 1️⃣ Supabase Schema

Run the complete schema from the file: `database/SQL/supabase_schema.sql`

This file contains all necessary tables, relationships, and Row Level Security (RLS) policies for the application.

**Note**: Previous Oracle-based schemas in the `database/SQL/` directory are deprecated but kept for reference.

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