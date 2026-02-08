# 🧠 AIUB Sports Portal - Project Memory

**Last Updated**: 2026-02-08 @ 11:44  
**Version**: 2.0  
**Status**: ✅ Stable - Development Active

> 📌 **Purpose**: This file serves as a persistent memory across sessions and agents. Read this FIRST when starting work on this project to understand the context, progress, and known issues.

---

## 🔥 Recent Updates Log

> ⚡ **Chain Reaction Rule**: Always READ this section → Work → UPDATE this section → READ again

### 2026-02-08 11:44 - Created: PROJECT_MEMORY.md System
- **What**: Initialized comprehensive memory file with full project documentation
- **Where**: Root directory `PROJECT_MEMORY.md` + workflow `.agent/workflows/memory-update.md`
- **Why**: Enable session continuity across account switches and agent transitions
- **Impact**: Any agent can now get full context instantly
- **Files**: PROJECT_MEMORY.md (17KB), memory-update.md workflow

### 2026-02-08 11:39 - Documented: Recent Bug Fixes
- **What**: Documented 5 major bug fixes from previous sessions
- **Where**: "Known Issues & Fixes" section below
- **Bugs Fixed**: Cancel button disappearing, cart integration, team validation, modal state, game ID stability
- **Impact**: Future agents won't re-investigate already-fixed issues

---

## 📋 Last Session Work

**Session**: 2026-02-08 @ 11:35-11:44  
**Agent**: Antigravity (account switch recovery session)  
**Focus**: Creating project memory system

**Completed**:
- ✅ Explored entire project structure (backend/frontend/database)
- ✅ Read all key configuration files
- ✅ Documented database schema (10 tables via Supabase MCP)
- ✅ Identified completed features and recent bug fixes
- ✅ Created PROJECT_MEMORY.md with comprehensive documentation
- ✅ Created memory-update.md workflow for continuous updates

**Next Session Should**:
- Read this memory file first
- Continue with planned features or bug fixes
- Update "Recent Updates Log" above as you work
- Document any new discoveries or issues

---

## � How to Use This Memory (Chain Reaction Cycle)

### 1️⃣ START OF SESSION → READ
**ALWAYS read this file first before doing ANY work:**
- Check "🔥 Recent Updates Log" above
- Review "Last Session Work" 
- Scan "Current Known Issues" below
- Get context before starting

### 2️⃣ DURING WORK → UPDATE
**Update immediately when:**
- ✅ Bug fixed → Add to "Known Issues & Fixes" + Recent Updates Log
- ✅ Feature added → Update "Key Features" + Recent Updates Log  
- ✅ File changed significantly → Note in Recent Updates Log
- ✅ Mistake made → Document in "Lessons Learned"
- ✅ Issue discovered → Add to "Current Known Issues"

### 3️⃣ END OF SESSION → UPDATE & READ
**Before finishing:**
- Update "Last Session Work" section with summary
- Review all your changes for accuracy
- Update "Last Updated" timestamp at bottom

### 4️⃣ NEXT SESSION → Cycle repeats at Step 1

**💡 See detailed workflow**: `.agent/workflows/memory-update.md`

---

## �📊 Quick Project Overview

**AIUB Sports Portal** is a full-stack web application for managing sports tournaments at American International University-Bangladesh (AIUB). Students can register for tournaments, create/join teams, and manage their sports participation.

### Tech Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript (no framework)
- **Backend**: Node.js + Express.js REST API
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Authentication**: Microsoft Azure AD OAuth 2.0
- **File Uploads**: Multer (tournament photos)
- **Hosting**: Local dev (Frontend: `http://localhost:3001`, Backend: `http://localhost:3000`)

---

## 🗂️ Project Structure

