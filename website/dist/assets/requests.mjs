import {requestService} from './config.mjs';
const form = document.querySelector('#request-form');
const input = document.querySelector('#request-text');
const button = form.querySelector('button');
const feedback = document.querySelector('#request-feedback');
let attempt;
if (requestService.enabled) {
  button.disabled = false;
  feedback.textContent = '请勿提交密码等敏感信息。';
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!requestService.enabled || button.disabled) return;
  const text = input.value.trim();
  if (!text) { feedback.textContent = '请填写需求。'; return; }
  if (!attempt || attempt.text !== text) attempt = {event_id:crypto.randomUUID(), text};
  button.disabled = true;
  feedback.textContent = '正在提交…';
  try {
    const response = await fetch(new URL('/v1/feature-requests', requestService.origin), {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(attempt), signal:AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (typeof result.accepted !== 'boolean' || result.event_id !== attempt.event_id) throw new Error();
    feedback.textContent = '已记录，感谢反馈。需求会定期整理评估。';
    input.value = '';
    attempt = undefined;
  } catch {
    feedback.textContent = '未能确认提交，请重试。你的内容已保留。';
  } finally { button.disabled = false; }
});