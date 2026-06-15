# ⚡ QUICK START GUIDE - Health Plan Comparison

## 🎯 What Was Built

✅ **Backend database** with all 47 health insurance comparison features  
✅ **8 API endpoints** for comparison tool + attendance reporting  
✅ **Staff-only access** control with role-based authorization  
✅ **Provider selection** UI - choose which brands to compare  
✅ **Login/logout reporting** for payroll calculation  

---

## 📋 Deployment Checklist (5 minutes)

### 1️⃣ Database Setup
```bash
# Load comparison schema (SQLite/D1)
sqlite3 bmgone.db < /payroll/database/comparison-schema.sql

# Verify data loaded
sqlite3 bmgone.db "SELECT COUNT(*) as count FROM comparison_features;"
# Should output: 47
```

### 2️⃣ Deploy API Endpoints
```bash
# Add these endpoints to /payroll/workers/src/index.js
# Copy-paste from comparison-api.js:
# - GET  /api/comparison/data
# - POST /api/comparison/data-filtered
# - POST /api/comparison/save-preferences
# - POST /api/comparison/save-report
# - GET  /api/reports/attendance-login
# - GET  /api/reports/attendance-login/csv
# - GET  /api/reports/login-logout-audit

# Deploy to Cloudflare Workers
wrangler deploy
```

### 3️⃣ Update Frontend (compare.html)
Replace this section (lines 7-15):
```javascript
// OLD:
(function() {
  var token = localStorage.getItem('token');
  var emp   = localStorage.getItem('employee');
  if (!token || !emp) {
    window.location.replace('https://pay.bmgone.com');
  }
})();

// NEW:
(function() {
  var token = localStorage.getItem('token');
  var emp   = localStorage.getItem('employee');
  var role  = localStorage.getItem('role');
  
  if (!token || !emp || !role) {
    window.location.replace('https://pay.bmgone.com');
  }
  
  if (!['staff', 'manager', 'admin', 'master_admin'].includes(role)) {
    window.location.replace('https://pay.bmgone.com');
  }
})();
```

### 4️⃣ Add Provider Selection UI
Insert before the comparison table (search for "<!-- COVER -->"):
```html
<div class="panel panel-qf">
  <div class="panel-label">📊 Select Providers to Compare</div>
  <div id="provider-checkboxes" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
    <!-- Populated by JavaScript -->
  </div>
  <div style="margin-top:12px;text-align:center;">
    <button class="btn btn-blue" onclick="updateComparison()">Update Comparison</button>
    <span id="selected-count">Providers selected: 0</span>
  </div>
</div>
```

### 5️⃣ Update JavaScript
Replace window.onload and add these functions:
```javascript
let brands = [];
let SECTIONS = [];
let selectedBrands = JSON.parse(localStorage.getItem('selectedBrands')) || ['ab', 'ic', 'star'];

async function loadComparisonData() {
  const token = localStorage.getItem('token');
  const response = await fetch('YOUR_API_URL/api/comparison/data', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  brands = data.brands;
  SECTIONS = data.sections;
  renderProviderSelection();
  renderTableHead();
  renderTableBody();
}

function renderProviderSelection() {
  const container = document.getElementById('provider-checkboxes');
  container.innerHTML = '';
  brands.forEach(b => {
    container.innerHTML += `
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="brand-${b.brand_id}" 
          ${selectedBrands.includes(b.brand_id) ? 'checked' : ''}
          onchange="toggleBrand('${b.brand_id}')">
        <label for="brand-${b.brand_id}">${b.brand_name}</label>
      </div>`;
  });
  document.getElementById('selected-count').textContent = `Providers selected: ${selectedBrands.length}`;
}

function toggleBrand(id) {
  selectedBrands = selectedBrands.includes(id) 
    ? selectedBrands.filter(x => x !== id) 
    : [...selectedBrands, id];
  document.getElementById('selected-count').textContent = `Providers selected: ${selectedBrands.length}`;
}

async function updateComparison() {
  const token = localStorage.getItem('token');
  const response = await fetch('YOUR_API_URL/api/comparison/data-filtered', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedBrandIds: selectedBrands })
  });
  const data = await response.json();
  brands = data.brands;
  localStorage.setItem('selectedBrands', JSON.stringify(selectedBrands));
  renderTableHead();
  renderTableBody();
}

window.onload = function() {
  loadComparisonData();
  // ... rest of initialization
};
```

