const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `將以下YouTube留言分類為5類並回傳JSON陣列。
類別定義：
1=建設性反饋 (具體改進建議, 技術指正)
2=高價值討論 (深入提問, 補充資訊)
3=正面鼓勵 (讚美, 感謝)
4=中性 (無明確意見, 閒聊)
5=需過濾 (垃圾, 攻擊性, 無意義)

嚴格JSON回傳格式：
[{"i":0,"c":1,"r":"原因短語"}]`;

async function analyzeComments(comments) {
    try {
        // 準備Prompt數據 (只傳送必要欄位以節省Token)
        const commentsPayload = comments.map((c, idx) => ({
            i: idx, // 批次內索引
            t: c.text // 留言內容
        }));

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: JSON.stringify(commentsPayload) }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;

        // 解析結果
        let parsedResults = [];
        try {
            const jsonStr = content.replace(/```json\n?|\n?```/g, '');
            const parsed = JSON.parse(jsonStr);

            if (Array.isArray(parsed)) {
                parsedResults = parsed;
            } else if (parsed.comments) {
                parsedResults = parsed.comments;
            } else {
                // 嘗試找第一個 array value
                parsedResults = Object.values(parsed).find(v => Array.isArray(v)) || [];
            }
        } catch (e) {
            console.error('Failed to parse GPT response:', content);
            throw new Error('AI 回傳格式錯誤');
        }

        // 將結果映射回原始ID (需要caller再做一次mapping，這裡回傳帶有索引的結果)
        return parsedResults;

    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw error;
    }
}

module.exports = { analyzeComments };
