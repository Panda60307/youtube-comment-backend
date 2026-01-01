import express from 'express';
import { fetchVideoComments } from '../services/youtube.js';
import { analyzeComments } from '../services/gemini.js';
import { db } from '../services/firebase.js';
import { verifyToken } from '../middleware/auth.js';
import { Timestamp } from 'firebase-admin/firestore';

const router = express.Router();

/**
 * POST /api/analyze
 * Body: { videoId: string, accessToken: string, count: number, language: string }
 * Header: Authorization: Bearer <Firebase_ID_Token>
 */
router.post('/analyze', verifyToken, async (req, res) => {
    const { uid, email } = req.user;
    const { videoId, accessToken, count = 100, language = 'Traditional Chinese' } = req.body;

    if (!videoId) return res.status(400).json({ error: 'videoId is required' });
    if (!accessToken) return res.status(400).json({ error: 'accessToken is required' });

    console.log(`[Request] User: ${email} (${uid}) requesting analysis for ${videoId}`);

    let userQuotaInfo = null;

    try {
        // --- Phase 1: Check & Deduct Quota (Firestore Transaction) ---
        await db.runTransaction(async (t) => {
            const userRef = db.collection('users').doc(uid);
            const doc = await t.get(userRef);

            let userData;
            const now = new Date();
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

            if (!doc.exists) {
                // 新用戶：初始化資料
                userData = {
                    email: email || 'unknown',
                    subscriptionStatus: 'free',
                    quotaLimit: 5, // 免費版每月 5 次
                    usageCount: 0,
                    quotaResetDate: Timestamp.fromDate(nextMonth),
                    createdAt: Timestamp.fromDate(now)
                };
                t.set(userRef, userData);
            } else {
                userData = doc.data();

                // 檢查是否需要重置額度 (新的一個月)
                if (userData.quotaResetDate.toDate() < now) {
                    userData.usageCount = 0;
                    userData.quotaResetDate = Timestamp.fromDate(nextMonth);
                    // 如果是 Pro 用戶，可能這裡要重設回 Pro 的額度，暫時保持原邏輯只重設 usage
                }
            }

            // 檢查額度
            if (userData.usageCount >= userData.quotaLimit) {
                throw new Error('QUOTA_EXCEEDED');
            }

            // 扣除次數
            t.update(userRef, {
                usageCount: userData.usageCount + 1,
                quotaResetDate: userData.quotaResetDate // 確保日期有被更新(如果是重置情況)
            });

            // 準備回傳給前端的額度資訊
            userQuotaInfo = {
                subscriptionStatus: userData.subscriptionStatus,
                usageCount: userData.usageCount + 1,
                quotaLimit: userData.quotaLimit,
                remaining: userData.quotaLimit - (userData.usageCount + 1)
            };
        });

    } catch (e) {
        if (e.message === 'QUOTA_EXCEEDED') {
            return res.status(403).json({
                error: 'Quota Exceeded',
                message: '您的免費額度已用完，請升級以繼續使用。',
                isQuotaError: true
            });
        }
        console.error('Firestore Transaction Error:', e);
        return res.status(500).json({ error: 'Database Error', details: e.message });
    }

    // --- Phase 2: YouTube & Gemini Analysis ---
    try {
        console.log(`[Step 1] Fetching comments for video: ${videoId}`);
        let comments;
        try {
            comments = await fetchVideoComments(videoId, accessToken, count);
        } catch (ytError) {
            return res.status(401).json({ error: 'YouTube API Error', details: ytError.message });
        }

        if (!comments || comments.length === 0) {
            return res.json({
                message: 'No comments found',
                results: [],
                summary: "沒有留言",
                videoIdeas: [],
                stats: { total: 0 },
                userQuota: userQuotaInfo
            });
        }

        console.log(`[Step 2] Analyzed ${comments.length} comments. Sending to Gemini...`);
        const analysisData = await analyzeComments(comments, language);

        // --- Phase 3: Response ---
        res.json({
            videoId,
            totalComments: comments.length,
            ...analysisData,
            userQuota: userQuotaInfo // 附帶最新的額度資訊
        });

    } catch (error) {
        console.error('Analysis error:', error);
        // 注意：這裡原則上不退還額度，因為 API 已經呼叫了。
        // 如果想要「失敗不扣款」，需要再包一層 catch 去做 rollback，但較複雜。
        res.status(500).json({
            error: 'Analysis failed',
            details: error.message
        });
    }
});

/**
 * GET /api/status
 * Header: Authorization: Bearer <Firebase_ID_Token>
 */
router.get('/status', verifyToken, async (req, res) => {
    const { uid, email } = req.user;
    console.log(`[Status Check] User: ${email} (${uid})`);

    try {
        const userRef = db.collection('users').doc(uid);
        const doc = await userRef.get();

        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        if (!doc.exists) {
            // 如果連紀錄都沒有，這真的是新帳號，但我們不要讓它在顯示時產生誤導
            // 回傳 0 次已用，5 次上限
            return res.json({
                subscriptionStatus: 'free',
                usageCount: 0,
                quotaLimit: 5,
                remaining: 5
            });
        }

        let userData = doc.data();

        // 核心修正：強制檢查重置日期
        if (userData.quotaResetDate && userData.quotaResetDate.toDate() < now) {
            console.log(`[Status] resetting quota for ${email}`);
            await userRef.update({
                usageCount: 0,
                quotaResetDate: Timestamp.fromDate(nextMonth)
            });
            userData.usageCount = 0;
            userData.quotaResetDate = Timestamp.fromDate(nextMonth);
        }

        const remaining = Math.max(0, userData.quotaLimit - userData.usageCount);
        console.log(`[Status Result] ${email}: ${userData.usageCount}/${userData.quotaLimit} (Rem: ${remaining})`);

        return res.json({
            subscriptionStatus: userData.subscriptionStatus || 'free',
            usageCount: userData.usageCount,
            quotaLimit: userData.quotaLimit,
            remaining: remaining
        });

    } catch (e) {
        console.error('Fetch Status Error:', e);
        return res.status(500).json({ error: 'Database Error', details: e.message });
    }
});

export default router;
