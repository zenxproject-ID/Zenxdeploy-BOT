const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

// Inisialisasi database default
const defaultDatabase = {
    users: {},
    websites: {},
    stats: {
        totalUsers: 0,
        totalWebsites: 0,
        lastBackup: null
    }
};

// Load database dari file
function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading database:', error);
    }
    return JSON.parse(JSON.stringify(defaultDatabase));
}

// Save database ke file
function saveDatabase(db) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving database:', error);
        return false;
    }
}

// Fungsi database
const db = {
    // User management
    saveUser(userId, userData) {
        const db = loadDatabase();
        if (!db.users[userId]) {
            db.stats.totalUsers++;
        }
        db.users[userId] = {
            ...userData,
            id: userId,
            joined_at: new Date().toISOString(),
            last_active: new Date().toISOString()
        };
        saveDatabase(db);
    },

    getUser(userId) {
        const db = loadDatabase();
        return db.users[userId] || null;
    },

    getAllUsers() {
        const db = loadDatabase();
        return db.users;
    },

    // Website management
    saveWebsite(websiteData) {
        const db = loadDatabase();
        const webName = websiteData.name;
        
        if (!db.websites[webName]) {
            db.stats.totalWebsites++;
        }
        
        db.websites[webName] = {
            ...websiteData,
            created_at: new Date().toISOString()
        };
        
        // Tambahkan ke user websites
        if (!db.users[websiteData.ownerId]) {
            db.users[websiteData.ownerId] = {
                id: websiteData.ownerId,
                first_name: websiteData.ownerName,
                username: '',
                joined_at: new Date().toISOString(),
                last_active: new Date().toISOString()
            };
        }
        
        saveDatabase(db);
        return true;
    },

    getWebsite(webName) {
        const db = loadDatabase();
        return db.websites[webName] || null;
    },

    getAllWebsites() {
        const db = loadDatabase();
        return db.websites;
    },

    getUserWebsites(userId) {
        const db = loadDatabase();
        const userWebsites = [];
        
        for (const [webName, website] of Object.entries(db.websites)) {
            if (website.ownerId === userId) {
                userWebsites.push(webName);
            }
        }
        
        return userWebsites;
    },

    deleteWebsite(webName) {
        const db = loadDatabase();
        if (db.websites[webName]) {
            delete db.websites[webName];
            db.stats.totalWebsites = Math.max(0, db.stats.totalWebsites - 1);
            saveDatabase(db);
            return true;
        }
        return false;
    },

    // Stats
    getStats() {
        const db = loadDatabase();
        return db.stats;
    },

    updateStats(newStats) {
        const db = loadDatabase();
        db.stats = { ...db.stats, ...newStats };
        saveDatabase(db);
    }
};

// Initialize database jika belum ada
if (!fs.existsSync(DB_PATH)) {
    saveDatabase(defaultDatabase);
    console.log('✅ Database initialized successfully');
} else {
    console.log('✅ Database loaded successfully');
}

module.exports = db;