# Qwen Code Configuration for AIUB Sports Portal

## Project Overview
- **Name**: AIUB Sports Portal
- **Type**: Full-stack web application for sports management at American International University-Bangladesh
- **Version**: 1.0
- **Main Purpose**: Student sports tournament registration and management system

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript (Client UI and dashboards)
- **Backend**: Node.js with Express.js (REST API server)
- **Database**: Oracle 10g with PL/SQL (Data storage and stored procedures)
- **Authentication**: Microsoft Teams OAuth (Azure AD)

## Project Structure
```
aiub-sports-portal/
├── backend/          # Node.js API server
│   ├── config/       # Database and configuration
│   ├── controllers/  # Business logic
│   ├── routes/       # API endpoints
│   ├── node_modules/
│   └── uploads/      # File uploads
├── frontend/         # HTML/CSS/JS client
├── database/         # Oracle SQL scripts
├── docs/            # Documentation
└── images/          # Static assets
```

## Key Code Files
- `backend/server.js` - Main API server entry point
- `backend/controllers/userController.js` - Core user management logic
- `backend/routes/auth.js`, `msauth.js`, `admin.js` - API route definitions
- `backend/config/database.js` - Oracle connection management
- `frontend/dashboard.html`, `login.html`, `profile-setup.html` - Main UI components
- `database/schema.sql`, `enhanced_schema.sql`, `admin-schema.sql` - Database schema

## Business Logic
1. **User Registration**: AIUB student email validation (XX-XXXXX-X@student.aiub.edu format)
2. **Profile Management**: Name edits limited to 3 times, locked fields (gender, program, department)
3. **Tournament System**: Admins create tournaments with games categorized by gender and type
4. **Registration System**: Students register for games within deadline periods
5. **Security**: Field locking after initial setup, Microsoft OAuth with email domain enforcement

## Important Notes for Development
- Oracle 10g compatibility requires thick mode configuration
- Email validation must follow strict AIUB format (XX-XXXXX-X@student.aiub.edu)
- Name edit limit: 3 changes before field becomes locked
- Locked profile fields: gender, program level, department (cannot be changed after initial setup)
- Tournament games have categories: Male, Female, Mix with Solo/Duo/Custom types
- Payment status tracking for game registrations (PENDING/PAID/FAILED)
- Photo URLs are stored as CLOB in Oracle and require special handling (fetchInfo: {"PHOTO_URL": { type: oracledb.STRING }})

## Common Development Tasks
- Add new game categories or types to tournament system
- Modify profile validation rules
- Extend tournament deadline management
- Add new admin dashboard features
- Enhance security measures
- Improve file upload functionality

## Testing Considerations
- Oracle database connection and query execution
- Microsoft OAuth flow and token validation
- Profile update business rules enforcement
- Tournament registration deadline validation
- Name edit limit enforcement

When working on this project, prioritize maintaining data integrity, security, and the business rules that govern profile management and tournament registration.