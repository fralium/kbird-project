/** 把一次 LLM 调用的模型名和 token 用量格式化成一行说明。 */
export function formatAiUsageLine(usage) {
  const model = usage?.model ? String(usage.model) : '未返回';
  const total = Number(usage?.totalTokens);
  const prompt = Number(usage?.promptTokens);
  const completion = Number(usage?.completionTokens);
  if (!Number.isFinite(total)) {
    return `模型：${model} · 本次用量未返回`;
  }
  const parts = [`模型：${model}`, `本次约 ${total} token`];
  if (Number.isFinite(prompt) || Number.isFinite(completion)) {
    const inputText = Number.isFinite(prompt) ? prompt : '—';
    const outputText = Number.isFinite(completion) ? completion : '—';
    parts.push(`输入 ${inputText} / 输出 ${outputText}`);
  }
  return parts.join(' · ');
}
