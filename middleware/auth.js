
import { auth } from '../services/firebase.js';

/**
 * 驗證 Firebase ID Token 的 Middleware
 * 會將驗證後的用戶資訊加入 req.user
 */
export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        if (!auth) {
            throw new Error('Firebase service not initialized');
        }

        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};
