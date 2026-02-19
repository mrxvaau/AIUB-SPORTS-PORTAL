# 🚀 AIUB Sports Portal - Production Setup Guide

**Version:** 2.0.0  
**Last Updated:** February 19, 2026  
**Status:** Production Deployment Checklist

---

## ⚠️ CRITICAL: DO NOT DEPLOY WITHOUT COMPLETING THESE STEPS

This application has been audited and scored **3.5/10** for production readiness. The following steps are **MANDATORY** before deploying to production.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Security Hardening](#security-hardening)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 1. Prerequisites

### Required Accounts & Services

- [ ] **Supabase Account** - Production project (not free tier for production)
- [ ] **Microsoft Azure Account** - For Azure AD OAuth
- [ ] **Domain Name** - For production URL (e.g., `sports.aiub.edu`)
- [ ] **SSL Certificate** - Via hosting provider or Let's Encrypt
- [ ] **Node.js Hosting** - Heroku, Railway, Render, AWS, or similar
- [ ] **Static Hosting** - Vercel, Netlify, or Cloudflare Pages (for frontend)

### Required Software Versions

- Node.js: **v18.x or higher** (LTS recommended)
- npm: **v9.x or higher**
- PostgreSQL: **Supabase managed** (handled automatically)

---

## 2. Environment Setup

### Step 2.1: Generate Secure Secrets

**Generate JWT Secret:**
```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

**Generate Session Secret:**
```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

**Save these outputs** - you'll need them in Step 2.2.

### Step 2.2: Create Production .env File

Create a file named `.env.production` in the `backend/` directory:

```bash
# ============================================
# SERVER CONFIGURATION
# ============================================
NODE_ENV=production
PORT=3000

# ============================================
# SUPABASE CONFIGURATION (PRODUCTION)
# ============================================
SUPABASE_URL=https://your-production-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-from-supabase-dashboard
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-supabase-dashboard

# ============================================
# JWT CONFIGURATION (CRITICAL - USE GENERATED SECRETS)
# ============================================
JWT_SECRET=paste-your-generated-jwt-secret-here
JWT_EXPIRATION=1h
REFRESH_TOKEN_EXPIRATION=7d

# ============================================
# SESSION CONFIGURATION
# ============================================
SESSION_SECRET=paste-your-generated-session-secret-here
SESSION_TIMEOUT=3600000

# ============================================
# CORS CONFIGURATION (PRODUCTION - RESTRICT ORIGINS)
# ============================================
CORS_ORIGIN=https://your-production-domain.com
ALLOWED_ORIGINS=https://your-production-domain.com,https://www.your-production-domain.com

# ============================================
# MICROSOFT AZURE AD OAUTH CONFIGURATION
# ============================================
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_REDIRECT_URI=https://your-production-domain.com/callback

# ============================================
# APPLICATION CONFIGURATION
# ============================================
APP_NAME=AIUB Sports Portal
APP_VERSION=2.0.0
ALLOWED_EMAIL_DOMAIN=@student.aiub.edu

# ============================================
# SECURITY CONFIGURATION
# ============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CSRF_SECRET=paste-your-generated-csrf-secret-here

# ============================================
# FILE UPLOAD CONFIGURATION
# ============================================
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp

# ============================================
# LOGGING CONFIGURATION
# ============================================
LOG_LEVEL=error
```

### Step 2.3: Secure Your .env File

**NEVER commit `.env` files to Git!**

Verify `.gitignore` includes:
```
.env
.env.production
.env.local
*.env
```

**For team deployments:**
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Or share via secure channel (not email/chat)

---

## 3. Database Configuration

### Step 3.1: Create Production Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Select **Production Plan** (not free tier)
4. Choose a region close to your users (e.g., Asia Southeast for Bangladesh)
5. Set a strong database password
6. Wait for provisioning (5-10 minutes)

### Step 3.2: Run Database Schema

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the following files **in order**:

**First:** `database/supabase-schema.sql`
```sql
-- This creates all tables and basic structure
```

**Second:** `database/supabase-rls-policies.sql`
```sql
-- This enables Row Level Security (CRITICAL FOR PRODUCTION)
```

### Step 3.3: Verify RLS is Enabled

Run this query in Supabase SQL Editor:
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**Expected:** All tables should show `rowsecurity = true`

### Step 3.4: Create Initial Admin User

Run this SQL to create your first admin:

```sql
-- Step 1: Create admin entry
INSERT INTO admins (admin_id, email, full_name, status)
VALUES ('admin-001', 'admin@aiub.edu', 'System Administrator', 'ACTIVE');

-- Step 2: Get the admin ID
-- Note: Replace 1 with the actual ID returned from above insert

-- Step 3: Assign SUPER_ADMIN role
INSERT INTO admin_role_map (admin_id, role_id)
VALUES (
    (SELECT id FROM admins WHERE email = 'admin@aiub.edu'),
    (SELECT id FROM admin_roles WHERE role_name = 'SUPER_ADMIN')
);
```

### Step 3.5: Configure Database Backups

1. Go to **Settings** → **Database**
2. Enable **Point-in-time Recovery**
3. Set backup retention to **30 days minimum**
4. Configure backup schedule (daily recommended)

---

## 4. Security Hardening

### Step 4.1: Update Microsoft Azure AD Configuration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App Registrations**
3. Select your application
4. Update **Redirect URIs**:
   - Add: `https://your-production-domain.com/callback`
   - Remove: `http://localhost:3001/callback` (for production)
5. Under **Authentication**:
   - Enable **Access tokens**
   - Enable **ID tokens**
   - Set **Supported account types** to "Single tenant"

### Step 4.2: Configure CORS for Production

Edit `backend/server.js`:

```javascript
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Email'],
    optionsSuccessStatus: 200
}));
```

### Step 4.3: Add Rate Limiting

Install if not already installed:
```bash
npm install express-rate-limit
```

Add to `backend/server.js`:
```javascript
const rateLimit = require('express-rate-limit');

// General rate limiter
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later.'
});

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 login attempts per window
    message: 'Too many login attempts, please try again later.'
});

// Apply general limiter to all routes
app.use(generalLimiter);

// Apply auth limiter to auth routes
app.use('/api/auth', authLimiter);
app.use('/api/msauth', authLimiter);
```

### Step 4.4: Add Security Headers (Helmet)

Install if not already installed:
```bash
npm install helmet
```

Add to `backend/server.js`:
```javascript
const helmet = require('helmet');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://*.supabase.co'],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

### Step 4.5: Secure File Uploads

Update `backend/routes/admin.js` multer configuration:

```javascript
const multer = require('multer');
const FileType = require('file-type');
const fs = require('fs');

// Validate file by magic numbers, not just extension
async function validateFile(file) {
    const buffer = fs.readFileSync(file.path);
    const fileType = await FileType.fromBuffer(buffer);
    
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
    ];
    
    if (!fileType || !allowedMimeTypes.includes(fileType.mime)) {
        throw new Error('Invalid file type');
    }
    
    return true;
}

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files allowed'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});
```

Install file-type:
```bash
npm install file-type
```

### Step 4.6: Enable HTTPS Enforcement

In `backend/server.js`, add:
```javascript
// Force HTTPS in production
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
        return res.redirect(['https://', req.get('Host'), req.url].join(''));
    }
    next();
});
```

---

## 5. Backend Deployment

### Option A: Deploy to Railway

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Initialize Project:**
   ```bash
   cd backend
   railway init
   ```

4. **Add Environment Variables:**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set JWT_SECRET=your-secret
   # ... add all .env variables
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

### Option B: Deploy to Heroku

1. **Install Heroku CLI:**
   ```bash
   npm install -g heroku
   ```

2. **Login:**
   ```bash
   heroku login
   ```

3. **Create App:**
   ```bash
   cd backend
   heroku create aiub-sports-portal-api
   ```

4. **Set Environment Variables:**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=your-secret
   # ... add all .env variables
   ```

