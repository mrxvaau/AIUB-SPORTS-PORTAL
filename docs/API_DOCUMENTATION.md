# API Documentation

## Base URL
`http://localhost:3000/api`

## Endpoints

### POST /auth/login
Login or register user

**Request:**
```json
{
  "email": "24-56434-1@student.aiub.edu"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User logged in",
  "isNewUser": false,
  "user": { ... }
}
```

### GET /auth/profile/:studentId
Get user profile

### PUT /auth/profile/:studentId
Update user profile

**Request:**
```json
{
  "fullName": "John Doe",
  "gender": "Male",
  "isFirstTime": false
}
```

### GET /auth/name-edit-count/:studentId
Get remaining name edits
