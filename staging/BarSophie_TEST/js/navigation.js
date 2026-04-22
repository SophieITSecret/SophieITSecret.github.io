export let jData = [], tData = [], state = "none", curG = "", curP = [], curI = -1;
export let liquorData = [];

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

        // ▼▼▼ 今回追加する「お酒データベース(TSV)」の読み込み処理 ▼▼▼
        try {
            const resL = await fetch('liquor_db.tsv');
            const tsvL = await resL.text();
            const lines = tsvL.trim().split('\n');
            const headers = lines[0].split('\t'); // タブで分割
            liquorData = lines.slice(1).map(line => {
                const vals = line.split('\t');
                let obj = {};
                headers.forEach((h, i) => obj[h.trim()] = vals[i] ? vals[i].trim() : "");
                return obj;
            });
        } catch (e) {
            console.log("お酒データの読み込みをスキップしました", e);
        }
        // ▲▲▲ 追加ここまで ▲▲▲

        console.log("Navigation Ready:", { music: jData.length, talk: tData.length, liquor: liquorData.length });
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