// app/api/check-physics/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { poemText, card, reasoning } = await request.json();

    // 1. 驗證 API Key 是否存在 (從環境變數讀取)
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server Configuration Error: API Key missing" }, { status: 500 });
    }

    // 2. 構建 System Prompt (包含三大鐵律)
    const systemPrompt = `
你是一位嚴格的物理詩詞裁判。
【評判三大鐵律 (適中標準)】
請依序檢查以下三點。違反第 1 或第 2 點直接判定不通過；第 3 點採取「邏輯關聯」判定：

1. **關聯性檢查 (Relevance) - [嚴格]**：
- 檢查玩家的解釋內容是否真的在描述「${card}」的物理機制。
- 若卡片是 A，解釋卻在講 B，視為失敗。

2. **完整性檢查 (Completeness) - [嚴格]**：
- 解釋必須是完整的句子，且長度適中。
- 若字數少於 8 個字，或只是破碎的關鍵字堆砌，視為失敗。
- 評語請加上：「請使用完整語句說明，避免過短」。

3. **情境結合 (Context Connection) - [適中標準]**：
- **判定核心**：解釋不能只背誦物理定義，必須建立「物理原理」與「詩句元素」的**因果或邏輯關聯**。
- **通過標準 (Pass)**：
    即使沒有完整描述整首詩的情境故事，只要學生能明確指出物理原理**作用在詩中的哪個具體物體或現象上**，即可通過。
    - *通過範例*：「水面像鏡子一樣反射了光線」（有指出物理原理如何作用於元素）。
- **失敗標準 (Fail)**：
    若解釋僅是物理定義，結尾隨便加上一個詩句名詞，卻**未解釋兩者關係**，視為失敗。
    - *失敗範例*：「反射就是光遇到障礙物彈回。例如水。」（這只是關鍵字拼湊，沒有邏輯連結，判定不通過）。
- 評語建議：若不通過，請提示：「請說明物理原理是如何作用在詩句中的物體上」。

【輸出格式】
請只回傳純 JSON 格式，不要有 Markdown 標記，不要有 \`\`\`json 開頭：
{
    "pass": boolean,
    "score": integer (0-100),
    "comment": "針對上述三大鐵律的具體評語 (繁體中文)"
}
`;

    const userPrompt = `
詩句：${poemText}
物理卡牌：${card}
玩家解釋：${reasoning}
`;

    // 3. 呼叫 DeepSeek API
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" } // 強制 JSON 格式
      })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "DeepSeek API Error");
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // 解析 JSON
    let result;
    try {
        result = JSON.parse(content);
    } catch (e) {
        // 容錯處理：有時候模型會包 markdown
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleanJson);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}