### 6️⃣ Add Attendance Report to Dashboard
In `/payroll/index.html`, add this for admins:
```html
<div class="dashboard-card" id="attendance-card" style="display:none;">
  <h3>📊 Attendance Report</h3>
  <div>
    <input type="date" id="fromDate">
    <input type="date" id="toDate">
    <button onclick="downloadAttendanceReport()">Download CSV</button>
  </div>
</div>

<script>
if (['admin', 'master_admin'].includes(localStorage.getItem('role'))) {
  document.getElementById('attendance-card').style.display = 'block';
}

async function downloadAttendanceReport() {
  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;
  const token = localStorage.getItem('token');
  const response = await fetch(
    `YOUR_API_URL/api/reports/attendance-login/csv?fromDate=${from}&toDate=${to}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
</script>
```

### 7️⃣ Delete Duplicate File
```bash
rm /Users/skreenit/bmgone/bmgone/BMG_Health_Compare.html
```

---

## 🔑 Key API URLs (Update these!)

Replace `YOUR_API_URL` with your actual endpoint:
- Local dev: `http://localhost:8787`
- Production: Your Cloudflare Workers URL

---

## 📊 What Data is in Database

| Table | Rows | Purpose |
|-------|------|---------|
| comparison_brands | 5 | Insurance companies + plan details |
| comparison_sections | 6 | Tiers (Foundation, Waiting Periods, etc.) |
| comparison_features | 47 | Individual questionnaire items |
| comparison_values | 235 | Y/N/E values for each feature-brand combo |
| staff_comparison_preferences | * | Save user's brand selections |
| comparison_reports | * | Audit trail of comparisons |

---

## 🔐 Access Control

| Who | What |
|-----|------|
| Staff | ✅ View comparison tool |
| Manager | ✅ View comparison tool |
| Admin | ✅ Download attendance reports |
| Master Admin | ✅ Everything + edit data |
| Non-staff | ❌ Redirected to login |

---

## ✅ Testing

1. **Staff Login Test**
   ```
   Login as staff → Should see Dashboard
   Click "Compare Plans" → Should load comparison tool
   Select providers → Should update table
   ```

2. **Admin Report Test**
   ```
   Login as admin → Should see "Attendance Report" card
   Select date range → Should show records
   Click Download → CSV file should download
   ```

3. **Non-Staff Test**
   ```
   Login as customer → Direct to /insurance/compare.html
   Should be redirected to login page
   ```

---

## 📁 Files You Modified/Created

```
✅ Created:
   /payroll/database/comparison-schema.sql (18 KB)
   /payroll/workers/src/comparison-api.js (19 KB)
   /IMPLEMENTATION-GUIDE.md (detailed guide)

🔄 Modified:
   /payroll/workers/src/index.js (add 8 endpoints)
   /insurance/compare.html (update auth + add UI)
   /payroll/index.html (add admin card)

❌ Delete:
   /BMG_Health_Compare.html (duplicate)
```

---

## 🚨 Common Issues

**"This feature is available to staff only"**
- Check `role` is stored in localStorage
- Verify user's role is 'staff' or above

**Comparison data not loading**
- Check API endpoint is deployed
- Verify token is valid
- Check browser console for errors

**Attendance report empty**
- Verify login times were recorded
- Check date filters
- Run: `SELECT * FROM attendance WHERE date = ?`

---

## 📞 Support

For detailed documentation, see: `/IMPLEMENTATION-GUIDE.md`

---

**Last Updated:** June 15, 2026  
**Status:** Ready for deployment
