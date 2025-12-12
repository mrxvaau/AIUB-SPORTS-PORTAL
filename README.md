# AIUB Sports Portal – Version 1.1

Full-stack web application for **AIUB Sports Management**.

This README is written so that **anyone can clone the repository and run the project step by step**, even on a **modern 64-bit Windows system using Oracle 10g**.

---

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **Database:** Oracle 10g (PL/SQL)
- **Authentication:** Microsoft Azure AD (OAuth)

---

## Project Structure
```
aiub-sports-portal/
├── backend/          # Node.js backend
├── frontend/         # HTML/CSS/JS frontend
├── database/         # Database dump & SQL scripts
│   ├── webuser_backup.dmp
│   └── schema.sql
├── docs/
└── README.md
```

---

## Prerequisites
- Node.js (v16+ recommended)
- npm
- Windows OS
- Git

---

## Step 1: Clone the Repository
```bash
git clone <your-repository-url>
cd aiub-sports-portal
```

---

## Step 2: Backend Environment Configuration (.env)

⚠️ **Do NOT commit the `.env` file to GitHub**

```bash
cd backend
type nul > .env
```

### `.env` Placeholder Configuration
```env
PORT=3000
NODE_ENV=development

DB_USER=webuser
DB_PASSWORD=webpassword
DB_CONNECTION_STRING=localhost:1521/XE

JWT_SECRET=change_me

SESSION_TIMEOUT=3600000
CORS_ORIGIN=http://localhost:3001

APP_NAME=AIUB Sports Portal
APP_VERSION=1.1

AZURE_TENANT_ID=YOUR_TENANT_ID
AZURE_CLIENT_ID=YOUR_CLIENT_ID
AZURE_CLIENT_SECRET=YOUR_CLIENT_SECRET
AZURE_REDIRECT_URI=http://localhost:3001/callback

ALLOWED_EMAIL_DOMAIN=@student.aiub.edu
```

---

## Azure OAuth Setup
1. Azure Portal → Azure Active Directory
2. App registrations → New registration
3. Copy Tenant ID & Client ID
4. Certificates & Secrets → Create Client Secret
5. Add redirect URI:
```
http://localhost:3001/callback
```

---

## Step 3: Install Oracle 10g (Manual Download)

GitHub does not allow `.exe` files.

**Download Oracle 10g (XE):**
https://www.dropbox.com/scl/fo/japz568rim4cc9y48xhze/AHUjHYykGFIsMpW-W5kfPes?rlkey=gr7kb9h5yd6qtn7wkyvhqoov8&e=1&dl=0

1. Extract archive
2. Run `setup.exe`
3. Install using default XE settings

Restart system after installation.

---

## Step 4: Oracle Instant Client (Required)

**Download (Official Oracle):**
https://download.oracle.com/otn_software/nt/instantclient/2326000/instantclient-basic-windows.x64-23.26.0.0.0.zip

1. Extract ZIP
2. Move folder to:
```
C:\oraclexe\instantclient_23_26
```

---

## Step 5: Environment Variables

Add to **PATH**:
```
C:\oraclexe\instantclient_23_26
```

Create system variables:

| Name | Value |
|-----|------|
| ORACLE_HOME | C:\oraclexe |
| TNS_ADMIN | C:\oraclexe\instantclient_23_26 |

Restart system.

---

## Step 6: Database Setup

```bash
sqlplus / as sysdba
```

```sql
CREATE USER webuser IDENTIFIED BY webpassword;
GRANT CONNECT, RESOURCE, DBA TO webuser;
```

Import dump:
```bash
cd database
imp webuser/webpassword@XE file=webuser_backup.dmp full=y
```

---

## Step 7: Run Backend
```bash
cd backend
npm install
npm run start
```

Backend URL:
```
http://localhost:3000
```

---

## Step 8: Run Frontend
```bash
cd frontend
npx http-server -p 3001
```

Frontend URL:
```
http://localhost:3001
```

---

## Notes
- Never commit `.env`
- Windows-only Oracle setup
- Restart required after Oracle setup

---

✅ Project will run successfully if all steps are followed.