```
AIUB-SPORTS-PORTAL/
├── backend/                  # Node.js REST API
│   ├── config/              # Database & auth config
│   │   ├── supabase.js      # Supabase client initialization
│   │   └── ...
│   ├── controllers/         # Business logic (8 controllers)
│   │   ├── authController.js        # User authentication & profile
│   │   ├── cartController.js        # Shopping cart for registrations
│   │   ├── notificationController.js # User notifications
│   │   ├── registrationController.js # Game registration logic
│   │   ├── requestController.js     # Team join requests
│   │   ├── teamController.js        # Team management (51KB - complex!)
│   │   ├── tournamentController.js  # Tournament operations
│   │   └── userController.js        # User profile operations
│   ├── routes/              # API endpoints
│   │   ├── admin.js         # Admin dashboard APIs (67KB - largest)
│   │   ├── auth.js          # Auth routes
│   │   ├── dashboard.js     # Student dashboard APIs
│   │   └── msauth.js        # Microsoft OAuth routes
│   ├── uploads/             # Tournament photo storage
│   ├── server.js            # Main Express app
│   ├── package.json         # Dependencies
│   └── .env                 # Environment variables (GITIGNORED!)
│
├── frontend/                # Client-side application
│   ├── css/                 # Stylesheets
│   ├── js/                  # JavaScript modules
│   │   ├── admin/           # Admin dashboard scripts
│   │   ├── auth.js          # Authentication helper
│   │   └── utils.js         # Utility functions
│   ├── images/              # Static assets
│   ├── index.html           # Landing page
│   ├── login.html           # Login page
│   ├── callback.html        # OAuth callback handler
│   ├── profile-setup.html   # First-time profile setup
│   ├── dashboard.html       # Student dashboard (74KB)
│   ├── registration.html    # Tournament registration (89KB - LARGEST!)
│   ├── admin-dashboard.html # Admin panel (166KB - MASSIVE!)
│   ├── admin-dashboard-modular.html # Modular admin (22KB)
│   └── admin-debug.html     # Admin debugging tools
│
├── database/                # Database schemas
│   └── SQL/                 # Legacy Oracle schemas (deprecated)
├── images/                  # Project images
├── README.md                # Setup instructions
├── QWEN.md                  # OLD config (references Oracle - OUTDATED!)
└── PROJECT_MEMORY.md        # 👈 THIS FILE
```

---

## 💾 Database Schema (Supabase PostgreSQL)

**Project**: mrxavu's Project  
**Project ID**: `qvtpcwlgdwcwzqaaycog`  
**Region**: ap-south-1 (Mumbai)  
**PostgreSQL Version**: 17.6.1  
**Status**: ACTIVE_HEALTHY ✅

### Tables Overview (10 Total)

| Table | Purpose | Key Fields | Notes |
|-------|---------|------------|-------|
| `users` | Student profiles | `id`, `student_id`, `email`, `full_name`, `is_first_login`, `name_edit_count` | Name edits limited to 3 changes |
| `tournaments` | Tournament events | `id`, `title`, `photo_url`, `registration_deadline`, `status` | Admin-created events |
| `tournament_games` | Games in tournaments | `id`, `tournament_id`, `category`, `game_name`, `game_type`, `fee_per_person` | Categories: Male/Female/Mix; Types: Solo/Duo/Custom |
| `game_registrations` | Individual registrations | `id`, `user_id`, `game_id`, `payment_status` | UNIQUE constraint on (user_id, game_id) |
| `teams` | Team registrations | `id`, `tournament_game_id`, `team_name`, `leader_user_id`, `status` | For Duo/Custom games |
| `team_members` | Team member tracking | `id`, `team_id`, `user_id`, `role`, `status` | Roles: LEADER/MEMBER |
| `notifications` | User notifications | `id`, `user_id`, `title`, `message`, `type`, `status` | Types: INFO/WARNING/SUCCESS/TEAM_REQUEST |
| `cart` | Registration shopping cart | `id`, `user_id`, `item_type`, `item_id`, `tournament_game_id` | UNIQUE constraint prevents duplicates |
| `admins` | Admin accounts | `id`, `admin_id`, `email`, `full_name` | Separate from users table |
| `moderators` | Moderator permissions | `id`, `user_id`, permissions (booleans) | Links to users table |

