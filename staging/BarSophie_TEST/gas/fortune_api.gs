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
      const amount = session.amount_total || 0;
      const mode = session.mode || '';
      if (mode === 'subscription') {
        // ご常連パスカード 月額サブスク
        updateFirestoreUserStatus(uid, 'active', null);
      } else if (amount === 200) {
        // Ｓチケット 1枚
        incrementPurchasedTickets(uid, 1);
      } else if (amount === 500) {
        // Ｓチケット 5枚セット
        incrementPurchasedTickets(uid, 5);
      } else if (amount === 360) {
        // ご常連パスカード 1カ月お試し
        const activeUntil = new Date();
        activeUntil.setDate(activeUntil.getDate() + 30);
        updateFirestoreUserStatus(uid, 'active', activeUntil.toISOString());
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const uid = subscription.metadata?.firebase_uid || '';
    if (uid) {
      updateFirestoreUserStatus(uid, 'free', null);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ received: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function updateFirestoreUserStatus(uid, status, activeUntil) {
  const projectId = 'bar-sophie';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
  const token = ScriptApp.getOAuthToken();
  const fields = {
    status: { stringValue: status },
    updatedAt: { timestampValue: new Date().toISOString() }
  };
  const masks = ['status', 'updatedAt'];
  if (activeUntil) {
    fields.activeUntil = { stringValue: activeUntil };
    masks.push('activeUntil');
  }
  const maskQuery = masks.map(f => `updateMask.fieldPaths=${f}`).join('&');
  UrlFetchApp.fetch(`${url}?${maskQuery}`, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify({ fields }),
    muteHttpExceptions: true
  });
}

function incrementPurchasedTickets(uid, amount) {
  const projectId = 'bar-sophie';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
  const token = ScriptApp.getOAuthToken();
  const getRes = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
  const userData = JSON.parse(getRes.getContentText());
  const current = parseInt(userData.fields?.purchasedTickets?.integerValue || 0);
  UrlFetchApp.fetch(`${url}?updateMask.fieldPaths=purchasedTickets&updateMask.fieldPaths=updatedAt`, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify({
      fields: {
        purchasedTickets: { integerValue: current + amount },
        updatedAt: { timestampValue: new Date().toISOString() }
      }
    }),
    muteHttpExceptions: true
  });
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