5. **Deploy:**
   ```bash
   git push heroku main
   ```

### Option C: Deploy to AWS (EC2)

1. **Launch EC2 Instance:**
   - AMI: Ubuntu 22.04 LTS
   - Instance Type: t3.small (minimum)
   - Security Group: Allow ports 22 (SSH), 3000 (HTTP)

2. **Connect via SSH:**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

3. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Clone Repository:**
   ```bash
   git clone https://github.com/your-org/AIUB-SPORTS-PORTAL.git
   cd AIUB-SPORTS-PORTAL/backend
   ```

5. **Install Dependencies:**
   ```bash
   npm install --production
   ```

6. **Create .env File:**
   ```bash
   nano .env
   # Paste your environment variables
   ```

7. **Install PM2 (Process Manager):**
   ```bash
   sudo npm install -g pm2
   ```

8. **Start Application:**
   ```bash
   pm2 start server.js --name aiub-sports-portal
   pm2 save
   pm2 startup
   ```

9. **Setup Nginx Reverse Proxy:**
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/aiub-sports-portal
   ```

   Add this configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/aiub-sports-portal /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

## 6. Frontend Deployment

### Step 6.1: Update API Configuration

Edit `frontend/api-config.js`:

```javascript
// Production Configuration
const API_CONFIG = {
    API_BASE_URL: 'https://api.your-production-domain.com/api',
    
    ENDPOINTS: {
        // ... existing endpoints
    }
};
```

### Step 6.2: Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   cd frontend
   vercel --prod
   ```

4. **Configure Domain:**
   - Go to your Vercel dashboard
   - Add your custom domain
   - Update DNS records as instructed

### Step 6.3: Alternative - Deploy to Netlify

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login:**
   ```bash
   netlify login
   ```

3. **Deploy:**
   ```bash
   cd frontend
   netlify deploy --prod
   ```

4. **Configure Domain:**
   - Go to Netlify dashboard
   - Add custom domain
   - Update DNS records

---

## 7. Post-Deployment Verification

### Step 7.1: Health Check

Test your backend health endpoint:
```bash
curl https://api.your-domain.com/api/health
```

**Expected Response:**
```json
{
    "status": "OK",
    "message": "AIUB Sports Portal API is running",
    "version": "1.0",
    "timestamp": "2026-02-19T..."
}
```

