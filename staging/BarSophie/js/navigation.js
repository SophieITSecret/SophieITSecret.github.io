export let jData = [], tData = [], state = "none", curG = "", curP = [], curI = -1;

export async function loadAllData() {
    const resMusic = await fetch('JBoxメニュー.csv');
    const csvMusic = await resMusic.text();
    const gMap = { 'E':'演歌', 'F':'フォーク', 'J':'歌謡曲', 'W':'洋楽', 'I':'インスト', 'S':'旅情・映像' };
    jData = csvMusic.split('\n').slice(1).filter(l => l.includes(',')).map(l => {
        const c = l.split(',').map(s => s.trim());
        return { f: c[0], gName: gMap[c[0]] || "他", a: c[2], ti: (c[3]||"").replace(/"/g,''), u: c[4] };
    }).filter(d => d.a);

    const resTalk = await fetch('お酒の話.csv');
    const csvTalk = await resTalk.text();
    tData = csvTalk.split('\n').slice(1).filter(l => l.includes(',')).map(l => {
        const c = l.split(',').map(s => s.trim());
        if (c.length < 6 || !c[1]) return null;
        return { id: c[0], g: c[1], th: c[2], ti: c[3], txt: c[5] };
    }).filter(d => d);
}

export function updateNavState(s, g, p, i) {
    if(s !== undefined) state = s;
    if(g !== undefined) curG = g;
    if(p !== undefined) curP = p;
    if(i !== undefined) curI = i;
}
