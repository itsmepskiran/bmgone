# BMGOne Payroll Portal - Deployment Guide

## 🎯 **Solution: Separate Payroll Subdomain**

You're absolutely right! The main BMGOne website should remain as-is, and the payroll portal should be deployed separately to `pay.bmgone.com`.

## 📁 **Deployment Structure**

### **Main Website (Existing):**
- **Domain**: `bmgone.com`
- **Repository**: `itsmepskiran/bmgone`
- **Content**: Static HTML pages
- **Status**: ✅ Already deployed

### **Payroll Portal (New):**
- **Domain**: `pay.bmgone.com`
- **Repository**: `itsmepskiran/bmgone-payroll` (recommended separate repo)
- **Content**: Employee management system
- **Status**: 🚀 Ready for deployment

## 🚀 **Deployment Options**

### **Option 1: Separate Repository (Recommended)**
Create a new GitHub repository specifically for the payroll system:

1. **Create New Repo:**
   - Go to GitHub → Create new repository
   - Name: `bmgone-payroll`
   - Description: BMGOne Payroll Portal - Employee Management System

2. **Push Payroll Files:**
   ```bash
   cd e:\BMGOne\payroll-deploy
   git init
   git add .
   git commit -m "Initial payroll portal deployment"
   git branch -M main
   git remote add origin https://github.com/itsmepskiran/bmgone-payroll.git
   git push -u origin main
   ```

3. **Deploy to Cloudflare Pages:**
   - Cloudflare Dashboard → Pages → Create application
   - Connect to `bmgone-payroll` repository
   - Build command: `npm run build`
   - Output directory: `/`
   - Custom domain: `pay.bmgone.com`

### **Option 2: Same Repository, Different Branch**
If you prefer to keep everything in one repository:

1. **Create New Branch:**
   ```bash
   cd e:\BMGOne
   git checkout -b payroll-portal
   git add payroll-deploy/
   git commit -m "Add payroll portal files"
   git push origin payroll-portal
   ```

2. **Deploy Specific Branch:**
   - Cloudflare Pages → Create application
   - Connect to `bmgone` repository
   - Select branch: `payroll-portal`
   - Build command: `npm run build`
   - Output directory: `payroll-deploy/`
   - Custom domain: `pay.bmgone.com`

## 📋 **Files Ready for Deployment**

```
e:\BMGOne\payroll-deploy\
├── index.html          # Main payroll portal
├── styles.css          # Complete styling
├── script.js           # JavaScript functionality
├── onboarding.html     # Employee onboarding form
├── banner.png          # Company banner
├── logo.png            # Company logo
├── _redirects          # Cloudflare routing rules
├── package.json        # Project configuration
├── build.js            # Build verification script
└── README.md           # This file
```

## 🔧 **Configuration Details**

### **Build Settings:**
- **Build Command**: `npm run build`
- **Build Output Directory**: `/` (root)
- **Node Version**: 16.0.0 or higher

### **Environment Variables:**
No environment variables needed - it's a static site!

### **Custom Domain:**
- **Domain**: `pay.bmgone.com`
- **DNS**: Configure CNAME record to point to Cloudflare Pages

## 🎯 **Features Included**

### **🔐 Authentication System**
- Employee ID based login
- Role-based access (Master Admin, Admin, Manager, Staff)
- First login password change
- JWT token security

### **👤 Employee Dashboard**
- Personal information display
- Real-time clock and date
- Role-based navigation

### **⏰ Attendance Management**
- Login/Logout buttons
- Time tracking
- Daily attendance status
- Total hours calculation

### **📝 Leave Management**
- Leave balance display
- Leave application form
- Multiple leave types (Casual, Sick, Earned)
- Date range selection

### **🎉 Holiday Management**
- Holiday list display
- Holiday categories
- Year-based filtering

### **👨‍💼 Admin Features**
- Employee onboarding form
- Admin navigation menu
- Employee management links
- Reports section (placeholder)

## 🔑 **Test Credentials**

| Role | Employee ID | Password | Access Level |
|------|-------------|----------|--------------|
| Master Admin | BMGHYD00001 | admin123 | Complete system control |
| Admin | BMGHYD00002 | admin123 | Employee management, leave approvals |
| Staff | BMG2024001 | staff123 | Basic employee functions |
| Staff | BMG2024002 | staff123 | Basic employee functions |
| Manager | BMG2024003 | jane123 | Team management |

## 🌐 **API Integration**

The payroll portal expects API endpoints at:
- **Development**: `http://127.0.0.1:8788/api`
- **Production**: `https://pay.bmgone.com/api`

### **Required API Endpoints:**
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout
- `POST /api/auth/change-password` - Password change
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance/mark` - Mark attendance
- `GET /api/leave/balances` - Get leave balances
- `POST /api/leave/apply` - Apply for leave
- `GET /api/holidays` - Get holiday list
- `POST /api/employees/create` - Create employee (admin only)

## 📱 **Mobile Responsive**
- Fully responsive design
- Touch-friendly interface
- Optimized for all screen sizes
- Mobile navigation menu

## 🔒 **Security Features**
- JWT token authentication
- Session management
- CORS protection
- Input validation
- SQL injection prevention
- Audit logging

## 🚀 **Deployment Steps**

### **Step 1: Choose Your Approach**
- Option 1: Create separate repository (recommended)
- Option 2: Use same repository with different branch

### **Step 2: Push Files**
Push the `payroll-deploy/` folder to your chosen repository

### **Step 3: Deploy to Cloudflare Pages**
1. Go to Cloudflare Dashboard → Pages
2. Create application → Connect to repository
3. Configure build settings
4. Assign custom domain `pay.bmgone.com`

### **Step 4: Deploy Workers API**
Deploy your Workers API to handle backend requests:
```bash
cd e:\BMGOne\payroll
wrangler deploy
```

### **Step 5: Test the Portal**
- Open: `https://pay.bmgone.com`
- Test login with credentials above
- Verify all features work

## 🎉 **Result**

You'll have:
- ✅ **Main Website**: `bmgone.com` (unchanged)
- ✅ **Payroll Portal**: `pay.bmgone.com` (new)
- ✅ **Complete separation** of concerns
- ✅ **Professional subdomain** for payroll activities

**Your payroll system will be completely separate from your main website!** 🚀
