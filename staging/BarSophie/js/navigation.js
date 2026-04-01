export let jData = [], tData = [], state = "none", curG = "", curP = [], curI = -1;

export async function loadAllData() {
    try {
        // 音楽データ
        const resM = await fetch('JBoxメニュー.csv');
        const csvM = await resM.text();
        const gMap = { 'E':'演歌', 'F':'フォーク', 'J':'歌謡曲', 'W':'洋楽', 'I':'インスト', 'S':'旅情・映像' };
        jData = csvM.split('\n').slice(1).filter(l => l.trim().includes(',')).map(l => {
            const c = l.split(',').map(s => s.trim());
            return { f: c[0], gName: gMap[c[0]] || "他", a: c[2], ti: (c[3]||"").replace(/"/g,''), u: c[4] };
        }).filter(d => d.a);

        // お酒の話データ
        const resT = await fetch('お酒の話.csv');
        const csvT = await resT.text();
        tData = csvT.split('\n').slice(1).filter(l => l.trim().includes(',')).map(l => {
            const c = l.split(',').map(s => s.trim());
            if (c.length < 6) return null;
            return { id: c[0], g: c[1], th: c[2], ti: c[3], txt: c[5] };
        }).filter(d => d && d.g); // ジャンル（g）があるものだけ残す

        console.log("Navigation Ready:", { music: jData.length, talk: tData.length });
    } catch (e) {
        console.error("Critical Data Load Error:", e);
    }
}

export function updateNav(s, g, p, i) {
    if(s !== undefined) state = s; 
    if(g !== undefined) curG = g; 
    if(p !== undefined) curP = p; 
    if(i !== undefined) curI = i;
}
