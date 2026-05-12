// js/meishiki.js
export function getThreePillars(year, month, day) {
    const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
    const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

    const epoch = Date.UTC(1600, 0, 1);
    const target = Date.UTC(year, month - 1, day);
    const days = Math.floor((target - epoch) / (1000 * 60 * 60 * 24));
    const dayPillar = stems[(days + 7) % 10] + branches[(days + 9) % 12];

    const setsuiriDays = [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7];
    let calMonth = month - 1;
    let solarMonth = calMonth;
    if (day < setsuiriDays[calMonth]) solarMonth -= 1;
    if (solarMonth < 0) solarMonth = 11;

    let astroYear = year;
    if (calMonth === 0 || (calMonth === 1 && day < setsuiriDays[1])) astroYear -= 1;

    const yStemIndex = (astroYear - 4 + 1000) % 10;
    const yBranchIndex = (astroYear - 4 + 1200) % 12;
    const yearPillar = stems[yStemIndex] + branches[yBranchIndex];

    const monthBranchIndex = (solarMonth + 1) % 12;
    const month1StemIndex = ((yStemIndex % 5) * 2 + 2) % 10;
    const monthOffset = (solarMonth - 1 + 12) % 12;
    const monthStemIndex = (month1StemIndex + monthOffset) % 10;
    const monthPillar = stems[monthStemIndex] + branches[monthBranchIndex];

    return { year: yearPillar, month: monthPillar, day: dayPillar };
}

// ─── 内部テーブル ────────────────────────────────────────────

const stemInfo = {
    甲:{gogyo:'木',yin:false}, 乙:{gogyo:'木',yin:true},
    丙:{gogyo:'火',yin:false}, 丁:{gogyo:'火',yin:true},
    戊:{gogyo:'土',yin:false}, 己:{gogyo:'土',yin:true},
    庚:{gogyo:'金',yin:false}, 辛:{gogyo:'金',yin:true},
    壬:{gogyo:'水',yin:false}, 癸:{gogyo:'水',yin:true}
};

const generates = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' };
const overcomes  = { 木:'土', 土:'水', 水:'火', 火:'金', 金:'木' };

const branchList = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 長生の地（天干ごと）
const choseiBranch = { 甲:11, 乙:6, 丙:2, 丁:9, 戊:2, 己:9, 庚:5, 辛:0, 壬:8, 癸:3 };

