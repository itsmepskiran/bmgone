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

// Get onboarding dropdown data (departments and designations from database)
router.get('/api/onboarding/dropdowns', async (request, env) => {
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
        
        const department = new URL(request.url).searchParams.get('department');
        
        // Get all active departments
        const departmentsResult = await env.DB.prepare(
            'SELECT department_id, department_name FROM departments WHERE is_active = 1 ORDER BY department_name'
        ).all();
        
        let responseData = {
            departments: departmentsResult.results || []
        };
        
        // Get designations based on department filter
        if (department) {
            console.log('Fetching designations for department:', department);
            const designationsResult = await env.DB.prepare(
                `SELECT designation_id, level, designation_name 
                 FROM designations 
                 WHERE department_id = ? AND is_active = 1 
                 ORDER BY level`
            ).bind(department).all();
            console.log('Designations result:', JSON.stringify(designationsResult));
            responseData.designations = designationsResult.results || [];
            console.log('Response designations count:', responseData.designations.length);
        } else {
            // Return all designations grouped by department
            const allDesignationsResult = await env.DB.prepare(
                `SELECT d.department_id, d.department_name, 
                        json_group_array(
                            json_object(
                                'designation_id', des.designation_id,
                                'level', des.level,
                                'designation_name', des.designation_name
                            )
                        ) as designations
                 FROM departments d
                 LEFT JOIN designations des ON d.department_id = des.department_id AND des.is_active = 1
                 WHERE d.is_active = 1
                 GROUP BY d.department_id
                 ORDER BY d.department_name`
            ).all();
            responseData.all_designations = allDesignationsResult.results || [];
        }
        
        // Get potential reporting managers (employees with designation level M01 and above OR admin/master_admin role)
        // M01 = Assistant Manager, M02 = Manager, M03 = Senior Manager, M04 = Head, B01 = Director
        let employeesQuery = `
            SELECT e.employee_id, e.first_name, e.last_name, e.department, e.position, d.level
            FROM employees e
            LEFT JOIN designations d ON e.position = d.designation_name AND d.is_active = 1
            WHERE e.is_active = 1 
            AND (
                d.level IN ('M01', 'M02', 'M03', 'M04', 'B01')
                OR e.role IN ('admin', 'master_admin')
            )
        `;
        
        if (department) {
            // Include employees from selected department (M01+) AND all admin/master_admin regardless of department
            employeesQuery += ` AND (e.department = ? OR e.role IN ('admin', 'master_admin'))`;
        }
        employeesQuery += ' ORDER BY e.first_name, e.last_name';
        
        console.log('Reporting manager query:', employeesQuery);
        console.log('Department filter:', department);
        
        const employeesResult = department 
            ? await env.DB.prepare(employeesQuery).bind(department).all()
            : await env.DB.prepare(employeesQuery).all();
        
        console.log('Employees result:', JSON.stringify(employeesResult));
        console.log('Employees count:', employeesResult.results ? employeesResult.results.length : 0);
        
        responseData.employees = employeesResult.results || [];
        
        // Add debug info to response
        responseData.debug = {
            requestedDepartment: department,
            designationsCount: responseData.designations ? responseData.designations.length : 0
        };
        
        return withCors(new Response(
            JSON.stringify(responseData),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get onboarding dropdowns error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
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
        
        // Get attendance for last 7 days with total_hours
        const attendance = await env.DB.prepare(
            `SELECT date, login_time, logout_time, total_hours, status 
             FROM attendance 
             WHERE employee_id = ? AND date >= date('now', '-7 days')
             ORDER BY date DESC`
        ).bind(user.employeeId).all();
        
        // Process records to ensure total_hours is calculated if not stored
        const processedAttendance = (attendance.results || []).map(record => {
            if (!record.total_hours && record.login_time && record.logout_time) {
                const login = new Date(record.login_time);
                const logout = new Date(record.logout_time);
                const hours = (logout - login) / (1000 * 60 * 60);
                record.total_hours = parseFloat(hours.toFixed(2));
            }
            return record;
        });
        
        return withCors(new Response(
            JSON.stringify({ attendance: processedAttendance }),
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

// Get pending leave approvals for reporting manager
router.get('/api/leave/pending-approvals', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Admins can see all pending approvals
        // Managers can see pending approvals for their direct reports only
        let query = `
            SELECT la.*, e.first_name, e.last_name, e.employee_id as emp_id, e.department, e.position
            FROM leave_applications la 
            JOIN employees e ON la.employee_id = e.employee_id
            WHERE la.status = 'pending'
        `;
        const params = [];
        
        // If user is a manager (not admin), filter by reporting manager
        if (user.role === 'manager') {
            query += ` AND e.reporting_manager = ?`;
            params.push(user.employeeId);
        }
        // If admin or master_admin, they see all pending approvals
        
        query += ' ORDER BY la.created_at DESC';
        
        const applications = await env.DB.prepare(query).bind(...params).all();
        
        return withCors(new Response(
            JSON.stringify({ 
                pendingApprovals: applications.results,
                totalCount: applications.results.length,
                isManager: user.role === 'manager',
                isAdmin: user.role === 'admin' || user.role === 'master_admin'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get pending approvals error:', error);
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
        
        // Get application details with employee info to check reporting manager
        const application = await env.DB.prepare(`
            SELECT la.*, e.reporting_manager 
            FROM leave_applications la
            JOIN employees e ON la.employee_id = e.employee_id
            WHERE la.id = ?
        `).bind(applicationId).first();
        
        if (!application) {
            return withCors(new Response(
                JSON.stringify({ error: 'Application not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Check if user is the reporting manager or an admin
        if (user.role === 'manager' && application.reporting_manager !== user.employeeId) {
            return withCors(new Response(
                JSON.stringify({ error: 'You can only approve/reject leaves for your direct reports' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
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
            'SELECT employee_id, first_name, last_name, email, phone, department, position, role, join_date, is_active FROM employees ORDER BY join_date DESC'
        ).all();
        
        return withCors(new Response(
            JSON.stringify({ employees: employees.results }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get employees error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Update employee details (Admin/Master Admin only)
router.put('/api/admin/employees/:employeeId', async (request, env) => {
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
        const updateData = await request.json();
        
        // Check if employee exists
        const existingEmployee = await env.DB.prepare(
            'SELECT employee_id, role FROM employees WHERE employee_id = ?'
        ).bind(employeeId).first();
        
        if (!existingEmployee) {
            return withCors(new Response(
                JSON.stringify({ error: 'Employee not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Prevent editing master_admin (only master_admin can edit themselves)
        if (existingEmployee.role === 'master_admin' && user.employeeId !== employeeId) {
            return withCors(new Response(
                JSON.stringify({ error: 'Cannot edit master admin details' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Build update query dynamically based on provided fields
        const allowedFields = [
            'first_name', 'last_name', 'email', 'phone', 'alternate_phone',
            'date_of_birth', 'gender', 'address', 'city', 'state', 'pincode',
            'department', 'position', 'role', 'reporting_manager', 'salary',
            'bank_name', 'bank_account', 'ifsc_code', 'pan_number', 'aadhaar_number',
            'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation'
        ];
        
        const updates = [];
        const values = [];
        
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(updateData[field]);
            }
        }
        
        if (updates.length === 0) {
            return withCors(new Response(
                JSON.stringify({ error: 'No fields to update' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Add updated_at timestamp
        updates.push('updated_at = datetime("now")');
        
        // Add employeeId to values
        values.push(employeeId);
        
        const query = `UPDATE employees SET ${updates.join(', ')} WHERE employee_id = ?`;
        
        await env.DB.prepare(query).bind(...values).run();
        
        // Log audit
        await logAudit(env, user.employeeId, 'employee_update', 'employees', employeeId, 
            null, updateData, 
            request.headers.get('CF-Connecting-IP'), request.headers.get('User-Agent'));
        
        return withCors(new Response(
            JSON.stringify({ 
                success: true, 
                message: 'Employee updated successfully',
                employeeId: employeeId
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Update employee error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Get single employee details (Admin/Master Admin only)
router.get('/api/admin/employees/:employeeId', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user || (user.role !== 'admin' && user.role !== 'master_admin')) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const { employeeId } = request.params;
        
        const employee = await env.DB.prepare(
            `SELECT employee_id, first_name, last_name, email, phone, alternate_phone,
                    date_of_birth, gender, address, city, state, pincode,
                    department, position, role, reporting_manager, join_date, is_active,
                    salary, bank_name, bank_account, ifsc_code, pan_number, aadhaar_number,
                    emergency_contact_name, emergency_contact_phone, emergency_contact_relation
             FROM employees WHERE employee_id = ?`
        ).bind(employeeId).first();
        
        if (!employee) {
            return withCors(new Response(
                JSON.stringify({ error: 'Employee not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        return withCors(new Response(
            JSON.stringify({ employee }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Get employee error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Update employee status (Admin/Master Admin only) - simplified to use is_active only
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
        const { status, reason, subreason, effectiveDate, notes } = await request.json();
        
        // Validate status - map to is_active (1 = active, 0 = inactive)
        const isActive = status === 'active' ? 1 : 0;
        
        // Get current employee data for audit
        const currentEmployee = await env.DB.prepare(
            'SELECT employee_id, first_name, last_name, is_active FROM employees WHERE employee_id = ?'
        ).bind(employeeId).first();
        
        if (!currentEmployee) {
            return withCors(new Response(
                JSON.stringify({ error: 'Employee not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Update employee status using only is_active column
        await env.DB.prepare(
            'UPDATE employees SET is_active = ?, updated_at = datetime("now") WHERE employee_id = ?'
        ).bind(isActive, employeeId).run();
        
        // Log audit
        await logAudit(env, user.employeeId, 'employee_status_update', 'employees', employeeId, 
                      { old_status: currentEmployee.is_active === 1 ? 'active' : 'inactive' }, 
                      { new_status: status, reason: reason || subreason, notes: notes }, 
                      request.headers.get('CF-Connecting-IP'), request.headers.get('User-Agent'));
        
        return withCors(new Response(
            JSON.stringify({ 
                success: true, 
                message: 'Employee status updated successfully',
                employeeId: employeeId,
                newStatus: status
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Update employee status error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
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

// Monthly Attendance Report Endpoint
router.get('/api/reports/monthly-attendance', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Only admins, managers, and employees viewing their own report
        const { month, year, employeeId, format = 'json' } = new URL(request.url).searchParams;
        
        if (!month || !year) {
            return withCors(new Response(
                JSON.stringify({ error: 'Month and year are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        const targetEmployeeId = employeeId || user.employeeId;
        
        // Check permissions - can only view own report unless admin/manager
        if (targetEmployeeId !== user.employeeId && 
            user.role !== 'admin' && user.role !== 'master_admin' && user.role !== 'manager') {
            return withCors(new Response(
                JSON.stringify({ error: 'Insufficient permissions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Get employee details
        const employee = await env.DB.prepare(
            'SELECT employee_id, first_name, last_name, department, position FROM employees WHERE employee_id = ?'
        ).bind(targetEmployeeId).first();
        
        if (!employee) {
            return withCors(new Response(
                JSON.stringify({ error: 'Employee not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Get attendance for the month
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];
        
        const attendance = await env.DB.prepare(
            `SELECT date, login_time, logout_time, total_hours, status 
             FROM attendance 
             WHERE employee_id = ? AND date >= ? AND date <= ?
             ORDER BY date`
        ).bind(targetEmployeeId, startDate, endDate).all();
        
        // Get approved leaves for the month
        const leaves = await env.DB.prepare(
            `SELECT start_date, end_date, total_days, leave_type, status
             FROM leave_applications 
             WHERE employee_id = ? AND status = 'approved' 
             AND ((start_date >= ? AND start_date <= ?) OR (end_date >= ? AND end_date <= ?))`
        ).bind(targetEmployeeId, startDate, endDate, startDate, endDate).all();
        
        // Calculate statistics
        const attendanceRecords = attendance.results || [];
        const leaveRecords = leaves.results || [];
        
        let totalWorkingDays = 0;
        let daysPresent = 0;
        let daysAbsent = 0;
        let totalLoginHours = 0;
        let daysOnLeave = 0;
        
        const dailyRecords = [];
        
        // Generate all days in the month
        const daysInMonth = new Date(year, parseInt(month), 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const dateObj = new Date(currentDate);
            const dayOfWeek = dateObj.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // Check if it's a holiday
            const holiday = await env.DB.prepare(
                'SELECT name FROM holidays WHERE date = ? AND is_active = 1'
            ).bind(currentDate).first();
            
            const isHoliday = !!holiday;
            
            // Find attendance record for this day
            const attendanceRecord = attendanceRecords.find(a => a.date === currentDate);
            
            // Check if on leave
            const onLeave = leaveRecords.some(leave => {
                const leaveStart = new Date(leave.start_date);
                const leaveEnd = new Date(leave.end_date);
                const checkDate = new Date(currentDate);
                return checkDate >= leaveStart && checkDate <= leaveEnd;
            });
            
            let status = 'working';
            let loginTime = '';
            let logoutTime = '';
            let hoursWorked = 0;
            
            if (isWeekend) {
                status = 'weekend';
            } else if (isHoliday) {
                status = 'holiday';
            } else if (onLeave) {
                status = 'on_leave';
                daysOnLeave++;
            } else if (attendanceRecord) {
                if (attendanceRecord.login_time) {
                    status = 'present';
                    daysPresent++;
                    loginTime = new Date(attendanceRecord.login_time).toLocaleTimeString();
                    
                    if (attendanceRecord.logout_time) {
                        logoutTime = new Date(attendanceRecord.logout_time).toLocaleTimeString();
                        hoursWorked = attendanceRecord.total_hours || 
                            ((new Date(attendanceRecord.logout_time) - new Date(attendanceRecord.login_time)) / (1000 * 60 * 60));
                        totalLoginHours += hoursWorked;
                    }
                } else {
                    status = 'absent';
                    daysAbsent++;
                }
                totalWorkingDays++;
            } else {
                // Check if date is in the past
                const today = new Date().toISOString().split('T')[0];
                if (currentDate < today) {
                    status = 'absent';
                    daysAbsent++;
                    totalWorkingDays++;
                } else {
                    status = 'future';
                }
            }
            
            dailyRecords.push({
                date: currentDate,
                day: day,
                status,
                loginTime,
                logoutTime,
                hoursWorked: hoursWorked ? hoursWorked.toFixed(2) : '0.00',
                isWeekend,
                isHoliday: isHoliday ? holiday.name : null
            });
        }
        
        const report = {
            employee: {
                id: employee.employee_id,
                name: `${employee.first_name} ${employee.last_name}`,
                department: employee.department,
                position: employee.position
            },
            month: parseInt(month),
            year: parseInt(year),
            summary: {
                totalWorkingDays,
                daysPresent,
                daysAbsent,
                daysOnLeave,
                totalLoginHours: totalLoginHours.toFixed(2),
                attendancePercentage: totalWorkingDays > 0 ? ((daysPresent / totalWorkingDays) * 100).toFixed(2) : '0.00'
            },
            dailyRecords
        };
        
        // If CSV format requested
        if (format === 'csv') {
            let csv = 'Date,Day,Status,Login Time,Logout Time,Hours Worked,Notes\n';
            dailyRecords.forEach(record => {
                const notes = record.isHoliday ? `Holiday: ${record.isHoliday}` : 
                             record.isWeekend ? 'Weekend' : '';
                csv += `${record.date},${record.day},${record.status},${record.loginTime},${record.logoutTime},${record.hoursWorked},"${notes}"\n`;
            });
            csv += `\nSummary,,,,,\n`;
            csv += `Total Working Days,${totalWorkingDays},,,,\n`;
            csv += `Days Present,${daysPresent},,,,\n`;
            csv += `Days Absent,${daysAbsent},,,,\n`;
            csv += `Days on Leave,${daysOnLeave},,,,\n`;
            csv += `Total Login Hours,${totalLoginHours.toFixed(2)},,,,\n`;
            csv += `Attendance %,${report.summary.attendancePercentage}%,,,,\n`;
            
            return withCors(new Response(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="attendance_${targetEmployeeId}_${year}_${month}.csv"`
                }
            }));
        }
        
        return withCors(new Response(
            JSON.stringify(report),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Monthly attendance report error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
});

// Check for absconding employees (3 continuous days absence)
router.post('/api/admin/check-absconding', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return withCors(new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Only admin can run this check
        if (user.role !== 'admin' && user.role !== 'master_admin') {
            return withCors(new Response(
                JSON.stringify({ error: 'Insufficient permissions' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            ));
        }
        
        // Get all active employees
        const employees = await env.DB.prepare(
            'SELECT employee_id, first_name, last_name, is_active FROM employees WHERE is_active = 1 AND role = "staff"'
        ).all();
        
        const abscondingEmployees = [];
        const today = new Date();
        
        for (const emp of employees.results) {
            // Check last 5 working days for absence pattern
            let continuousAbsences = 0;
            let checkDate = new Date(today);
            
            // Check backwards for continuous absences (skip weekends and holidays)
            for (let i = 0; i < 10; i++) { // Check up to 10 days back
                const dateStr = checkDate.toISOString().split('T')[0];
                const dayOfWeek = checkDate.getDay();
                
                // Skip weekends
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                
                // Check if holiday
                const holiday = await env.DB.prepare(
                    'SELECT 1 FROM holidays WHERE date = ? AND is_active = 1'
                ).bind(dateStr).first();
                
                if (holiday) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                
                // Check if on approved leave
                const onLeave = await env.DB.prepare(
                    `SELECT 1 FROM leave_applications 
                     WHERE employee_id = ? AND status = 'approved' 
                     AND ? BETWEEN start_date AND end_date`
                ).bind(emp.employee_id, dateStr).first();
                
                if (onLeave) {
                    // Reset counter if on approved leave
                    continuousAbsences = 0;
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                
                // Check attendance
                const attendance = await env.DB.prepare(
                    'SELECT login_time FROM attendance WHERE employee_id = ? AND date = ?'
                ).bind(emp.employee_id, dateStr).first();
                
                if (!attendance || !attendance.login_time) {
                    continuousAbsences++;
                } else {
                    // Found attendance, break the streak
                    break;
                }
                
                checkDate.setDate(checkDate.getDate() - 1);
            }
            
            // If 3 or more continuous absences, mark as absconding
            if (continuousAbsences >= 3) {
                // Update employee status to inactive (absconding)
                await env.DB.prepare(
                    'UPDATE employees SET is_active = 0, updated_at = datetime("now") WHERE employee_id = ?'
                ).bind(emp.employee_id).run();
                
                // Log the absconding status change
                await logAudit(env, user.employeeId, 'employee_status_update', 'employees', emp.employee_id, 
                    { old_status: 'active' }, 
                    { new_status: 'absconding', reason: 'Continuous absence for 3 or more working days', notes: 'Auto-detected by system' }, 
                    request.headers.get('CF-Connecting-IP'), request.headers.get('User-Agent'));
                
                abscondingEmployees.push({
                    employeeId: emp.employee_id,
                    name: `${emp.first_name} ${emp.last_name}`,
                    continuousAbsences,
                    status: 'marked_as_absconding'
                });
            }
        }
        
        return withCors(new Response(
            JSON.stringify({ 
                message: 'Absconding check completed',
                abscondingEmployees,
                totalChecked: employees.results.length,
                abscondingCount: abscondingEmployees.length
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
        
    } catch (error) {
        console.error('Check absconding error:', error);
        return withCors(new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
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
