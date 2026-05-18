// APIキーはスクリプトプロパティで管理する（GAS画面 > プロジェクトの設定 > スクリプトプロパティ）
// プロパティ名: ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const messages = req.messages;
    const useSearch = req.search === true;

    const payload = {
      model: 'claude-haiku-4-5',
      max_tokens: 2500,
      messages: messages
    };

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

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