### Important Database Notes
- **RLS Enabled**: All tables have Row Level Security (development mode: allow all)
- **Migration File**: `backend/supabase-schema.sql` contains full schema
- **Indexes**: Optimized for user_id, team_id, tournament lookups
- **Timestamps**: All tables use `TIMESTAMP WITH TIME ZONE` and `DEFAULT NOW()`

---

## 🔑 Key Features & Business Logic

### 1. Authentication Flow
1. User clicks "Login with Microsoft"
2. Redirects to Azure AD OAuth
3. Only `@student.aiub.edu` and `@aiub.edu` emails allowed
4. Auto-creates user profile on first login
5. Redirects to profile setup if `is_first_login = true`
6. Validates student ID format: `XX-XXXXX-X`

### 2. Profile Management
- **First Login**: Must complete profile (name, gender, phone, blood group, program, department)
- **Name Edit Limit**: Users can edit name max 3 times (`name_edit_count`)
- **Locked Fields**: Gender, program, department CANNOT be changed after initial setup
- **Session Tracking**: `last_login` timestamp updated on each login

### 3. Tournament System
- **Admin Actions**: Create/edit/delete tournaments and games
- **Game Categories**: Male, Female, Mix
- **Game Types**:
  - **Solo**: Individual registration
  - **Duo**: 2-person teams
  - **Custom**: Variable team size (configured per game)
- **Registration Deadline**: Enforced server-side
- **Payment Status**: PENDING/PAID/FAILED tracking

### 4. Team Registration Flow
1. User opens game card for Duo/Custom game
2. Creates team with unique team name
3. System auto-adds user as LEADER
4. Leader adds team members by student ID
5. Invited members receive notifications
6. Members accept/reject team invitations
7. Cart holds registrations until checkout

### 5. Cart System
- Holds both individual and team registrations
- UNIQUE constraint: one item per (user_id, tournament_game_id)
- Item types: `INDIVIDUAL_REGISTRATION`, `TEAM_REGISTRATION`
- Users can cancel registrations from cart

### 6. Notification System
- Types: INFO, WARNING, SUCCESS, TEAM_REQUEST
- Statuses: UNREAD, READ, ARCHIVED
- Related to teams, games, tournaments via `related_id` and `related_type`

---

## 🚀 Development Setup

### Prerequisites
- Node.js v16+
- npm
- Supabase account
- Microsoft Azure AD app (OAuth)

### Environment Variables (`.env`)
```env
# Server
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://qvtpcwlgdwcwzqaaycog.supabase.co
SUPABASE_ANON_KEY=[redacted]
SUPABASE_SERVICE_ROLE_KEY=[redacted]

# Auth
JWT_SECRET=[secret]
SESSION_TIMEOUT=3600000

# Azure AD
AZURE_TENANT_ID=[tenant_id]
AZURE_CLIENT_ID=[client_id]
AZURE_CLIENT_SECRET=[secret]
AZURE_REDIRECT_URI=http://localhost:3001/callback

# CORS
CORS_ORIGIN=http://localhost:3001

# Email Validation
ALLOWED_EMAIL_DOMAIN=@student.aiub.edu,aiub.edu
```

### Running the Project

**Backend**:
```bash
cd backend
npm install
npm start  # Runs on http://localhost:3000
```

**Frontend**:
```bash
cd frontend
npx http-server -p 3001  # Runs on http://localhost:3001
```

**Health Check**:
```bash
curl http://localhost:3000/api/health
```

---

## 🐛 Known Issues & Fixes

### Recent Bug Fixes (from conversation history)

#### 1. ✅ FIXED: Cancel Registration Button Disappearing
**Problem**: After editing tournament details in admin panel, the "Cancel Registration" button would disappear for already-registered users.

**Root Cause**: Tournament edits caused game IDs to change, breaking the registration state tracking.

**Solution**: Implemented proper state management to preserve registrations across tournament updates.

**Files Modified**: 
- `frontend/registration.html`
- Admin dashboard game editing logic

---

#### 2. ✅ FIXED: Cart Integration Issues
**Problem**: Cart functionality wasn't properly integrated with registration/cancellation flow.

