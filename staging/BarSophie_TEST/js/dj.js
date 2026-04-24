/**
 * dj.js — DJソフィー 司令塔
 * ★ Claude氏の改善案（キャンセルトークン・自動推定・終了待機）を完全採用
 */

import * as music from './music.js';
import * as media from './media.js';
import * as nav   from './navigation.js';

let _queue = [];
let _running = false;
let _cancelToken = 0;
let _onYtStateChange = null;

export function setYtStateChangeHandler(fn) { _onYtStateChange = fn; }

export function handleYtStateChange(state) {
    if (_onYtStateChange) _onYtStateChange(state);
}

export async function runScenario(scenario) {
    _cancelToken++;
    const myToken = _cancelToken;
    _queue = [...scenario];
    _running = true;
    await _runNext(myToken);
}

export function stopDJ() {
    _cancelToken++;
    _queue = [];
    _running = false;
    music.fadeOutAndStop(1500);
    window.speechSynthesis.cancel();
}

export function isRunning() { return _running; }

async function _runNext(token) {
    if (token !== _cancelToken || !_running || _queue.length === 0) {
        _running = false;
        return;
    }
    const cmd = _queue.shift();
    await _execute(cmd, token);
    await _runNext(token);
}

async function _execute(cmd, token) {
    if (token !== _cancelToken) return;

    switch (cmd.type) {
        case 'talk': {
            const text = cmd.text || "";
            const duration = cmd.duration || _estimateDuration(text);
            media.speak(text);
            await _waitCancellable(duration, token);
            break;
        }
        case 'song': {
            if (!music.playSongByCode(cmd.code, { source: "dj" })) break;
            if (cmd.waitForEnd) await _waitForSongEnd(token);
            else await _waitCancellable(cmd.duration || 30000, token);
            if (cmd.fadeOut && token === _cancelToken) {
                music.fadeOutAndStop(cmd.fadeOutDuration || 2000);
                await _waitCancellable(cmd.fadeOutDuration || 2000, token);
            }
            break;
        }
        case 'talk_then_song': {
            const text = cmd.text || "", duration = cmd.duration || _estimateDuration(text);
            media.speak(text);
            const loadDelay = Math.max(0, duration - 500);
            await _waitCancellable(loadDelay, token);
            if (token !== _cancelToken) break;
            music.playSongByCode(cmd.code, { source: "dj" });
            await _waitCancellable(500, token);
            window.speechSynthesis.cancel();
            if (cmd.waitForEnd) await _waitForSongEnd(token);
            else await _waitCancellable(cmd.duration2 || 30000, token);
            if (cmd.fadeOut && token === _cancelToken) {
                music.fadeOutAndStop(cmd.fadeOutDuration || 2000);
                await _waitCancellable(cmd.fadeOutDuration || 2000, token);
            }
            break;
        }
        case 'image': {
            const img = document.getElementById('monitor-img');
            if (img) { img.src = cmd.src || ""; img.style.display = 'block'; }
            await _waitCancellable(cmd.duration || 5000, token);
            break;
        }
        case 'telop': {
            const tel = document.getElementById('telop');
            if (tel) { tel.innerText = cmd.text || ""; tel.style.display = 'block'; }
            await _waitCancellable(cmd.duration || 5000, token);
            if (token === _cancelToken && tel) tel.style.display = 'none';
            break;
        }
        case 'wait': { await _waitCancellable(cmd.duration || 2000, token); break; }
    }
}

function _waitCancellable(ms, token) {
    return new Promise(resolve => {
        const check = setInterval(() => { if (token !== _cancelToken) { clearInterval(check); resolve(); } }, 100);
        setTimeout(() => { clearInterval(check); resolve(); }, ms);
    });
}

function _waitForSongEnd(token) {
    return new Promise(resolve => {
        const timeout = setTimeout(resolve, 600000);
        const prev = _onYtStateChange;
        _onYtStateChange = (state) => {
            if (state === 0 || token !== _cancelToken) {
                clearTimeout(timeout); _onYtStateChange = prev; resolve();
            }
        };
    });
}

function _estimateDuration(text) { return Math.max(2000, (text || "").length * 200); }

export function requestSong(code, introText = null) {
    if (introText) {
        media.speak(introText);
        setTimeout(() => music.playSongByCode(code, { source: "request" }), _estimateDuration(introText));
    } else music.playSongByCode(code, { source: "request" });
}