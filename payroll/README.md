# BMGOne Payroll System

## 📁 Project Structure

```
payroll/
├── payroll.html              # Main payroll dashboard (frontend)
├── database/
│   └── database-schema.sql  # Database schema and sample data
├── workers/
│   └── src/
│       └── index.js         # Cloudflare Workers API backend
├── docs/
│   └── README-PAYROLL.md    # Detailed technical documentation
├── package.json              # Node.js dependencies and scripts
└── wrangler.toml            # Cloudflare Workers configuration
```

## 🚀 Quick Start

### 1. Navigate to Payroll Directory
```bash
cd payroll
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Cloudflare D1 Database
```bash
# Create databases
wrangler d1 create bmgone-payroll-db
wrangler d1 create bmgone-payroll-db-dev

# Update wrangler.toml with your database IDs
# Then run migrations
npm run d1:migrate:dev
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Access the Application
- **Frontend**: Open `../index.html` and click "Staff Login"
- **API**: Workers dev server will be running on `http://localhost:8787`

## 📋 Available Scripts

```bash
# Development
npm run dev              # Start Workers dev server
npm run tail             # Monitor real-time logs

# Database Operations
npm run d1:create        # Create D1 database
npm run d1:migrate       # Run production migrations
npm run d1:migrate:dev   # Run development migrations
npm run d1:backup        # Export database backup

# Deployment
npm run deploy           # Deploy to development
npm run deploy:prod      # Deploy to production
```

## 🔗 File References

### Frontend Files
- **Main Page**: `../index.html` (BMGOne homepage)
- **Payroll Dashboard**: `payroll.html` (staff portal)
- **Styles**: `../styles.css` (shared styles)
- **Scripts**: `../script.js` (shared JavaScript)
- **Assets**: `../logo.png`, `../banner.png` (shared assets)

### Backend Files
- **API Server**: `workers/src/index.js` (Cloudflare Workers)
- **Database Schema**: `database/database-schema.sql` (D1 database)
- **Configuration**: `wrangler.toml` (Workers config)

### Documentation
- **Technical Guide**: `docs/README-PAYROLL.md` (detailed setup)
- **Project Overview**: `README.md` (this file)

## 🌐 URL Structure

```
https://bmgone.com/
├── index.html                    # Main website
└── payroll/
    └── payroll.html              # Staff portal

API Endpoints (Cloudflare Workers):
├── POST /api/auth/login
├── POST /api/auth/logout
├── GET /api/attendance
├── POST /api/attendance/mark
├── GET /api/leave/balances
├── POST /api/leave/apply
├── GET /api/leave/applications
├── PUT /api/leave/:id/approve
├── GET /api/holidays
└── GET /api/profile
```

## 🔧 Configuration

### Environment Variables (wrangler.toml)
```toml
[vars]
JWT_SECRET = "your-super-secret-jwt-key"
CORS_ORIGIN = "https://bmgone.com"
API_VERSION = "v1"
```

### Database Bindings
Update `wrangler.toml` with your Cloudflare D1 database IDs:
```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "bmgone-payroll-db"
database_id = "YOUR_PROD_DB_ID"
```

## 📊 Database Schema

The system uses 7 main tables:
- `employees` - Staff information and credentials
- `attendance` - Daily login/logout records
- `leave_balances` - Annual leave allocation
- `leave_applications` - Leave requests and approvals
- `holidays` - Company holiday lists
- `sessions` - Authentication session management
- `audit_log` - Complete audit trail

## 🔐 Authentication Flow

1. **Login**: `POST /api/auth/login` with email/password
2. **Token**: JWT returned and stored in localStorage
3. **API Calls**: Include `Authorization: Bearer <token>` header
4. **Session**: Validated against database on each request
5. **Logout**: `POST /api/auth/logout` removes session

## 🎯 Features Included

### ✅ Attendance Management
- Daily login/logout marking
- Real-time clock display
- Hours calculation
- Attendance history

### ✅ Leave Management
- Leave balance display (Casual, Sick, Earned)
- Leave application form
- Manager approval workflow
- Leave history tracking

### ✅ Holiday Management
- Company holiday lists
- Categorized holidays (Gazetted, Restricted, Optional)
- Year-wise organization

### ✅ User Management
- Role-based access (Staff, Manager, Admin)
- Profile management
- Session-based authentication

## 🚀 Deployment

### Development
```bash
cd payroll
npm run dev
```

### Production
```bash
cd payroll
npm run deploy:prod
```

Then deploy the frontend files to Cloudflare Pages or your preferred hosting service.

## 📱 Mobile Responsiveness

The payroll dashboard is fully responsive and works on:
- Desktop browsers
- Tablets
- Mobile devices

## 🔒 Security Features

- JWT-based authentication
- Session management
- CORS protection
- SQL injection prevention
- Input validation
- Audit logging

## 📞 Support

For technical issues:
1. Check `docs/README-PAYROLL.md` for detailed troubleshooting
2. Verify Cloudflare Workers and D1 configuration
3. Check browser console for frontend errors
4. Monitor Workers logs with `npm run tail`

---

**Ready to use! Your BMGOne Payroll System is organized and ready for deployment.**
