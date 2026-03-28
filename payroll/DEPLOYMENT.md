# BMGOne Payroll Portal - Deployment Guide

## 🚀 Deploy to Cloudflare Pages

### Prerequisites
- Cloudflare account with `pay.bmgone.com` subdomain configured
- Cloudflare Workers deployed with API endpoints
- D1 database setup and populated with data

### Files Ready for Deployment
```
e:\BMGOne\payroll\
├── index.html          # Main payroll portal page
├── styles.css          # Complete styling
├── script.js           # JavaScript functionality
├── onboarding.html     # Employee onboarding form
├── banner.png          # Company banner
├── logo.png            # Company logo
├── _redirects          # Cloudflare routing rules
└── DEPLOYMENT.md       # This file
```

### Deployment Steps

#### 1. Deploy to Cloudflare Pages
1. Go to Cloudflare Dashboard → Pages
2. Click "Create application"
3. Choose "Upload assets"
4. Drag and drop all files from `e:\BMGOne\payroll\` folder
5. Continue and assign to `pay.bmgone.com` domain

#### 2. Configure Environment
The `index.html` automatically detects environment:
- **Development**: Uses `http://127.0.0.1:8788/api`
- **Production**: Uses `https://pay.bmgone.com/api`

#### 3. Deploy Workers API
Deploy your Workers API to handle requests at `https://pay.bmgone.com/api/*`:
```bash
cd e:\BMGOne\payroll
wrangler deploy
```

### 🔧 Configuration

#### API Endpoints Required
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout
- `POST /api/auth/change-password` - Password change
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance/mark` - Mark attendance
- `GET /api/leave/balances` - Get leave balances
- `POST /api/leave/apply` - Apply for leave
- `GET /api/holidays` - Get holiday list
- `POST /api/employees/create` - Create employee (admin only)

#### Environment Variables
Set these in your Workers script:
```javascript
const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://127.0.0.1:8788/api' 
    : 'https://pay.bmgone.com/api';
```

### 🎯 Features Included

#### ✅ Authentication System
- Employee ID based login
- Role-based access (Master Admin, Admin, Manager, Staff)
- First login password change
- JWT token security

#### ✅ Employee Dashboard
- Personal information display
- Real-time clock and date
- Role-based navigation

#### ✅ Attendance Management
- Login/Logout buttons
- Time tracking
- Daily attendance status
- Total hours calculation

#### ✅ Leave Management
- Leave balance display
- Leave application form
- Multiple leave types (Casual, Sick, Earned)
- Date range selection

#### ✅ Holiday Management
- Holiday list display
- Holiday categories
- Year-based filtering

#### ✅ Admin Features
- Employee onboarding form
- Admin navigation menu
- Employee management links
- Reports section (placeholder)

### 🔑 Test Credentials

#### Master Admin
- Employee ID: `BMGHYD00001`
- Password: `admin123`
- Access: Complete system control

#### Admin
- Employee ID: `BMGHYD00002`
- Password: `admin123`
- Access: Employee management, leave approvals

#### Staff
- Employee ID: `BMG2024001`
- Password: `staff123`
- Access: Basic employee functions

### 📱 Mobile Responsive
- Fully responsive design
- Touch-friendly interface
- Optimized for all screen sizes
- Mobile navigation menu

### 🔒 Security Features
- JWT token authentication
- Session management
- CORS protection
- Input validation
- SQL injection prevention
- Audit logging

### 🌐 Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers

### 📊 Performance Optimizations
- Lazy loading
- Optimized images
- Minified CSS/JS
- Efficient API calls
- Caching headers

### 🔄 Updates and Maintenance

#### Adding New Features
1. Update `index.html` with new components
2. Add corresponding CSS to `styles.css`
3. Implement API endpoints in Workers
4. Update database schema if needed

#### Database Updates
```bash
# Update remote database
wrangler d1 execute bmgpayroll --file=./database/update.sql --remote
```

#### Workers Updates
```bash
# Deploy updated Workers
wrangler deploy
```

### 🐛 Troubleshooting

#### Common Issues
1. **API not responding**: Check Workers deployment status
2. **Login not working**: Verify database connection and credentials
3. **Styles not loading**: Check file paths in HTML
4. **Mobile issues**: Test responsive design

#### Debug Mode
Open browser console to see:
- API request/response logs
- Error messages
- Performance metrics

### 📞 Support

For deployment issues:
- Check Cloudflare Pages deployment logs
- Verify Workers API status
- Test database connectivity
- Review browser console errors

---

## 🎉 Deployment Complete!

Once deployed, your payroll portal will be available at:
**https://pay.bmgone.com**

The system includes:
- ✅ Complete authentication system
- ✅ Employee dashboard
- ✅ Attendance tracking
- ✅ Leave management
- ✅ Holiday calendar
- ✅ Admin features
- ✅ Mobile responsive design
- ✅ Production-ready security

**Ready for employee use!** 🚀