const stemGogyo   = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const branchGogyo = { 子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水' };

// ─── ① 蔵干 ─────────────────────────────────────────────────

const kakuchuTable = {
    子:['壬'],         丑:['己','癸','辛'],  寅:['甲','丙','戊'],
    卯:['乙'],         辰:['戊','乙','癸'],  巳:['丙','庚','戊'],
    午:['丁','己'],    未:['己','丁','乙'],   申:['庚','壬','戊'],
    酉:['辛'],         戌:['戊','辛','丁'],   亥:['壬','甲']
};

export function getKakuchu(branch) {
    return kakuchuTable[branch] || [];
}

// ─── ② 通変星 ────────────────────────────────────────────────

export function getTsuhensei(dayStem, targetStem) {
    const ds = stemInfo[dayStem];
    const ts = stemInfo[targetStem];
    if (!ds || !ts) return null;
    const same = ds.yin === ts.yin;
    if (ds.gogyo === ts.gogyo)             return same ? '比肩' : '劫財';
    if (generates[ds.gogyo] === ts.gogyo)  return same ? '食神' : '傷官';
    if (overcomes[ds.gogyo]  === ts.gogyo) return same ? '偏財' : '正財';
    if (overcomes[ts.gogyo]  === ds.gogyo) return same ? '偏官' : '正官';
    if (generates[ts.gogyo]  === ds.gogyo) return same ? '偏印' : '印綬';
    return null;
}

// ─── ③ 十二運星 ──────────────────────────────────────────────

const juniUnseiNames = ['長生','沐浴','冠帯','建禄','帝旺','衰','病','死','墓','絶','胎','養'];

export function getJuniUnsei(dayStem, branch) {
    const start = choseiBranch[dayStem];
    const yin   = stemInfo[dayStem]?.yin;
    const bi    = branchList.indexOf(branch);
    if (start === undefined || bi === -1) return null;
    // 陽干は順行、陰干は逆行
    const offset = yin ? (start - bi + 12) % 12 : (bi - start + 12) % 12;
    return juniUnseiNames[offset];
}

// ─── ④ 五行バランス ───────────────────────────────────────────

export function getGogyoBalance(yearPillar, monthPillar, dayPillar) {
    const bal = { 木:0, 火:0, 土:0, 金:0, 水:0 };
    for (const p of [yearPillar, monthPillar, dayPillar]) {
        const g1 = stemGogyo[p[0]];
        const g2 = branchGogyo[p[1]];
        if (g1) bal[g1]++;
        if (g2) bal[g2]++;
    }
    return bal;
}

// ─── ⑤ 大運 ──────────────────────────────────────────────────

export function getDaiyun(year, month, day, gender) {
    const stems = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
    const branches = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

    const yStemIdx = (year - 4 + 1000) % 10;
    const isYoYear = yStemIdx % 2 === 0;
    const isForward = (gender === '男性' && isYoYear) || (gender === '女性' && !isYoYear);

    const setsuiriDays = [6,4,6,5,6,6,7,8,8,8,7,7];
    const birthMonthIdx = month - 1;
    const setsuiriDay = setsuiriDays[birthMonthIdx];

    let daysToSetsuiri;
    if (isForward) {
        daysToSetsuiri = setsuiriDay - day;
        if (daysToSetsuiri <= 0) {
            const nextMonth = (birthMonthIdx + 1) % 12;
            daysToSetsuiri = (30 - day) + setsuiriDays[nextMonth];
        }
    } else {
        daysToSetsuiri = day - setsuiriDay;
        if (daysToSetsuiri <= 0) {
            const prevMonth = (birthMonthIdx - 1 + 12) % 12;
            daysToSetsuiri = day + (30 - setsuiriDays[prevMonth]);
        }
    }

    const startAge = Math.round(daysToSetsuiri / 3);

    const solarMonth = birthMonthIdx;
    const month1StemIdx = ((yStemIdx % 5) * 2 + 2) % 10;
    const monthOffset = (solarMonth - 1 + 12) % 12;
    const monthStemIdx = (month1StemIdx + monthOffset) % 10;
    const monthBranchIdx = (solarMonth + 1) % 12;

    const daiyunList = [];
    for (let i = 0; i < 10; i++) {
        const age = startAge + i * 10;
        let stemIdx, branchIdx;
        if (isForward) {
            stemIdx   = (monthStemIdx   + i + 1)      % 10;
            branchIdx = (monthBranchIdx + i + 1)      % 12;
        } else {
            stemIdx   = (monthStemIdx   - i - 1 + 100) % 10;
            branchIdx = (monthBranchIdx - i - 1 + 120) % 12;
        }
        daiyunList.push({
            age,
            ageRange: `${age}～${age + 9}歳`,
            pillar: stems[stemIdx] + branches[branchIdx]
        });
    }

    return { startAge, isForward, daiyunList };
}

// ─── ⑥ 統合関数 ──────────────────────────────────────────────

export function getFullMeishiki(year, month, day, gender) {
    const pillars = getThreePillars(year, month, day);
    const dayStem = pillars.day[0];
    const cols = {};

    for (const [key, pillar] of Object.entries(pillars)) {
        const stem    = pillar[0];
        const branch  = pillar[1];
        const kakuchu = getKakuchu(branch);
        cols[key] = {
            stem,
            branch,
            tsuhensei:        key === 'day' ? '日主' : getTsuhensei(dayStem, stem),
            juniUnsei:        getJuniUnsei(dayStem, branch),
            kakuchu,
            kakuchuTsuhensei: kakuchu.map(k => ({ stem: k, tsuhensei: getTsuhensei(dayStem, k) }))
        };
    }

    return {
        pillars,
        dayStem,
        gender,
        columns: cols,
        gogyoBalance: getGogyoBalance(pillars.year, pillars.month, pillars.day)
    };
}
