
import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let db;
let auth;

try {
    let serviceAccount;

    // 1. 優先從環境變數讀取 (雲端部署模式)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        const jsonString = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
        serviceAccount = JSON.parse(jsonString);
        console.log('✅ Firebase Init: Using Environment Variable Credentials');
    }
    // 2. 本地開發模式讀取檔案
    else {
        serviceAccount = require('../serviceAccountKey.json');
        console.log('✅ Firebase Init: Using Local File Credentials');
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    db = admin.firestore();
    auth = admin.auth();

    console.log('✅ Firebase Admin Initialized Successfully');
} catch (error) {
    console.error('❌ Firebase Initialization Error:', error.message);
    console.error('⚠️  請確保設定了 FIREBASE_SERVICE_ACCOUNT_BASE64 環境變數 或 backend 目錄下有 serviceAccountKey.json 檔案');
}

export { admin, db, auth };
