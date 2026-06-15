// Comparison Tool API Endpoints + Login Report Fix
// These endpoints should be added to the main index.js file in the payroll/workers/src/

// ═══════════════════════════════════════════════════════════════════════════
// COMPARISON TOOL ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Get all comparison data (brands, sections, features, values)
router.get('/api/comparison/data', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Check if user is staff
        if (user.role !== 'staff' && user.role !== 'manager' && user.role !== 'admin' && user.role !== 'master_admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'This feature is available to staff only' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const brands = await env.DB.prepare(`
            SELECT brand_id, brand_name, plan_name, premium_default, color_dark, color_light, color_mid, gradient, sort_order
            FROM comparison_brands
            WHERE is_active = 1
            ORDER BY sort_order ASC
        `).all();
        
        const sections = await env.DB.prepare(`
            SELECT section_id, tier_number, section_label, section_color, sort_order
            FROM comparison_sections
            WHERE is_active = 1
            ORDER BY sort_order ASC
        `).all();
        
        const features = await env.DB.prepare(`
            SELECT feature_id, section_id, feature_label, sort_order
            FROM comparison_features
            WHERE is_active = 1
            ORDER BY section_id, sort_order ASC
        `).all();
        
        const values = await env.DB.prepare(`
            SELECT feature_id, brand_id, value_type, notes
            FROM comparison_values
            ORDER BY feature_id, brand_id
        `).all();
        
        // Get user's preferences
        const preferences = await env.DB.prepare(`
            SELECT selected_brand_ids
            FROM staff_comparison_preferences
            WHERE employee_id = ?
        `).bind(user.employeeId).first();
        
        return withCors(new Response(
            JSON.stringify({
                success: true,
                brands: brands.results || [],
                sections: sections.results || [],
                features: features.results || [],
                values: values.results || [],
                userPreferences: preferences ? JSON.parse(preferences.selected_brand_ids) : null
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get comparison data error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Get only specific brands
router.post('/api/comparison/data-filtered', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        if (user.role !== 'staff' && user.role !== 'manager' && user.role !== 'admin' && user.role !== 'master_admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'This feature is available to staff only' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { selectedBrandIds } = await request.json(); // Array like ['ab', 'ic', 'star']
        
        if (!selectedBrandIds || !Array.isArray(selectedBrandIds) || selectedBrandIds.length === 0) {
            return withCors(new Response(
                JSON.stringify({ error: 'selectedBrandIds array is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const placeholders = selectedBrandIds.map(() => '?').join(',');
        
        const brands = await env.DB.prepare(`
            SELECT brand_id, brand_name, plan_name, premium_default, color_dark, color_light, color_mid, gradient, sort_order
            FROM comparison_brands
            WHERE is_active = 1 AND brand_id IN (${placeholders})
            ORDER BY sort_order ASC
        `).bind(...selectedBrandIds).all();
        
        const sections = await env.DB.prepare(`
            SELECT section_id, tier_number, section_label, section_color, sort_order
            FROM comparison_sections
            WHERE is_active = 1
            ORDER BY sort_order ASC
        `).all();
        
        const features = await env.DB.prepare(`
            SELECT feature_id, section_id, feature_label, sort_order
            FROM comparison_features
            WHERE is_active = 1
            ORDER BY section_id, sort_order ASC
        `).all();
        
        const values = await env.DB.prepare(`
            SELECT feature_id, brand_id, value_type, notes
            FROM comparison_values
            WHERE brand_id IN (${placeholders})
            ORDER BY feature_id, brand_id
        `).bind(...selectedBrandIds).all();
        
        return withCors(new Response(
            JSON.stringify({
                success: true,
                brands: brands.results || [],
                sections: sections.results || [],
                features: features.results || [],
                values: values.results || [],
                selectedCount: selectedBrandIds.length
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get filtered comparison data error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Save staff brand preferences
router.post('/api/comparison/save-preferences', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { selectedBrandIds } = await request.json();
        
        if (!selectedBrandIds || !Array.isArray(selectedBrandIds)) {
            return withCors(new Response(
                JSON.stringify({ error: 'selectedBrandIds array is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const selectedBrandIdsJson = JSON.stringify(selectedBrandIds);
        
        await env.DB.prepare(`
            INSERT INTO staff_comparison_preferences (employee_id, selected_brand_ids)
            VALUES (?, ?)
            ON CONFLICT(employee_id) DO UPDATE SET 
                selected_brand_ids = ?,
                updated_at = datetime('now')
        `).bind(user.employeeId, selectedBrandIdsJson, selectedBrandIdsJson).run();
        
        return withCors(new Response(
            JSON.stringify({
                success: true,
                message: 'Preferences saved successfully',
                selectedBrands: selectedBrandIds
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Save preferences error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Save comparison report
router.post('/api/comparison/save-report', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { clientName, clientAge, membersCount, selectedBrands, reportData } = await request.json();
        
        await env.DB.prepare(`
            INSERT INTO comparison_reports (employee_id, client_name, client_age, members_count, selected_brands, report_data)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            user.employeeId,
            clientName || null,
            clientAge || null,
            membersCount || null,
            JSON.stringify(selectedBrands),
            JSON.stringify(reportData)
        ).run();
        
        return withCors(new Response(
            JSON.stringify({
                success: true,
                message: 'Report saved successfully'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Save report error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN/LOGOUT ATTENDANCE REPORT ENDPOINTS (FIX)
// ═══════════════════════════════════════════════════════════════════════════

// Get login/logout report (for Master/Admin)
router.get('/api/reports/attendance-login', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Only master_admin and admin can access
        if (user.role !== 'master_admin' && user.role !== 'admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'Only Master Admin or Admin can access this report' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { fromDate, toDate, employeeId } = request.url.split('?')[1] ? 
            Object.fromEntries(new URLSearchParams(request.url.split('?')[1]).entries()) : {};
        
        let query = `
            SELECT 
                a.id,
                a.employee_id,
                e.first_name,
                e.last_name,
                e.email,
                e.department,
                a.date,
                a.login_time,
                a.logout_time,
                a.total_hours,
                a.status,
                a.notes
            FROM attendance a
            JOIN employees e ON a.employee_id = e.employee_id
            WHERE 1=1
        `;
        let params = [];
        
        if (fromDate) {
            query += ` AND a.date >= ?`;
            params.push(fromDate);
        }
        
        if (toDate) {
            query += ` AND a.date <= ?`;
            params.push(toDate);
        }
        
        if (employeeId) {
            query += ` AND a.employee_id = ?`;
            params.push(employeeId);
        }
        
        query += ` ORDER BY a.date DESC, a.employee_id`;
        
        let stmt = env.DB.prepare(query);
        if (params.length > 0) {
            stmt = stmt.bind(...params);
        }
        
        const attendance = await stmt.all();
        
        return withCors(new Response(
            JSON.stringify({
                success: true,
                totalRecords: attendance.results.length,
                data: attendance.results || [],
                filters: { fromDate, toDate, employeeId }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get attendance report error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Download attendance report as CSV (for Master/Admin)
router.get('/api/reports/attendance-login/csv', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Only master_admin and admin can access
        if (user.role !== 'master_admin' && user.role !== 'admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'Only Master Admin or Admin can access this report' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { fromDate, toDate } = request.url.split('?')[1] ? 
            Object.fromEntries(new URLSearchParams(request.url.split('?')[1]).entries()) : {};
        
        let query = `
            SELECT 
                a.employee_id,
                e.first_name,
                e.last_name,
                e.email,
                e.department,
                a.date,
                a.login_time,
                a.logout_time,
                ROUND(a.total_hours, 2) as total_hours,
                a.status,
                a.notes
            FROM attendance a
            JOIN employees e ON a.employee_id = e.employee_id
            WHERE 1=1
        `;
        let params = [];
        
        if (fromDate) {
            query += ` AND a.date >= ?`;
            params.push(fromDate);
        }
        
        if (toDate) {
            query += ` AND a.date <= ?`;
            params.push(toDate);
        }
        
        query += ` ORDER BY a.date DESC, a.employee_id`;
        
        let stmt = env.DB.prepare(query);
        if (params.length > 0) {
            stmt = stmt.bind(...params);
        }
        
        const attendance = await stmt.all();
        
        // Convert to CSV
        let csv = 'Employee ID,First Name,Last Name,Email,Department,Date,Login Time,Logout Time,Total Hours,Status,Notes\n';
        
        attendance.results.forEach(row => {
            csv += `"${row.employee_id}","${row.first_name}","${row.last_name}","${row.email}","${row.department}","${row.date}","${row.login_time || ''}","${row.logout_time || ''}","${row.total_hours || ''}","${row.status}","${row.notes || ''}"\n`;
        });
        
        return new Response(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="attendance-report-${new Date().toISOString().split('T')[0]}.csv"`,
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (error) {
        console.error('Download attendance report error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Get audit log for login/logout events
router.get('/api/reports/login-logout-audit', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Only master_admin and admin can access
        if (user.role !== 'master_admin' && user.role !== 'admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'Only Master Admin or Admin can access this report' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { fromDate, toDate } = request.url.split('?')[1] ? 
            Object.fromEntries(new URLSearchParams(request.url.split('?')[1]).entries()) : {};
        
        let query = `
            SELECT 
                al.id,
                al.employee_id,
                e.first_name,
                e.last_name,
                al.action,
                al.created_at,
                al.ip_address,
                al.user_agent
            FROM audit_log al
            LEFT JOIN employees e ON al.employee_id = e.employee_id
            WHERE al.action IN ('login', 'logout', 'attendance_mark')
        `;
        let params = [];
        
        if (fromDate) {
            query += ` AND DATE(al.created_at) >= ?`;
            params.push(fromDate);
        }
        
        if (toDate) {
            query += ` AND DATE(al.created_at) <= ?`;
            params.push(toDate);
        }
        
        query += ` ORDER BY al.created_at DESC`;
        
        let stmt = env.DB.prepare(query);
        if (params.length > 0) {
            stmt = stmt.bind(...params);
        }
        
        const auditLog = await stmt.all();
        
        return withCors(new Response(
            JSON.stringify({
                success: true,
                totalRecords: auditLog.results.length,
                data: auditLog.results || []
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get audit log error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});
