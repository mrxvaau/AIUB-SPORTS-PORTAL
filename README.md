# AIUB Sports Portal - Version 1.1

Full-stack web application for AIUB Sports Management

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **Database:** Oracle 10g (PL/SQL)

## Project Structure
```
aiub-sports-portal/
├── backend/          # Node.js backend
├── frontend/         # HTML/CSS/JS frontend
├── database/         # Oracle SQL scripts
└── docs/            # Documentation
```

## Setup Instructions
See `docs/SETUP_GUIDE.md` for complete installation instructions.

## Quick Start
1. Setup Oracle Database: `sqlplus @database/schema.sql`
2. Install backend: `cd backend && npm install`
3. Configure: Edit `backend/.env`
4. Start backend: `npm start`
5. Start frontend: `npx http-server frontend -p 3031`
6. Open: http://localhost:3031

## Version History
- v1.1 (Current) - Initial release with login and profile management