**Root Cause**: Separate development of cart and registration systems caused sync issues.

**Solution**: 
- Unified cart operations with registration state
- Ensured cart updates on register/cancel actions
- Added proper cart state validation

**Files Modified**:
- `backend/controllers/cartController.js`
- `frontend/registration.html`

---

#### 3. ✅ FIXED: Team Name Validation Missing
**Problem**: Team modal didn't validate team name in real-time.

**Root Cause**: Inline validation only implemented for student ID search, not team name.

**Solution**: 
- Added real-time team name uniqueness validation
- Disabled submit button until valid unique name entered
- Added visual feedback for invalid/duplicate names

**Files Modified**:
- `frontend/registration.html` (team modal logic)

---

#### 4. ✅ FIXED: Modal State Persistence
**Problem**: After canceling team creation, modal would reopen with stale data.

**Root Cause**: Modal state not properly reset on cancel/close.

**Solution**:
- Reset all modal fields on cancel
- Clear team member slots
- Reset validation states
- Prevent stale data from showing

**Files Modified**:
- `frontend/registration.html` (modal reset logic)

---

#### 5. ✅ FIXED: Game ID Stability on Tournament Edit
**Problem**: Editing tournament games caused existing game IDs to shift, breaking registrations.

**Root Cause**: Admin panel re-created games instead of updating them.

**Solution**:
- Implemented proper UPDATE logic for existing games
- Only DELETE removed games
- Only INSERT new games
- Preserve game IDs for unchanged games

**Files Modified**:
- `backend/routes/admin.js` (tournament update endpoint)

---

### Current Known Issues

#### ⚠️ Issue 1: Debug Logs Still Present
**Status**: Minor - Non-blocking  
**Description**: Console.log statements still present throughout codebase from debugging sessions.

**Impact**: Low - Only affects console output, no functional impact.

**TODO**: Clean up debug logs before production deployment.

**Files**: 
- Most frontend HTML files
- Some backend controllers

---

#### ⚠️ Issue 2: QWEN.md Outdated
**Status**: Documentation  
**Description**: `QWEN.md` still references Oracle database, but project migrated to Supabase.

**Impact**: None - Only confuses new developers.

**TODO**: Update or remove QWEN.md file.

---

#### ⚠️ Issue 3: RLS Policies Too Permissive
**Status**: Security - Important for Production  
**Description**: All Supabase RLS policies set to `FOR ALL USING (true)` (allow everything).

**Impact**: Development is fine, but MUST be restricted before production.

**TODO**: 
- Implement user-scoped RLS policies
- Admin-only policies for admin tables
- User can only see their own data

**Files**: `backend/supabase-schema.sql`

---

## 🎓 Lessons Learned (Mistakes & Solutions)

> 📝 **Document mistakes here so future agents don't repeat them**

### Lesson 1: Always Preserve Game IDs on Tournament Edit
**Mistake**: Early implementation recreated all games when editing tournaments  
**Result**: Game IDs changed, breaking existing registrations  
**Solution**: Update existing games, only INSERT new ones, only DELETE removed ones  
**Prevention**: Check if game has an `id` field before deciding INSERT vs UPDATE  

### Lesson 2: Never Skip Modal State Reset
**Mistake**: Didn't clear modal fields on cancel/close  
**Result**: Reopening modal showed stale data from previous interaction  
**Solution**: Always reset all fields, validation states, and error messages on close  
**Prevention**: Create a dedicated `resetModal()` function called on every close event  

### Lesson 3: Cart Must Sync with Registration State
**Mistake**: Developed cart and registration systems separately  
**Result**: Cart could show outdated registration status  
**Solution**: Update cart immediately on register/cancel actions  
**Prevention**: Treat cart as source of truth, not just UI convenience  

### Lesson 4: Inline Validation Improves UX Significantly
**Mistake**: Only validated on form submit  
**Result**: Users didn't know if their input was valid until clicking submit  
**Solution**: Add real-time validation with visual feedback (✅/❌ icons)  
**Prevention**: Add inline validation for critical fields (emails, IDs, unique names)  

