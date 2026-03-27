# BMGOne Payroll System - Technical Implementation Guide

## 🚀 Tech Stack Overview

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Cloudflare Workers (Serverless)
- **Database**: Cloudflare D1 (SQLite-based, serverless)
- **Authentication**: JWT tokens with session management
- **File Storage**: Cloudflare R2 (for document uploads)
- **Deployment**: Cloudflare Pages + Workers

## 📋 Prerequisites

1. **Cloudflare Account** with Workers and D1 enabled
2. **Node.js** (v18 or higher) for local development
3. **Wrangler CLI** (`npm install -g wrangler`)
4. **Git** for version control

## 🛠️ Setup Instructions

### 1. Initialize Cloudflare D1 Database

```bash
# Create production database
wrangler d1 create bmgone-payroll-db

# Create development database
wrangler d1 create bmgone-payroll-db-dev
```

**Update `wrangler.toml`** with your database IDs:
```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "bmgone-payroll-db"
database_id = "YOUR_PROD_DB_ID"

[[env.development.d1_databases]]
binding = "DB"
database_name = "bmgone-payroll-db-dev"
database_id = "YOUR_DEV_DB_ID"
```

### 2. Run Database Migrations

```bash
# Development database
npm run d1:migrate:dev

# Production database
npm run d1:migrate
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Update `wrangler.toml` with your secrets:
```toml
[vars]
JWT_SECRET = "your-super-secret-jwt-key-change-in-production"
CORS_ORIGIN = "https://your-domain.com"
API_VERSION = "v1"
```

### 5. Local Development

```bash
# Start development server
npm run dev

# In another terminal, monitor logs
npm run tail
```

## 🗄️ Database Schema

The system uses the following tables:

- **`employees`** - Employee information and credentials
- **`leave_balances`** - Leave balance tracking per employee
- **`attendance`** - Daily attendance records
- **`leave_applications`** - Leave requests and approvals
- **`holidays`** - Company holiday lists
- **`sessions`** - JWT session management
- **`audit_log`** - Audit trail for all actions

## 🔐 Authentication Flow

1. **Login**: Employee sends email/password to `/api/auth/login`
2. **Verification**: Server validates credentials against `employees` table
3. **Token Creation**: JWT token generated and session stored in `sessions` table
4. **API Calls**: All subsequent requests include `Authorization: Bearer <token>` header
5. **Session Validation**: Middleware verifies token and session existence
6. **Logout**: Session removed from database

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Employee login
- `POST /api/auth/logout` - Employee logout

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance/mark` - Mark login/logout

### Leave Management
- `GET /api/leave/balances` - Get leave balances
- `POST /api/leave/apply` - Apply for leave
- `GET /api/leave/applications` - Get pending applications (managers)
- `PUT /api/leave/:id/approve` - Approve/reject leave (managers)

### Holidays
- `GET /api/holidays` - Get holiday list

### Profile
- `GET /api/profile` - Get employee profile

## 🔧 Frontend Integration

Update your `payroll.html` to use the API:

```javascript
// API base URL
const API_BASE = 'https://your-worker.your-subdomain.workers.dev/api';

// Example: Login
async function login(email, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('employee', JSON.stringify(data.employee));
    }
    return data;
}

// Example: Mark attendance
async function markAttendance(type) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/attendance/mark`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type })
    });
    return await response.json();
}
```

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
# Deploy Workers
npm run deploy:prod

# Deploy frontend to Cloudflare Pages
# Upload your HTML/CSS/JS files to Cloudflare Pages
```

## 🔒 Security Considerations

1. **JWT Secret**: Use a strong, unique secret in production
2. **Password Hashing**: Use bcrypt for password storage
3. **CORS**: Configure proper origins in production
4. **Input Validation**: Validate all inputs on both client and server
5. **SQL Injection**: Use parameterized queries (already implemented)
6. **Session Management**: Sessions expire after 24 hours
7. **Audit Logging**: All actions are logged for compliance

## 📊 Monitoring

```bash
# View real-time logs
npm run tail

# Check database
wrangler d1 execute bmgone-payroll-db --command="SELECT COUNT(*) FROM employees"
```

## 🔄 Backup and Recovery

```bash
# Export database
npm run d1:backup

# Import to new database
wrangler d1 execute new-db --file=./backup.sql
```

## 🧪 Testing

Test endpoints using curl:

```bash
# Test login
curl -X POST https://your-worker.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@bmgone.com","password":"password"}'

# Test protected endpoint
curl -X GET https://your-worker.workers.dev/api/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📝 Next Steps

1. **Add Email Notifications** for leave approvals
2. **Implement File Upload** for leave documents
3. **Add Reporting Dashboard** for management
4. **Create Mobile App** using the same API
5. **Add Biometric Integration** for attendance
6. **Implement Payroll Calculations** and salary slips

## 🆘 Troubleshooting

### Common Issues

1. **CORS Errors**: Check `CORS_ORIGIN` in wrangler.toml
2. **Database Connection**: Verify D1 binding and database ID
3. **JWT Errors**: Ensure JWT_SECRET is set and consistent
4. **Permission Denied**: Check employee role in database

### Debug Commands

```bash
# Check database schema
wrangler d1 execute bmgone-payroll-db --command=".schema"

# View recent logs
wrangler tail --format=json

# Test locally
wrangler dev --local --port 8787
```

## 📞 Support

For issues with:
- **Cloudflare Workers**: Check Cloudflare documentation
- **D1 Database**: Review D1 limits and pricing
- **API Integration**: Check network requests in browser dev tools

---

**Ready to go! Your BMGOne Payroll System is now fully functional with Cloudflare D1 backend.**