### Step 7.2: Security Checklist

- [ ] **HTTPS is enforced** - HTTP redirects to HTTPS
- [ ] **CORS is configured** - Only your domain is allowed
- [ ] **RLS is enabled** - Run verification query from Step 3.3
- [ ] **JWT authentication works** - Test login and token validation
- [ ] **Admin routes are protected** - Try accessing without token
- [ ] **Rate limiting works** - Make 15 rapid requests
- [ ] **Security headers present** - Use [securityheaders.com](https://securityheaders.com)
- [ ] **No debug endpoints** - Verify /debug/* routes return 404

### Step 7.3: Functional Testing

1. **User Registration:**
   - [ ] Microsoft OAuth login works
   - [ ] Email validation works
   - [ ] User is created in database
   - [ ] JWT tokens are received

2. **Profile Management:**
   - [ ] Profile setup works
   - [ ] Field locking works (gender, program, department)
   - [ ] Name edit limit enforced (3 edits max)

3. **Tournament System:**
   - [ ] Admin can create tournaments
   - [ ] Users can view active tournaments
   - [ ] Registration deadline enforcement works
   - [ ] Team creation works

4. **Admin Dashboard:**
   - [ ] Admin authentication works
   - [ ] Admin can manage tournaments
   - [ ] Admin can view registrations
   - [ ] Non-admins cannot access admin routes

### Step 7.4: Performance Testing

Run basic load test:
```bash
npm install -g autocannon
autocannon -c 10 -d 30 https://api.your-domain.com/api/health
```

**Expected:** Should handle 100+ requests/second

---

## 8. Monitoring & Maintenance

### Step 8.1: Setup Application Monitoring

**Option A: Sentry (Error Tracking)**

1. Create account at [https://sentry.io](https://sentry.io)
2. Install:
   ```bash
   npm install @sentry/node
   ```
3. Add to `backend/server.js`:
   ```javascript
   const Sentry = require('@sentry/node');
   
   Sentry.init({
       dsn: process.env.SENTRY_DSN,
       environment: process.env.NODE_ENV,
       tracesSampleRate: 0.1
   });
   ```

**Option B: PM2 Monitoring (if using PM2)**

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Step 8.2: Setup Database Monitoring

In Supabase Dashboard:
1. Go to **Settings** → **Database**
2. Enable **Query Performance Insights**
3. Set up **Slow Query Logging** (queries > 1000ms)

### Step 8.3: Backup Strategy

**Daily Backups:**
- Supabase automatic backups (enabled in Step 3.5)
- Verify backup integrity weekly

**Weekly Tasks:**
- [ ] Review error logs
- [ ] Check database size
- [ ] Review slow queries
- [ ] Update dependencies (security patches)

**Monthly Tasks:**
- [ ] Security audit (run `npm audit`)
- [ ] Review user feedback
- [ ] Performance optimization
- [ ] Test backup restoration

### Step 8.4: Incident Response Plan

**If Security Breach Detected:**

1. **Immediate:**
   - Rotate all secrets (JWT_SECRET, SUPABASE keys, Azure credentials)
   - Enable maintenance mode
   - Review access logs

2. **Within 24 Hours:**
   - Identify breach source
   - Patch vulnerability
   - Notify affected users if data compromised

3. **Post-Incident:**
   - Document incident
   - Update security procedures
   - Conduct security audit

---

## 📞 Support & Resources

### Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)

### Emergency Contacts
- **Technical Lead:** [Your contact]
- **Database Admin:** [Contact]
- **Security Team:** [Contact]

---

## ✅ Pre-Launch Checklist

Before going live, verify ALL items are checked:

### Infrastructure
- [ ] Production Supabase project created
- [ ] RLS policies enabled
- [ ] Database backups configured
- [ ] Domain name purchased
- [ ] SSL certificate installed
- [ ] Backend deployed
- [ ] Frontend deployed

### Security
- [ ] JWT_SECRET generated and set
- [ ] All .env variables configured
- [ ] CORS restricted to production domain
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] HTTPS enforced
- [ ] Debug endpoints removed
- [ ] Admin authentication working

### Testing
- [ ] All functional tests passed
- [ ] Security tests passed
- [ ] Load tests completed
- [ ] Mobile responsiveness tested
- [ ] Cross-browser testing done

### Documentation
- [ ] Admin user guide created
- [ ] API documentation updated
- [ ] Incident response plan documented
- [ ] Team trained on deployment process

---

## 🎯 Launch Day

1. **Final Verification (1 hour before launch):**
   - Run all health checks
   - Verify database connection
   - Test OAuth flow
   - Confirm monitoring is active

2. **DNS Switch:**
   - Update DNS records to point to production
   - Wait for propagation (up to 24 hours)
   - Verify SSL certificate is valid

3. **Post-Launch Monitoring:**
   - Monitor error rates
   - Watch database performance
   - Track user registrations
   - Be ready to rollback if needed

---

**Good luck with your production deployment! 🚀**

*If you encounter any issues during setup, refer to the troubleshooting section or contact the technical team.*
