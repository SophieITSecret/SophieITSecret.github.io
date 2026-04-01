export function extractYtId(url) {
    if (!url) return "";
    const match = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : url;
}

export function speak(txt, rate = 1.05, onEndCallback = null) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = 'ja-JP';
    u.rate = rate;
    if (onEndCallback) u.onend = onEndCallback;
    window.speechSynthesis.speak(u);
}

export function stopSpeak() {
    window.speechSynthesis.cancel();
}
