import { google } from 'googleapis';

/**
 * 使用YouTube Data API獲取影片留言 (含子留言)
 * @param {string} videoId - YouTube影片ID
 * @param {string} accessToken - 用戶的OAuth access token
 * @param {number} maxResults - 最大留言數（預設100）
 * @returns {Promise<Array>} 留言陣列
 */
export async function fetchVideoComments(videoId, accessToken, maxResults = 100) {
    try {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });

        const youtube = google.youtube({ version: 'v3', auth });

        let allComments = [];
        let pageToken = null;

        console.log(`Fetching comments for video: ${videoId}`);

        do {
            const limit = Math.min(100, maxResults - allComments.length);

            // 必須加入 'replies' 到 part 才能獲取子留言
            const response = await youtube.commentThreads.list({
                part: ['snippet', 'replies'],
                videoId: videoId,
                maxResults: limit,
                pageToken: pageToken,
                textFormat: 'plainText'
            });

            const items = response.data.items || [];
            if (items.length === 0) break;

            for (const item of items) {
                // 1. 處理頂層留言
                const topLevel = item.snippet.topLevelComment.snippet;
                const topCommment = {
                    id: item.id,
                    text: topLevel.textOriginal,
                    author: topLevel.authorDisplayName,
                    likeCount: topLevel.likeCount,
                    replyCount: item.snippet.totalReplyCount,
                    publishedAt: topLevel.publishedAt,
                    authorImage: topLevel.authorProfileImageUrl,
                    isReply: false
                };
                allComments.push(topCommment);

                // 2. 處理子留言 (如果有且 API 有回傳)
                if (item.replies && item.replies.comments) {
                    const replies = item.replies.comments.map(reply => ({
                        id: reply.id,
                        text: reply.snippet.textOriginal,
                        author: reply.snippet.authorDisplayName,
                        likeCount: reply.snippet.likeCount,
                        replyCount: 0,
                        publishedAt: reply.snippet.publishedAt,
                        authorImage: reply.snippet.authorProfileImageUrl,
                        isReply: true,
                        parentId: item.id
                    }));
                    // 把子留言也加入列表
                    allComments.push(...replies);
                }

                if (allComments.length >= maxResults) break;
            }

            console.log(`Fetched ${allComments.length} comments so far...`);
            pageToken = response.data.nextPageToken;

        } while (pageToken && allComments.length < maxResults);

        // 確保不超過請求數量
        const finalComments = allComments.slice(0, maxResults);
        console.log(`Total comments fetched: ${finalComments.length}`);
        return finalComments;

    } catch (error) {
        console.error('YouTube API Error:', error);
        throw new Error(`Failed to fetch comments: ${error.message}`);
    }
}
