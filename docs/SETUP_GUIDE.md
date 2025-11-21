# Complete Setup Guide - AIUB Sports Portal v1.0

## Prerequisites
- Node.js (v14+)
- Oracle Database 10g
- Git

## Step-by-Step Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd aiub-sports-portal
```

### 2. Setup Database
```bash
sqlplus system/password@localhost:1521/XE
@database/schema.sql
```

### 3. Setup Backend
```bash
cd backend
npm install
# Edit .env with your Oracle credentials
npm start
```

### 4. Setup Frontend
```bash
cd frontend
npx http-server -p 8080
```

### 5. Access Application
http://localhost:8080/login.html

## Test Credentials
Email format: XX-XXXXX-X@student.aiub.edu
Example: 24-56434-1@student.aiub.edu
