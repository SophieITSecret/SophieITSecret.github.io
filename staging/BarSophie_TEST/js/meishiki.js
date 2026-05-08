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
