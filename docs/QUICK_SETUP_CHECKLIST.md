# ⚡ Quick Production Setup Checklist

**For: AIUB Sports Portal v2.0.0**  
**Use this for fast reference during deployment**

---

## 🔑 Step 1: Generate Secrets (5 minutes)

```bash
# Run these commands and save outputs
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('CSRF_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

**Save these values!** ✏️

---

## 🗄️ Step 2: Supabase Setup (15 minutes)

1. [ ] Create production project at [supabase.com](https://supabase.com)
2. [ ] Choose region: **Asia Southeast (Singapore)**
3. [ ] Get credentials from Settings → API:
    - [ ] `SUPABASE_URL`
    - [ ] `SUPABASE_ANON_KEY`
    - [ ] `SUPABASE_SERVICE_ROLE_KEY`

4. [ ] Run SQL scripts in SQL Editor:
    - [ ] `database/supabase-schema.sql`
    - [ ] `database/supabase-rls-policies.sql`

5. [ ] Verify RLS enabled:
    ```sql
    SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
    ```
    All should show `true`

6. [ ] Create first admin:
    ```sql
    INSERT INTO admins (admin_id, email, full_name, status)
    VALUES ('admin-001', 'admin@aiub.edu', 'System Admin', 'ACTIVE');
    
    INSERT INTO admin_role_map (admin_id, role_id)
    VALUES (
        (SELECT id FROM admins WHERE email = 'admin@aiub.edu'),
        (SELECT id FROM admin_roles WHERE role_name = 'SUPER_ADMIN')
    );
    ```

---

## 🔐 Step 3: Azure AD Setup (10 minutes)

1. [ ] Go to [Azure Portal](https://portal.azure.com)
2. [ ] Azure Active Directory → App Registrations
3. [ ] Update Redirect URIs:
    - [ ] `https://your-domain.com/callback`
4. [ ] Get credentials:
    - [ ] `AZURE_TENANT_ID`
    - [ ] `AZURE_CLIENT_ID`
    - [ ] `AZURE_CLIENT_SECRET`

---

## 📝 Step 4: Create .env File (5 minutes)

Create `backend/.env.production`:

```ini
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# JWT (USE GENERATED SECRETS)
JWT_SECRET=xxx
JWT_EXPIRATION=1h
REFRESH_TOKEN_EXPIRATION=7d

# Session
SESSION_SECRET=xxx
SESSION_TIMEOUT=3600000

# CORS
CORS_ORIGIN=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Azure AD
AZURE_TENANT_ID=xxx
AZURE_CLIENT_ID=xxx
AZURE_CLIENT_SECRET=xxx
AZURE_REDIRECT_URI=https://your-domain.com/callback

# App
APP_NAME=AIUB Sports Portal
APP_VERSION=2.0.0
ALLOWED_EMAIL_DOMAIN=@student.aiub.edu

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CSRF_SECRET=xxx

# Files
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp

# Logging
LOG_LEVEL=error
```

---

## 🚀 Step 5: Deploy Backend (15 minutes)

### Option A: Railway (Recommended)

```bash
npm install -g @railway/cli
railway login
cd backend
railway init
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-secret
# ... set all variables
railway up
```

### Option B: Heroku

```bash
npm install -g heroku
heroku login
cd backend
heroku create aiub-sports-portal-api
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret
# ... set all variables
git push heroku main
```

### Option C: AWS EC2

```bash
# SSH into EC2
ssh -i key.pem ubuntu@ec2-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone repo-url
cd AIUB-SPORTS-PORTAL/backend
npm install --production

# Create .env
nano .env
# Paste environment variables

# Install PM2 and start
sudo npm install -g pm2
pm2 start server.js --name aiub-sports-portal
pm2 save
pm2 startup
```

---

## 🎨 Step 6: Deploy Frontend (10 minutes)

### Update API Config

Edit `frontend/api-config.js`:
```javascript
const API_CONFIG = {
    API_BASE_URL: 'https://api.your-domain.com/api'
};
```

### Deploy to Vercel

```bash
npm install -g vercel
vercel login
cd frontend
vercel --prod
```

### Deploy to Netlify

```bash
npm install -g netlify-cli
netlify login
cd frontend
netlify deploy --prod
```

---

## ✅ Step 7: Verification (10 minutes)

### Health Check
```bash
curl https://api.your-domain.com/api/health
```

### Security Tests
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] CORS restricted (only your domain allowed)
- [ ] JWT auth working (try without token → 401)
- [ ] Admin routes protected (try without admin role → 403)
- [ ] Rate limiting works (make 15 rapid requests)

### Functional Tests
- [ ] Microsoft OAuth login works
- [ ] User registration works
- [ ] Profile setup works
- [ ] Admin can create tournaments
- [ ] Users can register for games

---

## 🔧 Required Code Changes

### 1. Update `backend/server.js` - Add Security Middleware

After `require('dotenv').config();`:

```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for now, enable after testing
    hsts: { maxAge: 31536000, includeSubDomains: true },
    noSniff: true,
    xssFilter: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// Force HTTPS
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
        return res.redirect(['https://', req.get('Host'), req.url].join(''));
    }
    next();
});
```

### 2. Update `backend/server.js` - CORS

Replace existing CORS config with:

```javascript
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Email']
}));
```

### 3. Install Missing Packages

```bash
cd backend
npm install helmet express-rate-limit file-type
```

---

## 📊 Post-Deployment Monitoring

### Setup Uptime Monitoring

1. [ ] Create account at [UptimeRobot](https://uptimerobot.com)
2. [ ] Add monitor: `https://api.your-domain.com/api/health`
3. [ ] Set check interval: 5 minutes
4. [ ] Add email alerts

### Setup Error Tracking

1. [ ] Create account at [Sentry](https://sentry.io)
2. [ ] Create project
3. [ ] Install: `npm install @sentry/node`
4. [ ] Add to `server.js`:
    ```javascript
    const Sentry = require('@sentry/node');
    Sentry.init({
        dsn: 'your-sentry-dsn',
        environment: 'production'
    });
    ```

---

## 🆘 Troubleshooting

### Issue: CORS errors
**Fix:** Check `ALLOWED_ORIGINS` in .env matches your frontend domain exactly

### Issue: JWT authentication fails
**Fix:** Verify `JWT_SECRET` is set and same across all deployments

### Issue: Database connection fails
**Fix:** Check `SUPABASE_URL` and keys are correct

### Issue: OAuth callback fails
**Fix:** Verify `AZURE_REDIRECT_URI` matches exactly (including https)

### Issue: RLS policies blocking requests
**Fix:** Backend should use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)

---

## 📞 Emergency Rollback

If something goes wrong:

1. **Stop all traffic:**
   - Put up maintenance page
   - Or revert DNS to previous version

2. **Restore database:**
   - Go to Supabase → Settings → Database
   - Use point-in-time recovery

3. **Rollback code:**
   ```bash
   git revert HEAD
   git push
   ```

4. **Rotate secrets:**
   - Change all secrets in .env
   - Update environment variables
   - Restart application

---

## ⏱️ Estimated Total Time: 70 minutes

| Step | Time |
|------|------|
| Generate Secrets | 5 min |
| Supabase Setup | 15 min |
| Azure AD Setup | 10 min |
| Create .env | 5 min |
| Deploy Backend | 15 min |
| Deploy Frontend | 10 min |
| Verification | 10 min |
| **Total** | **70 min** |

---

**✅ When all checkboxes are complete, you're production ready!**