**💡 Add new lessons here as you discover them!**

---

## 📝 Recent Development Sessions

### Session: 2026-02-06 to 2026-02-08 (Conversation ID: 8ed7ac26...)
**Focus**: Fixing Registration Bugs  
**Agent**: Multiple (account switched mid-session)  
**Status**: ✅ Completed

**Work Done**:
- Fixed cancel registration button visibility
- Integrated cart with registration flow
- Added team name inline validation
- Fixed modal state reset issues
- Stabilized game IDs on tournament edits
- Improved UI/UX for registration flow

**Files Modified**:
- `frontend/registration.html` (major changes)
- `backend/controllers/cartController.js`
- `backend/routes/admin.js`

---

### Session: 2026-02-04 to 2026-02-05 (Conversation ID: c0263b16...)
**Focus**: Fixing Registration Bugs  
**Status**: ✅ Completed

**Work Done**:
- Initial cart functionality implementation
- Registration workflow improvements
- Tournament edit stability fixes

---

## 🎯 Common Development Tasks

### Adding a New Game Type
1. Update `tournament_games` table if needed
2. Modify admin dashboard game creation form
3. Update registration flow in `frontend/registration.html`
4. Test Solo/Duo/Custom logic

### Modifying Profile Fields
1. Update `backend/supabase-schema.sql` (add migration)
2. Update `authController.js` validation logic
3. Update `profile-setup.html` form
4. Test locked fields enforcement

### Adding Admin Features
1. Add controller method in `backend/controllers/`
2. Add route in `backend/routes/admin.js`
3. Update `frontend/admin-dashboard.html` or modular version
4. Test with admin account

---

## 🧪 Testing Checklist

### User Flow Testing
- [ ] Login with AIUB email
- [ ] Complete profile setup (first login)
- [ ] View active tournaments
- [ ] Register for Solo game
- [ ] Create team for Duo game
- [ ] Join team via notification
- [ ] Add item to cart
- [ ] Cancel registration
- [ ] Edit profile (test name edit limit)

### Admin Flow Testing
- [ ] Login as admin
- [ ] Create tournament
- [ ] Upload tournament photo
- [ ] Add games (Solo/Duo/Custom)
- [ ] Edit tournament
- [ ] Verify game IDs remain stable
- [ ] View registrations
- [ ] Manage users

### Edge Cases
- [ ] Attempt to edit locked profile fields
- [ ] Try to register after deadline
- [ ] Create duplicate team name
- [ ] Exceed name edit limit (3)
- [ ] Register for same game twice
- [ ] Join team when already registered individually

---

## 📚 Important Code Patterns

### API Request Pattern (Frontend)
```javascript
const response = await fetch('http://localhost:3000/api/endpoint', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-user-email': sessionStorage.getItem('userEmail')
    },
    body: JSON.stringify({ data })
});
```

### Supabase Query Pattern (Backend)
```javascript
const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .eq('column', value)
    .single();

if (error) throw error;
```

### Error Handling Pattern
```javascript
try {
    // Operation
} catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
}
```

---

## 🔒 Security Considerations

1. **Email Validation**: STRICT enforcement of AIUB email domains
2. **Student ID Format**: Must match `XX-XXXXX-X` pattern
3. **JWT Tokens**: Used for session management
4. **Service Role Key**: NEVER expose to frontend (backend only)
5. **CORS**: Restricted to localhost during development
6. **File Uploads**: Limited to images, stored in `backend/uploads/`
7. **RLS Policies**: Must be tightened before production

---

## 🚨 Critical Warnings

