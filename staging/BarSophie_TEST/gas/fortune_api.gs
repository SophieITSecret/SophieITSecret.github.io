// APIキーはスクリプトプロパティで管理する（GAS画面 > プロジェクトの設定 > スクリプトプロパティ）
// プロパティ名: ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');

function doPost(e) {
  // 既存のdoPost（AI用）との判別
  try {
    const body = e.postData.contents;
    const parsed = JSON.parse(body);

    // Stripe Webhookの場合
    if (parsed.type) {
      return handleStripeWebhook(parsed);
    }

    // 既存のAI呼び出しの場合
    return handleAIRequest(parsed);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleStripeWebhook(event) {
  const FIREBASE_URL = 'https://firestore.googleapis.com/v1/projects/bar-sophie/databases/(default)/documents/users';

  if (event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    const status = subscription.status === 'active' ? 'active' : 'free';

    // customerIdからメールアドレスを取得してFirestoreを更新
    // FirebaseのREST APIを使用
    Logger.log('Webhook received: ' + event.type + ' customer: ' + customerId);
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    Logger.log('Subscription deleted: ' + subscription.customer);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ received: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleAIRequest(req) {
  const messages = req.messages;
  const useSearch = req.search === true;

  const payload = {
    model: useSearch ? 'claude-haiku-4-5' : 'claude-sonnet-4-6',
    max_tokens: 2500,
    messages: messages
  };

  if (useSearch) {
    payload.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const raw = response.getContentText();
  const result = JSON.parse(raw);

  let text = '';
  if (result.content && Array.isArray(result.content)) {
    text = result.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
  } else {
    text = raw;
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, text: text }))
    .setMimeType(ContentService.MimeType.JSON);
}
