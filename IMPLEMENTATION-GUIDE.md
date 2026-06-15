# IMPLEMENTATION GUIDE: Health Plan Comparison Backend Integration

## QUICK SUMMARY
This implementation moves the hardcoded comparison data to a backend database and adds:
1. Staff-only access with role-based authorization
2. Provider selection feature (select which brands to compare)
3. Login/logout attendance reporting for payroll
4. Comparison history tracking

---

## STEP 1: Database Setup

### 1a. Create comparison tables
```bash
# Run in your Cloudflare D1 database or SQLite:
cat /Users/skreenit/bmgone/bmgone/payroll/database/comparison-schema.sql | sqlite3 your_database.db
```

This creates 7 tables:
- `comparison_brands` (5 brands)
- `comparison_sections` (6 tiers)
- `comparison_features` (47 features)
- `comparison_values` (235 brand-feature combinations)
- `staff_comparison_preferences` (user preferences)
- `comparison_reports` (audit trail)

### 1b. Verify data loaded
```sql
SELECT COUNT(*) as brand_count FROM comparison_brands;
-- Should return: 5

SELECT COUNT(*) as feature_count FROM comparison_features;
-- Should return: 47

SELECT COUNT(*) as value_count FROM comparison_values;
-- Should return: 235
```

---

## STEP 2: API Endpoints Integration

### 2a. Add endpoints to `/payroll/workers/src/index.js`

Copy the content from `comparison-api.js` into the main `index.js` file.

**Key endpoints added:**
```
GET  /api/comparison/data              - Fetch all comparison data
POST /api/comparison/data-filtered     - Fetch filtered by brand selection
POST /api/comparison/save-preferences  - Save user's brand preferences
POST /api/comparison/save-report       - Save comparison report for audit
GET  /api/reports/attendance-login     - Get login/logout records (Admin only)
GET  /api/reports/attendance-login/csv - Download CSV report (Admin only)
GET  /api/reports/login-logout-audit   - Get audit log of login/logout events
```

### 2b. Role-based access
- **Staff**: Can access comparison tool, save preferences, generate reports
- **Manager**: Same as staff + view their team's reports
- **Admin**: View all reports, download attendance CSV
- **Master Admin**: Full access to all reports and audit logs

---

## STEP 3: Update compare.html

### 3a. Replace authentication guard
```javascript
// Enhanced staff-only guard
(function() {
  var token = localStorage.getItem('token');
  var emp = localStorage.getItem('employee');
  var role = localStorage.getItem('role');
  
  if (!token || !emp || !role) {
    window.location.replace('https://pay.bmgone.com');
  }
  
  // Only staff and above can access
  if (!['staff', 'manager', 'admin', 'master_admin'].includes(role)) {
    window.location.replace('https://pay.bmgone.com');
  }
})();
```

### 3b. Add provider selection UI
Insert this before the comparison table:

```html
<!-- Provider Selection Panel -->
<div class="panel panel-qf" id="provider-selection">
  <div class="panel-label">📊 Select Providers to Compare</div>
  <div id="provider-checkboxes" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
    <!-- Will be populated by JavaScript -->
  </div>
  <div style="margin-top:12px;text-align:center;">
    <button class="btn btn-blue" onclick="updateComparison()">Update Comparison</button>
    <span id="selected-count" style="color:#90CAF9;margin-left:20px;font-size:13px;">Providers selected: 0</span>
  </div>
</div>
```

### 3c. JavaScript changes

**1. Fetch data from API instead of hardcoded arrays:**
```javascript
// OLD: const brands = [{id:"ab",...}, ...];
// NEW:
let brands = [];
let SECTIONS = [];

async function loadComparisonData() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('https://your-api.workers.dev/api/comparison/data', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    brands = data.brands;
    SECTIONS = data.sections;
    
    renderProviderSelection();
    renderTableHead();
    renderTableBody();
  } catch (error) {
    console.error('Failed to load comparison data:', error);
    alert('Failed to load comparison data. Please try again.');
  }
}

window.onload = function() {
  loadComparisonData();
  // Rest of initialization
};
```

**2. Add provider selection logic:**
```javascript
let selectedBrands = JSON.parse(localStorage.getItem('selectedBrands')) || 
                     ['ab', 'ic', 'star']; // Default 3 brands

function renderProviderSelection() {
  const container = document.getElementById('provider-checkboxes');
  container.innerHTML = '';
  
  brands.forEach(brand => {
    const checkbox = document.createElement('div');
    checkbox.style.display = 'flex';
    checkbox.style.alignItems = 'center';
    checkbox.style.gap = '8px';
    checkbox.style.padding = '8px';
    checkbox.style.backgroundColor = 'rgba(255,255,255,.05)';
    checkbox.style.borderRadius = '8px';
    checkbox.innerHTML = `
      <input type="checkbox" id="brand-${brand.brand_id}" 
             ${selectedBrands.includes(brand.brand_id) ? 'checked' : ''}
             onchange="toggleBrand('${brand.brand_id}')">
      <label for="brand-${brand.brand_id}" style="cursor:pointer;flex:1;">
        ${brand.brand_name}
      </label>
    `;
    container.appendChild(checkbox);
  });
  
  updateSelectedCount();
}

function toggleBrand(brandId) {
  const index = selectedBrands.indexOf(brandId);
  if (index > -1) {
    selectedBrands.splice(index, 1);
  } else {
    selectedBrands.push(brandId);
  }
  updateSelectedCount();
}

function updateSelectedCount() {
  document.getElementById('selected-count').textContent = 
    `Providers selected: ${selectedBrands.length}`;
}

async function updateComparison() {
  if (selectedBrands.length === 0) {
    alert('Please select at least one provider');
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('https://your-api.workers.dev/api/comparison/data-filtered', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ selectedBrandIds: selectedBrands })
    });
    
    const data = await response.json();
    brands = data.brands;
    
    // Save preferences
    localStorage.setItem('selectedBrands', JSON.stringify(selectedBrands));
    
    // Save to backend
    await fetch('https://your-api.workers.dev/api/comparison/save-preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ selectedBrandIds: selectedBrands })
    });
    
    renderTableHead();
    renderTableBody();
    renderWinner();
    
  } catch (error) {
    console.error('Failed to update comparison:', error);
    alert('Failed to update comparison. Please try again.');
  }
}
```

