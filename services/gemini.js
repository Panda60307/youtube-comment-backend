import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️ Warning: GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function analyzeComments(comments, targetLanguage = 'Traditional Chinese') {
    // 使用 Gemini 2.5 Flash (最新穩定版，上下文窗口大，適合一次處理)
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash"
    });

    // 為了節省 Token，我們只傳送必要欄位給 AI
    const simplifiedComments = comments.map((c, idx) => ({
        index: idx,
        text: c.text,
        likes: c.likeCount,
        replies: c.replyCount
    }));

    const prompt = `You are an expert YouTube comment analyst. Your task is to analyze the following ${simplifiedComments.length} comments deeply.

Target Language: ${targetLanguage} (Output ALL summaries, reasons, and ideas in this language)

Output Format: PURE JSON object (Do NOT use Markdown code blocks like \`\`\`json).

JSON Structure:
{
  "summary": "A concise executive summary (50-100 words). Focus on the main discussion points and atmosphere. Ignore spam.",
  "sentiment_score": 0-100 (0=Toxic/Hate, 50=Neutral, 100=Love/Support),
  "video_ideas": ["Idea 1", "Idea 2", "Idea 3"] (Derived from user requests),
  "highlighted_comments": [
    { "index": <original_index>, "reason": "Why this is valuable (in ${targetLanguage})" }
  ],
  "classifications": [
    { "i": <index>, "c": <category_id> }
  ]
}

Classification Rules (Strictly map to these IDs):
1: Constructive/Ideas (Specific suggestions for improvement, "I hope you do X next time", or future topic requests).
2: Questions (Genuine information-seeking inquiries only. EXCLUDE rhetorical questions, sarcasm, jokes ending in '?', or rhetorical praise like "How can this be so good?").
3: Positive (Praise, appreciation, "Love this", support).
4: Neutral/Personal/Jokes (Sharing personal stories "I went there too", stating facts, jokes, sarcasm, emojis, or comments that don't fit other categories. This is the catch-all bucket).
5: Negative (Criticism, complaints, hate speech, or harsh feedback).

IMPORTANT CONSTRAINTS:
1. The "classifications" array MUST contain exactly ${simplifiedComments.length} items.
2. Every comment provided in the input MUST have a corresponding classification entry.
3. strictly map the "i" field to the input "index".

Input Data:
${JSON.stringify(simplifiedComments)}
`;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();

        console.log('Gemini Raw Response:', text.substring(0, 50) + '...');

        const aiData = safeJSONParse(text);

        if (!aiData) {
            throw new Error("Failed to parse AI response as JSON");
        }

        // 將 AI 的分析結果與原始留言資料合併
        // 1. 處理分類
        let matchCount = 0;
        const classifiedComments = comments.map((comment, idx) => {
            // 使用寬鬆比對 (==) 以容許字串/數字差異
            const cls = aiData.classifications?.find(c => c.i == idx);
            if (cls) matchCount++;
            return {
                ...comment,
                category: cls ? Number(cls.c) : 4 // 確保 category 是數字，預設中性
            };
        });
        console.log(`Classified ${matchCount}/${comments.length} comments.`);

        // 2. 處理亮點留言 (找出原始物件)
        const highlights = aiData.highlighted_comments?.map(h => {
            const original = comments[h.index];
            if (!original) return null;
            return {
                ...original,
                highlightReason: h.reason
            };
        }).filter(Boolean) || [];

        return {
            summary: aiData.summary || "無法產生摘要",
            sentimentScore: aiData.sentiment_score || 50,
            videoIdeas: aiData.video_ideas || [],
            highlights: highlights,
            results: classifiedComments // 這是列表用的完整資料
        };

    } catch (error) {
        console.error('Gemini Analysis Failed:', error);
        throw error;
    }
}

/**
 * 嘗試修復並解析不完美的 JSON
 */
function safeJSONParse(str) {
    try {
        // 1. 移除 Markdown code block
        str = str.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(str);
    } catch (e) {
        console.warn("Standard JSON parse failed, attempting fix...");
        try {
            // 2. 嘗試修復常見錯誤：移除尾部逗號
            let fixed = str.replace(/,\s*([\]}])/g, '$1');
            return JSON.parse(fixed);
        } catch (e2) {
            console.error("JSON Fix failed:", e2);
            // 如果還是失敗，嘗試只修復到最後一個有效閉合
            const lastClose = str.lastIndexOf('}');
            if (lastClose > 0) {
                try {
                    return JSON.parse(str.substring(0, lastClose + 1));
                } catch (e3) { return null; }
            }
            return null;
        }
    }
}
