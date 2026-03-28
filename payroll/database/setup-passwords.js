// Generate bcrypt hashes for test passwords
const bcrypt = require('bcryptjs');

async function generatePasswords() {
    const passwords = {
        'BMGHYD00001': 'admin123',      // Master Admin
        'BMGHYD00002': 'admin123',      // Admin  
        'BMGHYD12345': 'john123'        // Staff (first login)
    };
    
    const hashes = {};
    
    for (const [employeeId, password] of Object.entries(passwords)) {
        const hash = await bcrypt.hash(password, 10);
        hashes[employeeId] = hash;
        console.log(`${employeeId}: ${password} -> ${hash}`);
    }
    
    return hashes;
}

generatePasswords().then(hashes => {
    console.log('Generated hashes:', hashes);
}).catch(console.error);
