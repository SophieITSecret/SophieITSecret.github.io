// APIキーはスクリプトプロパティで管理する（GAS画面 > プロジェクトの設定 > スクリプトプロパティ）
// プロパティ名: ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');

function doPost(e) {
  try {
    const body = e.postData.contents;
    const parsed = JSON.parse(body);
    if (parsed.type) {
      return handleStripeWebhook(parsed);
    }
    return handleAIRequest(parsed);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleStripeWebhook(event) {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.client_reference_id || '';
    if (uid) {
      updateFirestoreUserStatus(uid, 'active');
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const uid = subscription.metadata?.firebase_uid || '';
    if (uid) {
      updateFirestoreUserStatus(uid, 'free');
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ received: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function updateFirestoreUserStatus(uid, status) {
  const projectId = 'bar-sophie';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
  const token = ScriptApp.getOAuthToken();
  const payload = {
    fields: {
      status: { stringValue: status },
      updatedAt: { timestampValue: new Date().toISOString() }
    }
  };
  const options = {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch(url + '?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt', options);
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