---

## STEP 4: Fix Login/Logout Reporting

### 4a. Verify attendance recording
The backend already records login/logout in the `attendance` table. To verify:

```sql
SELECT * FROM attendance WHERE employee_id = 'BMGHYD12345' ORDER BY date DESC;
```

### 4b. Create Admin Dashboard Report
Add this to the payroll dashboard for admins:

```html
<!-- For Admin/Master Admin Only -->
<div class="dashboard-card" id="attendance-report" style="display:none;">
  <div class="card-header">
    <h2 class="card-title">📊 Attendance Report</h2>
  </div>
  <div class="card-body">
    <div style="display:flex;gap:10px;margin-bottom:10px;">
      <input type="date" id="fromDate" placeholder="From Date">
      <input type="date" id="toDate" placeholder="To Date">
      <button class="btn btn-blue" onclick="downloadAttendanceReport()">Download CSV</button>
    </div>
    <div id="attendance-data" style="max-height:400px;overflow-y:auto;"></div>
  </div>
</div>

<script>
// Show attendance report for admin
if (['admin', 'master_admin'].includes(localStorage.getItem('role'))) {
  document.getElementById('attendance-report').style.display = 'block';
}

async function downloadAttendanceReport() {
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;
  
  if (!fromDate || !toDate) {
    alert('Please select both dates');
    return;
  }
  
  const token = localStorage.getItem('token');
  const response = await fetch(
    `https://your-api.workers.dev/api/reports/attendance-login/csv?fromDate=${fromDate}&toDate=${toDate}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
}
</script>
```

---

## STEP 5: Deployment Checklist

- [ ] 1. Database: Run `comparison-schema.sql`
- [ ] 2. API: Add comparison endpoints to `index.js`
- [ ] 3. API: Verify endpoint deployment to Cloudflare Workers
- [ ] 4. Frontend: Update `compare.html` with new auth & provider selection
- [ ] 5. Frontend: Update API URLs (replace `https://your-api.workers.dev/`)
- [ ] 6. Dashboard: Add attendance report card for admins
- [ ] 7. Test: Login as staff → Access compare.html → Select providers
- [ ] 8. Test: Login as admin → Download attendance report
- [ ] 9. Delete old `BMG_Health_Compare.html`

---

## STEP 6: Testing

### Test 1: Staff Access
1. Login as staff member
2. Navigate to Dashboard → Click "Compare Plans"
3. Verify page loads with provider selection
4. Select 3 providers → Click "Update Comparison"
5. Verify table updates with only selected providers

### Test 2: Admin Report
1. Login as admin/master_admin
2. Go to Dashboard → Find "Attendance Report"
3. Select date range
4. Click "Download CSV"
5. Verify file downloads with login/logout data

### Test 3: Non-Staff Access
1. Login as customer (not staff)
2. Try to access `/insurance/compare.html` directly
3. Verify redirected to payroll login page

---

## FILE LOCATIONS

```
/payroll/database/comparison-schema.sql      ← Database schema
/payroll/workers/src/comparison-api.js       ← New API endpoints
/payroll/workers/src/index.js                ← Main API (add above endpoints)
/insurance/compare.html                      ← Updated frontend
/payroll/index.html                          ← Add attendance report card
```

---

## TROUBLESHOOTING

### Q: "This feature is available to staff only" error
**A:** Check that `role` is stored in localStorage during login

### Q: Comparison data not loading
**A:** 
1. Verify API endpoint is deployed
2. Check browser console for CORS errors
3. Ensure token is valid
4. Check database has data: `SELECT COUNT(*) FROM comparison_brands;`

### Q: Attendance report shows no data
**A:**
1. Verify login times were recorded: `SELECT * FROM attendance WHERE date = ?`
2. Check audit_log: `SELECT * FROM audit_log WHERE action = 'login'`
3. Verify date filters in query

---

## NEXT STEPS

1. **Optional: Dynamic questionnaire management**
   - Add admin panel to edit questions/values
   - Version control for comparison data

2. **Optional: Email reports**
   - Send comparison reports via email
   - Automated report generation

3. **Optional: Analytics**
   - Track which providers are most compared
   - Track comparison trends over time

---

**Created:** June 15, 2026
**Database:** SQLite (Cloudflare D1)
**API:** Cloudflare Workers
**Frontend:** Static HTML/JavaScript
