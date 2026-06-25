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
        
        // Get employee details
        const employee = await env.DB.prepare(
            'SELECT employee_id, role, is_first_login FROM employees WHERE employee_id = ?'
        ).bind(decoded.employeeId).first();
        
        return { ...decoded, role: employee.role, isFirstLogin: employee.is_first_login };
    } catch (error) {
        return null;
    }
};

// Role-based authorization middleware
const authorize = (allowedRoles) => {
    return async (request, env) => {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        if (!allowedRoles.includes(user.role)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Insufficient permissions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        return user;
    };
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

// Helper function to generate employee ID
const generateEmployeeId = async (env, city = 'HYD') => {
    // Get the last employee ID for the city
    const lastEmployee = await env.DB.prepare(
        'SELECT employee_id FROM employees WHERE employee_id LIKE ? ORDER BY id DESC LIMIT 1'
    ).bind(`BMG${city}%`).first();
    
    if (!lastEmployee) {
        return `BMG${city}00001`;
    }
    
    // Extract the number and increment
    const lastNumber = parseInt(lastEmployee.employee_id.replace(`BMG${city}`, ''));
    const newNumber = (lastNumber + 1).toString().padStart(5, '0');
    
    return `BMG${city}${newNumber}`;
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

// Health check endpoint
router.get('/api/health', async (request, env) => {
    try {
        // Test database connection
        const dbTest = await env.DB.prepare('SELECT 1 as test').first();
        
        return withCors(new Response(
            JSON.stringify({
                status: 'online',
                timestamp: new Date().toISOString(),
                database: dbTest ? 'connected' : 'disconnected',
                version: '1.0.0'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
    } catch (error) {
        return withCors(new Response(
            JSON.stringify({
                status: 'offline',
                timestamp: new Date().toISOString(),
                error: error.message
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Login endpoint - uses employee_id instead of email
router.post('/api/auth/login', async (request, env) => {
    try {
        const { employeeId, password } = await request.json();
        
        if (!employeeId || !password) {
            return withCors(new Response(
                JSON.stringify({ error: 'Employee ID and password required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Find employee by employee_id
        const employee = await env.DB.prepare(
            'SELECT * FROM employees WHERE employee_id = ? AND is_active = 1'
        ).bind(employeeId).first();
        
        if (!employee) {
            return withCors(new Response(
                JSON.stringify({ error: 'Employee not found' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Verify password using bcrypt
        let isValidPassword = false;
        try {
            isValidPassword = await bcrypt.compare(password, employee.password_hash);
        } catch (error) {
            console.error('Bcrypt error:', error);
            isValidPassword = false;
        }
        
        if (!isValidPassword) {
            return withCors(new Response(
                JSON.stringify({ error: 'Invalid credentials' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Create JWT token (now using proper JWT since we have secure secret)
        const token = await createToken(employee.employee_id, env);
        
        // Log login event
        try {
            await logAudit(env, employee.employee_id, 'login', 'employees', employee.employee_id, null, null, 
                          request.headers.get('CF-Connecting-IP'), request.headers.get('User-Agent'));
        } catch (error) {
            console.error('Audit log error:', error);
            // Continue even if audit fails
        }
        
        // Return employee data (without password)
        const { password_hash, ...employeeData } = employee;
        
        return withCors(new Response(
            JSON.stringify({
                success: true,
                token: token,
                employee: employeeData,
                isFirstLogin: employee.is_first_login === 1
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Login error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Change password endpoint (for first login)
router.post('/api/auth/change-password', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { currentPassword, newPassword } = await request.json();
        
        if (!currentPassword || !newPassword) {
            return withCors(new Response(
                JSON.stringify({ error: 'Current and new password required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Get current password hash
        const employee = await env.DB.prepare(
            'SELECT password_hash FROM employees WHERE employee_id = ?'
        ).bind(user.employeeId).first();
        
        if (!employee) {
            return withCors(new Response(
                JSON.stringify({ error: 'Employee not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        if (!employee.password_hash) {
            return withCors(new Response(
                JSON.stringify({ error: 'No password hash found' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Verify current password using bcrypt only
        let isValid = false;
        try {
            isValid = await bcrypt.compare(currentPassword, employee.password_hash);
        } catch (bcryptError) {
            console.error('Bcrypt comparison error:', bcryptError);
        }
        
        if (!isValid) {
            return withCors(new Response(
                JSON.stringify({ error: 'Current password is incorrect' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        
        // Update password and set is_first_login to false
        await env.DB.prepare(
            'UPDATE employees SET password_hash = ?, is_first_login = 0, updated_at = datetime("now") WHERE employee_id = ?'
        ).bind(newPasswordHash, user.employeeId).run();
        
        await logAudit(env, user.employeeId, 'password_change', 'employees', user.employeeId, null, null,
                      request.headers.get('CF-Connecting-IP'), request.headers.get('User-Agent'));
        
        return withCors(new Response(
            JSON.stringify({ message: 'Password changed successfully' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Change password error:', error);
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

// ============= EMPLOYEE ONBOARDING ENDPOINTS =============

// Create new employee (Admin/Master Admin only)
router.post('/api/employees/create', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Check if user has permission (master_admin or admin)
        if (user.role !== 'master_admin' && user.role !== 'admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'Insufficient permissions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const employeeData = await request.json();
        
        // Validate required fields
        const requiredFields = ['first_name', 'last_name', 'email', 'phone', 'department', 'position', 'join_date'];
        for (const field of requiredFields) {
            if (!employeeData[field]) {
                return withCors(new Response(
                    JSON.stringify({ error: `${field} is required` }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                ));
            }
        }
        
        // Generate employee ID
        const city = employeeData.city || 'HYD';
        const employeeId = await generateEmployeeId(env, city);
        
        // Generate default password (first name + last 4 digits of phone)
        const defaultPassword = `${employeeData.first_name.toLowerCase()}${employeeData.phone.slice(-4)}`;
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        
        // Set role (admin can create staff/manager, master_admin can create any role)
        let role = employeeData.role || 'staff';
        if (user.role === 'admin' && role === 'admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'Admin cannot create admin users' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Insert employee
        const result = await env.DB.prepare(
            `INSERT INTO employees (
                employee_id, first_name, last_name, email, password_hash, phone, alternate_phone,
                date_of_birth, gender, address, city, state, pincode, department, position, role,
                reporting_manager, join_date, salary, bank_name, bank_account, ifsc_code,
                pan_number, aadhaar_number, emergency_contact_name, emergency_contact_phone,
                emergency_contact_relation, is_first_login, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            employeeId, employeeData.first_name, employeeData.last_name, employeeData.email, passwordHash,
            employeeData.phone, employeeData.alternate_phone, employeeData.date_of_birth, employeeData.gender,
            employeeData.address, employeeData.city, employeeData.state, employeeData.pincode,
            employeeData.department, employeeData.position, role, employeeData.reporting_manager,
            employeeData.join_date, employeeData.salary, employeeData.bank_name, employeeData.bank_account,
            employeeData.ifsc_code, employeeData.pan_number, employeeData.aadhaar_number,
            employeeData.emergency_contact_name, employeeData.emergency_contact_phone,
            employeeData.emergency_contact_relation, 1, user.employeeId
        ).run();
        
        // Create default leave balances
        const currentYear = new Date().getFullYear();
        await env.DB.prepare(
            `INSERT INTO leave_balances (employee_id, leave_type, total_days, year) VALUES
            (?, 'casual', 12, ?), (?, 'sick', 8, ?), (?, 'earned', 15, ?)`
        ).bind(employeeId, currentYear, employeeId, currentYear, employeeId, currentYear).run();
        
        await logAudit(env, user.employeeId, 'employee_create', 'employees', employeeId, null, 
                      { ...employeeData, employee_id: employeeId }, request.headers.get('CF-Connecting-IP'),
                      request.headers.get('User-Agent'));
        
        return withCors(new Response(
            JSON.stringify({
                message: 'Employee created successfully',
                employeeId,
                defaultPassword,
                note: 'Employee must change password on first login'
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Create employee error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

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
            'SELECT * FROM employees WHERE employee_id = ?'
        ).bind(user.employeeId).first();
        
        const { password_hash, ...employeeData } = employee;
        
        return withCors(new Response(
            JSON.stringify({ employee: employeeData }),
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

// ============= ATTENDANCE ENDPOINTS =============

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

// Get attendance records
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

// Get last 7 days attendance
router.get('/api/attendance/last7days', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Get attendance for last 7 days
        const attendance = await env.DB.prepare(
            `SELECT date, login_time, logout_time, status 
             FROM attendance 
             WHERE employee_id = ? AND date >= date('now', '-7 days')
             ORDER BY date DESC`
        ).bind(user.employeeId).all();
        
        return withCors(new Response(
            JSON.stringify({ attendance: attendance.results || [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get last 7 days attendance error:', error);
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

// Get leave applications (for managers/admins)
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
        if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'master_admin') {
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

// Get leave approvals for current manager (leaves from their team members)
router.get('/api/leave/approvals', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Only managers and admins can view approvals
        if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'master_admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'Only managers can view leave approvals' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        let query = `
            SELECT la.*, e.first_name, e.last_name, e.employee_id as emp_id, e.department
            FROM leave_applications la
            JOIN employees e ON la.employee_id = e.employee_id
        `;
        const params = [];

        // If user is manager (not admin), only show their team's leaves
        if (user.role === 'manager') {
            query += ' WHERE e.reporting_manager_id = ?';
            params.push(user.employeeId);
        }

        query += ' ORDER BY la.created_at DESC';

        const applications = await env.DB.prepare(query).bind(...params).all();

        return withCors(new Response(
            JSON.stringify({
                success: true,
                approvals: applications.results || []
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));

    } catch (error) {
        console.error('Get leave approvals error:', error);
        return withCors(new Response(
            JSON.stringify({
                error: 'Internal server error',
                details: error.message
            }),
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
        if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'master_admin') {
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

// ============= ADMIN ENDPOINTS =============

// Get all employees (Admin/Master Admin only)
router.get('/api/admin/employees', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user || (user.role !== 'admin' && user.role !== 'master_admin')) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const employees = await env.DB.prepare(
            'SELECT employee_id, first_name, last_name, email, phone, department, position, role, join_date, is_active, employment_status FROM employees ORDER BY first_name ASC'
        ).all();

        return withCors(new Response(
            JSON.stringify({
                success: true,
                employees: employees.results || []
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));

    } catch (error) {
        console.error('Get employees error:', error);
        return withCors(new Response(
            JSON.stringify({
                error: 'Internal server error',
                details: error.message
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Update employee status (Admin/Master Admin only)
router.post('/api/employees/:employeeId/status', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Check if user has permission (master_admin or admin)
        if (user.role !== 'master_admin' && user.role !== 'admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'Insufficient permissions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { employeeId } = request.params;
        const { employment_status, status_reason, status_notes } = await request.json();
        
        // Validate employment status
        const validStatuses = ['active', 'inactive', 'terminated', 'resigned', 'retired', 'on_leave'];
        if (!validStatuses.includes(employment_status)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Invalid employment status' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Get current employee data for audit
        const currentEmployee = await env.DB.prepare(
            'SELECT * FROM employees WHERE employee_id = ?'
        ).bind(employeeId).first();
        
        if (!currentEmployee) {
            return withCors(new Response(
                JSON.stringify({ error: 'Employee not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Update employee status
        await env.DB.prepare(`
            UPDATE employees SET 
                employment_status = ?, 
                status_reason = ?, 
                status_effective_date = date('now'),
                status_updated_by = ?,
                status_notes = ?,
                is_active = ?,
                updated_at = datetime('now')
            WHERE employee_id = ?
        `).bind(
            employment_status,
            status_reason || null,
            user.employeeId,
            status_notes || null,
            employment_status === 'active' ? 1 : 0,
            employeeId
        ).run();
        
        // Log audit
        await logAudit(env, user.employeeId, 'employee_status_update', 'employees', employeeId, 
                      { 
                        old_status: currentEmployee.employment_status, 
                        old_reason: currentEmployee.status_reason 
                      }, 
                      { 
                        new_status: employment_status, 
                        new_reason: status_reason,
                        notes: status_notes 
                      }, 
                      request.headers.get('CF-Connecting-IP'), request.headers.get('User-Agent'));
        
        return withCors(new Response(
            JSON.stringify({ 
                success: true, 
                message: 'Employee status updated successfully',
                employeeId: employeeId,
                newStatus: employment_status
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Update employee status error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Get employee status history
router.get('/api/employees/:employeeId/status-history', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { employeeId } = request.params;
        
        // Get employee details
        const employee = await env.DB.prepare(
            'SELECT employee_id, first_name, last_name, employment_status, status_reason, status_effective_date, status_notes FROM employees WHERE employee_id = ?'
        ).bind(employeeId).first();
        
        if (!employee) {
            return withCors(new Response(
                JSON.stringify({ error: 'Employee not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Get audit log for status changes
        const statusHistory = await env.DB.prepare(`
            SELECT action, old_values, new_values, created_at, ip_address
            FROM audit_log 
            WHERE employee_id = ? AND table_name = 'employees' AND action = 'employee_status_update'
            ORDER BY created_at DESC
        `).bind(employeeId).all();
        
        return withCors(new Response(
            JSON.stringify({ 
                employee: employee,
                statusHistory: statusHistory.results 
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get employee status history error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Admin password reset endpoint (Admin/Master Admin only)
router.post('/api/admin/reset-password', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Check if user has permission (master_admin or admin)
        if (user.role !== 'master_admin' && user.role !== 'admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'Insufficient permissions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { targetEmployeeId, newPassword } = await request.json();
        
        if (!targetEmployeeId || !newPassword) {
            return withCors(new Response(
                JSON.stringify({ error: 'Employee ID and new password are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        if (newPassword.length < 6) {
            return withCors(new Response(
                JSON.stringify({ error: 'Password must be at least 6 characters long' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Check if target employee exists
        const targetEmployee = await env.DB.prepare(
            'SELECT employee_id, first_name, last_name, role FROM employees WHERE employee_id = ?'
        ).bind(targetEmployeeId).first();
        
        if (!targetEmployee) {
            return withCors(new Response(
                JSON.stringify({ error: 'Employee not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Prevent admin from resetting another admin's password (only master_admin can)
        if (targetEmployee.role === 'admin' && user.role !== 'master_admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'Only master admin can reset admin passwords' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Prevent anyone from resetting master_admin password
        if (targetEmployee.role === 'master_admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'Master admin password cannot be reset' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        
        // Update password and set is_first_login to true to force password change
        await env.DB.prepare(
            'UPDATE employees SET password_hash = ?, is_first_login = 1, updated_at = datetime("now") WHERE employee_id = ?'
        ).bind(newPasswordHash, targetEmployeeId).run();
        
        await logAudit(env, user.employeeId, 'password_reset', 'employees', targetEmployeeId, null, 
                      { 
                        reset_by: user.employeeId,
                        target_employee: targetEmployeeId,
                        target_name: `${targetEmployee.first_name} ${targetEmployee.last_name}`
                      }, 
                      request.headers.get('CF-Connecting-IP'), request.headers.get('User-Agent'));
        
        return withCors(new Response(
            JSON.stringify({ 
                message: 'Password reset successfully',
                employeeId: targetEmployeeId,
                employeeName: `${targetEmployee.first_name} ${targetEmployee.last_name}`,
                note: 'Employee must change password on next login'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Password reset error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

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

// Save comparison report with individual answers (staff only)
router.post('/api/comparison/save-report', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized - Please log in first' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const { clientName, clientAge, membersCount, selectedBrands, reportData } = await request.json();

        // Step 1: Insert comparison header
        const reportResult = await env.DB.prepare(`
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

        const comparisonId = reportResult.meta.last_row_id;

        console.log('✅ Comparison saved with ID:', comparisonId);

        // Step 2: Insert individual answers
        let answersCount = 0;
        for (const section of reportData.sections) {
            for (const feature of section.features) {
                // For each brand, insert the answer
                for (let brandIndex = 0; brandIndex < reportData.brands.length; brandIndex++) {
                    const brand = reportData.brands[brandIndex];
                    const answerValue = feature.vals[brandIndex] || 'E';
                    const comment = feature.explain[brandIndex] || '';

                    await env.DB.prepare(`
                        INSERT INTO comparison_answers (comparison_id, feature_id, brand_id, answer_value, comment, employee_id)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).bind(
                        comparisonId,
                        feature.id,
                        brand.id,
                        answerValue,
                        comment,
                        user.employeeId
                    ).run();

                    answersCount++;
                }
            }
        }

        console.log('✅ Saved', answersCount, 'individual answers');

        return withCors(new Response(
            JSON.stringify({
                success: true,
                message: 'Report saved successfully',
                comparisonId: comparisonId,
                answersCount: answersCount
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));

    } catch (error) {
        console.error('Save report error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return withCors(new Response(
            JSON.stringify({
                error: 'Internal server error',
                details: error.message,
                type: error.constructor.name
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPARISON ADMIN ENDPOINTS (CRUD for Questions, Brands, Answers)
// ═══════════════════════════════════════════════════════════════════════════

// Get all questions
router.get('/api/comparison/questions', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) return withCors(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

        const questions = await env.DB.prepare(`
            SELECT id, feature_id, feature_label, section_id, sort_order
            FROM comparison_features
            WHERE is_active = 1
            ORDER BY section_id, sort_order
        `).all();

        return withCors(new Response(JSON.stringify({
            success: true,
            questions: questions.results || []
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    } catch (error) {
        console.error('Get questions error:', error);
        return withCors(new Response(JSON.stringify({ error: error.message }), { status: 500 }));
    }
});

// Get all brands
router.get('/api/comparison/brands', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) return withCors(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

        const brands = await env.DB.prepare(`
            SELECT id, brand_id, brand_name, plan_name, premium_default, color_dark, color_light, color_mid
            FROM comparison_brands
            WHERE is_active = 1
            ORDER BY sort_order
        `).all();

        return withCors(new Response(JSON.stringify({
            success: true,
            brands: brands.results || []
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    } catch (error) {
        console.error('Get brands error:', error);
        return withCors(new Response(JSON.stringify({ error: error.message }), { status: 500 }));
    }
});

// Get all comparisons (with answers)
router.get('/api/comparison/comparisons', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) return withCors(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

        const comparisons = await env.DB.prepare(`
            SELECT id, employee_id, client_name, client_age, members_count, selected_brands, created_at
            FROM comparison_reports
            ORDER BY created_at DESC
            LIMIT 100
        `).all();

        return withCors(new Response(JSON.stringify({
            success: true,
            comparisons: comparisons.results || []
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    } catch (error) {
        console.error('Get comparisons error:', error);
        return withCors(new Response(JSON.stringify({ error: error.message }), { status: 500 }));
    }
});

// Get answers for specific comparison
router.get('/api/comparison/answers/:comparisonId', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) return withCors(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

        const comparisonId = request.params.comparisonId;
        const answers = await env.DB.prepare(`
            SELECT id, comparison_id, feature_id, brand_id, answer_value, comment, updated_at
            FROM comparison_answers
            WHERE comparison_id = ?
            ORDER BY feature_id, brand_id
        `).bind(comparisonId).all();

        return withCors(new Response(JSON.stringify({
            success: true,
            answers: answers.results || []
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    } catch (error) {
        console.error('Get answers error:', error);
        return withCors(new Response(JSON.stringify({ error: error.message }), { status: 500 }));
    }
});

// Update answer
router.put('/api/comparison/answers/:answerId', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) return withCors(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

        const answerId = request.params.answerId;
        const { answer_value, comment } = await request.json();

        await env.DB.prepare(`
            UPDATE comparison_answers
            SET answer_value = ?, comment = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(answer_value, comment, answerId).run();

        return withCors(new Response(JSON.stringify({
            success: true,
            message: 'Answer updated successfully'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    } catch (error) {
        console.error('Update answer error:', error);
        return withCors(new Response(JSON.stringify({ error: error.message }), { status: 500 }));
    }
});

// Delete answer
router.delete('/api/comparison/answers/:answerId', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) return withCors(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

        const answerId = request.params.answerId;

        await env.DB.prepare(`
            DELETE FROM comparison_answers
            WHERE id = ?
        `).bind(answerId).run();

        return withCors(new Response(JSON.stringify({
            success: true,
            message: 'Answer deleted successfully'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    } catch (error) {
        console.error('Delete answer error:', error);
        return withCors(new Response(JSON.stringify({ error: error.message }), { status: 500 }));
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

// ═══════════════════════════════════════════════════════════════════════════
// QUESTIONS MANAGEMENT ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Get all questions (admin - includes hidden)
router.get('/api/comparison/questions/all', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // All authenticated users can read questions and notes (for compare.html)
        // Only admins can modify via POST endpoint

        const features = await env.DB.prepare(`
            SELECT
                feature_id,
                feature_label,
                section_id,
                is_active,
                sort_order
            FROM comparison_features
            ORDER BY section_id, sort_order
        `).all();

        // For each feature, get the values and notes for all brands
        const questions = [];
        for (const feature of features.results || []) {
            const values = await env.DB.prepare(`
                SELECT brand_id, value_type, notes
                FROM comparison_values
                WHERE feature_id = ?
            `).bind(feature.feature_id).all();

            const valuesMap = {};
            const notesMap = {};
            for (const val of values.results || []) {
                valuesMap[val.brand_id] = val.value_type;
                notesMap[val.brand_id] = val.notes || '';
            }

            questions.push({
                feature_id: feature.feature_id,
                feature_label: feature.feature_label,
                section_id: feature.section_id,
                is_active: feature.is_active,
                sort_order: feature.sort_order,
                values: valuesMap,
                notes: notesMap
            });
        }

        return withCors(new Response(
            JSON.stringify({
                success: true,
                questions: questions
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));

    } catch (error) {
        console.error('Get all questions error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Add or update a question
router.post('/api/comparison/questions', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Check if user is manager+
        if (!['manager', 'admin', 'master_admin'].includes(user.role)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Only managers can manage questions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const { feature_id, feature_label, section_id, values, notes } = await request.json();

        if (!feature_label || !section_id) {
            return withCors(new Response(
                JSON.stringify({ error: 'feature_label and section_id are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        if (feature_id) {
            // Update existing feature
            await env.DB.prepare(`
                UPDATE comparison_features
                SET feature_label = ?, section_id = ?, updated_at = datetime('now')
                WHERE feature_id = ?
            `).bind(feature_label, section_id, feature_id).run();
        } else {
            // Insert new feature - generate feature_id from label
            const newFeatureId = feature_label.toLowerCase().replace(/\s+/g, '_').substring(0, 30);

            await env.DB.prepare(`
                INSERT INTO comparison_features (feature_id, feature_label, section_id, is_active)
                VALUES (?, ?, ?, 1)
            `).bind(newFeatureId, feature_label, section_id).run();
        }

        // Update values for each brand
        const BRANDS = ['ab', 'ic', 'star', 'care', 'tata'];
        if (values && typeof values === 'object') {
            for (const brand of BRANDS) {
                const valueType = values[brand];
                const noteValue = notes && notes[brand] ? notes[brand] : '';
                const fid = feature_id || feature_label.toLowerCase().replace(/\s+/g, '_').substring(0, 30);

                if (valueType && ['Y', 'N', 'E'].includes(valueType)) {
                    await env.DB.prepare(`
                        INSERT INTO comparison_values (feature_id, brand_id, value_type, notes)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT(feature_id, brand_id) DO UPDATE SET
                            value_type = ?,
                            notes = ?,
                            updated_at = datetime('now')
                    `).bind(fid, brand, valueType, noteValue, valueType, noteValue).run();
                }
            }
        }

        return withCors(new Response(
            JSON.stringify({
                success: true,
                message: feature_id ? 'Question updated' : 'Question created',
                feature_id: feature_id || feature_label.toLowerCase().replace(/\s+/g, '_').substring(0, 30)
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));

    } catch (error) {
        console.error('Save question error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Toggle question visibility (hide/show)
router.post('/api/comparison/questions/toggle', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Check if user is manager+
        if (!['manager', 'admin', 'master_admin'].includes(user.role)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Only managers can manage questions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const { feature_id, is_active } = await request.json();

        if (!feature_id) {
            return withCors(new Response(
                JSON.stringify({ error: 'feature_id is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        await env.DB.prepare(`
            UPDATE comparison_features
            SET is_active = ?, updated_at = datetime('now')
            WHERE feature_id = ?
        `).bind(is_active ? 1 : 0, feature_id).run();

        return withCors(new Response(
            JSON.stringify({
                success: true,
                message: is_active ? 'Question shown' : 'Question hidden',
                feature_id: feature_id,
                is_active: is_active
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));

    } catch (error) {
        console.error('Toggle question error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

router.post('/api/comparison/questions/bulk-replace', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        if (!['admin', 'master_admin'].includes(user.role)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Only admins can bulk replace questions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const { questions } = await request.json();

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return withCors(new Response(
                JSON.stringify({ error: 'questions array is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Ensure comparison_sections are seeded (FK dependency for features)
        const sectionSeeds = [
            ['tier1', 1, 'TIER 1 — THE FOUNDATION | Deal Breakers', '#263238', 1],
            ['tier2', 2, 'TIER 2 — WAITING PERIODS | Hidden Traps', '#37474F', 2],
            ['tier3', 3, 'TIER 3 — RESTORATION & BONUS | Long Term Value', '#455A64', 3],
            ['tier4', 4, 'TIER 4 — ADDITIONAL BENEFITS | What Makes a Plan Stand Out', '#546E7A', 4],
            ['tier5', 5, 'TIER 5 — MATERNITY & NEW BORN BENEFITS', '#607D8B', 5],
            ['tier6', 6, 'TIER 6 — SPECIAL / UNIQUE FEATURES', '#78909C', 6],
        ];
        for (const [sid, tn, sl, sc, so] of sectionSeeds) {
            await env.DB.prepare(`
                INSERT OR IGNORE INTO comparison_sections (section_id, tier_number, section_label, section_color, sort_order)
                VALUES (?, ?, ?, ?, ?)
            `).bind(sid, tn, sl, sc, so).run();
        }

        // Ensure comparison_brands are seeded (FK dependency for values)
        const brandSeeds = [
            ['ab', 'Aditya Birla', 'Activ One Max', '₹10,271', '#B71C1C', '#FFF5F5', '#FFCDD2', 'linear-gradient(135deg,#B71C1C,#E53935)', 1],
            ['ic', 'ICICI Lombard', 'Elevate', '₹12,213', '#BF360C', '#FFF3EE', '#FFCCBC', 'linear-gradient(135deg,#BF360C,#FF5722)', 2],
            ['star', 'Star Health', 'Super Star', '₹11,500', '#0D47A1', '#EEF3FF', '#BBDEFB', 'linear-gradient(135deg,#0D47A1,#1976D2)', 3],
            ['care', 'Care Health', 'Care Supreme', '₹9,800', '#E65100', '#FFFDE7', '#FFE082', 'linear-gradient(135deg,#E65100,#F9A825)', 4],
            ['tata', 'Tata AIG', 'Medicare Select', '₹13,200', '#1A237E', '#F0F0FF', '#9FA8DA', 'linear-gradient(135deg,#1A237E,#3949AB)', 5],
        ];
        for (const [bid, bn, pn, pd, cd, cl, cm, gr, so] of brandSeeds) {
            await env.DB.prepare(`
                INSERT OR IGNORE INTO comparison_brands (brand_id, brand_name, plan_name, premium_default, color_dark, color_light, color_mid, gradient, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(bid, bn, pn, pd, cd, cl, cm, gr, so).run();
        }

        // Fetch the valid brand_ids actually in comparison_brands
        const brandsResult = await env.DB.prepare(`SELECT brand_id FROM comparison_brands`).all();
        const validBrands = brandsResult.results.map(b => b.brand_id);

        // Clear all existing features and their values
        await env.DB.prepare('DELETE FROM comparison_values').run();
        await env.DB.prepare('DELETE FROM comparison_features').run();

        let inserted = 0;

        for (const q of questions) {
            const { feature_id, feature_label, section_id, values, notes, is_active } = q;
            if (!feature_id || !feature_label || !section_id) continue;

            const activeVal = (is_active === false || is_active === 0) ? 0 : 1;

            await env.DB.prepare(`
                INSERT INTO comparison_features (feature_id, feature_label, section_id, is_active)
                VALUES (?, ?, ?, ?)
            `).bind(feature_id, feature_label, section_id, activeVal).run();

            if (values && typeof values === 'object') {
                for (const brand of validBrands) {
                    const valueType = values[brand];
                    const noteValue = (notes && notes[brand]) ? notes[brand] : '';
                    if (valueType && ['Y', 'N', 'E'].includes(valueType)) {
                        await env.DB.prepare(`
                            INSERT INTO comparison_values (feature_id, brand_id, value_type, notes)
                            VALUES (?, ?, ?, ?)
                        `).bind(feature_id, brand, valueType, noteValue).run();
                    }
                }
            }

            inserted++;
        }

        return withCors(new Response(
            JSON.stringify({
                success: true,
                message: `Replaced all questions. Imported ${inserted} questions.`,
                count: inserted
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));

    } catch (error) {
        console.error('Bulk replace error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

router.post('/api/comparison/questions/:feature_id/delete', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Check if user is manager+
        if (!['manager', 'admin', 'master_admin'].includes(user.role)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Only managers can manage questions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const { feature_id } = request.params;

        if (!feature_id) {
            return withCors(new Response(
                JSON.stringify({ error: 'feature_id is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Soft delete: set is_active = 0
        await env.DB.prepare(`
            UPDATE comparison_features
            SET is_active = 0, updated_at = datetime('now')
            WHERE feature_id = ?
        `).bind(feature_id).run();

        return withCors(new Response(
            JSON.stringify({
                success: true,
                message: 'Question deleted successfully',
                feature_id: feature_id
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));

    } catch (error) {
        console.error('Delete question error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Logo Upload Endpoint
router.post('/api/upload-logo', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user || !['admin', 'master_admin'].includes(user.role)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const { filename, base64, type } = await request.json();

        if (!base64 || !type) {
            return withCors(new Response(
                JSON.stringify({ error: 'base64 and type are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Return data URL for the logo (self-contained)
        // This allows logos to work without additional file storage
        const dataUrl = `data:${type};base64,${base64}`;

        return withCors(new Response(
            JSON.stringify({
                success: true,
                logo_url: dataUrl,
                message: 'Logo uploaded successfully'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
    } catch (error) {
        console.error('Logo upload error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Plan Management Endpoints
router.get('/api/plans', async (request, env) => {
    try {
        const result = await env.DB.prepare(`
            SELECT plan_id, plan_code, plan_name, plan_product_name, sum_insured, premium,
                   brand_color_dark, brand_color_light, brand_color_mid, brand_gradient,
                   logo_url, is_active
            FROM insurance_plans
            WHERE is_active = 1
            ORDER BY plan_name
        `).all();

        return withCors(new Response(
            JSON.stringify(result.results || []),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
    } catch (error) {
        console.error('Get plans error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

router.get('/api/plans/all', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user || !['admin', 'master_admin'].includes(user.role)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const result = await env.DB.prepare(`
            SELECT plan_id, plan_code, plan_name, plan_product_name, sum_insured, premium,
                   brand_color_dark, brand_color_light, brand_color_mid, brand_gradient,
                   logo_url, is_active
            FROM insurance_plans
            ORDER BY plan_name
        `).all();

        return withCors(new Response(
            JSON.stringify(result.results || []),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
    } catch (error) {
        console.error('Get all plans error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

router.post('/api/plans', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user || !['admin', 'master_admin'].includes(user.role)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const { plan_name, plan_product_name, sum_insured, premium, brand_color_dark,
                brand_color_light, brand_color_mid, brand_gradient, logo_url } = await request.json();

        if (!plan_name) {
            return withCors(new Response(
                JSON.stringify({ error: 'plan_name is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Auto-generate plan_code from plan_name (first 2 letters + counter if needed)
        let baseCode = plan_name.substring(0, 2).toLowerCase();
        let plan_code = baseCode;
        let counter = 2;

        // Check if this code already exists, if so append a number
        while (true) {
            const existing = await env.DB.prepare(`
                SELECT plan_code FROM insurance_plans WHERE plan_code = ? LIMIT 1
            `).bind(plan_code).first();

            if (!existing) {
                break; // Code is unique, use it
            }
            plan_code = baseCode + counter;
            counter++;
        }

        // Generate unique plan_id
        const plan_id = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await env.DB.prepare(`
            INSERT INTO insurance_plans
            (plan_id, plan_code, plan_name, plan_product_name, sum_insured, premium, brand_color_dark,
             brand_color_light, brand_color_mid, brand_gradient, logo_url, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
        `).bind(plan_id, plan_code, plan_name, plan_product_name || '', sum_insured || 0, premium || 0,
                brand_color_dark || '#000000', brand_color_light || '#FFFFFF',
                brand_color_mid || '#CCCCCC', brand_gradient || '', logo_url || '').run();

        return withCors(new Response(
            JSON.stringify({
                success: true,
                plan_id: plan_id,
                plan_code: plan_code,
                message: 'Plan created successfully with auto-generated code'
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
        ));
    } catch (error) {
        console.error('Create plan error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

router.put('/api/plans/:plan_id', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user || !['admin', 'master_admin'].includes(user.role)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const { plan_id } = request.params;
        const { plan_name, plan_product_name, sum_insured, premium, brand_color_dark,
                brand_color_light, brand_color_mid, brand_gradient, logo_url } = await request.json();

        await env.DB.prepare(`
            UPDATE insurance_plans
            SET plan_name = ?, plan_product_name = ?, sum_insured = ?, premium = ?,
                brand_color_dark = ?, brand_color_light = ?, brand_color_mid = ?,
                brand_gradient = ?, logo_url = ?, updated_at = datetime('now')
            WHERE plan_id = ?
        `).bind(plan_name, plan_product_name, sum_insured || 0, premium || 0,
                brand_color_dark, brand_color_light, brand_color_mid,
                brand_gradient, logo_url, plan_id).run();

        return withCors(new Response(
            JSON.stringify({
                success: true,
                plan_id: plan_id,
                message: 'Plan updated successfully'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
    } catch (error) {
        console.error('Update plan error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

router.post('/api/plans/:plan_id/toggle', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user || !['admin', 'master_admin'].includes(user.role)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const { plan_id } = request.params;
        const { is_active } = await request.json();

        await env.DB.prepare(`
            UPDATE insurance_plans
            SET is_active = ?, updated_at = datetime('now')
            WHERE plan_id = ?
        `).bind(is_active ? 1 : 0, plan_id).run();

        return withCors(new Response(
            JSON.stringify({
                success: true,
                plan_id: plan_id,
                is_active: is_active,
                message: is_active ? 'Plan activated' : 'Plan deactivated'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
    } catch (error) {
        console.error('Toggle plan error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

router.post('/api/plans/:plan_id/delete', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user || !['admin', 'master_admin'].includes(user.role)) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const { plan_id } = request.params;

        if (!plan_id) {
            return withCors(new Response(
                JSON.stringify({ error: 'plan_id is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Soft delete: set is_active = 0
        await env.DB.prepare(`
            UPDATE insurance_plans
            SET is_active = 0, updated_at = datetime('now')
            WHERE plan_id = ?
        `).bind(plan_id).run();

        return withCors(new Response(
            JSON.stringify({
                success: true,
                plan_id: plan_id,
                message: 'Plan deleted successfully'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
    } catch (error) {
        console.error('Delete plan error:', error);
        return withCors(new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Root endpoint
router.get('/', () => withCors(new Response(
    JSON.stringify({
        service: 'BMGOne Payroll API',
        version: '1.0.0',
        status: 'operational',
        documentation: 'https://bmgone.com/api/docs',
        endpoints: {
            health: 'GET /api/health',
            auth: 'POST /api/auth/login',
            profile: 'GET /api/profile',
            attendance: {
                mark: 'POST /api/attendance/mark',
                view: 'GET /api/attendance',
                last7days: 'GET /api/attendance/last7days'
            },
            leave: {
                balances: 'GET /api/leave/balances',
                apply: 'POST /api/leave/apply',
                applications: 'GET /api/leave/applications'
            },
            holidays: 'GET /api/holidays',
            admin: {
                employees: 'GET /api/admin/employees',
                resetPassword: 'POST /api/admin/reset-password'
            }
        }
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
)));

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