### ⚠️ DO NOT
1. **DO NOT** commit `.env` file to git (it's gitignored)
2. **DO NOT** expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
3. **DO NOT** remove UNIQUE constraints on (user_id, game_id)
4. **DO NOT** change student ID format validation
5. **DO NOT** disable name edit limit enforcement
6. **DO NOT** deploy with permissive RLS policies

### ⚠️ ALWAYS
1. **ALWAYS** test registration flow after tournament edits
2. **ALWAYS** validate email domain server-side
3. **ALWAYS** check deadline before allowing registration
4. **ALWAYS** preserve game IDs when editing tournaments
5. **ALWAYS** reset modal state on close/cancel
6. **ALWAYS** validate team name uniqueness

---

## 📖 Key File Reference

### Backend Controllers (in order of complexity)
1. `teamController.js` (51KB) - Most complex, handles team creation, invites, members
2. `authController.js` (24KB) - Authentication, profile setup, validation
3. `registrationController.js` (11KB) - Game registration logic
4. `requestController.js` (9KB) - Team join requests
5. `cartController.js` (9KB) - Cart operations
6. `userController.js` (3KB) - User profile operations
7. `notificationController.js` (2KB) - Notification CRUD
8. `tournamentController.js` (2KB) - Tournament queries

### Frontend Pages (in order of size)
1. `admin-dashboard.html` (166KB) - MASSIVE monolithic admin panel
2. `registration.html` (89KB) - Main registration interface **← MOST IMPORTANT**
3. `dashboard.html` (74KB) - Student dashboard
4. `admin-dashboard-modular.html` (22KB) - Cleaner admin version
5. `profile-setup.html` (19KB) - First-time profile form
6. `callback.html` (8KB) - OAuth handler
7. `login.html` (7KB) - Login page
8. `admin-debug.html` (7KB) - Debug utilities

---

## 💡 Tips for Future Agents

### When Starting a Session
1. **READ THIS FILE FIRST** - You're doing it right! 👍
2. Check `backend/.env` exists and has correct values
3. Verify both servers are running (backend:3000, frontend:3001)
4. Check Supabase project status (should be ACTIVE_HEALTHY)

### When Debugging
1. Check browser console for frontend errors
2. Check backend terminal for API errors
3. Verify network tab for failed requests
4. Check Supabase dashboard for database errors
5. Look at `admin-debug.html` for debug utilities

### When Making Changes
1. Test registration flow after ANY tournament/game changes
2. Verify cart state updates correctly
3. Check modal behavior (open/close/reset)
4. Test with different game types (Solo/Duo/Custom)
5. Verify deadline enforcement
6. Check notification generation

### Common Mistakes to Avoid
1. **Don't recreate games on tournament edit** - Update existing ones!
2. **Don't skip modal state reset** - Stale data causes bugs
3. **Don't forget cart sync** - Register/cancel should update cart
4. **Don't hardcode URLs** - Use `api-config.js`
5. **Don't trust IDs across sessions** - Game IDs must be stable

---

## 📞 Project Contacts

**Developer**: mrxvaau  
**GitHub**: https://github.com/mrxvaau/AIUB-SPORTS-PORTAL  
**University**: American International University-Bangladesh (AIUB)

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-02-08 | Created PROJECT_MEMORY.md, project stable |
| 1.5 | 2025-XX-XX | Migrated from Oracle to Supabase |
| 1.0 | 2025-XX-XX | Initial release with Oracle |

---

## 🎓 Learning Resources

### Supabase Docs
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Functions](https://supabase.com/docs/guides/database/functions)

### Microsoft OAuth
- [Azure AD OAuth Flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

### Express.js
- [Express Routing](https://expressjs.com/en/guide/routing.html)
- [Express Middleware](https://expressjs.com/en/guide/using-middleware.html)

---

**Last Updated**: 2026-02-08 @ 11:44 GMT+6  
**Next Review**: Start of every new session (read the "Recent Updates Log")  

**Remember**: This is a LIVING DOCUMENT - Read it, Update it, Read it again! 🔁 Future you (or another agent) will thank you! 🙏

---

## 🔗 Related Files

- **Memory Update Workflow**: `.agent/workflows/memory-update.md` - How to maintain this file
- **Task Checklist**: See conversation artifacts for current work tracking
- **Database Schema**: `backend/supabase-schema.sql` - Source of truth for schema
- **Setup Guide**: `README.md` - How to run the project
