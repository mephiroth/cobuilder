import mimo, { MODELS } from './client';

export interface ModerateResult {
  approved: boolean;
  reason?: string;
}

export async function moderateContent(
  text: string,
  _images?: string[]
): Promise<ModerateResult> {
  try {
    const response = await mimo.chat.completions.create({
      model: MODELS.moderate,
      messages: [{
        role: 'user',
        content: `请审核以下内容是否适合在产品反馈平台展示。

审核维度：
1. 政治敏感
2. 色情暴力
3. 广告垃圾
4. 人身攻击
5. 恶意内容

待审核内容：
"${text}"

只输出 JSON: { "approved": true/false, "reason": "拒绝原因，通过则省略" }`
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 256,
    });

    const content = response.choices[0].message.content || '{"approved": true}';
    return JSON.parse(content) as ModerateResult;
  } catch {
    // 审核异常时默认放行
    return { approved: true, reason: '审核服务异常，自动放行' };
  }
}
