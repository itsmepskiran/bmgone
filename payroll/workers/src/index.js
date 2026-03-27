// BMGOne Payroll API - Cloudflare Workers
import { Router } from 'itty-router';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Create router
const router = Router();

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle CORS preflight requests
router.options('*', () => new Response(null, { headers: corsHeaders }));

// Middleware to add CORS headers to all responses
const withCors = (response) => {
    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
};

// JWT Authentication middleware
const authenticate = async (request, env) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        
        // Verify session exists in database
        const session = await env.DB.prepare(
            'SELECT employee_id FROM sessions WHERE session_id = ? AND expires_at > datetime("now")'
        ).bind(decoded.sessionId).first();
        
        if (!session) {
            return null;
        }
        
        return decoded;
    } catch (error) {
        return null;
    }
};

// Helper function to create JWT token
const createToken = async (employeeId, env) => {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Store session in database
    await env.DB.prepare(
        'INSERT INTO sessions (session_id, employee_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, employeeId, expiresAt.toISOString()).run();
    
    const token = jwt.sign(
        { employeeId, sessionId },
        env.JWT_SECRET,
        { expiresIn: '24h' }
    );
    
    return token;
};

// Helper function to log audit events
const logAudit = async (env, employeeId, action, tableName, recordId, oldValues, newValues, ipAddress, userAgent) => {
    await env.DB.prepare(
        `INSERT INTO audit_log (employee_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        employeeId,
        action,
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
    ).run();
};

// ============= AUTH ENDPOINTS =============

// Login endpoint
router.post('/api/auth/login', async (request, env) => {
    try {
        const { email, password } = await request.json();
        
        if (!email || !password) {
            return withCors(new Response(
                JSON.stringify({ error: 'Email and password required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Find employee by email
        const employee = await env.DB.prepare(
            'SELECT * FROM employees WHERE email = ? AND is_active = 1'
        ).bind(email).first();
        
        if (!employee) {
            return withCors(new Response(
                JSON.stringify({ error: 'Invalid credentials' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Verify password (in production, use proper password hashing)
        const isValidPassword = await bcrypt.compare(password, employee.password_hash);
        if (!isValidPassword) {
            return withCors(new Response(
                JSON.stringify({ error: 'Invalid credentials' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Create JWT token
        const token = await createToken(employee.employee_id, env);
        
        // Log login event
        await logAudit(env, employee.employee_id, 'login', 'employees', employee.employee_id, null, null, 
                      request.headers.get('CF-Connecting-IP'), request.headers.get('User-Agent'));
        
        // Return employee data (without password)
        const { password_hash, ...employeeData } = employee;
        
        return withCors(new Response(
            JSON.stringify({
                message: 'Login successful',
                token,
                employee: employeeData
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Login error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Logout endpoint
router.post('/api/auth/logout', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Remove session from database
        await env.DB.prepare(
            'DELETE FROM sessions WHERE session_id = ?'
        ).bind(user.sessionId).run();
        
        // Log logout event
        await logAudit(env, user.employeeId, 'logout', 'sessions', user.sessionId, null, null,
                      request.headers.get('CF-Connecting-IP'), request.headers.get('User-Agent'));
        
        return withCors(new Response(
            JSON.stringify({ message: 'Logout successful' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Logout error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// ============= ATTENDANCE ENDPOINTS =============

// Get attendance for current employee
router.get('/api/attendance', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { month, year } = new URL(request.url).searchParams;
        const currentDate = new Date();
        const searchMonth = month || currentDate.getMonth() + 1;
        const searchYear = year || currentDate.getFullYear();
        
        const attendance = await env.DB.prepare(
            `SELECT * FROM attendance 
             WHERE employee_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
             ORDER BY date DESC`
        ).bind(user.employeeId, searchMonth.toString().padStart(2, '0'), searchYear.toString()).all();
        
        return withCors(new Response(
            JSON.stringify({ attendance: attendance.results }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get attendance error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Mark attendance (login/logout)
router.post('/api/attendance/mark', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { type } = await request.json(); // 'login' or 'logout'
        const today = new Date().toISOString().split('T')[0];
        
        // Check if attendance already exists for today
        const existing = await env.DB.prepare(
            'SELECT * FROM attendance WHERE employee_id = ? AND date = ?'
        ).bind(user.employeeId, today).first();
        
        if (type === 'login') {
            if (existing && existing.login_time) {
                return withCors(new Response(
                    JSON.stringify({ error: 'Already logged in today' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                ));
            }
            
            const loginTime = new Date().toISOString();
            
            if (existing) {
                // Update existing record
                await env.DB.prepare(
                    'UPDATE attendance SET login_time = ?, status = ? WHERE employee_id = ? AND date = ?'
                ).bind(loginTime, 'present', user.employeeId, today).run();
            } else {
                // Create new record
                await env.DB.prepare(
                    'INSERT INTO attendance (employee_id, date, login_time, status) VALUES (?, ?, ?, ?)'
                ).bind(user.employeeId, today, loginTime, 'present').run();
            }
            
            await logAudit(env, user.employeeId, 'attendance_mark', 'attendance', today, null, 
                          { type: 'login', time: loginTime }, request.headers.get('CF-Connecting-IP'), 
                          request.headers.get('User-Agent'));
            
            return withCors(new Response(
                JSON.stringify({ message: 'Login marked successfully', time: loginTime }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            ));
            
        } else if (type === 'logout') {
            if (!existing || !existing.login_time) {
                return withCors(new Response(
                    JSON.stringify({ error: 'No login record found for today' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                ));
            }
            
            if (existing.logout_time) {
                return withCors(new Response(
                    JSON.stringify({ error: 'Already logged out today' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                ));
            }
            
            const logoutTime = new Date().toISOString();
            const loginTime = new Date(existing.login_time);
            const totalHours = (new Date(logoutTime) - loginTime) / (1000 * 60 * 60);
            
            await env.DB.prepare(
                'UPDATE attendance SET logout_time = ?, total_hours = ? WHERE employee_id = ? AND date = ?'
            ).bind(logoutTime, totalHours, user.employeeId, today).run();
            
            await logAudit(env, user.employeeId, 'attendance_mark', 'attendance', today, null,
                          { type: 'logout', time: logoutTime, hours: totalHours }, 
                          request.headers.get('CF-Connecting-IP'), request.headers.get('User-Agent'));
            
            return withCors(new Response(
                JSON.stringify({ message: 'Logout marked successfully', time: logoutTime, totalHours }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
    } catch (error) {
        console.error('Mark attendance error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// ============= LEAVE ENDPOINTS =============

// Get leave balances
router.get('/api/leave/balances', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const currentYear = new Date().getFullYear();
        
        const balances = await env.DB.prepare(
            'SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?'
        ).bind(user.employeeId, currentYear).all();
        
        return withCors(new Response(
            JSON.stringify({ balances: balances.results }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get leave balances error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Apply for leave
router.post('/api/leave/apply', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { leaveType, startDate, endDate, reason } = await request.json();
        
        if (!leaveType || !startDate || !endDate || !reason) {
            return withCors(new Response(
                JSON.stringify({ error: 'All fields required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Calculate days
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        // Check leave balance
        const balance = await env.DB.prepare(
            'SELECT balance_days FROM leave_balances WHERE employee_id = ? AND leave_type = ? AND year = ?'
        ).bind(user.employeeId, leaveType, new Date().getFullYear()).first();
        
        if (!balance || balance.balance_days < days) {
            return withCors(new Response(
                JSON.stringify({ error: 'Insufficient leave balance' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Create leave application
        const result = await env.DB.prepare(
            `INSERT INTO leave_applications (employee_id, leave_type, start_date, end_date, total_days, reason)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(user.employeeId, leaveType, startDate, endDate, days, reason).run();
        
        await logAudit(env, user.employeeId, 'leave_apply', 'leave_applications', result.meta.last_row_id.toString(), null,
                      { leaveType, startDate, endDate, days, reason }, request.headers.get('CF-Connecting-IP'),
                      request.headers.get('User-Agent'));
        
        return withCors(new Response(
            JSON.stringify({ message: 'Leave application submitted successfully', applicationId: result.meta.last_row_id }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Apply leave error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Get leave applications (for managers)
router.get('/api/leave/applications', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Check if user is manager or admin
        const employee = await env.DB.prepare(
            'SELECT role FROM employees WHERE employee_id = ?'
        ).bind(user.employeeId).first();
        
        if (!employee || (employee.role !== 'manager' && employee.role !== 'admin')) {
            return withCors(new Response(
                JSON.stringify({ error: 'Insufficient permissions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { status } = new URL(request.url).searchParams;
        let query = `
            SELECT la.*, e.first_name, e.last_name, e.employee_id as emp_id 
            FROM leave_applications la 
            JOIN employees e ON la.employee_id = e.employee_id
        `;
        const params = [];
        
        if (status) {
            query += ' WHERE la.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY la.created_at DESC';
        
        const applications = await env.DB.prepare(query).bind(...params).all();
        
        return withCors(new Response(
            JSON.stringify({ applications: applications.results }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get leave applications error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Approve/Reject leave
router.put('/api/leave/:id/approve', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Check if user is manager or admin
        const employee = await env.DB.prepare(
            'SELECT role FROM employees WHERE employee_id = ?'
        ).bind(user.employeeId).first();
        
        if (!employee || (employee.role !== 'manager' && employee.role !== 'admin')) {
            return withCors(new Response(
                JSON.stringify({ error: 'Insufficient permissions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { status, rejectionReason } = await request.json();
        const applicationId = request.params.id;
        
        if (!['approved', 'rejected'].includes(status)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Invalid status' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Get application details
        const application = await env.DB.prepare(
            'SELECT * FROM leave_applications WHERE id = ?'
        ).bind(applicationId).first();
        
        if (!application) {
            return withCors(new Response(
                JSON.stringify({ error: 'Application not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Update application
        await env.DB.prepare(
            `UPDATE leave_applications 
             SET status = ?, approved_by = ?, approved_at = datetime("now"), rejection_reason = ?
             WHERE id = ?`
        ).bind(status, user.employeeId, rejectionReason || null, applicationId).run();
        
        // If approved, update leave balance
        if (status === 'approved') {
            await env.DB.prepare(
                'UPDATE leave_balances SET used_days = used_days + ? WHERE employee_id = ? AND leave_type = ? AND year = ?'
            ).bind(application.total_days, application.employee_id, application.leave_type, new Date().getFullYear()).run();
        }
        
        await logAudit(env, user.employeeId, status === 'approved' ? 'leave_approve' : 'leave_reject', 
                      'leave_applications', applicationId, null, { status, rejectionReason },
                      request.headers.get('CF-Connecting-IP'), request.headers.get('User-Agent'));
        
        return withCors(new Response(
            JSON.stringify({ message: `Leave ${status} successfully` }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Approve leave error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// ============= HOLIDAY ENDPOINTS =============

// Get holidays
router.get('/api/holidays', async (request, env) => {
    try {
        const { year } = new URL(request.url).searchParams;
        const currentYear = year || new Date().getFullYear();
        
        const holidays = await env.DB.prepare(
            'SELECT * FROM holidays WHERE year = ? AND is_active = 1 ORDER BY date'
        ).bind(currentYear).all();
        
        return withCors(new Response(
            JSON.stringify({ holidays: holidays.results }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get holidays error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// ============= PROFILE ENDPOINTS =============

// Get employee profile
router.get('/api/profile', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const employee = await env.DB.prepare(
            'SELECT employee_id, first_name, last_name, email, phone, department, position, role, join_date FROM employees WHERE employee_id = ?'
        ).bind(user.employeeId).first();
        
        return withCors(new Response(
            JSON.stringify({ employee }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get profile error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// 404 handler
router.all('*', () => withCors(new Response(
    JSON.stringify({ error: 'Endpoint not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
)));

// Export default fetch handler
export default {
    async fetch(request, env, ctx) {
        return router.handle(request, env, ctx);
    },
};
