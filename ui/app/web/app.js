(function () {
'use strict';

/* ============================================================
   Data
   ============================================================ */
var ISL = 'M200,30 L235,45 L245,75 L238,120 L232,170 L228,230 L215,290 L200,340 L180,400 L160,460 L148,470 L140,440 L118,395 L100,350 L90,300 L95,250 L110,200 L130,150 L155,100 L175,60 Z';
var PALS = { 'default': ['#4ADE80', '#FACC15', '#FB923C', '#EF4444'], cb: ['#2C7BB6', '#ABD9E9', '#FDAE61', '#D7191C'] };
var TIMES = ['−72h', '−48h', '−24h', '−12h', 'Now', '+6h', '+12h', '+24h', '+48h', '+72h', '+5d', '+7d'];
var NOW = 4;

// Taiwan places → search entries. kind: City | Landmark | University | Airport
var CITIES = [
  ['Taipei', '台北 臺北 taipei city', 25.0330, 121.5654, 'Taiwan'],
  ['New Taipei', '新北 banqiao 板橋', 25.0120, 121.4650, 'Taiwan'],
  ['Keelung', '基隆 jilong', 25.1276, 121.7392, 'Taiwan'],
  ['Taoyuan', '桃園', 24.9936, 121.3010, 'Taiwan'],
  ['Hsinchu', '新竹 xinzhu', 24.8138, 120.9675, 'Taiwan'],
  ['Miaoli', '苗栗', 24.5602, 120.8214, 'Taiwan'],
  ['Taichung', '台中 臺中 taizhong', 24.1477, 120.6736, 'Taiwan'],
  ['Changhua', '彰化', 24.0518, 120.5161, 'Taiwan'],
  ['Nantou', '南投', 23.9609, 120.9719, 'Taiwan'],
  ['Douliu, Yunlin', '斗六 雲林 yunlin', 23.7092, 120.4313, 'Taiwan'],
  ['Chiayi', '嘉義 jiayi', 23.4801, 120.4491, 'Taiwan'],
  ['Tainan', '台南 臺南', 22.9999, 120.2270, 'Taiwan'],
  ['Kaohsiung', '高雄 gaoxiong', 22.6273, 120.3014, 'Taiwan'],
  ['Pingtung', '屏東', 22.6690, 120.4860, 'Taiwan'],
  ['Yilan', '宜蘭 ilan', 24.7570, 121.7530, 'Taiwan'],
  ['Hualien', '花蓮 hualian', 23.9769, 121.6044, 'Taiwan'],
  ['Taitung', '台東 臺東 taidong', 22.7583, 121.1444, 'Taiwan'],
  ['Magong, Penghu', '馬公 澎湖 penghu pescadores', 23.5655, 119.5793, 'Taiwan'],
  ['Kinmen', '金門 quemoy', 24.4321, 118.3171, 'Taiwan'],
  ['Nangan, Matsu', '南竿 馬祖 matsu', 26.1505, 119.9499, 'Taiwan'],
  ['Tokyo', '東京', 35.6762, 139.6503, 'Japan'],
  ['Hong Kong', '香港', 22.3193, 114.1694, 'China'],
  ['Singapore', '新加坡', 1.3521, 103.8198, 'Singapore'],
  ['Seoul', '首爾', 37.5665, 126.9780, 'South Korea'],
  ['San Francisco', 'sf', 37.7749, -122.4194, 'California, USA'],
  ['New York', 'nyc', 40.7128, -74.0060, 'New York, USA'],
  ['London', '倫敦', 51.5074, -0.1278, 'United Kingdom'],
  ['Sydney', '雪梨', -33.8688, 151.2093, 'Australia']
];
var LANDMARKS = [
  ['Taipei 101', '台北101 101', 25.0340, 121.5645, 'Xinyi, Taipei'],
  ['Yangmingshan', '陽明山 yangming', 25.1550, 121.5480, 'Taipei'],
  ['Jiufen', '九份', 25.1090, 121.8440, 'New Taipei'],
  ['Sun Moon Lake', '日月潭', 23.8570, 120.9150, 'Nantou'],
  ['Alishan', '阿里山 ali mountain', 23.5100, 120.8020, 'Chiayi'],
  ['Yushan (Jade Mountain)', '玉山 jade mountain', 23.4700, 120.9570, 'Nantou · 3,952 m'],
  ['Taroko Gorge', '太魯閣 taroko', 24.1580, 121.6200, 'Hualien'],
  ['Kenting', '墾丁', 21.9480, 120.7800, 'Pingtung']
];
var UNIS = [
  ['National Taiwan University', '台灣大學 臺灣大學 台大 ntu', 25.0173, 121.5398, 'Da’an, Taipei'],
  ['National Tsing Hua University', '清華大學 清大 nthu tsinghua', 24.7961, 120.9967, 'Hsinchu'],
  ['National Yang Ming Chiao Tung University', '陽明交通大學 陽明交大 交大 nycu nctu chiao tung', 24.7869, 120.9975, 'Hsinchu'],
  ['National Cheng Kung University', '成功大學 成大 ncku', 22.9970, 120.2210, 'Tainan'],
  ['National Chengchi University', '政治大學 政大 nccu', 24.9867, 121.5763, 'Wenshan, Taipei'],
  ['National Taiwan Normal University', '台灣師範大學 臺灣師範大學 師大 ntnu', 25.0262, 121.5276, 'Taipei'],
  ['National Taiwan University of Science and Technology', '台灣科技大學 臺灣科技大學 台科大 ntust taiwan tech', 25.0136, 121.5415, 'Taipei'],
  ['National Taipei University of Technology', '台北科技大學 臺北科技大學 北科大 ntut taipei tech', 25.0424, 121.5354, 'Taipei'],
  ['National Central University', '中央大學 中央 ncu', 24.9681, 121.1950, 'Taoyuan'],
  ['National Chung Hsing University', '中興大學 興大 nchu', 24.1226, 120.6750, 'Taichung'],
  ['National Chung Cheng University', '中正大學 中正 ccu', 23.5603, 120.4735, 'Chiayi'],
  ['National Sun Yat-sen University', '中山大學 中山 nsysu', 22.6273, 120.2660, 'Kaohsiung'],
  ['National Dong Hwa University', '東華大學 東華 ndhu', 23.8970, 121.5420, 'Hualien'],
  ['Fu Jen Catholic University', '輔仁大學 輔大 fju', 25.0362, 121.4320, 'New Taipei'],
  ['Tamkang University', '淡江大學 淡江 tku', 25.1753, 121.4497, 'Tamsui, New Taipei'],
  ['Chang Gung University', '長庚大學 長庚 cgu', 25.0336, 121.3894, 'Taoyuan'],
  ['Feng Chia University', '逢甲大學 逢甲 fcu', 24.1790, 120.6466, 'Taichung'],
  ['Tunghai University', '東海大學 東海 thu', 24.1810, 120.6000, 'Taichung'],
  ['Taipei Medical University', '台北醫學大學 臺北醫學大學 北醫 tmu', 25.0265, 121.5617, 'Taipei'],
  ['Massachusetts Institute of Technology', 'mit', 42.3601, -71.0942, 'Cambridge, MA, USA'],
  ['Stanford University', 'stanford', 37.4275, -122.1697, 'Stanford, CA, USA'],
  ['Harvard University', 'harvard', 42.3770, -71.1167, 'Cambridge, MA, USA'],
  ['University of California, Berkeley', 'uc berkeley ucb cal', 37.8719, -122.2585, 'Berkeley, CA, USA'],
  ['University of Tokyo', '東京大學 東大 todai utokyo', 35.7126, 139.7620, 'Tokyo, Japan'],
  ['National University of Singapore', 'nus', 1.2966, 103.7764, 'Singapore'],
  ['University of Hong Kong', '香港大學 港大 hku', 22.2830, 114.1371, 'Hong Kong'],
  ['University of Oxford', 'oxford', 51.7548, -1.2544, 'Oxford, UK'],
  ['University of Cambridge', 'cambridge', 52.2043, 0.1149, 'Cambridge, UK']
];
// [name, iata, icao, lat, lon, where, chinese]
var AIRPORTS = [
  ['Taoyuan International Airport', 'TPE', 'RCTP', 25.0777, 121.2328, 'Taoyuan, Taiwan', '桃園機場 桃園國際機場'],
  ['Taipei Songshan Airport', 'TSA', 'RCSS', 25.0694, 121.5525, 'Taipei, Taiwan', '松山機場'],
  ['Kaohsiung International Airport', 'KHH', 'RCKH', 22.5771, 120.3500, 'Kaohsiung, Taiwan', '高雄機場 小港機場'],
  ['Taichung International Airport', 'RMQ', 'RCMQ', 24.2647, 120.6208, 'Taichung, Taiwan', '台中機場 清泉崗'],
  ['Tainan Airport', 'TNN', 'RCNN', 22.9504, 120.2057, 'Tainan, Taiwan', '台南機場'],
  ['Hualien Airport', 'HUN', 'RCYU', 24.0231, 121.6178, 'Hualien, Taiwan', '花蓮機場'],
  ['Taitung Airport', 'TTT', 'RCFN', 22.7550, 121.1018, 'Taitung, Taiwan', '台東機場 豐年機場'],
  ['Chiayi Airport', 'CYI', 'RCKU', 23.4618, 120.3928, 'Chiayi, Taiwan', '嘉義機場'],
  ['Penghu Magong Airport', 'MZG', 'RCQC', 23.5687, 119.6282, 'Penghu, Taiwan', '馬公機場 澎湖機場'],
  ['Kinmen Airport', 'KNH', 'RCBS', 24.4279, 118.3592, 'Kinmen, Taiwan', '金門機場 尚義機場'],
  ['Matsu Nangan Airport', 'LZN', 'RCFG', 26.1598, 119.9582, 'Matsu, Taiwan', '南竿機場'],
  ['Matsu Beigan Airport', 'MFK', 'RCMT', 26.2242, 120.0028, 'Matsu, Taiwan', '北竿機場'],
  ['Green Island Airport', 'GNI', 'RCGI', 22.6739, 121.4667, 'Taitung, Taiwan', '綠島機場'],
  ['Lanyu Airport', 'KYD', 'RCLY', 22.0270, 121.5350, 'Orchid Island, Taiwan', '蘭嶼機場'],
  ['Hengchun Airport', 'HCN', 'RCKW', 22.0411, 120.7300, 'Pingtung, Taiwan', '恆春機場'],
  ['Hong Kong International Airport', 'HKG', 'VHHH', 22.3080, 113.9185, 'Hong Kong', '香港機場 赤鱲角'],
  ['Narita International Airport', 'NRT', 'RJAA', 35.7720, 140.3929, 'Tokyo, Japan', '成田'],
  ['Tokyo Haneda Airport', 'HND', 'RJTT', 35.5494, 139.7798, 'Tokyo, Japan', '羽田'],
  ['Kansai International Airport', 'KIX', 'RJBB', 34.4320, 135.2304, 'Osaka, Japan', '關西機場'],
  ['Naha Airport', 'OKA', 'ROAH', 26.1958, 127.6459, 'Okinawa, Japan', '那霸'],
  ['Incheon International Airport', 'ICN', 'RKSI', 37.4602, 126.4407, 'Seoul, South Korea', '仁川'],
  ['Shanghai Pudong International Airport', 'PVG', 'ZSPD', 31.1443, 121.8083, 'Shanghai, China', '浦東'],
  ['Beijing Capital International Airport', 'PEK', 'ZBAA', 40.0799, 116.6031, 'Beijing, China', '首都機場'],
  ['Singapore Changi Airport', 'SIN', 'WSSS', 1.3644, 103.9915, 'Singapore', '樟宜'],
  ['Suvarnabhumi Airport', 'BKK', 'VTBS', 13.6900, 100.7501, 'Bangkok, Thailand', '曼谷'],
  ['Ninoy Aquino International Airport', 'MNL', 'RPLL', 14.5086, 121.0194, 'Manila, Philippines', '馬尼拉'],
  ['San Francisco International Airport', 'SFO', 'KSFO', 37.6213, -122.3790, 'California, USA', ''],
  ['Los Angeles International Airport', 'LAX', 'KLAX', 33.9416, -118.4085, 'California, USA', ''],
  ['Seattle–Tacoma International Airport', 'SEA', 'KSEA', 47.4502, -122.3088, 'Washington, USA', ''],
  ['John F. Kennedy International Airport', 'JFK', 'KJFK', 40.6413, -73.7781, 'New York, USA', ''],
  ['London Heathrow Airport', 'LHR', 'EGLL', 51.4700, -0.4543, 'London, UK', '希斯洛'],
  ['Paris Charles de Gaulle Airport', 'CDG', 'LFPG', 49.0097, 2.5479, 'Paris, France', ''],
  ['Frankfurt Airport', 'FRA', 'EDDF', 50.0379, 8.5622, 'Frankfurt, Germany', ''],
  ['Amsterdam Airport Schiphol', 'AMS', 'EHAM', 52.3105, 4.7683, 'Amsterdam, Netherlands', ''],
  ['Dubai International Airport', 'DXB', 'OMDB', 25.2532, 55.3657, 'Dubai, UAE', ''],
  ['Sydney Kingsford Smith Airport', 'SYD', 'YSSY', -33.9399, 151.1753, 'Sydney, Australia', '']
];

function norm(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/臺/g, '台').replace(/[.,'’\-–()]/g, ' ').replace(/\s+/g, ' ').trim();
}
var PLACES = [];
function addPlace(kind, name, aliases, lat, lon, sub, extra) {
  // Keys: the full name, plus each space-separated alias (abbreviations, 中文 names, codes)
  var keys = [norm(name)];
  String(aliases || '').split(/\s+/).forEach(function (w) { if (w) keys.push(norm(w)); });
  var p = { id: kind + ':' + name, kind: kind, name: name, sub: sub, lat: lat, lon: lon, keys: keys.filter(Boolean) };
  if (extra) for (var k in extra) p[k] = extra[k];
  PLACES.push(p);
  return p;
}
CITIES.forEach(function (c) { addPlace('City', c[0], c[1], c[2], c[3], c[4]); });
LANDMARKS.forEach(function (c) { addPlace('Landmark', c[0], c[1], c[2], c[3], c[4]); });
UNIS.forEach(function (c) { addPlace('University', c[0], c[1], c[2], c[3], c[4]); });
AIRPORTS.forEach(function (a) {
  addPlace('Airport', a[0], a[1] + ' ' + a[2] + ' ' + a[6], a[3], a[4], a[5], { iata: a[1], icao: a[2] });
});

// Taiwan 3-digit postal codes → districts / townships.
// [postal code, 中文 name, romanized name, 中文 city/county, English city/county, lat, lon]
// Coordinates: Wikidata (matched on postal code + 中文 name for all 368 districts).
var DISTRICTS = [
["100", "中正區", "Zhongzheng", "臺北市", "Taipei City", 25.0317, 121.5164],
["103", "大同區", "Datong", "臺北市", "Taipei City", 25.0597, 121.5142],
["104", "中山區", "Zhongshan", "臺北市", "Taipei City", 25.0689, 121.5331],
["105", "松山區", "Songshan", "臺北市", "Taipei City", 25.0592, 121.559],
["106", "大安區", "Da'an", "臺北市", "Taipei City", 25.0264, 121.5344],
["108", "萬華區", "Wanhua", "臺北市", "Taipei City", 25.0333, 121.483],
["110", "信義區", "Xinyi", "臺北市", "Taipei City", 25.0288, 121.5548],
["111", "士林區", "Shilin", "臺北市", "Taipei City", 25.0833, 121.517],
["112", "北投區", "Beitou", "臺北市", "Taipei City", 25.1167, 121.5],
["114", "內湖區", "Neihu", "臺北市", "Taipei City", 25.0833, 121.5833],
["115", "南港區", "Nangang", "臺北市", "Taipei City", 25.0533, 121.6074],
["116", "文山區", "Wenshan", "臺北市", "Taipei City", 24.9897, 121.5722],
["200", "仁愛區", "Ren'ai", "基隆市", "Keelung City", 25.1203, 121.743],
["201", "信義區", "Xinyi", "基隆市", "Keelung City", 25.1286, 121.773],
["202", "中正區", "Zhongzheng", "基隆市", "Keelung City", 25.1478, 121.772],
["203", "中山區", "Zhongshan", "基隆市", "Keelung City", 25.1519, 121.729],
["204", "安樂區", "Anle", "基隆市", "Keelung City", 25.1513, 121.703],
["205", "暖暖區", "Nuannuan", "基隆市", "Keelung City", 25.0875, 121.748],
["206", "七堵區", "Qidu", "基隆市", "Keelung City", 25.1117, 121.685],
["207", "萬里區", "Wanli", "新北市", "New Taipei City", 25.1675, 121.6394],
["208", "金山區", "Jinshan", "新北市", "New Taipei City", 25.2167, 121.6008],
["209", "南竿鄉", "Nangan", "連江縣", "Lienchiang County (Matsu)", 26.1598, 119.9432],
["210", "北竿鄉", "Beigan", "連江縣", "Lienchiang County (Matsu)", 26.2236, 119.9892],
["211", "莒光鄉", "Juguang", "連江縣", "Lienchiang County (Matsu)", 25.964, 119.959],
["212", "東引鄉", "Dongyin", "連江縣", "Lienchiang County (Matsu)", 26.3767, 120.5067],
["220", "板橋區", "Banqiao", "新北市", "New Taipei City", 25.0111, 121.4458],
["221", "汐止區", "Xizhi", "新北市", "New Taipei City", 25.0667, 121.6667],
["222", "深坑區", "Shenkeng", "新北市", "New Taipei City", 25.0, 121.6167],
["223", "石碇區", "Shiding", "新北市", "New Taipei City", 25.0, 121.65],
["224", "瑞芳區", "Ruifang", "新北市", "New Taipei City", 25.1, 121.8167],
["226", "平溪區", "Pingxi", "新北市", "New Taipei City", 25.0258, 121.7391],
["227", "雙溪區", "Shuangxi", "新北市", "New Taipei City", 25.0097, 121.8342],
["228", "貢寮區", "Gongliao", "新北市", "New Taipei City", 25.0219, 121.91],
["231", "新店區", "Xindian", "新北市", "New Taipei City", 24.95, 121.5333],
["232", "坪林區", "Pinglin", "新北市", "New Taipei City", 24.9244, 121.7267],
["233", "烏來區", "Wulai", "新北市", "New Taipei City", 24.8667, 121.55],
["234", "永和區", "Yonghe", "新北市", "New Taipei City", 25.0075, 121.5164],
["235", "中和區", "Zhonghe", "新北市", "New Taipei City", 24.9972, 121.5042],
["236", "土城區", "Tucheng", "新北市", "New Taipei City", 24.9667, 121.4333],
["237", "三峽區", "Sanxia", "新北市", "New Taipei City", 24.9347, 121.3708],
["238", "樹林區", "Shulin", "新北市", "New Taipei City", 24.99, 121.41],
["239", "鶯歌區", "Yingge", "新北市", "New Taipei City", 24.956, 121.355],
["241", "三重區", "Sanchong", "新北市", "New Taipei City", 25.0667, 121.4833],
["242", "新莊區", "Xinzhuang", "新北市", "New Taipei City", 25.0333, 121.45],
["243", "泰山區", "Taishan", "新北市", "New Taipei City", 25.0583, 121.4309],
["244", "林口區", "Linkou", "新北市", "New Taipei City", 25.1017, 121.3631],
["247", "蘆洲區", "Luzhou", "新北市", "New Taipei City", 25.0833, 121.4667],
["248", "五股區", "Wugu", "新北市", "New Taipei City", 25.1, 121.4333],
["249", "八里區", "Bali", "新北市", "New Taipei City", 25.15, 121.4],
["251", "淡水區", "Tamsui", "新北市", "New Taipei City", 25.1667, 121.4333],
["252", "三芝區", "Sanzhi", "新北市", "New Taipei City", 25.2367, 121.5253],
["253", "石門區", "Shimen", "新北市", "New Taipei City", 25.2686, 121.5714],
["260", "宜蘭市", "Yilan", "宜蘭縣", "Yilan County", 24.75, 121.75],
["261", "頭城鎮", "Toucheng", "宜蘭縣", "Yilan County", 24.9, 121.85],
["262", "礁溪鄉", "Jiaoxi", "宜蘭縣", "Yilan County", 24.8167, 121.7333],
["263", "壯圍鄉", "Zhuangwei", "宜蘭縣", "Yilan County", 24.7702, 121.802],
["264", "員山鄉", "Yuanshan", "宜蘭縣", "Yilan County", 24.75, 121.6833],
["265", "羅東鎮", "Luodong", "宜蘭縣", "Yilan County", 24.6767, 121.7669],
["266", "三星鄉", "Sanxing", "宜蘭縣", "Yilan County", 24.6833, 121.65],
["267", "大同鄉", "Datong", "宜蘭縣", "Yilan County", 24.6772, 121.609],
["268", "五結鄉", "Wujie", "宜蘭縣", "Yilan County", 24.7, 121.7833],
["269", "冬山鄉", "Dongshan", "宜蘭縣", "Yilan County", 24.65, 121.76],
["270", "蘇澳鎮", "Su'ao", "宜蘭縣", "Yilan County", 24.5917, 121.8533],
["272", "南澳鄉", "Nan'ao", "宜蘭縣", "Yilan County", 24.4667, 121.8],
["300", "東區", "East District", "新竹市", "Hsinchu City", 24.7959, 120.993],
["300", "北區", "North District", "新竹市", "Hsinchu City", 24.828, 120.948],
["300", "香山區", "Xiangshan", "新竹市", "Hsinchu City", 24.7746, 120.926],
["302", "竹北市", "Zhubei", "新竹縣", "Hsinchu County", 24.8333, 121.0],
["303", "湖口鄉", "Hukou", "新竹縣", "Hsinchu County", 24.9, 121.05],
["304", "新豐鄉", "Xinfeng", "新竹縣", "Hsinchu County", 24.9167, 121.0],
["305", "新埔鎮", "Xinpu", "新竹縣", "Hsinchu County", 24.8478, 121.096],
["306", "關西鎮", "Guanxi", "新竹縣", "Hsinchu County", 24.7833, 121.1833],
["307", "芎林鄉", "Qionglin", "新竹縣", "Hsinchu County", 24.7667, 121.1],
["308", "寶山鄉", "Baoshan", "新竹縣", "Hsinchu County", 24.7428, 120.9991],
["310", "竹東鎮", "Zhudong", "新竹縣", "Hsinchu County", 24.7366, 121.0916],
["311", "五峰鄉", "Wufeng", "新竹縣", "Hsinchu County", 24.6333, 121.1167],
["312", "橫山鄉", "Hengshan", "新竹縣", "Hsinchu County", 24.7167, 121.1413],
["313", "尖石鄉", "Jianshi", "新竹縣", "Hsinchu County", 24.6128, 121.2962],
["314", "北埔鄉", "Beipu", "新竹縣", "Hsinchu County", 24.6639, 121.0681],
["315", "峨眉鄉", "Emei", "新竹縣", "Hsinchu County", 24.6833, 121.0],
["320", "中壢區", "Zhongli", "桃園市", "Taoyuan City", 24.9569, 121.2236],
["324", "平鎮區", "Pingzhen", "桃園市", "Taoyuan City", 24.9439, 121.2161],
["325", "龍潭區", "Longtan", "桃園市", "Taoyuan City", 24.8444, 121.2053],
["326", "楊梅區", "Yangmei", "桃園市", "Taoyuan City", 24.9167, 121.1167],
["327", "新屋區", "Xinwu", "桃園市", "Taoyuan City", 24.9833, 121.0667],
["328", "觀音區", "Guanyin", "桃園市", "Taoyuan City", 25.0333, 121.1],
["330", "桃園區", "Taoyuan", "桃園市", "Taoyuan City", 24.9889, 121.3111],
["333", "龜山區", "Guishan", "桃園市", "Taoyuan City", 25.0333, 121.35],
["334", "八德區", "Bade", "桃園市", "Taoyuan City", 24.9576, 121.2988],
["335", "大溪區", "Daxi", "桃園市", "Taoyuan City", 24.8806, 121.2871],
["336", "復興區", "Fuxing", "桃園市", "Taoyuan City", 24.715, 121.355],
["337", "大園區", "Dayuan", "桃園市", "Taoyuan City", 25.0667, 121.2],
["338", "蘆竹區", "Luzhu", "桃園市", "Taoyuan City", 25.0667, 121.2833],
["350", "竹南鎮", "Zhunan", "苗栗縣", "Miaoli County", 24.6833, 120.8833],
["351", "頭份市", "Toufen", "苗栗縣", "Miaoli County", 24.6833, 120.9167],
["352", "三灣鄉", "Sanwan", "苗栗縣", "Miaoli County", 24.632, 120.937],
["353", "南庄鄉", "Nanzhuang", "苗栗縣", "Miaoli County", 24.5667, 121.0167],
["354", "獅潭鄉", "Shitan", "苗栗縣", "Miaoli County", 24.5333, 120.9167],
["356", "後龍鎮", "Houlong", "苗栗縣", "Miaoli County", 24.6167, 120.7667],
["357", "通霄鎮", "Tongxiao", "苗栗縣", "Miaoli County", 24.4833, 120.7],
["358", "苑裡鎮", "Yuanli", "苗栗縣", "Miaoli County", 24.4167, 120.6833],
["360", "苗栗市", "Miaoli", "苗栗縣", "Miaoli County", 24.57, 120.82],
["361", "造橋鄉", "Zaoqiao", "苗栗縣", "Miaoli County", 24.6333, 120.8667],
["362", "頭屋鄉", "Touwu", "苗栗縣", "Miaoli County", 24.5667, 120.8667],
["363", "公館鄉", "Gongguan", "苗栗縣", "Miaoli County", 24.5053, 120.845],
["364", "大湖鄉", "Dahu", "苗栗縣", "Miaoli County", 24.4, 120.85],
["365", "泰安鄉", "Tai'an", "苗栗縣", "Miaoli County", 24.4167, 121.0667],
["366", "銅鑼鄉", "Tongluo", "苗栗縣", "Miaoli County", 24.4833, 120.7833],
["367", "三義鄉", "Sanyi", "苗栗縣", "Miaoli County", 24.4167, 120.7667],
["368", "西湖鄉", "Xihu", "苗栗縣", "Miaoli County", 24.55, 120.75],
["369", "卓蘭鎮", "Zhuolan", "苗栗縣", "Miaoli County", 24.3333, 120.85],
["400", "中區", "Central District", "臺中市", "Taichung City", 24.142, 120.68],
["401", "東區", "East District", "臺中市", "Taichung City", 24.1373, 120.697],
["402", "南區", "South District", "臺中市", "Taichung City", 24.1216, 120.665],
["403", "西區", "West District", "臺中市", "Taichung City", 24.1445, 120.665],
["404", "北區", "North District", "臺中市", "Taichung City", 24.1576, 120.681],
["406", "北屯區", "Beitun", "臺中市", "Taichung City", 24.1804, 120.7466],
["407", "西屯區", "Xitun", "臺中市", "Taichung City", 24.1829, 120.626],
["408", "南屯區", "Nantun", "臺中市", "Taichung City", 24.1416, 120.638],
["411", "太平區", "Taiping", "臺中市", "Taichung City", 24.1188, 120.763],
["412", "大里區", "Dali", "臺中市", "Taichung City", 24.0917, 120.6917],
["413", "霧峰區", "Wufeng", "臺中市", "Taichung City", 24.0667, 120.7],
["414", "烏日區", "Wuri", "臺中市", "Taichung City", 24.0887, 120.632],
["420", "豐原區", "Fengyuan", "臺中市", "Taichung City", 24.25, 120.7167],
["421", "后里區", "Houli", "臺中市", "Taichung City", 24.3167, 120.7167],
["422", "石岡區", "Shigang", "臺中市", "Taichung City", 24.2662, 120.785],
["423", "東勢區", "Dongshi", "臺中市", "Taichung City", 24.2587, 120.8282],
["424", "和平區", "Heping", "臺中市", "Taichung City", 24.2667, 121.15],
["426", "新社區", "Xinshe", "臺中市", "Taichung City", 24.2643, 120.8],
["427", "潭子區", "Tanzi", "臺中市", "Taichung City", 24.218, 120.706],
["428", "大雅區", "Daya", "臺中市", "Taichung City", 24.2242, 120.6478],
["429", "神岡區", "Shengang", "臺中市", "Taichung City", 24.259, 120.663],
["432", "大肚區", "Dadu", "臺中市", "Taichung City", 24.1514, 120.5464],
["433", "沙鹿區", "Shalu", "臺中市", "Taichung City", 24.2394, 120.562],
["434", "龍井區", "Longjing", "臺中市", "Taichung City", 24.1944, 120.5464],
["435", "梧棲區", "Wuqi", "臺中市", "Taichung City", 24.2564, 120.5319],
["436", "清水區", "Qingshui", "臺中市", "Taichung City", 24.296, 120.5665],
["437", "大甲區", "Dajia", "臺中市", "Taichung City", 24.3619, 120.6283],
["438", "外埔區", "Waipu", "臺中市", "Taichung City", 24.3299, 120.654],
["439", "大安區", "Da'an", "臺中市", "Taichung City", 24.3652, 120.59],
["500", "彰化市", "Changhua", "彰化縣", "Changhua County", 24.0667, 120.5333],
["502", "芬園鄉", "Fenyuan", "彰化縣", "Changhua County", 24.0154, 120.627],
["503", "花壇鄉", "Huatan", "彰化縣", "Changhua County", 24.0333, 120.55],
["504", "秀水鄉", "Xiushui", "彰化縣", "Changhua County", 24.0333, 120.5],
["505", "鹿港鎮", "Lukang", "彰化縣", "Changhua County", 24.0833, 120.45],
["506", "福興鄉", "Fuxing", "彰化縣", "Changhua County", 24.0333, 120.4333],
["507", "線西鄉", "Xianxi", "彰化縣", "Changhua County", 24.1375, 120.4692],
["508", "和美鎮", "Hemei", "彰化縣", "Changhua County", 24.1167, 120.5],
["509", "伸港鄉", "Shengang", "彰化縣", "Changhua County", 24.1648, 120.489],
["510", "員林市", "Yuanlin", "彰化縣", "Changhua County", 23.95, 120.5833],
["511", "社頭鄉", "Shetou", "彰化縣", "Changhua County", 23.9167, 120.6],
["512", "永靖鄉", "Yongjing", "彰化縣", "Changhua County", 23.9333, 120.5333],
["513", "埔心鄉", "Puxin", "彰化縣", "Changhua County", 23.9523, 120.535],
["514", "溪湖鎮", "Xihu", "彰化縣", "Changhua County", 23.9594, 120.48],
["515", "大村鄉", "Dacun", "彰化縣", "Changhua County", 23.9911, 120.5394],
["516", "埔鹽鄉", "Puyan", "彰化縣", "Changhua County", 23.9961, 120.462],
["520", "田中鎮", "Tianzhong", "彰化縣", "Changhua County", 23.85, 120.5833],
["521", "北斗鎮", "Beidou", "彰化縣", "Changhua County", 23.8667, 120.5333],
["522", "田尾鄉", "Tianwei", "彰化縣", "Changhua County", 23.9, 120.5167],
["523", "埤頭鄉", "Pitou", "彰化縣", "Changhua County", 23.8833, 120.4667],
["524", "溪州鄉", "Xizhou", "彰化縣", "Changhua County", 23.8511, 120.4987],
["525", "竹塘鄉", "Zhutang", "彰化縣", "Changhua County", 23.8528, 120.411],
["526", "二林鎮", "Erlin", "彰化縣", "Changhua County", 23.9229, 120.409],
["527", "大城鄉", "Dacheng", "彰化縣", "Changhua County", 23.8667, 120.3167],
["528", "芳苑鄉", "Fangyuan", "彰化縣", "Changhua County", 23.9667, 120.35],
["530", "二水鄉", "Ershui", "彰化縣", "Changhua County", 23.8167, 120.6167],
["540", "南投市", "Nantou", "南投縣", "Nantou County", 23.9167, 120.6833],
["541", "中寮鄉", "Zhongliao", "南投縣", "Nantou County", 23.9167, 120.7833],
["542", "草屯鎮", "Caotun", "南投縣", "Nantou County", 23.9833, 120.7333],
["544", "國姓鄉", "Guoxing", "南投縣", "Nantou County", 24.0167, 120.85],
["545", "埔里鎮", "Puli", "南投縣", "Nantou County", 23.9667, 120.9667],
["546", "仁愛鄉", "Ren'ai", "南投縣", "Nantou County", 24.0253, 121.1311],
["551", "名間鄉", "Mingjian", "南投縣", "Nantou County", 23.85, 120.6667],
["552", "集集鎮", "Jiji", "南投縣", "Nantou County", 23.8286, 120.7864],
["553", "水里鄉", "Shuili", "南投縣", "Nantou County", 23.8167, 120.85],
["555", "魚池鄉", "Yuchi", "南投縣", "Nantou County", 23.8833, 120.9167],
["556", "信義鄉", "Xinyi", "南投縣", "Nantou County", 23.6624, 121.016],
["557", "竹山鎮", "Zhushan", "南投縣", "Nantou County", 23.6889, 120.7289],
["558", "鹿谷鄉", "Lugu", "南投縣", "Nantou County", 23.75, 120.7333],
["600", "東區", "East District", "嘉義市", "Chiayi City", 23.4889, 120.477],
["600", "西區", "West District", "嘉義市", "Chiayi City", 23.4837, 120.422],
["602", "番路鄉", "Fanlu", "嘉義縣", "Chiayi County", 23.4494, 120.603],
["603", "梅山鄉", "Meishan", "嘉義縣", "Chiayi County", 23.5634, 120.627],
["604", "竹崎鄉", "Zhuqi", "嘉義縣", "Chiayi County", 23.5065, 120.602],
["605", "阿里山鄉", "Alishan", "嘉義縣", "Chiayi County", 23.35, 120.8],
["606", "中埔鄉", "Zhongpu", "嘉義縣", "Chiayi County", 23.4082, 120.534],
["607", "大埔鄉", "Dapu", "嘉義縣", "Chiayi County", 23.2946, 120.5937],
["608", "水上鄉", "Shuishang", "嘉義縣", "Chiayi County", 23.4319, 120.415],
["611", "鹿草鄉", "Lucao", "嘉義縣", "Chiayi County", 23.4133, 120.309],
["612", "太保市", "Taibao", "嘉義縣", "Chiayi County", 23.4833, 120.3333],
["613", "朴子市", "Puzi", "嘉義縣", "Chiayi County", 23.4611, 120.242],
["614", "東石鄉", "Dongshi", "嘉義縣", "Chiayi County", 23.4666, 120.179],
["615", "六腳鄉", "Liujiao", "嘉義縣", "Chiayi County", 23.5167, 120.2667],
["616", "新港鄉", "Xingang", "嘉義縣", "Chiayi County", 23.55, 120.35],
["621", "民雄鄉", "Minxiong", "嘉義縣", "Chiayi County", 23.5504, 120.446],
["622", "大林鎮", "Dalin", "嘉義縣", "Chiayi County", 23.5989, 120.47],
["623", "溪口鄉", "Xikou", "嘉義縣", "Chiayi County", 23.5947, 120.395],
["624", "義竹鄉", "Yizhu", "嘉義縣", "Chiayi County", 23.3565, 120.224],
["625", "布袋鎮", "Budai", "嘉義縣", "Chiayi County", 23.3783, 120.1671],
["630", "斗南鎮", "Dounan", "雲林縣", "Yunlin County", 23.6833, 120.4833],
["631", "大埤鄉", "Dapi", "雲林縣", "Yunlin County", 23.6494, 120.425],
["632", "虎尾鎮", "Huwei", "雲林縣", "Yunlin County", 23.72, 120.435],
["633", "土庫鎮", "Tuku", "雲林縣", "Yunlin County", 23.7, 120.35],
["634", "褒忠鄉", "Baozhong", "雲林縣", "Yunlin County", 23.7167, 120.3],
["635", "東勢鄉", "Dongshi", "雲林縣", "Yunlin County", 23.7, 120.25],
["636", "臺西鄉", "Taixi", "雲林縣", "Yunlin County", 23.7167, 120.2],
["637", "崙背鄉", "Lunbei", "雲林縣", "Yunlin County", 23.7833, 120.3333],
["638", "麥寮鄉", "Mailiao", "雲林縣", "Yunlin County", 23.7833, 120.25],
["640", "斗六市", "Douliu", "雲林縣", "Yunlin County", 23.7075, 120.5439],
["643", "林內鄉", "Linnei", "雲林縣", "Yunlin County", 23.75, 120.6167],
["646", "古坑鄉", "Gukeng", "雲林縣", "Yunlin County", 23.65, 120.5667],
["647", "莿桐鄉", "Citong", "雲林縣", "Yunlin County", 23.7667, 120.5333],
["648", "西螺鎮", "Xiluo", "雲林縣", "Yunlin County", 23.7833, 120.45],
["649", "二崙鄉", "Erlun", "雲林縣", "Yunlin County", 23.7833, 120.4],
["651", "北港鎮", "Beigang", "雲林縣", "Yunlin County", 23.5701, 120.3016],
["652", "水林鄉", "Shuilin", "雲林縣", "Yunlin County", 23.5662, 120.234],
["653", "口湖鄉", "Kouhu", "雲林縣", "Yunlin County", 23.5763, 120.173],
["654", "四湖鄉", "Sihu", "雲林縣", "Yunlin County", 23.65, 120.2],
["655", "元長鄉", "Yuanchang", "雲林縣", "Yunlin County", 23.642, 120.323],
["700", "中西區", "West Central District", "臺南市", "Tainan City", 22.9965, 120.194],
["701", "東區", "East District", "臺南市", "Tainan City", 22.9857, 120.226],
["702", "南區", "South District", "臺南市", "Tainan City", 22.9616, 120.191],
["704", "北區", "North District", "臺南市", "Tainan City", 23.0109, 120.207],
["708", "安平區", "Anping", "臺南市", "Tainan City", 22.9935, 120.1649],
["709", "安南區", "Annan", "臺南市", "Tainan City", 23.0473, 120.1847],
["710", "永康區", "Yongkang", "臺南市", "Tainan City", 23.0333, 120.25],
["711", "歸仁區", "Guiren", "臺南市", "Tainan City", 22.9667, 120.2833],
["712", "新化區", "Xinhua", "臺南市", "Tainan City", 23.0383, 120.3108],
["713", "左鎮區", "Zuozhen", "臺南市", "Tainan City", 23.0333, 120.4],
["714", "玉井區", "Yujing", "臺南市", "Tainan City", 23.1167, 120.4667],
["715", "楠西區", "Nanxi", "臺南市", "Tainan City", 23.1833, 120.5167],
["716", "南化區", "Nanhua", "臺南市", "Tainan City", 23.1167, 120.55],
["717", "仁德區", "Rende", "臺南市", "Tainan City", 22.95, 120.2333],
["718", "關廟區", "Guanmiao", "臺南市", "Tainan City", 22.9597, 120.3278],
["719", "龍崎區", "Longqi", "臺南市", "Tainan City", 22.9667, 120.3833],
["720", "官田區", "Guantian", "臺南市", "Tainan City", 23.2, 120.3333],
["721", "麻豆區", "Madou", "臺南市", "Tainan City", 23.1833, 120.2483],
["722", "佳里區", "Jiali", "臺南市", "Tainan City", 23.17, 120.178],
["723", "西港區", "Xigang", "臺南市", "Tainan City", 23.1333, 120.2],
["724", "七股區", "Qigu", "臺南市", "Tainan City", 23.1333, 120.1167],
["725", "將軍區", "Jiangjun", "臺南市", "Tainan City", 23.2, 120.1167],
["726", "學甲區", "Xuejia", "臺南市", "Tainan City", 23.25, 120.1833],
["727", "北門區", "Beimen", "臺南市", "Tainan City", 23.2833, 120.1333],
["730", "新營區", "Xinying", "臺南市", "Tainan City", 23.3, 120.2833],
["731", "後壁區", "Houbi", "臺南市", "Tainan City", 23.3627, 120.349],
["732", "白河區", "Baihe", "臺南市", "Tainan City", 23.3667, 120.45],
["733", "東山區", "Dongshan", "臺南市", "Tainan City", 23.2852, 120.433],
["734", "六甲區", "Liujia", "臺南市", "Tainan City", 23.224, 120.377],
["735", "下營區", "Xiaying", "臺南市", "Tainan City", 23.2291, 120.2646],
["736", "柳營區", "Liuying", "臺南市", "Tainan City", 23.2833, 120.35],
["737", "鹽水區", "Yanshui", "臺南市", "Tainan City", 23.3, 120.2331],
["741", "善化區", "Shanhua", "臺南市", "Tainan City", 23.15, 120.2833],
["742", "大內區", "Danei", "臺南市", "Tainan City", 23.15, 120.3833],
["743", "山上區", "Shanshang", "臺南市", "Tainan City", 23.1, 120.3667],
["744", "新市區", "Xinshi", "臺南市", "Tainan City", 23.0833, 120.2667],
["745", "安定區", "Anding", "臺南市", "Tainan City", 23.0956, 120.2222],
["800", "新興區", "Xinxing", "高雄市", "Kaohsiung City", 22.6247, 120.3013],
["801", "前金區", "Qianjin", "高雄市", "Kaohsiung City", 22.6288, 120.295],
["802", "苓雅區", "Lingya", "高雄市", "Kaohsiung City", 22.6236, 120.317],
["803", "鹽埕區", "Yancheng", "高雄市", "Kaohsiung City", 22.6247, 120.2868],
["804", "鼓山區", "Gushan", "高雄市", "Kaohsiung City", 22.6489, 120.2725],
["805", "旗津區", "Qijin", "高雄市", "Kaohsiung City", 22.5874, 120.2879],
["806", "前鎮區", "Qianzhen", "高雄市", "Kaohsiung City", 22.6006, 120.315],
["807", "三民區", "Sanmin", "高雄市", "Kaohsiung City", 22.6562, 120.327],
["811", "楠梓區", "Nanzi", "高雄市", "Kaohsiung City", 22.7268, 120.2975],
["812", "小港區", "Xiaogang", "高雄市", "Kaohsiung City", 22.5544, 120.36],
["813", "左營區", "Zuoying", "高雄市", "Kaohsiung City", 22.6822, 120.294],
["814", "仁武區", "Renwu", "高雄市", "Kaohsiung City", 22.697, 120.358],
["815", "大社區", "Dashe", "高雄市", "Kaohsiung City", 22.7431, 120.371],
["820", "岡山區", "Gangshan", "高雄市", "Kaohsiung City", 22.8, 120.2833],
["821", "路竹區", "Luzhu", "高雄市", "Kaohsiung City", 22.855, 120.265],
["822", "阿蓮區", "Alian", "高雄市", "Kaohsiung City", 22.8833, 120.3333],
["823", "田寮區", "Tianliao", "高雄市", "Kaohsiung City", 22.8651, 120.39],
["824", "燕巢區", "Yanchao", "高雄市", "Kaohsiung City", 22.7893, 120.369],
["825", "橋頭區", "Qiaotou", "高雄市", "Kaohsiung City", 22.7518, 120.301],
["826", "梓官區", "Ziguan", "高雄市", "Kaohsiung City", 22.7491, 120.255],
["827", "彌陀區", "Mituo", "高雄市", "Kaohsiung City", 22.7801, 120.24],
["828", "永安區", "Yong'an", "高雄市", "Kaohsiung City", 22.8227, 120.227],
["829", "湖內區", "Hunei", "高雄市", "Kaohsiung City", 22.895, 120.225],
["830", "鳳山區", "Fengshan", "高雄市", "Kaohsiung City", 22.6333, 120.35],
["831", "大寮區", "Daliao", "高雄市", "Kaohsiung City", 22.5963, 120.414],
["832", "林園區", "Linyuan", "高雄市", "Kaohsiung City", 22.5071, 120.3949],
["833", "鳥松區", "Niaosong", "高雄市", "Kaohsiung City", 22.6612, 120.372],
["840", "大樹區", "Dashu", "高雄市", "Kaohsiung City", 22.6934, 120.4331],
["842", "旗山區", "Qishan", "高雄市", "Kaohsiung City", 22.868, 120.474],
["843", "美濃區", "Meinong", "高雄市", "Kaohsiung City", 22.9, 120.54],
["844", "六龜區", "Liugui", "高雄市", "Kaohsiung City", 22.997, 120.648],
["845", "內門區", "Neimen", "高雄市", "Kaohsiung City", 22.9518, 120.468],
["846", "杉林區", "Shanlin", "高雄市", "Kaohsiung City", 23.0004, 120.563],
["847", "甲仙區", "Jiaxian", "高雄市", "Kaohsiung City", 23.0833, 120.5833],
["848", "桃源區", "Taoyuan", "高雄市", "Kaohsiung City", 23.2388, 120.834],
["849", "那瑪夏區", "Namaxia", "高雄市", "Kaohsiung City", 23.2716, 120.726],
["851", "茂林區", "Maolin", "高雄市", "Kaohsiung City", 22.9274, 120.746],
["852", "茄萣區", "Qieding", "高雄市", "Kaohsiung City", 22.9068, 120.1826],
["880", "馬公市", "Magong", "澎湖縣", "Penghu County", 23.5653, 119.5864],
["881", "西嶼鄉", "Xiyu", "澎湖縣", "Penghu County", 23.6086, 119.5114],
["882", "望安鄉", "Wang'an", "澎湖縣", "Penghu County", 23.3581, 119.4972],
["883", "七美鄉", "Qimei", "澎湖縣", "Penghu County", 23.2114, 119.4317],
["884", "白沙鄉", "Baisha", "澎湖縣", "Penghu County", 23.6634, 119.5924],
["885", "湖西鄉", "Huxi", "澎湖縣", "Penghu County", 23.5833, 119.6667],
["890", "金沙鎮", "Jinsha", "金門縣", "Kinmen County", 24.4811, 118.428],
["891", "金湖鎮", "Jinhu", "金門縣", "Kinmen County", 24.4377, 118.428],
["892", "金寧鄉", "Jinning", "金門縣", "Kinmen County", 24.4567, 118.3345],
["893", "金城鎮", "Jincheng", "金門縣", "Kinmen County", 24.4167, 118.3167],
["894", "烈嶼鄉", "Lieyu", "金門縣", "Kinmen County", 24.4281, 118.235],
["896", "烏坵鄉", "Wuqiu", "金門縣", "Kinmen County", 24.9833, 119.45],
["900", "屏東市", "Pingtung", "屏東縣", "Pingtung County", 22.6761, 120.4942],
["901", "三地門鄉", "Sandimen", "屏東縣", "Pingtung County", 22.7167, 120.65],
["902", "霧臺鄉", "Wutai", "屏東縣", "Pingtung County", 22.7667, 120.8],
["903", "瑪家鄉", "Majia", "屏東縣", "Pingtung County", 22.6783, 120.665],
["904", "九如鄉", "Jiuru", "屏東縣", "Pingtung County", 22.7333, 120.4833],
["905", "里港鄉", "Ligang", "屏東縣", "Pingtung County", 22.8, 120.5],
["906", "高樹鄉", "Gaoshu", "屏東縣", "Pingtung County", 22.8, 120.5833],
["907", "鹽埔鄉", "Yanpu", "屏東縣", "Pingtung County", 22.7333, 120.5667],
["908", "長治鄉", "Changzhi", "屏東縣", "Pingtung County", 22.7, 120.55],
["909", "麟洛鄉", "Linluo", "屏東縣", "Pingtung County", 22.6519, 120.5292],
["911", "竹田鄉", "Zhutian", "屏東縣", "Pingtung County", 22.5942, 120.5342],
["912", "內埔鄉", "Neipu", "屏東縣", "Pingtung County", 22.65, 120.5875],
["913", "萬丹鄉", "Wandan", "屏東縣", "Pingtung County", 22.5833, 120.4667],
["920", "潮州鎮", "Chaozhou", "屏東縣", "Pingtung County", 22.5333, 120.55],
["921", "泰武鄉", "Taiwu", "屏東縣", "Pingtung County", 22.6, 120.6833],
["922", "來義鄉", "Laiyi", "屏東縣", "Pingtung County", 22.5, 120.6833],
["923", "萬巒鄉", "Wanluan", "屏東縣", "Pingtung County", 22.5833, 120.5833],
["924", "崁頂鄉", "Kanding", "屏東縣", "Pingtung County", 22.5167, 120.4833],
["925", "新埤鄉", "Xinpi", "屏東縣", "Pingtung County", 22.4833, 120.5833],
["926", "南州鄉", "Nanzhou", "屏東縣", "Pingtung County", 22.4789, 120.516],
["927", "林邊鄉", "Linbian", "屏東縣", "Pingtung County", 22.4333, 120.5167],
["928", "東港鎮", "Donggang", "屏東縣", "Pingtung County", 22.4667, 120.4667],
["929", "琉球鄉", "Liuqiu", "屏東縣", "Pingtung County", 22.3417, 120.3694],
["931", "佳冬鄉", "Jiadong", "屏東縣", "Pingtung County", 22.4333, 120.5333],
["932", "新園鄉", "Xinyuan", "屏東縣", "Pingtung County", 22.5167, 120.45],
["940", "枋寮鄉", "Fangliao", "屏東縣", "Pingtung County", 22.4, 120.6],
["941", "枋山鄉", "Fangshan", "屏東縣", "Pingtung County", 22.2564, 120.6583],
["942", "春日鄉", "Chunri", "屏東縣", "Pingtung County", 22.3833, 120.7],
["943", "獅子鄉", "Shizi", "屏東縣", "Pingtung County", 22.2018, 120.7054],
["944", "車城鄉", "Checheng", "屏東縣", "Pingtung County", 22.0833, 120.75],
["945", "牡丹鄉", "Mudan", "屏東縣", "Pingtung County", 22.15, 120.8],
["946", "恆春鎮", "Hengchun", "屏東縣", "Pingtung County", 22.0, 120.75],
["947", "滿州鄉", "Manzhou", "屏東縣", "Pingtung County", 22.05, 120.8333],
["950", "臺東市", "Taitung", "臺東縣", "Taitung County", 22.7583, 121.1444],
["951", "綠島鄉", "Green Island", "臺東縣", "Taitung County", 22.6667, 121.4833],
["952", "蘭嶼鄉", "Lanyu", "臺東縣", "Taitung County", 22.0464, 121.5383],
["953", "延平鄉", "Yanping", "臺東縣", "Taitung County", 22.9, 120.9833],
["954", "卑南鄉", "Beinan", "臺東縣", "Taitung County", 22.7667, 121.0],
["955", "鹿野鄉", "Luye", "臺東縣", "Taitung County", 22.9525, 121.163],
["956", "關山鎮", "Guanshan", "臺東縣", "Taitung County", 23.0181, 121.1939],
["957", "海端鄉", "Haiduan", "臺東縣", "Taitung County", 23.1333, 121.0333],
["958", "池上鄉", "Chishang", "臺東縣", "Taitung County", 23.1, 121.2167],
["959", "東河鄉", "Donghe", "臺東縣", "Taitung County", 22.9748, 121.2983],
["961", "成功鎮", "Chenggong", "臺東縣", "Taitung County", 23.1167, 121.35],
["962", "長濱鄉", "Changbin", "臺東縣", "Taitung County", 23.3333, 121.4167],
["963", "太麻里鄉", "Taimali", "臺東縣", "Taitung County", 22.5833, 120.9833],
["964", "金峰鄉", "Jinfeng", "臺東縣", "Taitung County", 22.6, 120.9667],
["965", "大武鄉", "Dawu", "臺東縣", "Taitung County", 22.3667, 120.9],
["966", "達仁鄉", "Daren", "臺東縣", "Taitung County", 22.3667, 120.8167],
["970", "花蓮市", "Hualien", "花蓮縣", "Hualien County", 23.9722, 121.6064],
["971", "新城鄉", "Xincheng", "花蓮縣", "Hualien County", 24.0514, 121.6083],
["972", "秀林鄉", "Xiulin", "花蓮縣", "Hualien County", 24.2167, 121.5333],
["973", "吉安鄉", "Ji'an", "花蓮縣", "Hualien County", 23.95, 121.5722],
["974", "壽豐鄉", "Shoufeng", "花蓮縣", "Hualien County", 23.8667, 121.5167],
["975", "鳳林鎮", "Fenglin", "花蓮縣", "Hualien County", 23.7333, 121.45],
["976", "光復鄉", "Guangfu", "花蓮縣", "Hualien County", 23.6351, 121.4228],
["977", "豐濱鄉", "Fengbin", "花蓮縣", "Hualien County", 23.5911, 121.5038],
["978", "瑞穗鄉", "Ruisui", "花蓮縣", "Hualien County", 23.5333, 121.4061],
["979", "萬榮鄉", "Wanrong", "花蓮縣", "Hualien County", 24.0514, 121.608],
["981", "玉里鎮", "Yuli", "花蓮縣", "Hualien County", 23.3875, 121.3764],
["982", "卓溪鄉", "Zhuoxi", "花蓮縣", "Hualien County", 23.3333, 121.2833],
["983", "富里鄉", "Fuli", "花蓮縣", "Hualien County", 23.2167, 121.3]
];
var DIST_SUFFIX = { '區': 'District', '鄉': 'Township', '鎮': 'Township', '市': 'City' };
DISTRICTS.forEach(function (d) {
  var zh = d[1], en = d[2], suf = DIST_SUFFIX[zh.slice(-1)] || '';
  var enName = /District$/.test(en) ? en : en + (suf ? ' ' + suf : '');
  var cityShort = d[4].replace(/ (City|County)( \(.*\))?$/, '');
  var bare = zh.length > 2 ? zh.slice(0, -1) : zh;               // 南屯區 → 南屯
  var czhAlt = d[3].replace(/臺/g, '台');
  var aliases = [d[0], zh, bare, d[3] + zh, czhAlt + zh, czhAlt.slice(0, -1) + zh, en.replace(/'/g, ''), en.toLowerCase().replace(/[' ]/g, '')].join(' ');
  addPlace('District', enName + ', ' + cityShort, aliases, d[5], d[6], d[0] + ' · ' + zh + ' · ' + d[4], {
    postal: d[0], zh: zh, locName: enName, locSub: cityShort + ' · ' + d[0] + ' ' + zh
  });
});

// Points just off Taiwan's coast, clockwise from the north. The wave model has no value on land, so an
// inland location reads waves at the nearest of these (each one checked against Open-Meteo Marine).
var COAST = [
  ['Keelung', 25.16, 121.75], ['Tamsui', 25.19, 121.40], ['Taoyuan', 25.12, 121.24], ['Hsinchu', 24.85, 120.92], ['Miaoli', 24.62, 120.75],
  ['Taichung Port', 24.29, 120.50], ['Changhua', 24.07, 120.38], ['Yunlin', 23.78, 120.15], ['Chiayi', 23.38, 120.13], ['Tainan', 23.00, 120.14],
  ['Kaohsiung', 22.61, 120.26], ['Donggang', 22.46, 120.43], ['Kenting', 21.94, 120.78], ['Taitung', 22.79, 121.20], ['Chenggong', 23.10, 121.38],
  ['Hualien', 23.98, 121.63], ['Su’ao', 24.60, 121.87], ['Toucheng', 24.86, 121.84], ['Fulong', 25.02, 121.95]
];

var SKYLINES = (function () {
  var mk = function (hs, x0, w) { return hs.map(function (h, i) { return { x: x0 + i * (w + 6), y: 220 - h, w: w, h: h }; }); };
  return {
    Taipei: { lat: 25.0330, lon: 121.5654, label: 'Taipei skyline: Taipei 101 between city blocks, with Elephant Mountain and Yangmingshan behind',
      mtnFar: 'M0,220 L0,120 Q140,60 300,100 Q420,40 560,90 Q640,70 700,110 L1200,140 L1200,220 Z', mtnNear: 'M820,220 L820,170 Q900,120 980,150 Q1060,110 1200,160 L1200,220 Z',
      blds: mk([60, 90, 70, 110, 80, 50, 95, 120, 70], 420, 30).concat(mk([70, 100, 60, 85, 55], 860, 34)),
      landmark: 'M752,220 V160 H744 L752,142 H746 L754,124 H748 L756,106 H750 L758,88 H752 L760,70 H756 V44 H760 V14 H764 V44 H768 V70 H764 L772,88 H766 L774,106 H768 L776,124 H770 L778,142 H772 L780,160 H772 V220 Z' },
    Taichung: { lat: 24.1477, lon: 120.6736, label: 'Taichung skyline: the National Taichung Theater, a box cut by curved openings, in front of the Dakeng hills',
      mtnFar: 'M0,220 L0,140 L160,80 L260,120 L380,60 L520,110 L660,70 L800,120 L960,80 L1200,120 L1200,220 Z', mtnNear: 'M0,220 L0,180 Q200,140 400,170 Q600,150 800,175 Q1000,150 1200,180 L1200,220 Z',
      blds: mk([50, 80, 65, 95, 70, 55], 270, 34).concat(mk([60, 85, 75, 50], 840, 34)),
      landmark: 'M520,220 V108 H780 V220 Z M536,108 a7,7 0 0 1 14,0 Z M578,108 a5,5 0 0 1 10,0 Z M630,108 a9,9 0 0 1 18,0 Z M690,108 a6,6 0 0 1 12,0 Z M742,108 a8,8 0 0 1 16,0 Z',
      glass: 'M505,111 L535,111 C550,117.3 550,139.7 535,146 L505,146 C490,139.7 490,117.3 505,111 Z M569,111 L599,111 C614,117.3 614,139.7 599,146 L569,146 C554,139.7 554,117.3 569,111 Z M633,111 L663,111 C678,117.3 678,139.7 663,146 L633,146 C618,139.7 618,117.3 633,111 Z M697,111 L727,111 C742,117.3 742,139.7 727,146 L697,146 C682,139.7 682,117.3 697,111 Z M761,111 L791,111 C806,117.3 806,139.7 791,146 L761,146 C746,139.7 746,117.3 761,111 Z M537,147 L567,147 C582,153.5 582,176.5 567,183 L537,183 C522,176.5 522,153.5 537,147 Z M601,147 L631,147 C646,153.5 646,176.5 631,183 L601,183 C586,176.5 586,153.5 601,147 Z M665,147 L695,147 C710,153.5 710,176.5 695,183 L665,183 C650,176.5 650,153.5 665,147 Z M729,147 L759,147 C774,153.5 774,176.5 759,183 L729,183 C714,176.5 714,153.5 729,147 Z M505,184 L535,184 C550,190.5 550,213.5 535,220 L505,220 C490,213.5 490,190.5 505,184 Z M569,184 L599,184 C614,190.5 614,213.5 599,220 L569,220 C554,213.5 554,190.5 569,184 Z M633,184 L663,184 C678,190.5 678,213.5 663,220 L633,220 C618,213.5 618,190.5 633,184 Z M697,184 L727,184 C742,190.5 742,213.5 727,220 L697,220 C682,213.5 682,190.5 697,184 Z M761,184 L791,184 C806,190.5 806,213.5 791,220 L761,220 C746,213.5 746,190.5 761,184 Z', glassClip: [520, 108, 260, 112] },
    Tainan: { lat: 22.9999, lon: 120.2270, label: 'Tainan skyline: a temple roof with upturned eaves among low old-town houses',
      mtnFar: 'M0,220 L0,170 Q300,140 600,165 Q900,145 1200,170 L1200,220 Z', mtnNear: 'M0,220 L1200,220 L1200,219 L0,219 Z',
      blds: mk([40, 55, 45, 60, 50, 42], 300, 40).concat(mk([45, 58, 40, 52, 48], 820, 40)),
      landmark: 'M590,220 V170 H556 Q584,164 600,138 H720 Q736,164 764,170 H730 V220 Z M612,138 Q640,126 660,108 Q680,126 708,138 Z' },
    Kaohsiung: { lat: 22.6273, lon: 120.3014, label: 'Kaohsiung skyline: the 85 Sky Tower with Shoushan behind',
      mtnFar: 'M0,220 L0,130 Q120,70 260,110 Q320,130 380,160 L1200,175 L1200,220 Z', mtnNear: 'M0,220 L0,205 Q300,198 600,206 Q900,198 1200,206 L1200,220 Z',
      blds: mk([60, 95, 70, 110, 80], 420, 34).concat(mk([90, 65, 100, 75, 55], 820, 34)),
      landmark: 'M640,220 V100 H660 V70 H680 V30 H686 V4 H690 V30 H696 V70 H716 V100 H736 V220 H706 V150 H670 V220 Z' },
    Hualien: { lat: 23.9769, lon: 121.6044, label: 'Hualien: the steep Central Range dropping to Pacific waves',
      mtnFar: 'M0,220 L0,110 L110,30 L200,100 L320,10 L430,90 L560,20 L690,100 L820,40 L960,110 L1080,50 L1200,100 L1200,220 Z', mtnNear: 'M0,220 L0,150 L160,80 L300,150 L460,90 L620,160 L800,110 L1000,170 L1200,140 L1200,220 Z',
      blds: mk([30, 40, 34, 45, 30, 38, 42], 380, 36),
      landmark: 'M0,220 V206 Q30,196 60,206 Q90,196 120,206 Q150,196 180,206 Q210,196 240,206 L240,220 Z M900,220 V206 Q930,196 960,206 Q990,196 1020,206 Q1050,196 1080,206 Q1110,196 1140,206 Q1170,196 1200,206 V220 Z' },
    World: { label: 'A generic city skyline. City art is drawn for Taiwan locations.',
      mtnFar: 'M0,220 L0,170 Q300,130 600,160 Q900,130 1200,165 L1200,220 Z', mtnNear: 'M0,220 L1200,220 L1200,219 L0,219 Z',
      blds: mk([50, 80, 60, 100, 70, 55, 90], 380, 40).concat(mk([60, 75, 50], 820, 40)), landmark: '' }
  };
})();

var WEATHER = (function () {
  var white = 'rgba(255,255,255,0.95)', whiteU = 'rgba(205,215,230,0.9)';
  return {
    'clear-day': { label: 'Clear day', top: '#1550C4', mid: '#3F8EE8', bottom: '#86C3F4', sun: true, sx: 78, sy: 14, glow: 'rgba(255,245,215,0.45)', core: '#FFF1B8', clouds: [1, 'rgba(255,255,255,0.7)', 'rgba(230,236,245,0.6)', 0.6, 120], mtn: '#FFFFFF' },
    'partly-cloudy': { label: 'Partly cloudy', top: '#1A58C4', mid: '#4A93E4', bottom: '#93C6F0', sun: true, sx: 76, sy: 16, glow: 'rgba(255,245,215,0.4)', core: '#FFF1B8', clouds: [4, white, whiteU, 0.92, 260], mtn: '#FFFFFF' },
    'cloudy': { label: 'Cloudy', top: '#5F708A', mid: '#8695AA', bottom: '#AEB9C8', clouds: [7, 'rgba(236,240,246,0.95)', 'rgba(150,162,180,0.9)', 0.95, 300], mtn: '#DDE3EC' },
    'rain': { label: 'Rain', top: '#344255', mid: '#4F5E73', bottom: '#6E7C92', clouds: [8, 'rgba(150,162,180,0.95)', 'rgba(80,92,110,0.95)', 0.95, 300], rain: true, mtn: '#9AA6B8' },
    'thunderstorm': { label: 'Thunderstorm', top: '#141A26', mid: '#262E3D', bottom: '#3F4757', clouds: [9, 'rgba(90,98,115,0.97)', 'rgba(35,40,52,0.97)', 0.97, 300], rain: true, storm: true, mtn: '#6B7486' },
    'clear-night': { label: 'Clear night', top: '#040A1E', mid: '#0C1A42', bottom: '#1E3068', stars: true, moon: true, clouds: [1, 'rgba(120,135,170,0.5)', 'rgba(60,70,100,0.5)', 0.5, 200], mtn: '#3A4C80' },
    'dawn': { label: 'Dawn', top: '#26346F', mid: '#B9799F', bottom: '#F5C08A', sun: true, sx: 22, sy: 46, glow: 'rgba(255,200,150,0.5)', core: '#FFD8A0', warm: true, stars: true, clouds: [3, 'rgba(255,205,200,0.85)', 'rgba(170,120,150,0.8)', 0.85, 200], mtn: '#6B4E7A' },
    'dusk': { label: 'Dusk', top: '#1C2054', mid: '#8F4C82', bottom: '#F0895C', sun: true, sx: 80, sy: 48, glow: 'rgba(255,170,110,0.5)', core: '#FFC48A', warm: true, clouds: [3, 'rgba(255,180,140,0.85)', 'rgba(140,80,110,0.85)', 0.85, 220], mtn: '#5A3A6A' }
  };
})();

var MAP_PLACES = [
  { name: 'Taipei', x: 205, y: 55 }, { name: 'Taichung', x: 125, y: 190 }, { name: 'Nantou', x: 165, y: 230 },
  { name: 'Hualien', x: 225, y: 215 }, { name: 'Chiayi', x: 110, y: 290 }, { name: 'Kaohsiung', x: 118, y: 385 }, { name: 'Taitung', x: 195, y: 350 }
];
// Prediction datasets. They carry no values of their own: levels come from a live feed (liveSet) or the
// dataset shows a loading / not connected / unavailable state (setState).
var DATASETS = [
  { id: 'pm25', group: 'By Skyline', title: 'PM2.5 forecast', src: 'Team PM2.5 model + Open-Meteo CAMS', desc: 'Fine-particle pollution by region, about four days ahead.',
    labels: ['Good', 'Moderate', 'Sensitive', 'Unhealthy'], legend: ['Good (0–15)', 'Moderate (16–35)', 'Sensitive (36–54)', 'Unhealthy (55+)'] },
  { id: 'landslide', group: 'By Skyline', title: 'Landslide risk', src: 'Team landslide model', desc: 'Slope-failure risk from satellite data, rain and soil saturation.',
    labels: ['Low', 'Medium', 'High', 'Very high'], legend: ['Low', 'Medium', 'High', 'Very high'] },
  { id: 'rain', group: 'Others', title: 'Rain', src: 'Open-Meteo', desc: 'Rain that fell in the 24 hours up to each time.',
    labels: ['< 2 mm', '2–10 mm', '10–40 mm', '40+ mm'], legend: ['< 2 mm', '2–10 mm', '10–40 mm', '40+ mm'] },
  { id: 'thunder', group: 'Others', title: 'Thunderstorms', src: 'Open-Meteo · CAPE', desc: 'Storm energy (CAPE): where thunderstorms can form.',
    labels: ['Unlikely', 'Possible', 'Likely', 'Severe'], legend: ['CAPE < 500', '500–1500', '1500–2500', '2500+ J/kg'] },
  { id: 'wind', group: 'Others', title: 'Wind & gusts', src: 'Open-Meteo', desc: 'Peak gusts by region.',
    labels: ['Calm', 'Breezy', 'Strong', 'Gale'], legend: ['< 20 km/h', '20–40', '40–60', '60+ km/h'] },
  { id: 'typhoon', group: 'Others', title: 'Typhoon track', src: 'CWA typhoon warnings', desc: 'Storm position, forecast track and its distance from each region.',
    labels: ['700+ km', '400–700 km', '200–400 km', '< 200 km'], legend: ['700+ km away', '400–700 km', '200–400 km', '< 200 km'] },
  { id: 'waves', group: 'Others', title: 'Coast & waves', src: 'Open-Meteo Marine', desc: 'Wave height at the coast nearest each region.',
    labels: ['< 1 m', '1–2 m', '2–3 m', '3+ m'], legend: ['< 1 m', '1–2 m', '2–3 m', '3+ m'] },
  { id: 'climate', group: 'Others', title: 'Seasonal outlook', src: 'ECMWF SEAS5 · Open-Meteo', desc: 'Next month’s temperature compared with normal, from the ECMWF seasonal forecast.',
    labels: ['< +0.5 °C', '+0.5–1 °C', '+1–1.5 °C', '+1.5 °C or more'], legend: ['< +0.5 °C', '+0.5–1 °C', '+1–1.5 °C', '+1.5 °C or more'] }
];

var PIN_IDS = ['thunder', 'pm25', 'wind', 'landslide', 'rain', 'humidity', 'uv', 'pressure', 'visibility', 'waves'];

/* ============================================================
   State (saved in localStorage when available)
   ============================================================ */
// Settings live under KEY. People who used the earlier build have theirs under OLD_KEY: those are
// copied over once (the old entry is left alone) and everything is saved under KEY from then on.
var KEY = 'skyline-v1', OLD_KEY = 'skyline-mockup-v1';
var DEFAULTS = {
  loc: { name: 'Xinyi District', sub: 'Taipei · 110 信義區', lat: 25.0330, lon: 121.5654, kind: 'District' },
  weather: 'live', dataV: 2, pinCount: 3, pins: PIN_IDS.slice(), order: null, spans: {}, hidden: {},
  accent: '#FFC24B', risk: 'default', bgMode: 'live', tiles: 'glass', fonts: 'default', radius: 24, skyline: 'city', mapBase: 'auto',
  reduceMotion: false, units: 'C', lang: 'en',
  sources: { openMeteo: true, windyMap: true, pm25: true, landslide: true, typhoon: true },
  recents: [], predBase: {}, predT: NOW,
  ai: { provider: 'builtin', oaBase: 'https://openrouter.ai/api/v1', oaModel: '', claudeModel: 'claude-opus-5-5', remember: false }
};
var THEME_KEYS = ['accent', 'risk', 'bgMode', 'tiles', 'fonts', 'radius', 'skyline', 'mapBase'];
function clone(o) { return JSON.parse(JSON.stringify(o)); }
var S = clone(DEFAULTS);
// ?demo=1 puts the sky preview picker back on Home (it is always in Settings).
var DEMO_UI = /[?&]demo=1(&|$)/.test(location.search || '');
try {
  var savedRaw = localStorage.getItem(KEY), migrated = false;
  if (savedRaw == null) { savedRaw = localStorage.getItem(OLD_KEY); migrated = savedRaw != null; }
  var saved = JSON.parse(savedRaw || 'null');
  if (saved && typeof saved === 'object') {
    for (var k in saved) if (k in DEFAULTS) S[k] = saved[k];
    S.sources = Object.assign(clone(DEFAULTS.sources), saved.sources || {});
    S.ai = Object.assign(clone(DEFAULTS.ai), saved.ai || {});
    if (S.ai.provider === 'demo') S.ai.provider = 'builtin';   // the old "Demo" provider is now the built-in summary
    S.dataV = DEFAULTS.dataV;
    if (migrated) localStorage.setItem(KEY, JSON.stringify(S));
  }
} catch (e) { /* storage unavailable: run with defaults */ }
// The sky preview is a session-only control: every load starts on live weather.
S.weather = 'live';
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

var editing = false, dragId = null, chat = null, lastRoute = '', pendingAsk = null;

/* ============================================================
   Helpers
   ============================================================ */
function $(s, el) { return (el || document).querySelector(s); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function inTW(lat, lon) { return lat >= 21.7 && lat <= 26.5 && lon >= 118.0 && lon <= 122.2; }
function km(aLat, aLon, bLat, bLon) {
  var R = 6371, toR = Math.PI / 180;
  var dLat = (bLat - aLat) * toR, dLon = (bLon - aLon) * toR;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
function fmtKm(d) { return d < 1 ? d.toFixed(1) + ' km' : d < 10 ? d.toFixed(1) + ' km' : Math.round(d).toLocaleString() + ' km'; }
function fmtCoord(lat, lon) {
  return Math.abs(lat).toFixed(4) + '° ' + (lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(lon).toFixed(4) + '° ' + (lon >= 0 ? 'E' : 'W');
}
function pal() { return PALS[S.risk] || PALS['default']; }
function inkFor(hex) {
  var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return '#0B1B3F';
  var c = [m[1], m[2], m[3]].map(function (x) { var v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  var L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return L > 0.35 ? '#2A1A00' : '#FFFFFF';
}
function fmtT(c) { return (S.units === 'F' ? Math.round(c * 9 / 5 + 32) : Math.round(c)) + '°'; }
// Automatic names (typed coordinates, GPS, default) come from the district in Taiwan or the
// nearest city elsewhere, never from a university, airport or landmark. Those only become the
// location name when the user picks them in search.
function nearestPlace(lat, lon) {
  var best = null, bd = Infinity, second = null, sd = Infinity, kind = inTW(lat, lon) ? 'District' : 'City';
  PLACES.forEach(function (p) {
    if (p.kind !== kind) return;
    var d = km(lat, lon, p.lat, p.lon);
    if (d < bd) { second = best; sd = bd; bd = d; best = p; }
    else if (d < sd) { sd = d; second = p; }
  });
  return { place: best, d: bd, second: second, d2: sd };
}
// We only have district centres, not boundaries, so "nearest centre" can name the neighbour for a
// point close to a border. When the two nearest centres are almost equally far (within 10%), the
// point is in that uncertain band: keep the nearest as the name but say which district it borders.
function borderDistrict(np) {
  var p = np.place, s = np.second;
  if (!p || !s || p.kind !== 'District' || !(np.d2 < 25)) return null;
  return np.d >= 0.9 * np.d2 ? s : null;
}
// Location record for a point: "Nantun District · Taichung · 408 南屯區" in Taiwan, the city elsewhere.
function autoLoc(lat, lon, kind, extraSub) {
  var np = nearestPlace(lat, lon), p = np.place, c = fmtCoord(lat, lon);
  var nb = borderDistrict(np);
  if (p && p.kind === 'District' && np.d < 25) return { name: p.locName, sub: p.locSub + (nb ? ' · near ' + nb.locName + ' border' : '') + (extraSub ? ' · ' + extraSub : ''), lat: lat, lon: lon, kind: kind };
  if (p && p.kind === 'City' && np.d < 40) return { name: p.name, sub: (p.sub ? p.sub + ' · ' : '') + (extraSub || c), lat: lat, lon: lon, kind: kind };
  return { name: extraSub === 'Current location' ? 'My location' : c, sub: p && np.d < 150 ? 'Near ' + p.name : (extraSub || 'Coordinates'), lat: lat, lon: lon, kind: kind };
}
function skylineFor(L) {
  if (!inTW(L.lat, L.lon)) return SKYLINES.World;
  var best = 'Taipei', bd = Infinity;
  ['Taipei', 'Taichung', 'Tainan', 'Kaohsiung', 'Hualien'].forEach(function (n) {
    var d = km(L.lat, L.lon, SKYLINES[n].lat, SKYLINES[n].lon);
    if (d < bd) { bd = d; best = n; }
  });
  return SKYLINES[best];
}
function project(L) { return { x: 205 + (L.lon - 121.5654) * 69, y: 55 + (25.033 - L.lat) * 137.5 }; }
function toast(msg) {
  var t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 3600);
}

/* ============================================================
   Theme
   ============================================================ */
function applyTheme() {
  var r = document.documentElement.style;
  r.setProperty('--accent', S.accent);
  r.setProperty('--accent-ink', inkFor(S.accent));
  r.setProperty('--r', S.radius + 'px');
  document.body.classList.toggle('solid-tiles', S.tiles === 'solid');
  document.body.classList.toggle('system-fonts', S.fonts === 'system');
  document.body.classList.toggle('reduce-motion', !!S.reduceMotion);
}
function themeIsDefault() { return THEME_KEYS.every(function (k) { return S[k] === DEFAULTS[k]; }); }

/* ============================================================
   Sky background
   ============================================================ */
function cloudBg(c, under) {
  return 'radial-gradient(ellipse 34% 46% at 28% 58%, ' + c + ' 0%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 30% 54% at 50% 42%, ' + c + ' 0%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 26% 42% at 72% 55%, ' + c + ' 0%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 58% 26% at 50% 78%, ' + under + ' 0%, rgba(0,0,0,0) 75%)';
}
/* ============================================================
   Sky effects (canvas): layered clouds, rain, lightning.
   Back canvas (behind the skyline): clouds, cloud lighting, bolts.
   Front canvas (in front of skyline and text): rain, splashes, haze.
   Flashes are capped at 2 per strike with ≥3.5 s between strikes
   (under the 3-flashes-per-second photosensitivity limit), and
   Reduce motion draws a single still frame with no lightning.
   ============================================================ */
var SkyFX = (function () {
  var FX = {
    'clear-day':     { cu: 2, size: [220, 340], light: [255, 255, 255, 0.82], shade: [170, 190, 215, 0.45], drift: 5 },
    'partly-cloudy': { cu: 6, size: [280, 560], light: [255, 255, 255, 0.97], shade: [146, 164, 194, 0.72], drift: 7 },
    'cloudy':        { deck: 1, cu: 5, size: [380, 700], light: [228, 233, 241, 0.98], shade: [112, 124, 145, 0.9], drift: 9, haze: 0.14 },
    'rain':          { deck: 1, cu: 4, size: [420, 760], light: [146, 156, 172, 0.98], shade: [48, 57, 72, 0.96], drift: 14, rain: 1, wind: 0.12, haze: 0.32 },
    'thunderstorm':  { deck: 1, cu: 4, size: [460, 820], light: [96, 104, 120, 0.99], shade: [12, 15, 23, 0.98], drift: 22, rain: 1.7, wind: 0.24, haze: 0.4, lightning: 1 },
    'clear-night':   { cu: 2, size: [240, 400], light: [118, 132, 168, 0.42], shade: [24, 30, 56, 0.55], drift: 4 },
    'dawn':          { cu: 4, size: [260, 500], light: [255, 204, 194, 0.95], shade: [116, 82, 126, 0.8], drift: 5, hl: -1 },
    'dusk':          { cu: 4, size: [260, 500], light: [255, 176, 130, 0.95], shade: [96, 56, 94, 0.86], drift: 5, hl: 1 }
  };
  var st = null;

  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? c[3] : a).toFixed(3) + ')'; }

  // One cloud, drawn once to an offscreen canvas: many soft puffs, lit from the sun side,
  // shaded underneath, with a flat fading base (cumulus) or a ragged sheet (deck).
  function sprite(w, h, f, seed, flat, dpr) {
    var c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    var g = c.getContext('2d'); g.scale(dpr, dpr);
    var R = rng(seed), base = h * (flat ? 0.86 : 0.8), n = Math.round(w / (flat ? 8 : 11)), hl = f.hl || 0;
    for (var i = 0; i < n; i++) {
      var x = w * (0.07 + 0.86 * R()), d = Math.abs(x / w - 0.5) * 2;
      var hf = flat ? 0.6 + 0.4 * R() : Math.max(0.06, 1 - Math.pow(d, 1.5));
      var r = flat ? h * (0.13 + 0.15 * R()) : h * (0.12 + 0.17 * R()) * (0.5 + 0.5 * hf);
      var y = flat ? h * (0.22 + 0.55 * R()) : base - r * 0.5 - R() * h * 0.52 * hf;
      var gr = g.createRadialGradient(x + hl * r * 0.45, y - r * 0.5, r * 0.04, x, y, r);
      gr.addColorStop(0, rgba(f.light, f.light[3]));
      gr.addColorStop(0.55, rgba(f.light, f.light[3] * 0.8));
      gr.addColorStop(1, rgba(f.light, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-atop';
    // inner billows: darker pockets give the cloud body texture
    for (var k = 0; k < n * 0.6; k++) {
      var bx = w * (0.1 + 0.8 * R()), by = h * (0.35 + 0.5 * R()), br = h * (0.06 + 0.12 * R());
      var bg = g.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0, rgba(f.shade, f.shade[3] * 0.35)); bg.addColorStop(1, rgba(f.shade, 0));
      g.fillStyle = bg; g.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    // underside shading
    var lg = g.createLinearGradient(0, h * (flat ? 0.15 : 0.3), 0, base);
    lg.addColorStop(0, rgba(f.shade, 0)); lg.addColorStop(1, rgba(f.shade, f.shade[3]));
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    // flat, softly fading base
    g.globalCompositeOperation = 'destination-out';
    var fb = g.createLinearGradient(0, base - h * 0.04, 0, base + h * (flat ? 0.14 : 0.1));
    fb.addColorStop(0, 'rgba(0,0,0,0)'); fb.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = fb; g.fillRect(0, base - h * 0.04, w, h);
    return c;
  }

  function layoutClouds(s) {
    var f = s.f, W = s.W, H = s.H, R = rng(11), out = [];
    if (f.deck) {
      // overlapping sheets make a full overcast deck
      for (var row = 0; row < 3; row++) {
        for (var col = 0; col < 3; col++) {
          var w = W * (0.55 + 0.2 * R()), h = H * (0.2 + 0.08 * R());
          out.push({ img: sprite(w, h, f, 100 + row * 7 + col, true, s.dpr), w: w, h: h,
            x: col * W * 0.42 - W * 0.12 + R() * 60, y: -H * 0.08 + row * H * 0.1, v: f.drift * (0.6 + row * 0.25) });
        }
      }
    }
    for (var i = 0; i < f.cu; i++) {
      var cw = Math.min(W * 0.75, f.size[0] + R() * (f.size[1] - f.size[0])), ch = cw * (0.5 + 0.12 * R());
      out.push({ img: sprite(cw, ch, f, 300 + i * 13, false, s.dpr), w: cw, h: ch,
        x: R() * (W + cw) - cw, y: H * (f.deck ? 0.12 + 0.24 * R() : 0.02 + 0.34 * R()), v: f.drift * (0.8 + 0.8 * R()) });
    }
    out.sort(function (a, b) { return a.y - b.y; });
    s.clouds = out;
  }

  function size(s) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var bw = s.back.clientWidth, bh = s.back.clientHeight;
    var pin = s.hero.querySelector('.pinned-wrap');
    var fh = pin ? pin.offsetTop : s.hero.clientHeight;
    s.front.style.height = fh + 'px';
    [[s.back, bw, bh], [s.front, bw, fh]].forEach(function (a) { a[0].width = Math.round(a[1] * dpr); a[0].height = Math.round(a[2] * dpr); });
    s.dpr = dpr; s.W = bw; s.H = bh; s.FH = fh;
    s.bctx.setTransform(dpr, 0, 0, dpr, 0, 0); s.fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutClouds(s);
    if (s.f.rain) seedRain(s);
  }

  function seedRain(s) {
    var R = Math.random, n = Math.min(1500, Math.round(s.f.rain * 420 * (s.W * s.FH) / (1280 * 700)));
    s.drops = [];
    for (var i = 0; i < n; i++) { var d = { z: i % 10 < 5 ? 0.3 : i % 10 < 8 ? 0.6 : 1 }; respawn(s, d, true); s.drops.push(d); }
    s.splash = [];
    s.curtains = [0, 1, 2].map(function (i) { return { x: R() * s.W, w: 140 + R() * 260, a: 0.04 + R() * 0.05 }; });
  }
  function respawn(s, d, anywhere) {
    var wind = s.f.wind || 0;
    d.y = anywhere ? Math.random() * s.FH : -Math.random() * s.FH * 0.25;
    d.x = Math.random() * (s.W + s.FH * wind) - s.FH * wind;
    d.v = (680 + 1150 * d.z) * (s.f.lightning ? 1.1 : 1);
    d.len = (12 + 36 * d.z) * (s.f.lightning ? 1.15 : 1);
    d.gy = d.z >= 0.6 ? s.FH * (0.8 + 0.2 * Math.random()) : Infinity;
  }

  // Lightning: midpoint-displacement bolt with branches
  function boltPath(x0, y0, x1, y1, R) {
    var pts = [[x0, y0], [x1, y1]], disp = Math.hypot(x1 - x0, y1 - y0) * 0.2;
    for (var k = 0; k < 7; k++) {
      var np = [pts[0]];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, off = (R() - 0.5) * disp;
        np.push([(a[0] + b[0]) / 2 - dy / L * off, (a[1] + b[1]) / 2 + dx / L * off], b);
      }
      pts = np; disp *= 0.52;
    }
    return pts;
  }
  function makeStrike(s) {
    var R = Math.random, W = s.W, H = s.H, now = performance.now();
    var cloudToGround = R() < 0.55;
    var x0 = W * (0.12 + 0.76 * R()), y0 = H * (0.16 + 0.08 * R());
    var ev = { t0: now, x: x0, y: y0, paths: [], peaks: [[0, 1]] };
    if (R() < 0.7) ev.peaks.push([140 + R() * 120, 0.55 + R() * 0.4]);   // a second return stroke
    if (cloudToGround) {
      var x1 = x0 + (R() - 0.5) * W * 0.25, y1 = H * 1.05;
      var main = boltPath(x0, y0, x1, y1, R);
      ev.paths.push({ pts: main, w: 2.2 });
      var nb = 3 + Math.floor(R() * 4);
      for (var b = 0; b < nb; b++) {
        var i = Math.floor(R() * main.length * 0.7), p = main[i];
        var ang = Math.atan2(y1 - y0, x1 - x0) + (R() < 0.5 ? -1 : 1) * (0.35 + R() * 0.6);
        var len = (0.12 + R() * 0.3) * (y1 - y0);
        var br = boltPath(p[0], p[1], p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len, R);
        ev.paths.push({ pts: br, w: 0.9 });
        if (R() < 0.4) {
          var q = br[Math.floor(br.length * (0.3 + R() * 0.4))], a2 = ang + (R() - 0.5) * 1.2;
          ev.paths.push({ pts: boltPath(q[0], q[1], q[0] + Math.cos(a2) * len * 0.45, q[1] + Math.sin(a2) * len * 0.45, R), w: 0.5 });
        }
      }
    } else {
      // in-cloud flash: sometimes a faint horizontal spider bolt inside the base
      ev.y = H * (0.06 + 0.2 * R());
      if (R() < 0.5) ev.paths.push({ pts: boltPath(x0 - W * 0.12, ev.y + 20, x0 + W * 0.12, ev.y + 10 + R() * 30, R), w: 0.7, faint: true });
    }
    s.strike = ev;
    s.nextStrike = now + 3500 + R() * 7000;
  }
  function flashLevel(ev, now) {
    var t = now - ev.t0, I = 0;
    ev.peaks.forEach(function (p) { if (t >= p[0]) I = Math.max(I, p[1] * Math.exp(-(t - p[0]) / 75)); });
    return t > 1000 ? 0 : I;
  }
  function strokePath(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); }

  function drawBack(s, now, dt) {
    var g = s.bctx, W = s.W, H = s.H, f = s.f;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    if (f.deck) {
      var tg = g.createLinearGradient(0, 0, 0, H * 0.6);
      tg.addColorStop(0, rgba(f.shade, 0.75)); tg.addColorStop(1, rgba(f.shade, 0));
      g.fillStyle = tg; g.fillRect(0, 0, W, H * 0.6);
    }
    s.clouds.forEach(function (c) {
      c.x += c.v * dt;
      if (c.x > W) c.x = -c.w;
      g.drawImage(c.img, c.x, c.y, c.w, c.h);
    });
    var ev = s.strike, I = ev ? flashLevel(ev, now) : 0;
    s.flash = I;
    if (I > 0.01) {
      // light the clouds from inside, around the strike
      g.globalCompositeOperation = 'source-atop';
      var rg = g.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, W * 0.5);
      rg.addColorStop(0, 'rgba(232,236,255,' + (0.85 * I).toFixed(3) + ')');
      rg.addColorStop(0.4, 'rgba(190,200,240,' + (0.35 * I).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(190,200,240,0)');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
      // and the air behind them, a little
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(200,210,255,' + (0.16 * I).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
      if (ev.paths.length) {
        g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
        [[12, '120,140,255', 0.08], [5, '170,190,255', 0.3], [2, '220,228,255', 0.7], [0.9, '255,255,255', 1]].forEach(function (pass) {
          ev.paths.forEach(function (p) {
            g.lineWidth = p.w * pass[0];
            g.strokeStyle = 'rgba(' + pass[1] + ',' + (pass[2] * I * (p.faint ? 0.45 : 1)).toFixed(3) + ')';
            strokePath(g, p.pts);
          });
        });
      }
      g.globalCompositeOperation = 'source-over';
    } else if (ev && now - ev.t0 > 1000) s.strike = null;
  }

  function drawFront(s, now, dt, still) {
    var g = s.fctx, W = s.W, H = s.FH, f = s.f;
    g.clearRect(0, 0, W, H);
    if (!f.rain && !f.haze) return;
    var wind = f.wind || 0;
    if (f.rain) {
      // drifting rain curtains
      s.curtains.forEach(function (c) {
        c.x += (40 + wind * 300) * dt; if (c.x - c.w > W + H * wind) c.x = -c.w - H * wind;
        g.save(); g.setTransform(s.dpr, 0, wind * s.dpr, s.dpr, c.x * s.dpr, 0);
        var cg = g.createLinearGradient(-c.w / 2, 0, c.w / 2, 0);
        cg.addColorStop(0, 'rgba(190,200,215,0)'); cg.addColorStop(0.5, 'rgba(190,200,215,' + (c.a * f.rain).toFixed(3) + ')'); cg.addColorStop(1, 'rgba(190,200,215,0)');
        g.fillStyle = cg; g.fillRect(-c.w / 2, 0, c.w, H); g.restore();
      });
    }
    if (f.haze) {
      var hz = g.createLinearGradient(0, H * 0.5, 0, H);
      var hc = s.flash > 0.01 ? [175 + 60 * s.flash, 185 + 55 * s.flash, 205 + 50 * s.flash] : [150, 160, 176];
      hz.addColorStop(0, 'rgba(' + hc.map(Math.round).join(',') + ',0)');
      hz.addColorStop(1, 'rgba(' + hc.map(Math.round).join(',') + ',' + f.haze.toFixed(3) + ')');
      g.fillStyle = hz; g.fillRect(0, H * 0.5, W, H * 0.5);
    }
    if (!f.rain) return;
    var lit = s.flash || 0;
    [0.3, 0.6, 1].forEach(function (z) {
      g.beginPath();
      s.drops.forEach(function (d) {
        if (d.z !== z) return;
        if (!still) {
          d.y += d.v * dt; d.x += d.v * wind * dt;
          if (d.y >= d.gy) { addSplash(s, d.x, d.gy); respawn(s, d, false); return; }
          if (d.y - d.len > H) { respawn(s, d, false); return; }
        }
        g.moveTo(d.x, d.y); g.lineTo(d.x - wind * d.len, d.y - d.len);
      });
      var a = (0.09 + 0.3 * z) * (still ? 0.6 : 1) + lit * 0.35 * z;
      g.strokeStyle = 'rgba(' + (205 + 50 * lit | 0) + ',' + (216 + 39 * lit | 0) + ',235,' + Math.min(0.9, a).toFixed(3) + ')';
      g.lineWidth = 0.6 + 0.9 * z; g.lineCap = 'round'; g.stroke();
    });
    if (still) return;
    g.fillStyle = 'rgba(215,225,240,0.55)';
    for (var i = s.splash.length - 1; i >= 0; i--) {
      var p = s.splash[i]; p.life -= dt;
      if (p.life <= 0) { s.splash.splice(i, 1); continue; }
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = Math.min(1, p.life / 0.25); g.fillRect(p.x, p.y, 1.4, 1.4);
    }
    g.globalAlpha = 1;
  }
  function addSplash(s, x, y) {
    if (s.splash.length > 400) return;
    for (var k = 0; k < 2 + (Math.random() * 2 | 0); k++) s.splash.push({ x: x, y: y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 110, life: 0.22 + Math.random() * 0.18 });
  }

  function frame(now) {
    var s = st; if (!s) return;
    var dt = Math.min(0.05, (now - (s.last || now)) / 1000); s.last = now;
    if (s.f.lightning && !s.strike && now >= s.nextStrike) makeStrike(s);
    drawBack(s, now, dt);
    drawFront(s, now, dt, false);
    s.raf = requestAnimationFrame(frame);
  }

  function start(hero, weather, still) {
    stop();
    var back = hero && hero.querySelector('.wx-back'), front = hero && hero.querySelector('.wx-front');
    if (!back || !front) return;
    var s = st = { hero: hero, back: back, front: front, bctx: back.getContext('2d'), fctx: front.getContext('2d'),
      f: FX[weather] || FX['partly-cloudy'], clouds: [], drops: [], splash: [], strike: null, flash: 0,
      nextStrike: performance.now() + 1500 + Math.random() * 2500 };
    size(s);
    s.ro = new ResizeObserver(function () { if (st === s) { size(s); if (still) paintStill(s); } });
    s.ro.observe(hero);
    if (still) paintStill(s); else s.raf = requestAnimationFrame(frame);
  }
  function paintStill(s) { drawBack(s, performance.now(), 0); drawFront(s, 0, 0, true); }
  function stop() {
    if (!st) return;
    cancelAnimationFrame(st.raf);
    if (st.ro) st.ro.disconnect();
    st = null;
  }
  return { start: start, stop: stop, rng: rng };
})();

function skyLayers(b) {
  var h = '<div class="sky" aria-hidden="true">';
  if (b.stars) h += '<div class="stars sk-stars"></div>';
  if (b.moon) h += '<div class="moon"></div>';
  if (b.sun) {
    var x = b.sx + '%', y = b.sy + '%';
    h += '<div class="sun-glow" style="left:' + x + ';top:' + y + ';background:radial-gradient(circle,' + b.glow + ' 0%,rgba(255,240,200,0) 60%)"></div>' +
      '<div class="sun sk-flare" style="left:' + x + ';top:' + y + ';background:radial-gradient(circle,#FFFFFF 0%,#FFFBEA 18%,' + b.core + ' 34%,rgba(255,210,120,0) 70%)"></div>' +
      '<div class="streak" style="left:' + x + ';top:' + y + '"></div>';
    var ks = [0.35, 0.62, 0.9, 1.25, 1.6], sizes = [40, 90, 24, 140, 60];
    var cols = b.warm
      ? ['rgba(255,190,120,0.22)', 'rgba(255,140,90,0.12)', 'rgba(255,220,160,0.3)', 'rgba(255,150,120,0.08)', 'rgba(255,200,140,0.15)']
      : ['rgba(160,220,255,0.22)', 'rgba(140,255,200,0.12)', 'rgba(255,230,160,0.3)', 'rgba(180,160,255,0.08)', 'rgba(140,200,255,0.16)'];
    ks.forEach(function (k, i) {
      var gx = b.sx + (50 - b.sx) * k * 1.2, gy = b.sy + (55 - b.sy) * k * 1.2, s = sizes[i];
      h += '<div class="flare-ghost" style="left:' + gx + '%;top:' + gy + '%;width:' + s + 'px;height:' + s + 'px;margin:' + (-s / 2) + 'px 0 0 ' + (-s / 2) + 'px;background:radial-gradient(circle,' + cols[i] + ' 0%,rgba(255,255,255,0) 72%);' + (i === 3 ? 'border:1px solid rgba(200,230,255,0.18)' : '') + '"></div>';
    });
  }
  h += '<canvas class="wx-back" aria-hidden="true"></canvas>';
  return h + '</div>';
}
function litShare() { return { 'clear-night': 0.42, 'dusk': 0.34, 'thunderstorm': 0.38, 'rain': 0.28, 'dawn': 0.16, 'cloudy': 0.1 }[wxKey()] || 0; }
function litWindows(city) {
  var share = litShare();
  if (!share) return '';
  var R = SkyFX.rng(7), w = '';
  city.blds.forEach(function (r) {
    for (var y = r.y + 7; y < 210; y += 9) for (var x = r.x + 5; x <= r.x + r.w - 8; x += 7) if (R() < share) w += '<rect x="' + x + '" y="' + y + '" width="3" height="4"/>';
  });
  return '<g fill="#FFD58A" fill-opacity="0.72">' + w + '</g>';
}
function skylineSVG(city, b) {
  var blds = city.blds.map(function (r) { return '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="2"/>'; }).join('');
  return '<svg class="skyline" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice" role="img" aria-label="' + esc(city.label) + '">' +
    '<path d="' + city.mtnFar + '" fill="' + b.mtn + '" fill-opacity="0.35"/>' +
    '<path d="' + city.mtnNear + '" fill="#0B1B3F" fill-opacity="0.4"/>' +
    '<g fill="#0B1B3F" fill-opacity="0.82">' + blds + '</g>' + litWindows(city) +
    (city.landmark ? '<path d="' + city.landmark + '" fill="#0B1B3F" fill-opacity="0.95"/>' : '') +
    (city.glass ? '<clipPath id="lm-clip"><rect x="' + city.glassClip[0] + '" y="' + city.glassClip[1] + '" width="' + city.glassClip[2] + '" height="' + city.glassClip[3] + '"/></clipPath><path clip-path="url(#lm-clip)" d="' + city.glass + '" fill="' + (litShare() >= 0.28 ? '#FFD58A' : '#C7D6EE') + '" fill-opacity="' + (litShare() >= 0.28 ? 0.62 : 0.42) + '"/>' : '') +
    '<rect x="0" y="214" width="1200" height="8" fill="#0B1B3F"/></svg>';
}

/* ============================================================
   Live data
   - Open-Meteo (no key) gives current conditions, the hourly and 7-day forecast, air
     quality (CAMS), waves (Marine) and the ECMWF seasonal outlook for S.loc, plus hourly
     values at the seven map cities for Predictions.
   - The team PM2.5 model (/api/predict) and the typhoon feed (/api/typhoon) are on the
     same origin. /api/health says which of them this server has.
   Nothing is invented. Until a feed arrives screens show a loading placeholder; when a
   refresh fails they keep the last good data and say how old it is, or show "Unavailable"
   with Retry; anything with no source says "Not connected yet". Only coordinates are sent out.
   ============================================================ */
var LIVE_TTL = 10 * 60 * 1000, RETRY_GAP = 2 * 60 * 1000, FEEDS = {}, liveTimer = 0;
var OM_WX = 'https://api.open-meteo.com/v1/forecast', OM_AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality', OM_SEA = 'https://marine-api.open-meteo.com/v1/marine';
var OM_SEASON = 'https://seasonal-api.open-meteo.com/v1/seasonal';
var SAME_ORIGIN = /^https?:$/.test(location.protocol);
var STEP_H = [-72, -48, -24, -12, 0, 6, 12, 24, 48, 72, 120, 168]; // hours from now for each TIMES step
var COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
var WMO_TEXT = { 0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Light showers', 81: 'Showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail' };

function getJSON(url) {
  var ac = window.AbortController ? new AbortController() : null;
  var tm = setTimeout(function () { if (ac) ac.abort(); }, 15000);
  return fetch(url, ac ? { signal: ac.signal } : {}).then(function (r) {
    if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }).then(function (d) { clearTimeout(tm); return d; }, function (e) { clearTimeout(tm); throw e; });
}
// One cached feed per name. Fresh for its ttl (LIVE_TTL unless given). A failed refresh keeps the
// last good data (err is set, so screens can say how old it is) and is retried after RETRY_GAP.
function feed(name, url, ok, ttl) {
  var f = FEEDS[name] || (FEEDS[name] = { t: 0, tried: 0, d: null, busy: false, err: false, code: 0 }), now = Date.now();
  if (f.busy || now - f.t < (ttl || LIVE_TTL) || now - f.tried < RETRY_GAP) return;
  f.busy = true; f.tried = now;
  getJSON(url).then(function (d) {
    f.busy = false;
    if (ok(d)) { f.d = d; f.t = Date.now(); f.err = false; f.code = 200; }
    else { f.err = true; f.code = 0; }
    liveArrived();
  }, function (e) { f.busy = false; f.err = true; f.code = (e && e.status) || 0; liveArrived(); });
}
// The last good data of a feed, however old (feedState says whether it is current)
function feedData(name) { var f = FEEDS[name]; return f && f.d ? f.d : null; }
// loading | ok | stale (old data, the refresh failed) | error (no data, the request failed) | gone (no such endpoint)
function feedState(name) {
  var f = FEEDS[name];
  if (!f) return 'loading';
  if (f.d) return f.err ? 'stale' : 'ok';
  if (f.busy || !f.tried) return 'loading';
  return f.code === 404 || f.code === 405 || f.code === 501 || f.code === 503 ? 'gone' : 'error';
}
function fmtAge(t) {
  var m = Math.max(1, Math.round((Date.now() - t) / 60000));
  return m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago';
}
// Suffix for a source name: " · live" for current data, the age of the data when a refresh failed
function liveTag(name) { var f = FEEDS[name]; return f && f.d && f.err ? ' · ' + fmtAge(f.t) : ' · live'; }
function offline() { return typeof navigator !== 'undefined' && navigator.onLine === false; }
function liveOn() { return S.sources.openMeteo !== false; }
function ptKey(L) { return L.lat.toFixed(3) + ',' + L.lon.toFixed(3); }
function liveWx() { return liveOn() ? feedData('wx@' + ptKey(S.loc)) : null; }
function liveAir() { return liveOn() ? feedData('air@' + ptKey(S.loc)) : null; }
function omState(prefix) { return liveOn() ? feedState(prefix + '@' + ptKey(S.loc)) : 'off'; }
function wxState() { return omState('wx'); }
function isNum(v) { return typeof v === 'number' && isFinite(v); }

// ----- server features -----
// /api/health lists what this server has, so a missing feature shows "Not connected yet" at once
// instead of after a failed request. When /api/health itself is missing (a plain static host),
// features stays null and each endpoint is simply tried.
var HEALTH = { state: 'checking', features: null, promise: null };   // state: checking | ok | missing
function loadHealth() {
  if (HEALTH.promise) return HEALTH.promise;
  if (!SAME_ORIGIN) { HEALTH.state = 'missing'; return (HEALTH.promise = Promise.resolve(HEALTH)); }
  var ctrl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
  HEALTH.promise = fetch('/api/health', { signal: ctrl ? ctrl.signal : undefined, cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
    .then(function (j) { if (j && j.features && typeof j.features === 'object') { HEALTH.features = j.features; HEALTH.state = 'ok'; } })
    .catch(function () {})
    .then(function () { clearTimeout(timer); if (HEALTH.state === 'checking') HEALTH.state = 'missing'; return HEALTH; });
  return HEALTH.promise;
}
// true or false when the server said so, null when it did not
function feat(name) { return HEALTH.features && typeof HEALTH.features[name] === 'boolean' ? HEALTH.features[name] : null; }
// State of a same-origin feed: off (switched off in Settings) | gone (not on this server) | loading | ok | stale | error
function apiState(feature, feedName) {
  if (S.sources[feature] === false) return 'off';
  if (!SAME_ORIGIN || feat(feature) === false) return 'gone';
  if (HEALTH.state === 'checking') return 'loading';
  return feedState(feedName);
}
function tyState() { return apiState('typhoon', 'ty'); }
function pmData() { return S.sources.pm25 && feat('pm25') !== false ? feedData('pm') : null; }

// ----- waves -----
// Nearest COAST point to a place: [name, lat, lon, km away]
function nearestCoast(lat, lon) {
  var best = null, bd = Infinity;
  COAST.forEach(function (c) { var d = km(lat, lon, c[1], c[2]); if (d < bd) { bd = d; best = c; } });
  return [best[0], best[1], best[2], bd];
}
function seaURL(lat, lon, rest) { return OM_SEA + '?latitude=' + lat + '&longitude=' + lon + '&timezone=auto&cell_selection=sea' + rest; }
function isSea(d) { return !!(d && d.current && 'wave_height' in d.current); }
// Waves for S.loc: the sea point Open-Meteo finds at the location, else (in Taiwan) the nearest coast point.
function liveSea() {
  if (!liveOn()) return null;
  var L = S.loc, d = feedData('sea@' + ptKey(L));
  if (d && isNum(d.current.wave_height)) return { cur: d.current, coast: null, feed: 'sea@' + ptKey(L) };
  if (!d || !inTW(L.lat, L.lon)) return null;
  var cp = nearestCoast(L.lat, L.lon), d2 = feedData('coast@' + cp[0]);
  return d2 && isNum(d2.current.wave_height) ? { cur: d2.current, coast: cp, feed: 'coast@' + cp[0] } : null;
}
// As feedState, plus 'none': the wave model has no sea point for this location
function seaState() {
  if (!liveOn()) return 'off';
  var L = S.loc, st = feedState('sea@' + ptKey(L)), d = feedData('sea@' + ptKey(L));
  if (!d || isNum(d.current.wave_height)) return st;
  return inTW(L.lat, L.lon) ? feedState('coast@' + nearestCoast(L.lat, L.lon)[0]) : 'none';
}
// The coast point each map city reads waves from, or null when the coast is more than 50 km away (Nantou)
function regCoast() {
  return MAP_PLACES.map(function (p) { var ll = PLACE_LL[p.name], c = nearestCoast(ll[0], ll[1]); return c[3] <= 50 ? c : null; });
}

// ----- seasonal outlook -----
function isSeason(r) { return !!(r && r.monthly && Array.isArray(r.monthly.time) && Array.isArray(r.monthly.temperature_2m_anomaly)); }
function liveSeason() { return liveOn() ? feedData('season@' + ptKey(S.loc)) : null; }
// Index of the first whole month ahead that has a value, or -1
function seasonPick(m) {
  var n = new Date(), cur = n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-01';
  for (var i = 0; i < m.time.length; i++) if (String(m.time[i]) > cur && isNum(m.temperature_2m_anomaly[i])) return i;
  return -1;
}
function monthName(iso) { return new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'long' }); }
// A temperature difference (given in °C) in the chosen unit, signed: "+1.3°"
function fmtAnom(k) { var v = S.units === 'F' ? k * 1.8 : k; return (v > 0.04 ? '+' : v < -0.04 ? '−' : '') + Math.abs(v).toFixed(1) + '°'; }

function loadLive(page) {
  if (liveOn()) {
    var L = S.loc, k = ptKey(L), q = '?latitude=' + L.lat.toFixed(3) + '&longitude=' + L.lon.toFixed(3) + '&timezone=auto';
    feed('wx@' + k, OM_WX + q + '&forecast_days=7&forecast_hours=24' +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day,visibility' +
      '&hourly=temperature_2m,precipitation_probability,weather_code,cape,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,pressure_msl' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,sunrise,sunset',
      function (d) { return !!(d && d.current && isNum(d.current.temperature_2m) && d.hourly && Array.isArray(d.hourly.time) && d.daily && Array.isArray(d.daily.time) && d.daily.time.length); });
    feed('air@' + k, OM_AIR + q + '&forecast_hours=24&current=pm2_5,pm10,us_aqi&hourly=pm2_5',
      function (d) { return !!(d && d.current && isNum(d.current.pm2_5)); });
    var seaVars = '&current=wave_height,wave_direction,swell_wave_height';
    feed('sea@' + k, seaURL(L.lat.toFixed(3), L.lon.toFixed(3), seaVars), isSea);
    // No sea point at the location itself (inland): read the nearest point on Taiwan's coast instead
    var sea = feedData('sea@' + k);
    if (sea && !isNum(sea.current.wave_height) && inTW(L.lat, L.lon)) { var cp = nearestCoast(L.lat, L.lon); feed('coast@' + cp[0], seaURL(cp[1], cp[2], seaVars), isSea); }
    feed('season@' + k, OM_SEASON + '?latitude=' + L.lat.toFixed(3) + '&longitude=' + L.lon.toFixed(3) + '&monthly=temperature_2m_anomaly,precipitation_anomaly', isSeason, 6 * 3600000);
    if (page === 'predictions' || page === 'ask') {
      var lat = MAP_PLACES.map(function (p) { return PLACE_LL[p.name][0]; }).join(','), lon = MAP_PLACES.map(function (p) { return PLACE_LL[p.name][1]; }).join(',');
      var rq = '?latitude=' + lat + '&longitude=' + lon + '&timezone=auto&past_days=3', isReg = function (d) { return Array.isArray(d) && d.length === MAP_PLACES.length && !!d[0].hourly && Array.isArray(d[0].hourly.time); };
      feed('reg', OM_WX + rq + '&forecast_days=8&hourly=precipitation,cape,wind_gusts_10m', isReg);
      feed('regAir', OM_AIR + rq + '&forecast_days=7&hourly=pm2_5', isReg);
      var cs = regCoast().filter(function (c) { return c; });
      feed('regSea', seaURL(cs.map(function (c) { return c[1]; }).join(','), cs.map(function (c) { return c[2]; }).join(','), '&past_days=3&forecast_days=8&hourly=wave_height'),
        function (d) { return Array.isArray(d) && d.length === cs.length && !!d[0].hourly && Array.isArray(d[0].hourly.wave_height); });
      feed('regSeason', OM_SEASON + '?latitude=' + lat + '&longitude=' + lon + '&monthly=temperature_2m_anomaly',
        function (d) { return Array.isArray(d) && d.length === MAP_PLACES.length && isSeason(d[0]); }, 6 * 3600000);
    }
  }
  // Same-origin feeds wait for /api/health, then skip whatever the server says it does not have
  if (HEALTH.state === 'checking') { loadHealth().then(function () { loadLive(route().page); liveArrived(); }); return; }
  if (!SAME_ORIGIN) return;
  if (S.sources.pm25 && feat('pm25') !== false) feed('pm', '/api/predict', function (d) { return !!(d && isNum(d.pm25)); });
  if (S.sources.typhoon && feat('typhoon') !== false) feed('ty', '/api/typhoon', function (d) { return !!(d && typeof d.active === 'boolean'); });
}
// A feed arrived (or failed): redraw once things settle, without interrupting a drag or an open picker.
function liveArrived() {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(function () {
    var ae = document.activeElement, r = route();
    if (dragId || (ae && ae.id === 'demo-weather')) { liveArrived(); return; }
    loadLive(r.page);   // starts any follow-up request (the coast point for an inland location)
    var ch = applyLiveSets();
    if (r.page === 'home') rerender();
    else if (r.page === 'predictions' && (r.sub ? ch[r.sub] : Object.keys(ch).length)) rerender();
  }, 250);
}
// Retry now: forget the back-off on every failed feed and ask again.
function retryLive() {
  Object.keys(FEEDS).forEach(function (k) { var f = FEEDS[k]; if (f.err && !f.busy) f.tried = 0; });
  loadLive(route().page);
  rerender();
}

// ----- current conditions -----
function wmoText(code) { return WMO_TEXT[code] || 'Unknown'; }
function wmoKind(code) { return code >= 95 ? 'storm' : (code >= 51 && code <= 86) ? 'rain' : code >= 2 ? 'cloud' : 'sun'; }
function compass(deg) { return COMPASS[Math.round((((+deg % 360) + 360) % 360) / 45) % 8]; }
function bearing(aLat, aLon, bLat, bLon) {
  var r = Math.PI / 180, dl = (bLon - aLon) * r;
  return Math.atan2(Math.sin(dl) * Math.cos(bLat * r), Math.cos(aLat * r) * Math.sin(bLat * r) - Math.sin(aLat * r) * Math.cos(bLat * r) * Math.cos(dl)) / r;
}
function hourLabel(iso) { var h = +String(iso).substr(11, 2); return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'); }
function weekdayOf(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }); }
function fmtVis(m) { return m >= 10000 ? Math.round(m / 1000) + ' km' : (m / 1000).toFixed(1) + ' km'; }
function pmLevel(v) { return (v >= 15.5) + (v >= 35.5) + (v >= 54.5); }
// Which background matches the live weather code, day/night and sunrise/sunset
function liveCond(wx) {
  var c = wx.current, code = c.weather_code, dy = wx.daily;
  if (code >= 95) return 'thunderstorm';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 3 || code === 45 || code === 48 || (code >= 71 && code <= 86)) return 'cloudy';
  var local = Date.now() + (wx.utc_offset_seconds || 0) * 1000;
  var near = function (a) { var v = a && Date.parse(a[0] + ':00Z'); return isNum(v) && Math.abs(local - v) <= 40 * 60000; };
  if (near(dy.sunrise)) return 'dawn';
  if (near(dy.sunset)) return 'dusk';
  if (c.is_day === 0) return 'clear-night';
  return code === 2 ? 'partly-cloudy' : 'clear-day';
}
// The background in use: a preview pick (Settings) wins, then live weather. null while the weather
// is not known yet, so no particular sky is implied.
function wxKey() {
  if (S.weather !== 'live' && Object.prototype.hasOwnProperty.call(WEATHER, S.weather)) return S.weather;
  var wx = liveWx();
  return wx ? liveCond(wx) : null;
}
// Plain backdrop for "weather not known": no sun, clouds, rain or night
var SKY_UNKNOWN = { label: '', top: '#163A7A', mid: '#1F4C94', bottom: '#2A5AA8', mtn: '#9FB4DA' };
function skyNow() { var k = wxKey(); return k ? WEATHER[k] : SKY_UNKNOWN; }
function previewOn() { return S.weather !== 'live' && Object.prototype.hasOwnProperty.call(WEATHER, S.weather); }
function liveHeadline(wx) {
  var c = wx.current;
  return wmoText(c.weather_code) + (isNum(c.apparent_temperature) ? ' · feels like ' + fmtT(c.apparent_temperature) : '');
}
// What the hero shows now. Live (or last good) values, else only the state: loading | error | off.
function wxNow() {
  var wx = liveWx(), st = wxState();
  if (wx) return { live: true, stale: st === 'stale', t: FEEDS['wx@' + ptKey(S.loc)].t, temp: wx.current.temperature_2m, label: wmoText(wx.current.weather_code), headline: liveHeadline(wx), time: String(wx.current.time || '').substr(11, 5) };
  return { live: false, state: st === 'gone' ? 'error' : st };
}

// ----- Home tiles -----
// Why something has no value. st: loading | off | gone | none | nodata | error. kind: 'om' (Open-Meteo), 'ty' (typhoon feed), 'landslide'.
function naOf(st, kind) {
  if (kind === 'landslide') return { st: 'gone', h: 'Not connected yet', msg: feat('landslide') === true
    ? 'The landslide model is on the server, but this version of the app can’t show its output yet.'
    : 'The team landslide model isn’t connected yet. No value is shown until it is.' };
  if (st === 'loading') return { st: st, h: '—', msg: 'Loading…' };
  if (st === 'off') return { st: st, h: 'Turned off', msg: 'Open-Meteo is switched off in Settings.' };
  if (st === 'none') return { st: st, h: 'No sea nearby', msg: 'Open-Meteo Marine has no sea point near this location.' };
  if (st === 'gone' && kind === 'ty') return { st: st, h: 'Not connected yet', msg: 'The CWA typhoon feed isn’t connected on this server.' };
  if (st === 'ok' || st === 'stale') return { st: 'nodata', h: '—', msg: 'No reading from the source right now.' };
  return { st: 'error', h: 'Unavailable', retry: true, msg: offline() ? 'You’re offline. Reconnect, then retry.' : kind === 'ty' ? 'Couldn’t load the typhoon feed.' : 'Couldn’t reach Open-Meteo.' };
}
function tileNA(t) {
  if (t.id === 'landslide') return naOf('gone', 'landslide');
  if (t.id === 'typhoon') return naOf(tyState(), 'ty');
  return naOf(t.id === 'pm25' ? omState('air') : t.id === 'waves' ? seaState() : t.id === 'climate' ? omState('season') : wxState(), 'om');
}
// Fills tiles from the loaded feeds. A tile no feed can fill gets t.na (a state, never a number).
function liveTiles(all, L) {
  var wx = liveWx(), air = liveAir(), sea = liveSea(), season = liveSeason(), pm = pmData(), by = {}, k = ptKey(L);
  all.forEach(function (t) { by[t.id] = t; });
  function set(id, o) { var t = by[id]; if (!t) return; for (var key in o) t[key] = o[key]; t.live = true; }
  try {
    if (wx) {
      var c = wx.current, h = wx.hourly, dy = wx.daily, n = h.time.length, i, hours = [], tag = liveTag('wx@' + k), OM = 'Open-Meteo' + tag;
      // "Now" is only true of fresh data: an old first hour is labelled with its clock time instead
      var old = Date.now() - FEEDS['wx@' + k].t > 45 * 60000;
      for (i = 0; i < Math.min(10, n); i++) hours.push({ t: i || old ? hourLabel(h.time[i]) : 'Now', temp: fmtT(i ? h.temperature_2m[i] : c.temperature_2m), c: WEEK_COL[wmoKind(h.weather_code[i])], rain: Math.round(h.precipitation_probability[i] || 0) + '%' });
      set('hourly', { hours: hours, src: OM });
      set('week', { src: OM });
      // Same scoring as the MCP tool get_thunderstorm_risk
      var top = 0, topI = 0, capeMax = 0;
      for (i = 0; i < n; i++) {
        var cape = h.cape[i] || 0, pop = h.precipitation_probability[i] || 0, code = h.weather_code[i];
        var sc = (code === 96 || code === 99 ? 3 : code === 95 ? 2 : 0) + (cape >= 2500 ? 2 : cape >= 1000 ? 1 : 0) + (pop >= 60 ? 1 : 0);
        if (sc > top) { top = sc; topI = i; }
        if (cape > capeMax) capeMax = cape;
      }
      var lvl = top >= 5 ? 3 : top >= 3 ? 2 : top >= 2 ? 1 : 0;
      set('thunder', { value: ['Low', 'Moderate', 'High', 'Severe'][lvl], sub: 'CAPE up to ' + Math.round(capeMax).toLocaleString('en-US') + ' J/kg in 24 h' + (lvl ? ' · peak around ' + hourLabel(h.time[topI]) : ''), meter: [8, 38, 70, 92][lvl] + '%', src: 'Open-Meteo · CAPE + weather codes' + tag });
      var sd = [];
      for (i = 0; i < Math.min(3, dy.time.length); i++) if (dy.weather_code[i] >= 95) sd.push(i ? weekdayOf(dy.time[i]) : 'Today');
      set('storms', { value: sd.length ? sd.length + (sd.length > 1 ? ' days' : ' day') : 'None', sub: sd.length ? 'Thunderstorms forecast: ' + sd.join(', ') : 'No thunderstorms in the 3-day forecast', src: OM });
      if (isNum(c.wind_speed_10m)) set('wind', { value: Math.round(c.wind_speed_10m) + ' km/h', sub: 'Gusts ' + Math.round(c.wind_gusts_10m || 0) + ' km/h · from ' + compass(c.wind_direction_10m || 0), src: OM });
      if (isNum(dy.precipitation_sum[0])) set('rain', { value: (dy.precipitation_sum[0] < 10 ? dy.precipitation_sum[0].toFixed(1) : Math.round(dy.precipitation_sum[0])) + ' mm', sub: 'Chance of rain today: ' + Math.round(dy.precipitation_probability_max[0] || 0) + '%', src: OM });
      if (isNum(c.cloud_cover)) set('clouds', { value: Math.round(c.cloud_cover) + '%', sub: 'Low ' + Math.round(h.cloud_cover_low[0] || 0) + '% · Mid ' + Math.round(h.cloud_cover_mid[0] || 0) + '% · High ' + Math.round(h.cloud_cover_high[0] || 0) + '%', src: OM });
      if (isNum(c.relative_humidity_2m)) set('humidity', { value: Math.round(c.relative_humidity_2m) + '%', sub: isNum(c.dew_point_2m) ? 'Dew point ' + fmtT(c.dew_point_2m) : '', src: OM });
      if (isNum(c.pressure_msl)) {
        var dp = n > 3 && isNum(h.pressure_msl[3]) && isNum(h.pressure_msl[0]) ? h.pressure_msl[3] - h.pressure_msl[0] : 0;
        set('pressure', { value: Math.round(c.pressure_msl) + ' hPa', sub: dp <= -1 ? 'Falling over the next 3 hours' : dp >= 1 ? 'Rising over the next 3 hours' : 'Steady over the next 3 hours', src: OM });
      }
      if (isNum(c.visibility)) {
        var vmin = c.visibility;
        h.visibility.forEach(function (v) { if (isNum(v) && v < vmin) vmin = v; });
        set('visibility', { value: fmtVis(c.visibility), sub: 'Lowest in the next 24 h: ' + fmtVis(vmin), src: OM });
      }
      var uv = dy.uv_index_max[0];
      if (isNum(uv)) set('uv', { value: String(Math.round(uv)), sub: (uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very high' : 'Extreme') + ' at today’s peak', src: OM });
    }
    var nearTc = !!pm && km(L.lat, L.lon, 24.15, 120.67) <= 30; // the team model forecasts Taichung only
    if (air) {
      var p = air.current.pm2_5, hp = (air.hourly && air.hourly.pm2_5) || [], pk = -1, atag = liveTag('air@' + k);
      hp.forEach(function (v, j) { if (isNum(v) && (pk < 0 || v > hp[pk])) pk = j; });
      var cat = DATASETS[0].labels[pmLevel(p)];
      set('pm25', { value: (p < 10 ? p.toFixed(1) : Math.round(p)) + ' µg/m³',
        sub: nearTc ? cat + ' · tomorrow ' + pm.pm25 + ' µg/m³ (team model)' : cat + (pk >= 0 ? ' · peaks ' + Math.round(hp[pk]) + ' µg/m³ around ' + hourLabel(air.hourly.time[pk]) : ''),
        meter: Math.min(96, Math.round(p / 75 * 100)) + '%', src: (nearTc ? 'Team model + Open-Meteo CAMS' : 'Open-Meteo CAMS') + atag });
    } else if (nearTc) {
      set('pm25', { value: pm.pm25 + ' µg/m³', sub: 'Tomorrow’s average, ' + esc(pm.category || '') + ' (team model)', meter: Math.min(96, Math.round(pm.pm25 / 75 * 100)) + '%', src: 'Team PM2.5 model' + liveTag('pm') });
    }
    if (sea) set('waves', { value: sea.cur.wave_height.toFixed(1) + ' m', src: 'Open-Meteo Marine' + liveTag(sea.feed),
      sub: (isNum(sea.cur.swell_wave_height) ? 'Swell ' + sea.cur.swell_wave_height.toFixed(1) + ' m · ' : '') + (isNum(sea.cur.wave_direction) ? 'from ' + compass(sea.cur.wave_direction) + ' · ' : '') +
        (sea.coast ? 'off ' + sea.coast[0] + ', ' + fmtKm(sea.coast[3]) + ' away' : 'nearest sea point') });
    var si = season ? seasonPick(season.monthly) : -1;
    if (si >= 0) {
      var an = season.monthly.temperature_2m_anomaly[si], pa = (season.monthly.precipitation_anomaly || [])[si];
      set('climate', { value: fmtAnom(an), src: 'ECMWF SEAS5 · Open-Meteo' + liveTag('season@' + k),
        sub: monthName(season.monthly.time[si]) + ' · ' + (an >= 0.5 ? 'warmer than normal' : an <= -0.5 ? 'cooler than normal' : 'near normal') +
          (isNum(pa) ? ' · rain ' + (pa >= 0 ? '+' : '−') + Math.abs(Math.round(pa)) + ' mm vs normal' : '') });
    }
    var tv = tyView();
    if (tv.state === 'active' || tv.state === 'none') set('typhoon', { src: tv.src });
  } catch (e) { /* malformed feed: whatever was not set gets a state below */ }
  all.forEach(function (t) {
    if (t.live || t.id === 'map') return;
    t.na = tileNA(t); t.value = '—'; t.sub = t.na.h === '—' ? t.na.msg : t.na.h;
  });
}

// ----- Typhoon feed -----
// null: no feed (callers show the tyState() state, never a storm). Otherwise { active:false } or the first storm with a track.
function tyStorm() {
  var d = S.sources.typhoon ? feedData('ty') : null;
  if (!d) return null;
  var out = { active: false, source: String(d.source || 'CWA typhoon warnings'), updated: String(d.updated || '') };
  var st = d.active && Array.isArray(d.storms) ? d.storms.filter(function (s) { return s && Array.isArray(s.track) && s.track.length; })[0] : null;
  if (!st) return out;
  var pts = st.track.filter(function (p) { return p && isNum(+p.lat) && isNum(+p.lon) && p.lat !== null && p.lon !== null; })
    .map(function (p) { return { ll: [+p.lat, +p.lon], ms: Date.parse(p.time), fc: !!p.forecast, wind: p.wind_ms, hpa: p.pressure_hpa }; });
  if (!pts.length) return out;
  var cur = pts[0];
  pts.forEach(function (p) { if (!p.fc) cur = p; });
  out.active = true; out.pts = pts; out.cur = cur;
  out.name = String((S.lang === 'zh' && st.name_zh) || st.name || st.name_zh || 'Typhoon');
  out.timed = pts.length > 1 && pts.every(function (p) { return isNum(p.ms); });
  return out;
}
// Storm position at a slider step, or null when that time is outside the track
function tyPosAt(ty, step) {
  var p = ty.pts, n = p.length, i;
  if (n < 2) return p[0].ll;
  if (!ty.timed) {
    var k = step / (STEP_H.length - 1) * (n - 1), i0 = Math.min(n - 2, Math.floor(k)), f0 = k - i0;
    return [p[i0].ll[0] + (p[i0 + 1].ll[0] - p[i0].ll[0]) * f0, p[i0].ll[1] + (p[i0 + 1].ll[1] - p[i0].ll[1]) * f0];
  }
  var T = Date.now() + STEP_H[step] * 3600000, slack = 6 * 3600000;
  if (T < p[0].ms - slack || T > p[n - 1].ms + slack) return null;
  if (T <= p[0].ms) return p[0].ll;
  for (i = 0; i < n - 1; i++) if (T <= p[i + 1].ms) {
    var f = (T - p[i].ms) / Math.max(1, p[i + 1].ms - p[i].ms);
    return [p[i].ll[0] + (p[i + 1].ll[0] - p[i].ll[0]) * f, p[i].ll[1] + (p[i + 1].ll[1] - p[i].ll[1]) * f];
  }
  return p[n - 1].ll;
}
// What the Home typhoon tile shows
function tyView() {
  var ty = tyStorm();
  if (!ty) return { state: tyState() };   // loading | gone | error | off: no storm is drawn
  var src = ty.source + liveTag('ty');
  if (!ty.active) return { state: 'none', src: src, updated: ty.updated };
  var c = ty.cur, L = S.loc, bits = [];
  if (isNum(c.wind)) bits.push('Max wind ' + Math.round(c.wind * 3.6) + ' km/h');
  if (isNum(c.hpa)) bits.push(Math.round(c.hpa) + ' hPa');
  return { state: 'active', src: src, ty: ty, sub: bits.join(' · '),
    title: ty.name + ' · ' + fmtKm(km(L.lat, L.lon, c.ll[0], c.ll[1])) + ' ' + compass(bearing(L.lat, L.lon, c.ll[0], c.ll[1])) };
}
function tyTileHTML(tv) {
  var X = function (ll) { return 40 + 0.42 * (205 + (ll[1] - 121.5654) * 69); }, Y = function (ll) { return 10 + 0.42 * (55 + (25.033 - ll[0]) * 137.5); };
  var art = '', fit = '';
  if (tv.state === 'active') {
    // Zoom out just enough to keep the island and the whole track in frame
    var c = tv.ty.cur.ll, x0 = 40, x1 = 170, y0 = 10, y1 = 220;
    tv.ty.pts.forEach(function (p) { x0 = Math.min(x0, X(p.ll)); x1 = Math.max(x1, X(p.ll)); y0 = Math.min(y0, Y(p.ll)); y1 = Math.max(y1, Y(p.ll)); });
    x0 -= 30; x1 += 30; y0 -= 30; y1 += 30;
    var k = Math.min(1, 300 / (x1 - x0), 240 / (y1 - y0)), u = function (v) { return (v / k).toFixed(1); };
    fit = ' transform="translate(' + ((300 - (x1 - x0) * k) / 2 - x0 * k).toFixed(1) + ',' + ((240 - (y1 - y0) * k) / 2 - y0 * k).toFixed(1) + ') scale(' + k.toFixed(3) + ')"';
    art = '<polyline points="' + tv.ty.pts.map(function (p) { return X(p.ll).toFixed(1) + ',' + Y(p.ll).toFixed(1); }).join(' ') + '" fill="none" stroke="#FFC24B" stroke-width="' + u(5) + '" stroke-dasharray="' + u(12) + ' ' + u(10) + '"/>' +
      '<circle cx="' + X(c).toFixed(1) + '" cy="' + Y(c).toFixed(1) + '" r="' + u(26) + '" fill="#EF4444" fill-opacity="0.3" stroke="#fff" stroke-width="' + u(3) + '"/><circle cx="' + X(c).toFixed(1) + '" cy="' + Y(c).toFixed(1) + '" r="' + u(7) + '" fill="#fff"/>';
  }
  return '<div style="display:flex;gap:16px;align-items:center;flex:1">' +
    '<svg width="120" height="96" viewBox="0 0 300 240" aria-hidden="true" style="flex:none;border-radius:14px;background:#0A2A48">' +
      '<g' + fit + '><g transform="translate(40,10) scale(0.42)"><path d="' + ISL + '" fill="#2F5A49"/></g>' + art + '</g></svg>' +
    (tv.state === 'active'
      ? '<div><div class="val" style="font-size:26px">' + esc(tv.title) + '</div><p class="sub">' + esc(tv.sub) + '</p></div></div>'
      : '<div><div class="val" style="font-size:26px">No active typhoon</div><p class="sub">No tropical cyclone is being tracked near Taiwan right now.</p></div></div>');
}
// Real track on the satellite map
function drawTy(L, t) {
  var ty = tyStorm();
  if (!ty || !ty.active) return;
  var all = ty.pts.map(function (p) { return p.ll; }), past = ty.pts.filter(function (p) { return !p.fc; }).map(function (p) { return p.ll; });
  if (all.length > 1) L.polyline(all, { color: '#FFC24B', weight: 3, dashArray: '8 8' }).addTo(live.marks);
  if (past.length > 1) L.polyline(past, { color: '#FFC24B', weight: 3 }).addTo(live.marks);
  var pos = tyPosAt(ty, t);
  if (!pos) return;
  L.circle(pos, { radius: 70000, color: '#fff', weight: 2, fillColor: '#EF4444', fillOpacity: 0.25 }).addTo(live.marks);
  L.circleMarker(pos, { radius: 5, color: '#fff', weight: 0, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(esc(ty.name) + ' · ' + TIMES[t]).addTo(live.marks);
}

// ----- Predictions: region levels at the seven map cities -----
function hourIdx(resp) {
  return resp.hourly.time.indexOf(new Date(Date.now() + (resp.utc_offset_seconds || 0) * 1000).toISOString().slice(0, 13) + ':00');
}
// 12 slider steps × 7 cities. Past the end of a forecast, a city keeps its last known level.
// A city with no response (arr[p] is null) or no value yet has level null.
function regLevels(arr, val, th) {
  var out = [];
  STEP_H.forEach(function (hh, s) {
    out.push(arr.map(function (r, p) {
      if (!r) return null;
      var i0 = hourIdx(r), v = i0 < 0 ? null : val(r.hourly, i0 + hh);
      if (!isNum(v)) return s ? out[s - 1][p] : null;
      return (v >= th[0]) + (v >= th[1]) + (v >= th[2]);
    }));
  });
  return out;
}
function tySet() {
  var ty = tyStorm();
  if (!ty) return null;
  var src = esc(ty.source) + liveTag('ty'), stamp = FEEDS.ty.t;
  if (!ty.active) return { lv: STEP_H.map(function () { return MAP_PLACES.map(function () { return 0; }); }), sig: 'ty:none:' + stamp + src, src: src, note: 'No active typhoon near Taiwan right now.', basis: 'CWA typhoon feed', quiet: 'No active typhoon' };
  var lv = STEP_H.map(function (hh, s) {
    var pos = tyPosAt(ty, s);
    return MAP_PLACES.map(function (p) {
      if (!pos) return 0;
      var ll = PLACE_LL[p.name], d = km(ll[0], ll[1], pos[0], pos[1]);
      return (d < 700) + (d < 400) + (d < 200);
    });
  });
  return { lv: lv, sig: 'ty:' + stamp + ':' + S.lang + src, src: src, basis: 'Forecast track',
    note: 'Track of ' + esc(ty.name) + '. Each region shows how far the storm centre is from it along the track. These are distances, not official warnings.' };
}
// Live levels, source and note for a dataset, or null when it has no data (setNA says why)
function liveSet(d) {
  if (d.id === 'typhoon') return tySet();
  if (d.id === 'landslide' || !liveOn()) return null;
  var model = 'Model data, not station readings', lv, src;
  if (d.id === 'pm25') {
    var air = feedData('regAir');
    if (!air) return null;
    lv = regLevels(air, function (h, i) { return h.pm2_5[i]; }, [15.5, 35.5, 54.5]);
    var pm = pmData(), pmSt = apiState('pm25', 'pm');
    var note = 'PM2.5 at seven cities from the Copernicus CAMS model, via Open-Meteo. These are model estimates, not station readings. The forecast ends about four days ahead, so later steps repeat the last value.';
    if (pm) {
      MAP_PLACES.forEach(function (p, i) { if (p.name === 'Taichung') lv[7][i] = pmLevel(pm.pm25); });
      note += ' Team model, Taichung, ' + esc(pm.date || 'tomorrow') + ': ' + pm.pm25 + ' µg/m³ (' + esc(pm.category || '') + ').';
    } else if (pmSt === 'gone') note += ' The team PM2.5 model isn’t connected on this server.';
    else if (pmSt === 'error') note += ' The team PM2.5 model couldn’t be reached.';
    src = (pm ? 'Team model (Taichung) + Open-Meteo CAMS' : 'Open-Meteo CAMS') + liveTag('regAir');
    return { lv: lv, sig: 'pm25:' + FEEDS.regAir.t + ':' + (pm ? FEEDS.pm.t : pmSt) + src, basis: model, note: note, src: src };
  }
  if (d.id === 'waves') {
    var seas = feedData('regSea');
    if (!seas) return null;
    var j = 0, coast = regCoast(), rows = coast.map(function (c) { return c ? seas[j++] : null; });
    src = 'Open-Meteo Marine' + liveTag('regSea');
    return { sig: 'waves:' + FEEDS.regSea.t + src, src: src, basis: model, none: 'No coast',
      note: 'Wave height at the coast point nearest each city (' + MAP_PLACES.map(function (p, i) { return coast[i] ? p.name + ': ' + coast[i][0] : ''; }).filter(Boolean).join(', ') + '). Nantou has no coast. Open-Meteo Marine wave models.',
      lv: regLevels(rows, function (h, i) { return h.wave_height[i]; }, [1, 2, 3]) };
  }
  if (d.id === 'climate') {
    var ss = feedData('regSeason');
    if (!ss) return null;
    var mi = seasonPick(ss[0].monthly);
    if (mi < 0) return null;
    var row = ss.map(function (r) { var a = r.monthly.temperature_2m_anomaly[mi]; return isNum(a) ? (a >= 0.5) + (a >= 1) + (a >= 1.5) : null; });
    src = 'ECMWF SEAS5 · Open-Meteo' + liveTag('regSeason');
    return { sig: 'climate:' + FEEDS.regSeason.t + src, src: src, basis: 'Seasonal forecast', lv: STEP_H.map(function () { return row; }),
      note: 'Temperature anomaly for ' + monthName(ss[0].monthly.time[mi]) + ' ' + String(ss[0].monthly.time[mi]).slice(0, 4) + ' at seven cities, from the ECMWF SEAS5 seasonal forecast via Open-Meteo. “Normal” is the model’s own long-term climatology. This is a monthly outlook, so the time slider doesn’t change it.' };
  }
  var reg = feedData('reg');
  if (!reg) return null;
  src = 'Open-Meteo' + liveTag('reg');
  var sig = d.id + ':' + FEEDS.reg.t + src;
  if (d.id === 'rain') return { sig: sig, src: src, basis: model, note: 'Rain that fell in the 24 hours up to each time, at seven cities. Open-Meteo forecast models.',
    lv: regLevels(reg, function (h, i) { var s = 0, k = 0; for (var j2 = i - 23; j2 <= i; j2++) if (isNum(h.precipitation[j2])) { s += h.precipitation[j2]; k++; } return k ? s : null; }, [2, 10, 40]) };
  if (d.id === 'thunder') return { sig: sig, src: 'Open-Meteo · CAPE' + liveTag('reg'), basis: model, note: 'Storm energy (CAPE) at seven cities. High CAPE means storms can form, not that one will. Open-Meteo forecast models.',
    lv: regLevels(reg, function (h, i) { return h.cape[i]; }, [500, 1500, 2500]) };
  if (d.id === 'wind') return { sig: sig, src: src, basis: model, note: 'Peak gusts at seven cities. Open-Meteo forecast models.',
    lv: regLevels(reg, function (h, i) { return h.wind_gusts_10m[i]; }, [20, 40, 60]) };
  return null;
}
// Why a dataset has no levels (same shape as naOf)
function setNA(d) {
  if (d.id === 'landslide') return naOf('gone', 'landslide');
  if (d.id === 'typhoon') return naOf(tyState(), 'ty');
  if (!liveOn()) return naOf('off', 'om');
  var st = feedState({ pm25: 'regAir', waves: 'regSea', climate: 'regSeason' }[d.id] || 'reg');
  return naOf(st === 'gone' ? 'error' : st, 'om');
}
// Gives each dataset its live levels, or a state (d.na) and no levels at all. Returns the ids that changed.
function applyLiveSets() {
  var changed = {};
  DATASETS.forEach(function (d) {
    if (!d._src) d._src = d.src;
    var lv = null;
    try { lv = liveSet(d); } catch (e) { lv = null; }
    var na = lv ? null : setNA(d), sig = lv ? lv.sig : 'na:' + na.st + ':' + na.msg;
    if (d._sig === sig) return;
    d._sig = sig; changed[d.id] = 1;
    d.lv = lv ? lv.lv : null; d.na = na; d.src = lv ? lv.src : d._src; d.note = lv ? lv.note : ''; d.basis = lv ? lv.basis : '';
    d.none = (lv && lv.none) || '—'; d.quiet = (lv && lv.quiet) || '';
  });
  return changed;
}
// Level (0–3) of region i at slider step t; null when the dataset or that region has no value
function lvlAt(d, i, t) { var l = d.lv && d.lv[t] ? d.lv[t][i] : null; return l == null ? null : l; }
function lvlText(d, l) { return l == null ? d.none : d.labels[l]; }

/* ============================================================
   Tiles (every value comes from liveTiles; nothing here is a reading)
   ============================================================ */
var WEEK_COL = { sun: '#FFC24B', cloud: '#E2E8F0', rain: '#7DD3FC', storm: '#A78BFA' };
function dayNames() {
  var out = ['Today'], d = new Date();
  for (var i = 1; i < 7; i++) out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i).toLocaleDateString('en-US', { weekday: 'short' }));
  return out;
}
// Today's high/low always brackets the current temperature. null without live weather.
function todayHL() {
  var wx = liveWx();
  if (wx && isNum(wx.daily.temperature_2m_max[0]) && isNum(wx.daily.temperature_2m_min[0])) {
    return { hi: Math.max(wx.daily.temperature_2m_max[0], wx.current.temperature_2m), lo: Math.min(wx.daily.temperature_2m_min[0], wx.current.temperature_2m) };
  }
  return null;
}
// Seven days of lows and highs. Without live weather: the day names with "—" (rows are flagged na).
function weekData() {
  var hl = todayHL(), wx = liveWx();
  if (wx && hl) {
    var dy = wx.daily, rows = [], mn = Infinity, mx = -Infinity;
    for (var i = 0; i < Math.min(7, dy.time.length); i++) {
      var dlo = i ? dy.temperature_2m_min[i] : hl.lo, dhi = i ? dy.temperature_2m_max[i] : hl.hi;
      if (!isNum(dlo) || !isNum(dhi)) break;
      rows.push({ day: i ? weekdayOf(dy.time[i]) : 'Today', lo: dlo, hi: dhi, c: WEEK_COL[wmoKind(dy.weather_code[i])] });
      mn = Math.min(mn, dlo); mx = Math.max(mx, dhi);
    }
    var span = Math.max(1, mx - mn);
    if (rows.length) return rows.map(function (r) {
      return { day: r.day, lo: fmtT(r.lo), hi: fmtT(r.hi), c: r.c, l: ((r.lo - mn) / span * 100) + '%', r: ((mx - r.hi) / span * 100) + '%' };
    });
  }
  return dayNames().map(function (n) { return { day: n, lo: '—', hi: '—', c: 'rgba(255,255,255,0.28)', l: '0%', r: '100%', na: true }; });
}
function catalog(L) {
  var grad = 'linear-gradient(90deg,' + pal().join(',') + ')', OM = 'Open-Meteo';
  var stat = function (id, title, src, o) { var t = { id: id, title: title, src: src, value: '—', sub: '', span: 1, rows: 1, kind: 'stat' }; for (var k in (o || {})) t[k] = o[k]; return t; };
  var all = [
    { id: 'hourly', title: 'Hourly', src: OM, span: 4, rows: 1, kind: 'hourly', hours: [] },
    { id: 'map', title: 'Live map', src: 'Windy', span: 2, rows: 2, kind: 'map' },
    stat('thunder', 'Thunderstorm risk', 'Open-Meteo · CAPE + weather codes', { meterBg: grad, bg: '#3B2F6B' }),
    stat('storms', 'Storm outlook · 72h', OM),
    { id: 'typhoon', title: 'Typhoon watch', src: 'CWA typhoon warnings', span: 2, rows: 1, kind: 'typhoon', bg: '#123A5E' },
    stat('pm25', 'PM2.5', 'Open-Meteo CAMS', { meterBg: grad }),
    stat('landslide', 'Landslide risk', 'Team landslide model', { bg: '#FFF4E0', fg: '#5A2E00' }),
    { id: 'week', title: '7-day forecast', src: OM, span: 2, rows: 2, kind: 'week', week: weekData() },
    stat('wind', 'Wind & gusts', OM),
    stat('rain', 'Rain today', OM),
    stat('clouds', 'Cloud layers', OM),
    stat('humidity', 'Humidity', OM),
    stat('pressure', 'Pressure', OM),
    stat('visibility', 'Visibility', OM),
    stat('waves', 'Coast & waves', 'Open-Meteo Marine'),
    stat('uv', 'UV index', OM),
    stat('climate', 'Seasonal outlook', 'ECMWF SEAS5 · Open-Meteo', { span: 2 })
  ];
  var off = { pm25: !S.sources.pm25, landslide: !S.sources.landslide, typhoon: !S.sources.typhoon, map: !S.sources.windyMap };
  liveTiles(all, L);
  return all.filter(function (t) { return !off[t.id]; });
}
function activeSets() {
  return DATASETS.filter(function (d) { return !((d.id === 'landslide' && !S.sources.landslide) || (d.id === 'typhoon' && !S.sources.typhoon)); });
}
function currentOrder(cat) {
  var ids = cat.map(function (t) { return t.id; });
  var o = Array.isArray(S.order) ? S.order.filter(function (id) { return ids.indexOf(id) >= 0; }) : [];
  ids.forEach(function (id) { if (o.indexOf(id) < 0) o.push(id); });
  return o;
}
// Which base map a dataset opens on
function baseFor(d) {
  if (S.predBase[d.id]) return S.predBase[d.id];
  if (S.mapBase === 'sat' || S.mapBase === 'windy') return S.mapBase;
  return d.group === 'By Skyline' ? 'sat' : 'windy';
}

/* ============================================================
   Views
   ============================================================ */
function homeView() {
  var b = WEATHER[wxKey()];
  var live = S.bgMode === 'live';
  var L = S.loc, src = nearestSource(L), tw = inTW(L.lat, L.lon), nowWx = wxNow(L), demo = S.weather !== 'live' && S.weather === wxKey();
  var bgVars = live ? '--top:' + b.top + ';--mid:' + b.mid + ';--bottom:' + b.bottom : '--top:#163A7A;--mid:#1F4C94;--bottom:#2A5AA8';
  var cat = catalog(L), byId = {};
  cat.forEach(function (t) { byId[t.id] = t; });
  var n = Math.max(3, Math.min(10, S.pinCount));
  var pins = S.pins.slice(0, n).map(function (id) {
    var t = byId[id]; if (!t) return '';
    return '<div class="pin"><span class="t">' + t.title + '</span><span class="v">' + t.value + '</span><span class="s">' + t.sub + '</span><span class="src">' + t.src + '</span></div>';
  }).join('');
  var opts = '<option value="live"' + (demo ? '' : ' selected') + '>Live weather</option>' +
    Object.keys(WEATHER).map(function (k) { return '<option value="' + k + '"' + (demo && k === S.weather ? ' selected' : '') + '>' + WEATHER[k].label + '</option>'; }).join('');
  var srcChip = nowWx.live ? 'Open-Meteo · live' + (nowWx.time ? ' · updated ' + nowWx.time : '')
    : liveLoading() ? 'Sample data · loading live conditions…' : 'Sample data · nearest source: ' + esc(src.name);

  return '<section class="hero" style="' + bgVars + '" aria-label="Current weather">' +
    (live ? skyLayers(b) : '') +
    '<label class="demo"><span>Demo: station conditions</span><select id="demo-weather" data-input="weather">' + opts + '</select></label>' +
    '<div class="hero-main">' +
      '<button type="button" class="loc" data-action="open-search" aria-label="Location: ' + esc(L.name) + '. Change location">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>' +
        '<span>' + esc(L.name) + '</span>' + (L.sub ? '<span class="loc-sub">· ' + esc(L.sub) + '</span>' : '') +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>' +
      '</button>' +
      '<div class="temp" aria-label="Temperature ' + fmtT(nowWx.temp) + '">' + fmtT(nowWx.temp) + '</div>' +
      '<div class="headline">' + esc(nowWx.headline) + '</div>' +
      '<div class="hilo" aria-label="Today: high ' + fmtT(todayHL(L).hi) + ', low ' + fmtT(todayHL(L).lo) + '"><span>H:' + fmtT(todayHL(L).hi) + '</span><span>L:' + fmtT(todayHL(L).lo) + '</span></div>' +
      '<div class="chips"><span class="chip">' + (nowWx.live ? '<span class="dot" aria-hidden="true"></span>' : '') + srcChip + '</span>' +
      (demo ? '<span class="chip warn">Demo sky: ' + b.label + '</span>' : '') +
      (tw ? '' : '<span class="chip warn">Outside Taiwan: PM2.5, landslide and Predictions cover Taiwan only</span>') + '</div>' +
    '</div>' +
    (S.skyline === 'city' ? skylineSVG(skylineFor(L), b) : '') +
    (live ? '<canvas class="wx-front" aria-hidden="true"></canvas>' : '') +
    '<div class="pinned-wrap"><div class="days" role="list" aria-label="7-day forecast">' + weekData(L).map(function (w) {
        return '<div class="day" role="listitem" aria-label="' + w.day + ': high ' + w.hi + ', low ' + w.lo + '"><span class="dn">' + w.day + '</span><span class="ic" style="background:' + w.c + '" aria-hidden="true"></span><span class="dh">' + w.hi + '</span><span class="dl">' + w.lo + '</span></div>';
      }).join('') + '</div><div class="pinned ' + (n <= 3 ? 'few' : 'many') + '">' + pins + '</div>' +
      '<button type="button" class="scroll-hint" data-action="scroll-stats">All stats ↓</button></div>' +
  '</section>' +
  '<section id="stats" class="stats" aria-labelledby="stats-h">' + statsInner() + '</section>';
}

function statsInner() {
  var L = S.loc, cat = catalog(L), byId = {};
  cat.forEach(function (t) { byId[t.id] = t; });
  var order = currentOrder(cat);
  var visible = order.filter(function (id) { return !S.hidden[id]; });
  var tiles = visible.map(function (id, vi) {
    var t = byId[id], span = S.spans[id] || t.span;
    var style = (t.bg ? '--tbg:' + t.bg + ';' : '') + (t.fg ? '--tfg:' + t.fg + ';' : '');
    return '<article class="tile s' + span + (t.rows > 1 ? ' r2' : '') + '" data-id="' + id + '"' + (editing ? ' draggable="true"' : '') + ' style="' + style + '" aria-label="' + t.title + '">' +
      '<header><h3>' + t.title + '</h3><span class="src">' + esc(t.src) + '</span></header>' + tileBody(t) +
      (editing ? '<div class="edit-ctl">' +
        '<button type="button" data-action="tile-left" data-id="' + id + '" aria-label="Move ' + t.title + ' earlier"' + (vi === 0 ? ' disabled' : '') + '>◀</button>' +
        '<button type="button" data-action="tile-right" data-id="' + id + '" aria-label="Move ' + t.title + ' later"' + (vi === visible.length - 1 ? ' disabled' : '') + '>▶</button>' +
        '<button type="button" data-action="tile-smaller" data-id="' + id + '"' + (span <= 1 ? ' disabled' : '') + '>Smaller</button>' +
        '<button type="button" data-action="tile-bigger" data-id="' + id + '"' + (span >= 4 ? ' disabled' : '') + '>Bigger</button>' +
        '<button type="button" class="hide" data-action="tile-hide" data-id="' + id + '">Hide</button></div>' : '') +
      '</article>';
  }).join('');
  var hidden = order.filter(function (id) { return S.hidden[id]; });
  return '<div class="stats-head"><div><h2 id="stats-h">All stats</h2><p>Each reading uses the source nearest ' + esc(L.name) + '.</p></div>' +
    '<div class="row">' + (editing ? '<button type="button" class="btn ghost" data-action="reset-grid">Reset layout</button>' : '') +
    '<button type="button" class="btn' + (editing ? ' accent' : '') + '" data-action="toggle-edit" aria-pressed="' + editing + '">' + (editing ? 'Done' : 'Customize') + '</button></div></div>' +
    (editing ? '<p class="edit-tip">Drag a tile to move it, or use its buttons. Make tiles bigger or smaller, or hide the ones you don’t need. Hidden tiles wait below so you can bring them back.</p>' : '') +
    '<div class="grid' + (editing ? ' editing' : '') + '" id="grid">' + tiles + '</div>' +
    (hidden.length ? '<div class="hidden-row"><span>Hidden:</span>' + hidden.map(function (id) { return '<button type="button" data-action="tile-restore" data-id="' + id + '">+ ' + byId[id].title + '</button>'; }).join('') + '</div>' : '') +
    '<p class="foot">Readings marked “live” come from Open-Meteo at your coordinates, the team PM2.5 model or the typhoon feed. Anything marked “Sample” is a placeholder, not a measurement.</p>';
}

function tileBody(t) {
  if (t.kind === 'stat') {
    return '<div class="val">' + t.value + '</div><p class="sub">' + t.sub + '</p>' +
      (t.meter ? '<div class="meter" style="background:' + t.meterBg + '" aria-hidden="true"><span style="left:' + t.meter + '"></span></div>' : '');
  }
  if (t.kind === 'hourly') {
    return '<div class="hours">' + t.hours.map(function (h) {
      return '<div class="hour"><span>' + h.t + '</span><span class="ic" style="background:' + h.c + '" aria-hidden="true"></span><span class="tt">' + h.temp + '</span><span class="rp">' + h.rain + '</span></div>';
    }).join('') + '</div>';
  }
  if (t.kind === 'week') {
    return '<div class="week">' + t.week.map(function (w) {
      return '<div class="wrow"><span>' + w.day + '</span><span class="ic" style="background:' + w.c + '" aria-hidden="true"></span><span class="lo">' + w.lo + '</span><span class="wbar" aria-hidden="true"><span style="left:' + w.l + ';right:' + w.r + '"></span></span><span>' + w.hi + '</span></div>';
    }).join('') + '</div>';
  }
  if (t.kind === 'map') {
    var wind = DATASETS.filter(function (d) { return d.id === 'wind'; })[0];
    return '<div class="tile-map">' + windyFrame('Live Windy wind map', windyURL(WINDY_LAYER.wind, inTW(S.loc.lat, S.loc.lon) ? 8 : 6)) +
      '<a class="btn accent open" href="#predictions/wind">Open map</a></div>';
  }
  if (t.kind === 'typhoon') {
    var tv = tyView();
    if (tv.state !== 'sample') return tyTileHTML(tv);
    return '<div style="display:flex;gap:16px;align-items:center;flex:1">' +
      '<svg width="120" height="96" viewBox="0 0 300 240" aria-hidden="true" style="flex:none;border-radius:14px;background:#0A2A48">' +
        '<g transform="translate(40,10) scale(0.42)"><path d="' + ISL + '" fill="#2F5A49"/></g>' +
        '<path d="M290,230 Q250,190 230,150 T160,90" fill="none" stroke="#FFC24B" stroke-width="5" stroke-dasharray="12 10"/>' +
        '<circle cx="246" cy="178" r="26" fill="#EF4444" fill-opacity="0.3" stroke="#fff" stroke-width="3"/><circle cx="246" cy="178" r="7" fill="#fff"/></svg>' +
      '<div><div class="val" style="font-size:26px">TD-27 · 860 km SE</div><p class="sub">Sample storm. Moving NW at 18 km/h. A sea warning is possible in about 48h.</p></div></div>';
  }
  return '';
}

/* ============================================================
   Live maps
   - Windy: the official Windy embed (embed.windy.com), with the layer that matches
     the dataset. Pan, zoom and its own timeline all work inside the frame.
   - Satellite: Leaflet on Esri World Imagery, with our data drawn on top as a
     soft colored overlay, region labels, the typhoon track and the user's pin.
   ============================================================ */
var LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
var ESRI_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
var ESRI_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
// One satellite still of Taiwan for the card previews (plain lat/lon projection, so overlay math is linear)
var TW_BOX = [119.2, 21.7, 122.4, 25.5];
var TW_IMG = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=' + TW_BOX.join(',') + '&bboxSR=4326&imageSR=4326&size=384,456&format=jpg&f=image';
var PLACE_LL = { Taipei: [25.04, 121.56], Taichung: [24.15, 120.67], Nantou: [23.96, 120.97], Hualien: [23.98, 121.60], Chiayi: [23.48, 120.45], Kaohsiung: [22.63, 120.30], Taitung: [22.76, 121.14] };
var TYPHOON_TRACK = [[19.2, 125.4], [20.4, 124.3], [21.6, 123.3], [22.8, 122.5], [24.0, 121.9], [25.3, 121.5]];
// Windy embed overlay + model per dataset
var WINDY_LAYER = { pm25: ['pm2p5', 'cams'], landslide: ['rain', 'ecmwf'], rain: ['rain', 'ecmwf'], thunder: ['thunder', 'ecmwf'], wind: ['wind', 'ecmwf'], typhoon: ['wind', 'ecmwf'], waves: ['waves', 'ecmwfWaves'], climate: ['temp', 'ecmwf'] };

var leafletReady = null, live = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletReady) return leafletReady;
  leafletReady = new Promise(function (resolve, reject) {
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET_CSS; document.head.appendChild(css);
    var js = document.createElement('script'); js.src = LEAFLET_JS;
    js.onload = function () { resolve(window.L); };
    js.onerror = function () { leafletReady = null; reject(new Error('Leaflet failed to load')); };
    document.head.appendChild(js);
  });
  return leafletReady;
}
// Slider steps as hours from now (same order as TIMES).
var TIME_HOURS = [-72, -48, -24, -12, 0, 6, 12, 24, 48, 72, 120, 168];
// Forecast offset the Windy embed can open at. Its script (embed2.js) reads `calendar` and
// `forecast` for type=map: calendar=12|24, or calendar=in + forecast=<hours>, sets its timeline to
// now + that many hours, clamped to its own range (today's midnight … end of the free forecast).
// It cannot open in the past, so past steps keep the map at "now".
function windyHours(t) { var h = TIME_HOURS[t] || 0; return h > 0 ? h : 0; }
function windyURL(layer, zoom, hours) {
  var L = S.loc, tw = inTW(L.lat, L.lon);
  var c = tw ? [L.lat, L.lon] : [23.75, 120.95];
  var p = { lat: c[0].toFixed(3), lon: c[1].toFixed(3), detailLat: c[0].toFixed(3), detailLon: c[1].toFixed(3), zoom: String(zoom || 7),
    level: 'surface', overlay: layer[0], product: layer[1], menu: '', message: 'true', marker: tw ? 'true' : '', calendar: 'now',
    pressure: '', type: 'map', location: 'coordinates', detail: '', metricWind: 'km/h', metricTemp: S.units === 'F' ? '°F' : '°C', radarRange: '-1' };
  if (hours > 0) { p.calendar = 'in'; p.forecast = String(hours); }
  return 'https://embed.windy.com/embed2.html?' + new URLSearchParams(p).toString();
}
function windyFrame(title, src) {
  return '<iframe class="windy-frame" title="' + esc(title) + '" src="' + esc(src) + '" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
}
function destroyLive() {
  // stop any zoom animation first; removing a map mid-animation throws inside Leaflet
  if (live && live.map) { try { live.map.stop(); live.map.off(); live.map.remove(); } catch (e) {} }
  clearTimeout(windyTimer);
  live = null;
}
var windyTimer = 0;

function renderLive(d, t, base) {
  var host = $('#pm-live'); if (!host) return;
  if (base === 'windy') {
    var src = windyURL(WINDY_LAYER[d.id] || ['wind', 'ecmwf'], 7, windyHours(t));
    if (!live || live.mode !== 'windy') { destroyLive(); host.innerHTML = windyFrame('Windy map: ' + d.title, src); live = { mode: 'windy', src: src, shown: src }; }
    else if (live.src !== src) {
      // Debounced: wait until the slider settles, then swap in a fresh frame (replacing the
      // element, not its src, keeps the browser's Back button out of the iframe's history).
      live.src = src;
      var token = live, title = 'Windy map: ' + d.title;
      clearTimeout(windyTimer);
      windyTimer = setTimeout(function () {
        var h2 = $('#pm-live');
        if (!h2 || live !== token || token.shown === token.src) return;
        h2.innerHTML = windyFrame(title, token.src); token.shown = token.src;
      }, 700);
    }
    return;
  }
  if (live && live.mode === 'sat') { if (live.map) drawSat(d, t); return; }
  destroyLive();
  host.innerHTML = '<div class="leaflet-host" id="pm-leaflet"></div><div class="map-loading">Loading satellite map…</div>';
  var token = live = { mode: 'sat' };
  loadLeaflet().then(function (L) {
    if (live !== token || !$('#pm-leaflet')) return;
    buildSat(L, token);
    drawSat(d, S.predT);
  }).catch(function () { var ml = host.querySelector('.map-loading'); if (ml) ml.textContent = 'Couldn’t load the map (offline?).'; });
}
function buildSat(L, token) {
  var map = L.map('pm-leaflet', { zoomControl: false, minZoom: 5, maxZoom: 17 }).setView([23.75, 120.95], 7);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer(ESRI_IMAGERY, { maxZoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' }).addTo(map);
  map.createPane('data'); map.getPane('data').style.zIndex = 420; map.getPane('data').classList.add('data-pane');
  map.createPane('labels'); map.getPane('labels').style.zIndex = 640; map.getPane('labels').style.pointerEvents = 'none';
  L.tileLayer(ESRI_LABELS, { maxZoom: 18, pane: 'labels', opacity: 0.85 }).addTo(map);
  // Fade the overlay as you zoom in so the imagery underneath stays readable
  var fade = function () { var z = map.getZoom(); map.getPane('data').style.opacity = z <= 7 ? 0.8 : z <= 9 ? 0.6 : z <= 11 ? 0.42 : 0.3; };
  map.on('zoomend', fade); fade();
  token.L = L; token.map = map;
  token.data = L.layerGroup().addTo(map);
  token.marks = L.layerGroup().addTo(map);
  var ml = document.querySelector('#pm-live .map-loading'); if (ml) ml.remove();
  setTimeout(function () { map.invalidateSize(); }, 0);
}
function drawSat(d, t) {
  var L = live.L, P = pal();
  live.data.clearLayers(); live.marks.clearLayers();
  MAP_PLACES.forEach(function (p, i) {
    var l = lvlAt(d, i, t), ll = PLACE_LL[p.name];
    L.circle(ll, { pane: 'data', radius: 24000 + l * 9000, stroke: false, fillColor: P[l], fillOpacity: 0.8, interactive: false }).addTo(live.data);
    L.circleMarker(ll, { radius: 4, color: '#05172E', weight: 1, fillColor: '#fff', fillOpacity: 1 })
      .bindTooltip(p.name + ' · ' + d.labels[l], { permanent: true, direction: 'right', offset: [6, 0], className: 'map-label' }).addTo(live.marks);
  });
  if (d.id === 'typhoon' && tyStorm()) drawTy(L, t);
  else if (d.id === 'typhoon') {
    L.polyline(TYPHOON_TRACK, { color: '#FFC24B', weight: 3, dashArray: '8 8' }).addTo(live.marks);
    var k = t / 11 * (TYPHOON_TRACK.length - 1), i0 = Math.min(TYPHOON_TRACK.length - 2, Math.floor(k)), f = k - i0;
    var a = TYPHOON_TRACK[i0], b = TYPHOON_TRACK[i0 + 1], pos = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    L.circle(pos, { radius: 70000 + t * 4000, color: '#fff', weight: 2, fillColor: '#EF4444', fillOpacity: 0.25 }).addTo(live.marks);
    L.circleMarker(pos, { radius: 5, color: '#fff', weight: 0, fillColor: '#fff', fillOpacity: 1 }).bindTooltip('TD-27 (sample) · ' + TIMES[t]).addTo(live.marks);
  }
  if (inTW(S.loc.lat, S.loc.lon)) {
    L.circleMarker([S.loc.lat, S.loc.lon], { radius: 7, color: '#fff', weight: 2, fillColor: S.accent, fillOpacity: 1 })
      .bindTooltip('You: ' + S.loc.name).addTo(live.marks);
  }
}

// Card previews: one real satellite still of Taiwan (a single cached request shared by every
// card), but each dataset gets its own crop, its own overlay motif and a small key showing the
// worst region and the colour scale, so no two cards look the same.
// Crop per dataset: [centre lat, centre lon, width in still pixels] (the still is 384 × 456).
var THUMB_VIEW = { pm25: [23.35, 120.6, 320], landslide: [23.95, 121.25, 280], rain: [24.3, 121.15, 330], thunder: [24.0, 120.9, 310],
  wind: [24.45, 120.6, 350], typhoon: [23.7, 121.3, 300], waves: [24.6, 121.15, 290], climate: [23.7, 120.9, 384] };
function thumbHTML(d, base) {
  var P = pal(), W = 384, H = 456;
  var px = function (ll) { return [(ll[1] - TW_BOX[0]) / (TW_BOX[2] - TW_BOX[0]) * W, (TW_BOX[3] - ll[0]) / (TW_BOX[3] - TW_BOX[1]) * H]; };
  var f1 = function (n) { return n.toFixed(1); };
  var inBox = function (ll) { return ll[1] >= TW_BOX[0] && ll[1] <= TW_BOX[2] && ll[0] >= TW_BOX[1] && ll[0] <= TW_BOX[3]; };
  var v = THUMB_VIEW[d.id] || THUMB_VIEW.climate, storm = null;
  if (d.id === 'typhoon') {
    // centre the crop on the first forecast point that falls on the still
    storm = TYPHOON_TRACK.filter(inBox)[0] || TYPHOON_TRACK[TYPHOON_TRACK.length - 1];
    v = [storm[0] - 0.3, storm[1] - 0.6, v[2]];
  }
  var vw = Math.min(W, v[2]), vh = vw / 1.7, c = px(v);
  var vx = Math.max(0, Math.min(W - vw, c[0] - vw / 2)), vy = Math.max(0, Math.min(H - vh, c[1] - vh / 2));
  var at = MAP_PLACES.map(function (p) { return px(PLACE_LL[p.name]); });
  var spots = at.map(function (q, i) {
    var l = d.base[i];
    return '<circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="' + (20 + l * 9) + '" fill="' + P[l] + '" fill-opacity="' + (base === 'sat' ? 0.55 : 0.7) + '" filter="url(#sk-b16)"/>';
  }).join('');
  var mark = function (minL, fn) { return at.map(function (q, i) { return d.base[i] >= minL ? fn(q, d.base[i]) : ''; }).join(''); };
  var rows = function (n, fn) { var s = ''; for (var i = 0; i < n; i++) s += fn(i, vy + (i + 0.5) * vh / n); return s; };
  var motif = '';
  if (d.id === 'pm25') {            // haze bank along the west coast
    motif = '<ellipse cx="138" cy="252" rx="46" ry="150" transform="rotate(12 138 252)" fill="' + P[2] + '" fill-opacity="0.3" filter="url(#sk-b16)"/>';
  } else if (d.id === 'landslide') { // slope contours on the Central Range, warning triangles on risky regions
    motif = '<g fill="none" stroke="#fff" stroke-opacity="0.32" stroke-width="1.2" transform="rotate(14 216 216)">' +
      [26, 40, 54].map(function (r) { return '<ellipse cx="216" cy="216" rx="' + r + '" ry="' + (r * 3 + 30) + '"/>'; }).join('') + '</g>' +
      mark(2, function (q, l) { return '<path d="M' + f1(q[0]) + ',' + f1(q[1] - 10) + ' l9,16 h-18 z" fill="' + P[l] + '" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>'; });
  } else if (d.id === 'rain') {      // slanted rain streaks
    motif = '<g fill="none" stroke="#CFE8FF" stroke-opacity="0.55" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="9 13">' +
      rows(18, function (i) { return '<path d="M' + f1(vx + i * 24) + ',' + f1(vy - 10) + ' l-44,' + f1(vh + 20) + '"/>'; }) + '</g>';
  } else if (d.id === 'thunder') {   // lightning bolts where storms are likely
    motif = mark(2, function (q) { return '<path transform="translate(' + f1(q[0]) + ' ' + f1(q[1]) + ')" d="M2,-14 L-7,2 H-1 L-3,14 L8,-3 H2 Z" fill="#FFE066" stroke="#05172E" stroke-width="1" stroke-linejoin="round"/>'; });
  } else if (d.id === 'wind') {      // north-easterly flow lines
    motif = '<g fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="10 14">' +
      rows(6, function (i, y) { return '<path class="sk-flow" d="M' + f1(vx + vw + 10) + ',' + f1(y - 34) + ' C' + f1(vx + vw * 0.66) + ',' + f1(y - 30) + ' ' + f1(vx + vw * 0.33) + ',' + f1(y + 22) + ' ' + f1(vx - 10) + ',' + f1(y + 34) + '"/>'; }) + '</g>';
  } else if (d.id === 'typhoon') {   // forecast track and the storm
    var s = px(storm);
    motif = '<polyline points="' + TYPHOON_TRACK.map(function (ll) { var q = px(ll); return f1(q[0]) + ',' + f1(q[1]); }).join(' ') + '" fill="none" stroke="#FFC24B" stroke-width="2.5" stroke-dasharray="7 7" stroke-linecap="round"/>' +
      '<circle cx="' + f1(s[0]) + '" cy="' + f1(s[1]) + '" r="34" fill="#EF4444" fill-opacity="0.18" stroke="#fff" stroke-opacity="0.5" stroke-width="1"/>' +
      '<circle cx="' + f1(s[0]) + '" cy="' + f1(s[1]) + '" r="18" fill="#EF4444" fill-opacity="0.32" stroke="#fff" stroke-width="2"/><circle cx="' + f1(s[0]) + '" cy="' + f1(s[1]) + '" r="4.5" fill="#fff"/>';
  } else if (d.id === 'waves') {     // swell lines
    var humps = Math.ceil((vw + 20) / 26), tail = ''; for (var k = 1; k < humps; k++) tail += ' t26,0';
    motif = '<g fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="1.3" stroke-linecap="round">' +
      rows(7, function (i, y) { return '<path d="M' + f1(vx - 10 - (i % 2) * 13) + ',' + f1(y) + ' q13,-9 26,0' + tail + ' t26,0"/>'; }) + '</g>';
  } else if (d.id === 'climate') {   // warm anomaly wash with isotherms
    motif = '<rect width="' + W + '" height="' + H + '" fill="#FF6A3D" fill-opacity="0.2"/><g fill="none" stroke="#FFD7A8" stroke-opacity="0.65" stroke-width="1.3">' +
      rows(4, function (i, y) { return '<path d="M' + f1(vx - 10) + ',' + f1(y) + ' C' + f1(vx + vw * 0.3) + ',' + f1(y - 24) + ' ' + f1(vx + vw * 0.6) + ',' + f1(y + 24) + ' ' + f1(vx + vw + 10) + ',' + f1(y - 6) + '"/>'; }) + '</g>';
  }
  var windy = base === 'windy' ? '<rect width="' + W + '" height="' + H + '" fill="url(#sk-windy)" fill-opacity="0.72"/>' : '';
  var worst = 0; d.base.forEach(function (l, i) { if (l > d.base[worst]) worst = i; });
  return '<svg viewBox="' + f1(vx) + ' ' + f1(vy) + ' ' + f1(vw) + ' ' + f1(vh) + '" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + esc(d.title) + ' preview on ' + (base === 'sat' ? 'satellite' : 'Windy') + ' map">' +
    '<rect width="' + W + '" height="' + H + '" fill="#05172E"/><image href="' + TW_IMG + '" width="' + W + '" height="' + H + '" preserveAspectRatio="none" style="filter:brightness(1.45) saturate(1.15)"/>' + windy + spots + motif + '</svg>' +
    '<span class="thumb-peak"><i style="background:' + P[d.base[worst]] + '"></i><span>' + esc(MAP_PLACES[worst].name) + '</span><span>' + esc(d.labels[d.base[worst]]) + '</span></span>' +
    '<span class="thumb-key" aria-hidden="true">' + P.map(function (col) { return '<i style="background:' + col + '"></i>'; }).join('') + '</span>';
}

function predView(sub) {
  var tw = inTW(S.loc.lat, S.loc.lon);
  var banner = tw ? '' : '<div class="banner">You’re looking at <b>' + esc(S.loc.name) + '</b>. Predictions and the team models cover Taiwan only, so these maps always show Taiwan.</div>';
  var d = activeSets().filter(function (x) { return x.id === sub; })[0];
  if (!d) {
    var groups = [['By Skyline', 'Our own Taiwan models'], ['Others', 'Pulled from Windy, CWA and other APIs']];
    return '<div class="page"><header><div class="eyebrow">Taiwan only</div><h1>Predictions</h1>' +
      '<p class="lede">Pick a dataset to open its map, then scrub back through the past or forward into the forecast.</p></header>' + banner +
      groups.map(function (g) {
        return '<section aria-labelledby="g-' + g[0].replace(/\s/g, '') + '"><div class="group-head"><h2 id="g-' + g[0].replace(/\s/g, '') + '">' + g[0] + '</h2><span>' + g[1] + '</span></div><div class="pred-grid">' +
          activeSets().filter(function (x) { return x.group === g[0]; }).map(function (x) {
            var base = baseFor(x), own = x.group === 'By Skyline';
            return '<a class="pcard' + (own ? ' own' : '') + '" href="#predictions/' + x.id + '"><div class="thumb">' +
              thumbHTML(x, base) +
              '<span class="base-tag">' + (base === 'sat' ? 'Satellite' : 'Windy') + '</span>' + (own ? '<span class="own-tag">Skyline</span>' : '') + '</div>' +
              '<div class="pc-body"><h3>' + x.title + '</h3><p>' + x.desc + '</p><span class="src">' + x.src + '</span></div></a>';
          }).join('') + '</div></section>';
      }).join('') + '</div>';
  }
  var own = d.group === 'By Skyline';
  return '<div class="page"><header class="pm-head"><a class="btn ghost" href="#predictions">← All predictions</a>' +
    '<div><div class="eyebrow">' + d.group + '</div><h1>' + d.title + '</h1></div><div class="grow"></div>' +
    '<span class="chip ' + (own ? 'own' : 'solid') + '">' + d.src + '</span></header>' + banner +
    '<div class="pm-body"><section class="pm-map" aria-label="Map">' +
      '<div class="map-bar"><span class="mode" id="pm-mode"></span>' +
        '<div class="seg" role="group" aria-label="Map base"><button type="button" data-action="set-base" data-base="sat" id="base-sat">Satellite</button><button type="button" data-action="set-base" data-base="windy" id="base-windy">Windy</button></div></div>' +
        '<div class="map-box"><div id="pm-live" class="pm-live"></div></div>' +
        '<p class="map-note" id="pm-note"></p>' +
      '<div class="slider"><label for="pred-time"><span>Past ← Now → Prediction</span><span class="now" id="pm-time"></span></label>' +
        '<input id="pred-time" class="time" type="range" min="0" max="11" step="1" value="' + S.predT + '" data-input="predT" aria-valuetext="' + TIMES[S.predT] + '">' +
        '<div class="ticks" aria-hidden="true">' + TIMES.map(function (l, i) { return '<span' + (i === NOW ? ' class="is-now"' : '') + '>' + l + '</span>'; }).join('') + '</div></div>' +
      '<div class="legend" id="pm-legend"></div></section>' +
    '<aside class="pm-side" aria-label="Region values"><div class="note"><div class="k" id="pm-k"></div><p>' + d.note + '</p><div class="conf" id="pm-conf"></div></div>' +
      '<div class="regions" id="pm-rows"></div>' +
      '<a class="btn accent" href="#ask" data-action="ask-about" data-q="' + esc('What does the ' + d.title + ' map show near ' + S.loc.name + '?') + '" style="border-radius:14px;min-height:50px">Ask the AI about this map</a></aside></div></div>';
}
function updatePred() {
  var sub = route().sub, d = activeSets().filter(function (x) { return x.id === sub; })[0];
  if (!d || !$('#pm-live')) return;
  var t = S.predT, base = baseFor(d), P = pal();
  var mode = t < NOW ? ['Observed (past)', '#5B6F99', '#fff'] : t === NOW ? ['Now', '#fff', '#0B1B3F'] : ['Prediction', 'var(--accent)', 'var(--accent-ink)'];
  renderLive(d, t, base);
  $('#pm-note').textContent = base === 'windy'
    ? 'Live Windy map (' + (WINDY_LAYER[d.id] || ['wind'])[0] + ' layer). ' + (
        t > NOW ? 'The slider opened it at ' + TIMES[t] + ' (as far as Windy’s free forecast reaches); Windy’s own timeline at the bottom can move it from there. The region values on the right follow the slider.'
        : t < NOW ? 'Windy’s embed can’t open in the past, so the map stays at now. At ' + TIMES[t] + ' the slider only changes the region values on the right.'
        : 'Drag and zoom it. Move the slider into the forecast to reopen Windy at that time; the region values on the right follow the slider.')
    :'Satellite imagery from Esri. Drag and zoom it; the colored overlay and labels follow the slider.';
  var m = $('#pm-mode'); m.textContent = mode[0]; m.style.background = mode[1]; m.style.color = mode[2];
  $('#pm-time').textContent = TIMES[t];
  $('#pm-k').textContent = mode[0] + ' · ' + TIMES[t];
  $('#pm-conf').textContent = 'Confidence: ' + (t <= NOW ? 'Observed' : t <= 7 ? d.conf[0] : t <= 9 ? d.conf[1] : d.conf[2]);
  $('#base-sat').setAttribute('aria-pressed', base === 'sat');
  $('#base-windy').setAttribute('aria-pressed', base === 'windy');
  var yours = inTW(S.loc.lat, S.loc.lon) ? nearestMapPlace() : -1;
  $('#pm-rows').innerHTML = MAP_PLACES.map(function (p, i) {
    var l = lvlAt(d, i, t);
    return '<div class="region' + (i === yours ? ' you' : '') + '"><span>' + p.name + '</span><b style="background:' + P[l] + ';color:' + inkFor(P[l]) + '">' + d.labels[l] + '</b></div>';
  }).join('');
  $('#pm-legend').innerHTML = d.legend.map(function (l, i) { return '<span><i style="background:' + P[i] + '"></i>' + l + '</span>'; }).join('');
  var r = $('#pred-time'); r.setAttribute('aria-valuetext', TIMES[t] + ', ' + mode[0]);
}
function nearestMapPlace() {
  var y = project(S.loc), bi = 0, bd = Infinity;
  MAP_PLACES.forEach(function (p, i) { var d = Math.hypot(p.x - y.x, p.y - y.y); if (d < bd) { bd = d; bi = i; } });
  return bi;
}

/* ---------- Ask AI ---------- */
function bars(levels, labels) {
  var P = pal(), max = 4;
  var words = S.lang === 'zh' ? ['低', '中', '高', '極高'] : ['low', 'medium', 'high', 'very high'];
  return '<div class="bars" role="img" aria-label="' + esc(labels.map(function (l, i) { return l + ': ' + words[levels[i]]; }).join(', ')) + '">' +
    levels.map(function (l, i) { return '<div><i style="height:' + ((l + 1) / max * 100) + '%;background:' + P[l] + '"></i>' + labels[i] + '</div>'; }).join('') + '</div>';
}
// Which canned answer a question gets (shared by the English and 中文 versions).
function askTopic(q) {
  var l = q.toLowerCase();
  if (/landslide|slope|suhua|highway|road|drive|hike|trail|山崩|土石流|邊坡|公路|蘇花/.test(l)) return 'landslide';
  if (/pm|air|haze|aqi|smog|空氣|空汙|空污|霾/.test(l)) return 'pm25';
  if (/typhoon|颱風/.test(l)) return 'typhoon';
  if (/thunder|storm|lightning|hail|雷|閃電|冰雹/.test(l)) return 'thunder';
  if (/rain|umbrella|wet|下雨|雨|傘/.test(l)) return 'rain';
  return '';
}
// Source names inside AI bubbles (the 中文 layer skips those, so translate here).
function zhSrc(name) {
  var m = /^CWA (.*) station$/.exec(name);
  if (m) { var z = zh(m[1]); if (z === m[1]) z = zh(m[1] + ' District'); return '中央氣象署 ' + (z === m[1] + ' District' ? m[1] : z) + ' 測站'; }
  return { 'Windy point forecast': 'Windy 點預報', 'No source enabled': '未啟用任何來源' }[name] || name;
}
// 中文 versions of the canned answers: the same sample facts as answer() below.
function answerZh(q) {
  var L = S.loc, b = WEATHER[S.weather] || {}, src = nearestSource(L), tw = inTW(L.lat, L.lon), topic = askTopic(q);
  var name = esc(zh(L.name)), srcName = zhSrc(src.name);
  if (topic === 'landslide') return {
    text: tw ? '週六風險最高：大雨會讓東部邊坡的山崩風險升到<strong>高</strong>，週日上午 10 點後降為<strong>中</strong>。可以的話，建議週日下午再出發。' : '山崩模型只涵蓋台灣，所以無法評估' + name + '附近的邊坡。',
    bars: tw ? [[1, 1, 2, 3, 3, 2, 1, 0], ['週五', '下午', '週六', '下午', '晚上', '週日', '下午', '週一']] : null,
    src: ['中央氣象署雨量站', 'Windy · 降水', '★山崩模型'] };
  if (topic === 'pm25') return {
    text: tw ? name + '附近的 PM2.5 目前為<strong>普通（18 µg/m³）</strong>，晚上 9 點左右最高，約 30 µg/m³。明天早上東北季風增強後就會散去。' : '團隊的 PM2.5 模型只涵蓋台灣。Windy CAMS 顯示' + name + '附近的 PM2.5 屬於普通範圍（示範數值）。',
    bars: [[0, 1, 1, 2, 1, 0], ['現在', '18 時', '20 時', '21 時', '23 時', '6 時']],
    src: tw ? ['★PM2.5 模型', 'Windy CAMS pm2p5'] : ['Windy CAMS pm2p5'] };
  if (topic === 'typhoon') return {
    text: '目前有一個系統需要留意：示範颱風 <strong>TD-27</strong>，位於東南方約 860 公里，正向西北移動。中央氣象署可能在約 48 小時後發布海上警報，東部沿海會最先受影響。',
    bars: null, src: ['中央氣象署颱風警報', 'Windy · 風、浪'] };
  if (topic === 'thunder') return {
    text: '今天下午對流能量偏高（CAPE 2,400 J/kg）。<strong>下午 4 到 7 點很可能有雷雨</strong>，週六可能下冰雹（Windy 警示代碼 96）。',
    bars: [[0, 1, 2, 3, 3, 1], ['14 時', '15 時', '16 時', '17 時', '18 時', '19 時']], src: ['Windy · CAPE', 'Windy · 天氣警示'] };
  if (topic === 'rain') return {
    text: '記得帶傘。今天預估降雨約 <strong>32 毫米</strong>，多集中在下午 4 到 7 點。',
    bars: [[0, 0, 1, 3, 3, 2, 1], ['14 時', '15 時', '16 時', '17 時', '18 時', '19 時', '20 時']], src: ['Windy · 降水', srcName] };
  return {
    text: name + '現在是 <strong>' + fmtT(b.temp + tempOffset(L)) + '</strong>：' + esc(zh(b.headline || '')) + '。資料來自' + esc(srcName) + '。可以問我 PM2.5、山崩風險、雷雨、颱風或降雨。',
    bars: null, src: [srcName, 'Windy 點預報'] };
}
// A canned (Demo) answer in both languages; msgHTML shows the one for the current language.
function cannedMsg(q) { return { me: false, canned: true, en: answer(q), zh: answerZh(q) }; }
function cannedOf(m) { return m.canned ? (S.lang === 'zh' ? m.zh : m.en) : m; }
function tr(s) { return S.lang === 'zh' ? zh(s) : s; }
function answer(q) {
  var l = askTopic(q), L = S.loc, b = WEATHER[S.weather], src = nearestSource(L);
  var tw = inTW(L.lat, L.lon);
  if (l === 'landslide') return {
    text: tw ? 'Saturday is the risky day: heavy rain pushes landslide risk to <strong>High</strong> on eastern slopes. Sunday after 10 AM it drops to <strong>Medium</strong>. If you can, go Sunday afternoon.' : 'The landslide model only covers Taiwan, so I can’t rate slopes near ' + esc(L.name) + '.',
    bars: tw ? [[1, 1, 2, 3, 3, 2, 1, 0], ['Fri', 'PM', 'Sat', 'PM', 'Night', 'Sun', 'PM', 'Mon']] : null,
    src: ['CWA rain gauges', 'Windy · precip', '★Landslide model'] };
  if (l === 'pm25') return {
    text: tw ? 'PM2.5 near ' + esc(L.name) + ' is <strong>Moderate (18 µg/m³)</strong> and peaks around 9 PM at about 30 µg/m³. It clears by tomorrow morning as the northeast monsoon picks up.' : 'The team PM2.5 model covers Taiwan only. Windy CAMS puts PM2.5 near ' + esc(L.name) + ' in the moderate range (sample value).',
    bars: [[0, 1, 1, 2, 1, 0], ['Now', '6 PM', '8 PM', '9 PM', '11 PM', '6 AM']],
    src: tw ? ['★PM2.5 model', 'Windy CAMS pm2p5'] : ['Windy CAMS pm2p5'] };
  if (l === 'typhoon') return {
    text: 'There’s one system to watch: sample storm <strong>TD-27</strong>, about 860 km southeast and moving northwest. CWA could issue a sea warning in about 48 hours. The east coast would feel it first.',
    bars: null, src: ['CWA typhoon warnings', 'Windy · wind, waves'] };
  if (l === 'thunder') return {
    text: 'Storm energy is high this afternoon (CAPE 2,400 J/kg). Thunderstorms are <strong>likely from 4 to 7 PM</strong>, and hail is possible on Saturday (Windy warning code 96).',
    bars: [[0, 1, 2, 3, 3, 1], ['2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM']], src: ['Windy · CAPE', 'Windy · weatherWarnings'] };
  if (l === 'rain') return {
    text: 'Bring an umbrella. About <strong>32 mm</strong> of rain is expected today, most of it between 4 and 7 PM.',
    bars: [[0, 0, 1, 3, 3, 2, 1], ['2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM']], src: ['Windy · precip', src.name] };
  return {
    text: 'Right now in ' + esc(L.name) + ' it’s <strong>' + fmtT(b.temp + tempOffset(L)) + '</strong>: ' + esc(b.headline) + '. Reading from ' + esc(src.name) + '. Ask me about PM2.5, landslide risk, thunderstorms, typhoons or rain.',
    bars: null, src: [src.name, 'Windy point forecast'] };
}
function seedChat() {
  return [{ me: true, text: 'Safe to drive Suhua Highway this weekend?' }, cannedMsg('suhua highway')];
}
function msgHTML(m) {
  if (m.me) return '<div class="msg me">' + esc(m.text) + '</div>';
  // AI bubbles are skipped by the 中文 layer (model text must stay as written), so fixed strings use tr().
  if (m.llm) return '<div class="msg ai' + (m.live ? ' live' : '') + '">' +
    (m.error ? '<p class="err">' + esc(tr(m.error)) + ' <a class="link" href="#settings">' + tr('Check settings') + '</a></p>'
             : '<p class="body">' + (m.plain ? mdLite(m.plain) : (m.live ? '<span class="thinking">' + tr('Thinking…') + '</span>' : '')) + '</p>') +
    '<div class="srcs">' + m.src.map(function (x) { return '<span>' + esc(tr(x)) + '</span>'; }).join('') + '</div></div>';
  if (m.typing) return '<div class="msg ai typing">' + tr('Checking the nearest sources…') + '</div>';
  m = cannedOf(m);
  return '<div class="msg ai"><p>' + m.text + '</p>' + (m.bars ? bars(m.bars[0], m.bars[1]) : '') +
    '<div class="srcs">' + m.src.map(function (s) { return s.charAt(0) === '★' ? '<span class="own">' + esc(s.slice(1)) + '</span>' : '<span>' + esc(s) + '</span>'; }).join('') + '</div></div>';
}
function askView() {
  if (!chat) chat = seedChat();
  var sugg = ['PM2.5 tonight?', 'Typhoon outlook', 'Will it storm this afternoon?', 'Do I need an umbrella?', 'Landslide risk on Highway 8'];
  return '<div class="page light"><header><div class="eyebrow">RAG + MCP over our data</div><h1>Ask Skyline</h1>' +
    '<p class="lede">Answers are grounded in CWA stations, Windy and the team’s PM2.5 and landslide models, for ' + esc(S.loc.name) + '.</p>' +
    '<p class="lede ai-using">Answering with: <strong>' + esc(aiLabel()) + '</strong> · <a class="link" href="#settings">Change</a></p></header>' +
    '<div class="chat" id="chat" aria-live="polite">' + chat.map(msgHTML).join('') + '</div>' +
    '<div class="suggest">' + sugg.map(function (s) { return '<button type="button" data-action="ask" data-q="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
    '<form class="ask-form" id="ask-form"><label for="ask-input" class="sr-only">Ask a question</label><input id="ask-input" type="text" placeholder="Ask about Taiwan weather…" autocomplete="off"><button type="submit" id="ask-btn">' + (aiAbort ? 'Stop' : 'Ask') + '</button></form></div>';
}
function ask(q) {
  q = q.trim(); if (!q) return;
  if (aiAbort) return;
  // Asked before the server probe came back (4 s at most): wait, so the right provider answers.
  if (skyAI.state === 'checking' && (S.ai.provider === 'skyline' || !aiConfigured())) { probeSkyAI().then(function () { ask(q); }); return; }
  if (aiProvider() !== 'demo') {
    var btn = $('#ask-btn'); if (btn) btn.textContent = 'Stop';
    llmAsk(q).then(function () { var b2 = $('#ask-btn'); if (b2) b2.textContent = 'Ask'; });
    return;
  }
  chat.push({ me: true, text: q }, { typing: true });
  renderChat();
  setTimeout(function () {
    chat.pop(); chat.push(cannedMsg(q));
    renderChat();
  }, 700);
}
function renderChat() {
  var c = $('#chat'); if (!c) return;
  c.innerHTML = chat.map(msgHTML).join('');
  var last = c.lastElementChild; if (last) last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ============================================================
   Bring-your-own AI for Ask Skyline.
   - Demo: canned answers (no network).
   - OpenAI-compatible: any /v1/chat/completions server (OpenAI, OpenRouter,
     Ollama, LM Studio, vLLM...), streamed with fetch + SSE.
   - Claude: the official Anthropic TypeScript SDK, loaded from a CDN on first use.
   Keys live only in this browser (memory, or localStorage if "Remember" is on)
   and are sent only to the provider the user picked.
   ============================================================ */
var AI_KEYS_STORE = 'skyline-ai-keys-v1';
var AI_KEYS = { openai: '', claude: '' };
try { var savedKeys = JSON.parse(localStorage.getItem(AI_KEYS_STORE) || 'null'); if (savedKeys) { AI_KEYS.openai = savedKeys.openai || ''; AI_KEYS.claude = savedKeys.claude || ''; } } catch (e) {}
function saveKeys() {
  try {
    if (S.ai.remember) localStorage.setItem(AI_KEYS_STORE, JSON.stringify(AI_KEYS));
    else localStorage.removeItem(AI_KEYS_STORE);
  } catch (e) {}
}
var OA_PRESETS = [
  ['OpenAI', 'https://api.openai.com/v1'],
  ['OpenRouter', 'https://openrouter.ai/api/v1'],
  ['Ollama (local)', 'http://localhost:11434/v1'],
  ['LM Studio (local)', 'http://localhost:1234/v1']
];
var CLAUDE_SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm';
// Models that accept server-side refusal fallbacks ("default" routing by refusal category)
var CLAUDE_FALLBACK_MODELS = ['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1'];
var AnthropicSDK = null, aiAbort = null, aiModels = [];

function aiLabel() {
  var p = aiProvider();
  if (p === 'openai') return (S.ai.oaModel || 'no model set') + ' via ' + hostOf(S.ai.oaBase);
  if (p === 'claude') return 'Claude · ' + (S.ai.claudeModel || 'claude-opus-5-5');
  if (p === 'skyline') return 'Skyline AI' + (skyAI.model ? ' · ' + skyAI.model : '');
  return 'Demo answers';
}
function hostOf(u) { try { return new URL(u).host; } catch (e) { return u || 'no URL set'; } }

// Everything the model may use: the same data the screens show for the current location.
// Each line carries its source, which says "live" or "Sample".
function skylineContext() {
  var L = S.loc, src = nearestSource(L), nowWx = wxNow(L), tv = tyView();
  applyLiveSets();
  var cat = catalog(L), lines = [];
  lines.push('Location: ' + L.name + (L.sub ? ' (' + L.sub + ')' : '') + ' at ' + fmtCoord(L.lat, L.lon) + (inTW(L.lat, L.lon) ? '' : ' — outside Taiwan: team models and prediction maps do not cover it'));
  var wxSrc = nowWx.live ? 'Open-Meteo forecast API, live' + (nowWx.time ? ', updated ' + nowWx.time + ' local time' : '') : 'Sample (placeholder, live weather not loaded; nearest station would be ' + src.name + ')';
  lines.push('Now: ' + fmtT(nowWx.temp) + ', ' + nowWx.label + '. Headline: ' + nowWx.headline + ' [source: ' + wxSrc + ']');
  lines.push('Today: high ' + fmtT(todayHL(L).hi) + ', low ' + fmtT(todayHL(L).lo) + ' [source: ' + wxSrc + ']');
  cat.forEach(function (t) {
    if (t.kind === 'stat') lines.push('- ' + t.title + ': ' + t.value + ' — ' + t.sub + ' [source: ' + t.src + ']');
    if (t.kind === 'hourly') lines.push('- Hourly: ' + t.hours.map(function (h) { return h.t + ' ' + h.temp + ' rain ' + h.rain; }).join('; ') + ' [source: ' + t.src + ']');
    if (t.kind === 'week') lines.push('- 7-day forecast (low–high): ' + t.week.map(function (w) { return w.day + ' ' + w.lo + '–' + w.hi; }).join('; ') + ' [source: ' + t.src + ']');
    if (t.kind === 'typhoon') lines.push(tv.state === 'active' ? '- Typhoon watch: ' + tv.title + ' of this location' + (tv.sub ? '; ' + tv.sub : '') + ' [source: ' + tv.src + ']'
      : tv.state === 'none' ? '- Typhoon watch: no active typhoon near Taiwan [source: ' + tv.src + ']'
      : '- Typhoon watch: sample storm TD-27, 860 km SE, moving NW at 18 km/h; sea warning possible in ~48h [source: Sample (placeholder, typhoon feed not loaded)]');
  });
  lines.push('Taiwan prediction maps (region levels now / +24h / +72h):');
  activeSets().forEach(function (d) {
    var at = function (t) { return MAP_PLACES.map(function (p, i) { return p.name + ' ' + d.labels[lvlAt(d, i, t)]; }).join(', '); };
    lines.push('- ' + d.title + ' [' + d.src + ']: now: ' + at(NOW) + ' | +24h: ' + at(7) + ' | +72h: ' + at(9) + '. Note: ' + d.note);
  });
  return 'You are Skyline, a weather assistant for Taiwan inside a hackathon app. Answer using only the data in <skyline_data>. ' +
    'If the data does not cover the question, say so plainly instead of guessing. Name the source for each fact (for example "CWA station", "Windy", "team PM2.5 model"). ' +
    'Keep answers short and practical: two to five sentences, plain text, no headings. Reply in the language the user writes in (English or Traditional Chinese). ' +
    'Temperatures are in °' + S.units + '. Each line names its source. Sources ending in "live" are real, current data. Sources starting with "Sample" are placeholder values, not measurements: ' +
    'if an answer depends on one, say that figure is sample data.\n\n' +
    '<skyline_data>\n' + lines.join('\n') + '\n</skyline_data>';
}

// Conversation so far, as alternating user/assistant text (skips failed turns).
function chatHistory() {
  var out = [];
  for (var i = 0; i < chat.length; i++) {
    var m = chat[i];
    if (m.typing || m.error || m.live) continue;
    var text = m.me ? m.text : (m.plain || stripHTML(cannedOf(m).text));
    if (!text) continue;
    var role = m.me ? 'user' : 'assistant';
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n\n' + text;
    else out.push({ role: role, content: text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.slice(-12);
}
function stripHTML(h) { var d = document.createElement('div'); d.innerHTML = h || ''; return d.textContent || ''; }

// Minimal, safe markdown: escape first, then **bold**, `code`, line breaks and "- " bullets.
function mdLite(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^[-•] (.*)$/gm, '• $1').replace(/\n/g, '<br>');
}

async function streamOpenAI(messages, system, onDelta, signal) {
  var base = (S.ai.oaBase || '').replace(/\/+$/, '');
  if (!base) throw new Error('Set a base URL in Settings → AI assistant.');
  if (!S.ai.oaModel) throw new Error('Pick a model in Settings → AI assistant.');
  var headers = { 'Content-Type': 'application/json' };
  if (AI_KEYS.openai) headers.Authorization = 'Bearer ' + AI_KEYS.openai;
  var res;
  try {
    res = await fetch(base + '/chat/completions', { method: 'POST', headers: headers, signal: signal,
      body: JSON.stringify({ model: S.ai.oaModel, stream: true, messages: [{ role: 'system', content: system }].concat(messages) }) });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Couldn’t reach ' + hostOf(base) + '. A local server (Ollama, LM Studio) has to allow this page’s origin, e.g. OLLAMA_ORIGINS=' + location.origin + '. Some providers also block requests made straight from a browser.');
  }
  if (!res.ok) {
    var body = ''; try { body = await res.text(); } catch (e2) {}
    var msg = body; try { var j = JSON.parse(body); msg = (j.error && (j.error.message || j.error)) || j.message || body; } catch (e3) {}
    var known = { 401: 'The API key was rejected', 403: 'Access denied', 404: 'Not found (check the base URL and model)', 429: 'Rate limited or out of credit' }[res.status];
    throw new Error((known || 'Error ' + res.status) + ': ' + String(msg).slice(0, 200));
  }
  await readSSE(res, onDelta);
}
// Reads an OpenAI-style SSE stream (data: {"choices":[{"delta":{"content":"…"}}]} … data: [DONE]).
// Shared by the OpenAI-compatible provider and the Skyline server proxy.
async function readSSE(res, onDelta) {
  var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
  for (;;) {
    var r = await reader.read();
    if (r.done) break;
    buf += dec.decode(r.value, { stream: true });
    var lines = buf.split('\n'); buf = lines.pop();
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf('data:') !== 0) continue;
      var data = line.slice(5).trim();
      if (data === '[DONE]') return;
      var j2; try { j2 = JSON.parse(data); } catch (e4) { continue; }
      if (j2.error) throw new Error(j2.error.message || (typeof j2.error === 'string' && j2.error) || 'The provider returned an error.');
      var c = j2.choices && j2.choices[0] && j2.choices[0].delta && j2.choices[0].delta.content;
      if (c) onDelta(c);
    }
  }
}

/* Skyline (no setup): a same-origin proxy on the Skyline server holds the team's key, so this
   page never sees one. GET /api/ask/status says whether the proxy is there (it is not on
   localhost or a plain static host); POST /api/ask streams the answer in the OpenAI SSE format. */
var skyAI = { state: 'checking', model: '', remaining: null, promise: null };   // state: checking | ok | off
var SKY_ERR = {
  budget: 'The shared Skyline AI budget is used up for now. Demo answers still work, or add your own key in Settings.',
  rate: 'Skyline AI is busy: too many questions in a short time. Wait a moment and ask again.',
  gone: 'Skyline AI isn’t available on this server. Pick Demo or your own provider in Settings.',
  server: 'Skyline AI had a problem answering. Try again in a moment.',
  net: 'Couldn’t reach the Skyline server. Check your connection and try again.'
};
// Has the user picked a provider themselves? (Untouched installs get Skyline AI when the server offers it.)
function aiConfigured() { return !!S.ai.chosen || S.ai.provider !== 'demo'; }
// The provider actually used right now.
function aiProvider() {
  var p = S.ai.provider;
  if (p === 'skyline') return skyAI.state === 'off' ? 'demo' : 'skyline';
  if (p === 'demo' && !S.ai.chosen && skyAI.state === 'ok') return 'skyline';
  return p;
}
function probeSkyAI(force) {
  if (skyAI.promise && !force) return skyAI.promise;
  var done = function () { skyAIChanged(); return skyAI; };
  if (!/^https?:$/.test(location.protocol)) { skyAI.state = 'off'; return (skyAI.promise = Promise.resolve().then(done)); }
  var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 4000);
  skyAI.promise = fetch('/api/ask/status', { signal: ctrl.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
    .then(function (j) {
      skyAI.state = j && j.available === true ? 'ok' : 'off';
      skyAI.model = j && typeof j.model === 'string' ? j.model : '';
      skyAI.remaining = j && typeof j.remaining_usd === 'number' ? j.remaining_usd : null;
    })
    .catch(function () { skyAI.state = 'off'; })
    .then(function () { clearTimeout(timer); return done(); });
  return skyAI.promise;
}
// Refresh what is on screen after a probe, without rebuilding a form someone is typing in.
function skyAIChanged() {
  var r = route();
  if (r.page === 'ask') { var s = $('.ai-using strong'); if (s) s.textContent = aiLabel(); }
  if (r.page === 'settings') {
    var card = $('#ai-card'), a = document.activeElement, inside = !!(card && a && card.contains(a));
    if (!card || (inside && a.tagName === 'INPUT')) return;
    var sel = inside ? selectorFor(a) : null;
    card.outerHTML = aiSettingsHTML();
    if (sel) { var el = document.querySelector(sel); if (el && !el.disabled) el.focus({ preventScroll: true }); }
  }
}
async function streamSkyline(messages, system, onDelta, signal) {
  var res;
  try {
    res = await fetch('/api/ask', { method: 'POST', signal: signal, headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ messages: messages, context: system }) });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error(SKY_ERR.net);
  }
  if (!res.ok) {
    var why = ''; try { var j = await res.json(); why = String((j && j.error && (j.error.message || j.error)) || ''); } catch (e2) {}
    if (res.status === 429) {
      probeSkyAI(true);   // the status endpoint knows whether the budget is gone for good
      throw new Error(/budget|credit|quota|spend|exhaust|cap/i.test(why) ? SKY_ERR.budget : SKY_ERR.rate);
    }
    if (res.status === 404 || res.status === 405 || res.status === 501) { skyAI.state = 'off'; skyAIChanged(); throw new Error(SKY_ERR.gone); }
    throw new Error(SKY_ERR.server);
  }
  await readSSE(res, onDelta);
}
probeSkyAI();

async function claudeClient() {
  if (!AI_KEYS.claude) throw new Error('Add your Anthropic API key in Settings → AI assistant.');
  if (!AnthropicSDK) {
    try { AnthropicSDK = (await import(CLAUDE_SDK_URL)).default; }
    catch (e) { throw new Error('Couldn’t load the Anthropic SDK from the CDN (offline?).'); }
  }
  return new AnthropicSDK({ apiKey: AI_KEYS.claude, dangerouslyAllowBrowser: true });
}
function claudeError(e) {
  var A = AnthropicSDK;
  if (!A || !(e instanceof A.APIError)) return e;
  if (e instanceof A.AuthenticationError) return new Error('Anthropic rejected the API key.');
  if (e instanceof A.PermissionDeniedError) return new Error('This key can’t use that model.');
  if (e instanceof A.NotFoundError) return new Error('Model not found. Pick one with “Load models”.');
  if (e instanceof A.RateLimitError) return new Error('Rate limited. Try again in a moment.');
  if (e instanceof A.BadRequestError) return new Error('Request rejected: ' + e.message);
  if (e instanceof A.APIConnectionError) return new Error('Couldn’t reach the Anthropic API.');
  return new Error('Anthropic API error ' + (e.status || '') + ': ' + e.message);
}
async function streamClaude(messages, system, onDelta, signal) {
  var client = await claudeClient();
  var model = S.ai.claudeModel || 'claude-opus-5-5';
  var params = { model: model, max_tokens: 64000, system: system, messages: messages };
  var stream;
  try {
    if (CLAUDE_FALLBACK_MODELS.indexOf(model) >= 0) {
      // Server-side refusal fallback: if a safety classifier declines, the API retries on a suitable model.
      params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default';
      stream = client.beta.messages.stream(params, { signal: signal });
    } else {
      stream = client.messages.stream(params, { signal: signal });
    }
    stream.on('text', function (delta) { onDelta(delta); });
    var final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new Error('Claude declined to answer that' + (final.stop_details && final.stop_details.category ? ' (' + final.stop_details.category + ')' : '') + '.');
    if (final.stop_reason === 'max_tokens') onDelta('\n\n(The answer was cut off.)');
  } catch (e) { throw claudeError(e); }
}

async function listModels() {
  if (S.ai.provider === 'claude') {
    var client = await claudeClient(), ids = [];
    try { for await (var m of client.models.list()) ids.push(m.id); } catch (e) { throw claudeError(e); }
    return ids;
  }
  var base = (S.ai.oaBase || '').replace(/\/+$/, ''), headers = {};
  if (AI_KEYS.openai) headers.Authorization = 'Bearer ' + AI_KEYS.openai;
  var res;
  try { res = await fetch(base + '/models', { headers: headers }); }
  catch (e) { throw new Error('Couldn’t reach ' + hostOf(base) + ' (offline, wrong URL, or the server blocks browser requests).'); }
  if (!res.ok) throw new Error(res.status === 401 ? 'The API key was rejected.' : 'Error ' + res.status + ' listing models.');
  var j = await res.json();
  return (j.data || j.models || []).map(function (m) { return m.id || m.name; }).filter(Boolean).sort();
}

async function llmAsk(q) {
  var msg = { me: false, llm: true, live: true, plain: '', src: [aiLabel(), 'Skyline data for ' + S.loc.name] };
  chat.push({ me: true, text: q }, msg);
  var history = chatHistory();
  renderChat();
  var ctrl = new AbortController(); aiAbort = ctrl;
  var pending = false;
  var paint = function () {
    pending = false;
    var el = document.querySelector('#chat .msg.ai.live .body');
    if (el) el.innerHTML = mdLite(msg.plain);
  };
  var onDelta = function (d) { msg.plain += d; if (!pending) { pending = true; requestAnimationFrame(paint); } };
  try {
    var system = skylineContext();
    var prov = aiProvider();
    if (prov === 'claude') await streamClaude(history, system, onDelta, ctrl.signal);
    else if (prov === 'skyline') await streamSkyline(history, system, onDelta, ctrl.signal);
    else await streamOpenAI(history, system, onDelta, ctrl.signal);
    if (!msg.plain.trim()) msg.plain = '(No answer came back.)';
  } catch (e) {
    if (e && e.name === 'AbortError') msg.plain += (msg.plain ? '\n\n' : '') + '(Stopped.)';
    else { msg.error = (e && e.message) || String(e); }
  }
  msg.live = false; aiAbort = null;
  renderChat();
}

/* ---------- Settings ---------- */
function aiSettingsHTML() {
  var p = aiProvider(), skyOff = skyAI.state === 'off';
  var segH = '<div class="seg" role="group" aria-label="AI provider" style="flex-wrap:wrap">' + [['skyline', 'Skyline (no setup)'], ['demo', 'Demo'], ['openai', 'OpenAI-compatible'], ['claude', 'Claude']].map(function (o) {
    var dis = o[0] === 'skyline' && skyOff;
    return '<button type="button" data-action="ai-provider" data-val="' + o[0] + '" aria-pressed="' + (p === o[0]) + '"' + (dis ? ' disabled style="opacity:.45;cursor:not-allowed"' : '') + '>' + o[1] + '</button>';
  }).join('') + '</div>';
  if (skyOff) segH += '<p class="hint">Skyline (no setup) isn’t available on this server. Demo or your own provider still work. <button type="button" class="light-btn" data-action="ai-recheck">Check again</button></p>';
  var body = '';
  if (p === 'skyline') {
    body = '<p class="hint">No key and nothing to set up. Your question and the Skyline data shown for your location go to the Skyline server, which asks a shared model for you.</p>' +
      (skyAI.state === 'checking' ? '<p class="hint" role="status">Checking whether Skyline AI is available…</p>' : '') +
      (skyAI.model ? '<p class="hint"><span>Model:</span> <b>' + esc(skyAI.model) + '</b></p>' : '') +
      (skyAI.remaining != null ? '<p class="hint"><span>Shared budget left:</span> <b>$' + Math.max(0, skyAI.remaining).toFixed(2) + '</b></p>' : '');
  } else if (p === 'openai') {
    body = '<div class="field"><span class="lbl">Preset</span><div class="chips-row">' + OA_PRESETS.map(function (x) {
        return '<button type="button" class="chip-btn" data-action="ai-preset" data-base="' + esc(x[1]) + '" aria-pressed="' + (S.ai.oaBase === x[1]) + '">' + esc(x[0]) + '</button>';
      }).join('') + '</div></div>' +
      aiField('ai-base', 'Base URL', '<input id="ai-base" type="url" data-input="ai.oaBase" value="' + esc(S.ai.oaBase) + '" placeholder="https://…/v1" autocomplete="off" spellcheck="false">') +
      aiField('ai-key-oa', 'API key <small>(leave empty for local servers)</small>', '<input id="ai-key-oa" type="password" data-input="key.openai" value="' + esc(AI_KEYS.openai) + '" autocomplete="off" spellcheck="false" placeholder="sk-…">') +
      modelField('ai-model-oa', 'ai.oaModel', S.ai.oaModel, 'e.g. deepseek/deepseek-v4.1-flash');
  } else if (p === 'claude') {
    body = aiField('ai-key-claude', 'Anthropic API key', '<input id="ai-key-claude" type="password" data-input="key.claude" value="' + esc(AI_KEYS.claude) + '" autocomplete="off" spellcheck="false" placeholder="sk-ant-…">') +
      modelField('ai-model-claude', 'ai.claudeModel', S.ai.claudeModel, 'claude-opus-5-5');
  } else {
    body = '<p class="hint">Canned answers with no network. Pick a provider to use a real model.</p>';
  }
  if (p === 'openai' || p === 'claude') {
    body += setRow('Remember the key on this device', 'Otherwise it’s forgotten when you close the tab', '<button type="button" class="switch" role="switch" aria-checked="' + !!S.ai.remember + '" aria-label="Remember the key on this device" data-action="ai-remember"></button>') +
      '<p class="hint">The key stays in this browser and is sent only to ' + (p === 'claude' ? 'api.anthropic.com' : esc(hostOf(S.ai.oaBase))) + '. Don’t save it on a shared computer.</p>' +
      '<p class="hint ai-status" id="ai-status" role="status"></p>';
  }
  return '<section class="card" id="ai-card" aria-labelledby="st-ai"><h2 id="st-ai">AI assistant</h2><p class="hint">Ask AI can answer with Skyline’s shared model or your own. It gets the same Skyline data the screens show for your location.</p>' + segH + body + '</section>';
}
function aiField(id, label, input) { return '<div class="field"><label for="' + id + '" class="lbl">' + label + '</label>' + input + '</div>'; }
function modelField(id, key, val, ph) {
  return '<div class="field"><label for="' + id + '" class="lbl">Model</label><div class="row-in"><input id="' + id + '" type="text" list="ai-model-list" data-input="' + key + '" value="' + esc(val) + '" placeholder="' + esc(ph) + '" autocomplete="off" spellcheck="false">' +
    '<button type="button" class="light-btn" data-action="ai-models">Load models</button></div><datalist id="ai-model-list">' + aiModels.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('') + '</datalist></div>';
}
function mcpSettingsHTML() {
  var path = '/path/to/special-octo-enigma/ui/mcp/skyline_mcp.py';
  var cfg = JSON.stringify({ mcpServers: { skyline: { command: 'python3', args: [path] } } }, null, 2);
  return '<section class="card" aria-labelledby="st-mcp"><h2 id="st-mcp">Use Skyline in your own assistant (MCP)</h2>' +
    '<p class="hint">Skyline also runs as an MCP server, so Claude, ChatGPT, Cursor, VS Code or any other MCP client can use its tools: find a place (postal code, district, airport, coordinates), live weather, air quality, thunderstorm risk and the team’s PM2.5 forecast.</p>' +
    '<div class="field"><span class="lbl">Claude Code</span>' + codeBlock('mcp-cc', 'claude mcp add skyline -- python3 ' + path) + '</div>' +
    '<div class="field"><span class="lbl">Claude Desktop, Cursor and other clients (JSON config)</span>' + codeBlock('mcp-json', cfg) + '</div>' +
    '<div class="field"><span class="lbl">Over HTTP, for clients that connect to a URL</span>' + codeBlock('mcp-http', 'python3 ui/mcp/skyline_mcp.py --http --port 8790\n# then add http://localhost:8790/mcp in your client') + '</div>' +
    '<p class="hint">Setup steps are in ui/mcp/README.md in the repo.</p></section>';
}
function codeBlock(id, text) { return '<div class="code"><pre id="' + id + '">' + esc(text) + '</pre><button type="button" class="light-btn" data-action="copy" data-target="' + id + '">Copy</button></div>'; }

function seg(key, label, options) {
  return '<div class="seg" role="group" aria-label="' + label + '">' + options.map(function (o) {
    return '<button type="button" data-action="set" data-key="' + key + '" data-val="' + o[0] + '" aria-pressed="' + (String(S[key]) === String(o[0])) + '">' + o[1] + '</button>';
  }).join('') + '</div>';
}
function sw(path, label) {
  var on = path.indexOf('.') > 0 ? S.sources[path.split('.')[1]] : S[path];
  return '<button type="button" class="switch" role="switch" aria-checked="' + !!on + '" aria-label="' + label + '" data-action="toggle" data-key="' + path + '"></button>';
}
function setRow(label, small, control) {
  return '<div class="set-row"><span class="lbl">' + label + (small ? '<small>' + small + '</small>' : '') + '</span>' + control + '</div>';
}
function settingsView() {
  var cat = catalog(S.loc), byId = {};
  cat.forEach(function (t) { byId[t.id] = t; });
  var n = S.pinCount, src = nearestSource(S.loc);
  var swatches = [['#FFC24B', 'Sun yellow (default)'], ['#FF6B5A', 'Coral'], ['#4C8DFF', 'Sky blue'], ['#2FBF9B', 'Jade'], ['#C084FC', 'Orchid']];
  var isPreset = swatches.some(function (s) { return s[0].toLowerCase() === S.accent.toLowerCase(); });
  return '<div class="page light"><header><h1>Settings</h1><p class="lede">Everything in Skyline can be changed here, down to the colors. What you see now are the defaults.</p></header>' +
  '<div class="settings-grid"><div style="display:flex;flex-direction:column;gap:20px">' +

  '<section class="card" aria-labelledby="st-loc"><h2 id="st-loc">Location</h2>' +
    setRow(esc(S.loc.name), esc((S.loc.sub ? S.loc.sub + ' · ' : '') + fmtCoord(S.loc.lat, S.loc.lon)), '<button type="button" class="light-btn" data-action="open-search">Change</button>') +
    setRow('Nearest source', esc(src.name + (src.dist ? ' · ' + src.dist : '')), '') +
  '</section>' +

  '<section class="card" aria-labelledby="st-home"><h2 id="st-home">Home screen</h2>' +
    '<label for="pin-count" style="display:flex;justify-content:space-between;font-weight:600;font-size:15px"><span>Pinned items under the temperature</span><span id="pin-out" style="color:#1E5BC6">' + n + '</span></label>' +
    '<input id="pin-count" class="plain" type="range" min="3" max="10" value="' + n + '" data-input="pinCount">' +
    '<p class="hint">Shows the first ' + n + '. Reorder to choose which ones.</p>' +
    '<ol class="pins-list">' + S.pins.map(function (id, i) {
      var t = byId[id]; if (!t) return '';
      return '<li class="' + (i < n ? '' : 'off') + '"><span class="n">' + (i + 1) + '</span><span class="grow">' + t.title + (i < n ? '' : ' <small>(not shown)</small>') + '</span>' +
        '<button type="button" class="mini" data-action="pin-up" data-id="' + id + '" aria-label="Move ' + t.title + ' up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="mini" data-action="pin-down" data-id="' + id + '" aria-label="Move ' + t.title + ' down"' + (i === S.pins.length - 1 ? ' disabled' : '') + '>↓</button></li>';
    }).join('') + '</ol>' +
    '<a class="link" href="#stats">Customize All stats →</a>' +
  '</section>' +

  '<section class="card" aria-labelledby="st-data"><h2 id="st-data">Data sources</h2><p class="hint">Each reading always comes from the closest enabled source. Turning off a model or map hides its tiles and prediction cards.</p>' +
    setRow('Open-Meteo', 'Live conditions, forecast, air quality and waves at your coordinates. Off shows sample values.', sw('sources.openMeteo', 'Open-Meteo')) +
    setRow('CWA weather stations', 'Observed conditions', sw('sources.cwa', 'CWA weather stations')) +
    setRow('Windy Point Forecast', 'Forecasts at your exact point', sw('sources.windyPoint', 'Windy Point Forecast')) +
    setRow('Windy Map Forecast', 'Live maps', sw('sources.windyMap', 'Windy Map Forecast')) +
    setRow('Team PM2.5 model', 'Taiwan only', sw('sources.pm25', 'Team PM2.5 model')) +
    setRow('Team landslide model', 'Taiwan only, satellite-based', sw('sources.landslide', 'Team landslide model')) +
    setRow('CWA typhoon warnings', '', sw('sources.typhoon', 'CWA typhoon warnings')) +
  '</section></div>' +

  '<div style="display:flex;flex-direction:column;gap:20px">' +
  '<section class="card" aria-labelledby="st-theme"><div style="display:flex;justify-content:space-between;align-items:center"><h2 id="st-theme">Theme &amp; colors</h2>' +
    (themeIsDefault() ? '<span class="badge">Default</span>' : '<span class="badge custom">Custom</span>') + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px"><span style="font-weight:600;font-size:15px">Accent color</span><div class="swatches" role="group" aria-label="Accent color">' +
      swatches.map(function (s) { return '<button type="button" class="swatch" style="background:' + s[0] + '" aria-label="' + s[1] + '" aria-pressed="' + (s[0].toLowerCase() === S.accent.toLowerCase()) + '" data-action="set" data-key="accent" data-val="' + s[0] + '"></button>'; }).join('') +
      '<input type="color" id="accent-custom" data-input="accent" value="' + S.accent + '" aria-label="Custom accent color"' + (isPreset ? '' : ' style="border:3px solid #0B1B3F"') + '></div></div>' +
    setRow('Risk color scale', '<span style="display:flex;gap:3px;margin-top:4px">' + pal().map(function (c) { return '<i style="display:block;width:18px;height:10px;border-radius:3px;background:' + c + '"></i>'; }).join('') + '</span>',
      seg('risk', 'Risk color scale', [['default', 'Default'], ['cb', 'Color-blind safe']])) +
    setRow('Background', 'Follows the nearest station', seg('bgMode', 'Background', [['live', 'Live weather'], ['static', 'Static']])) +
    setRow('Tile style', '', seg('tiles', 'Tile style', [['glass', 'Glass'], ['solid', 'Solid']])) +
    setRow('Fonts', '', seg('fonts', 'Fonts', [['default', 'Bricolage + Inter'], ['system', 'System']])) +
    '<div class="set-row"><label for="radius" class="lbl">Corner roundness<small id="radius-out">' + S.radius + ' px</small></label><input id="radius" class="plain" style="max-width:200px" type="range" min="6" max="36" value="' + S.radius + '" data-input="radius"></div>' +
    setRow('Skyline art', 'Taiwan city silhouettes', seg('skyline', 'Skyline art', [['city', 'Follow my city'], ['off', 'Off']])) +
    setRow('Map base', 'Default for prediction maps', seg('mapBase', 'Map base', [['auto', 'Auto'], ['sat', 'Satellite'], ['windy', 'Windy']])) +
    '<p class="hint" style="margin-top:-4px">Auto: satellite for Skyline models, Windy for everything else.</p>' +
    '<button type="button" class="light-btn" data-action="reset-theme"' + (themeIsDefault() ? ' disabled' : '') + '>Reset theme to default</button>' +
  '</section>' +

  aiSettingsHTML() + mcpSettingsHTML() +
  '<section class="card" aria-labelledby="st-look"><h2 id="st-look">Motion</h2>' +
    setRow('Reduce motion', 'Stops drifting clouds, rain, lightning and map flow', sw('reduceMotion', 'Reduce motion')) +
  '</section>' +

  '<section class="card" aria-labelledby="st-units"><h2 id="st-units">Units &amp; language</h2>' +
    setRow('Temperature', '', seg('units', 'Temperature unit', [['C', '°C'], ['F', '°F']])) +
    setRow('Language', 'Demo AI answers follow this too', seg('lang', 'Language', [['zh', '中文'], ['en', 'English']])) +
  '</section>' +
  '<button type="button" class="light-btn" data-action="reset-all">Reset everything to default</button>' +
  '</div></div></div>';
}

/* ============================================================
   Router & render
   ============================================================ */
function route() {
  var h = decodeURIComponent(location.hash.slice(1)) || 'home';
  var parts = h.split('/');
  var page = parts[0] === 'stats' ? 'home' : parts[0];
  if (['home', 'predictions', 'ask', 'settings'].indexOf(page) < 0) page = 'home';
  return { page: page, sub: parts[1] || '', stats: parts[0] === 'stats' };
}
function render() {
  var r = route(), key = r.page + '/' + r.sub;
  document.body.dataset.page = r.page;
  var app = $('#app');
  destroyLive();
  loadLive(r.page); applyLiveSets();
  app.innerHTML = r.page === 'home' ? homeView() : r.page === 'predictions' ? predView(r.sub) : r.page === 'ask' ? askView() : settingsView();
  document.querySelectorAll('[data-nav]').forEach(function (a) {
    if (a.dataset.nav === r.page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (r.page === 'home' && S.bgMode === 'live') SkyFX.start($('.hero'), wxKey(), !!S.reduceMotion || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches));
  else SkyFX.stop();
  if (r.page === 'predictions' && r.sub) updatePred();
  if (r.page === 'ask' && pendingAsk) { var pq = pendingAsk; pendingAsk = null; ask(pq); }
  document.documentElement.lang = S.lang === 'zh' ? 'zh-Hant-TW' : 'en';
  document.title = { home: S.loc.name + ' · Skyline', predictions: 'Predictions · Skyline', ask: 'Ask AI · Skyline', settings: 'Settings · Skyline' }[r.page];
  if (key !== lastRoute) {
    if (r.stats) { var st = $('#stats'); if (st) st.scrollIntoView(); }
    else window.scrollTo(0, 0);
  }
  lastRoute = key;
}
function selectorFor(el) {
  if (!el || el === document.body) return null;
  if (el.id) return '#' + el.id;
  if (el.dataset && el.dataset.action) {
    var s = '[data-action="' + el.dataset.action + '"]';
    ['key', 'val', 'id', 'base'].forEach(function (k) { if (el.dataset[k] != null) s += '[data-' + k + '="' + el.dataset[k] + '"]'; });
    return s;
  }
  return null;
}
function rerender() {
  var sel = selectorFor(document.activeElement);
  render();
  if (sel) { var el = document.querySelector(sel); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}
function rerenderStats(focusSel) {
  var st = $('#stats'); if (!st) return;
  st.innerHTML = statsInner();
  if (focusSel) { var el = document.querySelector(focusSel); if (el && !el.disabled) el.focus({ preventScroll: true }); else { var g = $('#grid .edit-ctl button'); if (g) g.focus({ preventScroll: true }); } }
}

/* ============================================================
   Actions
   ============================================================ */
function moveIn(arr, id, dir) {
  var i = arr.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return arr;
  var o = arr.slice(); o.splice(i, 1); o.splice(j, 0, id); return o;
}
function visibleNeighbor(order, id, dir) {
  var vis = order.filter(function (x) { return !S.hidden[x]; });
  var i = vis.indexOf(id), j = i + dir;
  return j >= 0 && j < vis.length ? vis[j] : null;
}
var ACTIONS = {
  'open-search': function () { openSearch(); },
  'close-search': function () { closeSearch(); },
  'scroll-stats': function () { var s = $('#stats'); if (s) s.scrollIntoView({ behavior: 'smooth' }); },
  'toggle-edit': function () { editing = !editing; rerenderStats('[data-action="toggle-edit"]'); },
  'reset-grid': function () { S.order = null; S.spans = {}; S.hidden = {}; save(); rerenderStats('[data-action="toggle-edit"]'); toast('Layout reset to default'); },
  'tile-left': function (el) { tileMove(el.dataset.id, -1, '[data-action="tile-left"][data-id="' + el.dataset.id + '"]'); },
  'tile-right': function (el) { tileMove(el.dataset.id, 1, '[data-action="tile-right"][data-id="' + el.dataset.id + '"]'); },
  'tile-bigger': function (el) { tileSpan(el.dataset.id, 1); rerenderStats('[data-action="tile-bigger"][data-id="' + el.dataset.id + '"]'); },
  'tile-smaller': function (el) { tileSpan(el.dataset.id, -1); rerenderStats('[data-action="tile-smaller"][data-id="' + el.dataset.id + '"]'); },
  'tile-hide': function (el) { S.hidden[el.dataset.id] = true; save(); rerenderStats('[data-action="tile-restore"][data-id="' + el.dataset.id + '"]'); },
  'tile-restore': function (el) { delete S.hidden[el.dataset.id]; save(); rerenderStats('[data-action="tile-hide"][data-id="' + el.dataset.id + '"]'); },
  'set-base': function (el) { var sub = route().sub; S.predBase[sub] = el.dataset.base; save(); updatePred(); },
  'ask': function (el) { ask(el.dataset.q); },
  'ask-about': function (el) { pendingAsk = el.dataset.q; location.hash = 'ask'; },
  'set': function (el) { S[el.dataset.key] = el.dataset.val; save(); applyTheme(); rerender(); },
  'toggle': function (el) {
    var k = el.dataset.key;
    if (k.indexOf('sources.') === 0) { var sk = k.split('.')[1]; S.sources[sk] = !S.sources[sk]; } else S[k] = !S[k];
    save(); applyTheme(); rerender();
  },
  'pin-up': function (el) { S.pins = moveIn(S.pins, el.dataset.id, -1); save(); rerender(); },
  'pin-down': function (el) { S.pins = moveIn(S.pins, el.dataset.id, 1); save(); rerender(); },
  'reset-theme': function () { THEME_KEYS.forEach(function (k) { S[k] = DEFAULTS[k]; }); save(); applyTheme(); render(); toast('Theme reset to default'); },
  'ai-provider': function (el) { S.ai.provider = el.dataset.val; S.ai.chosen = true; aiModels = []; save(); rerender(); },
  'ai-recheck': function (el) { el.disabled = true; el.textContent = 'Checking…'; probeSkyAI(true); },
  'ai-preset': function (el) { S.ai.oaBase = el.dataset.base; aiModels = []; save(); rerender(); },
  'ai-remember': function () { S.ai.remember = !S.ai.remember; save(); saveKeys(); rerender(); },
  'ai-models': function () {
    var st = $('#ai-status'); if (st) st.textContent = 'Loading models…';
    listModels().then(function (ids) {
      aiModels = ids;
      var dl = $('#ai-model-list'); if (dl) dl.innerHTML = ids.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('');
      if (st) st.textContent = ids.length ? 'Connected. ' + ids.length + ' models available: start typing in the Model box to pick one.' : 'Connected, but the provider listed no models.';
    }).catch(function (e) { if (st) st.textContent = e.message || String(e); });
  },
  'copy': function (el) {
    var t = $('#' + el.dataset.target); if (!t) return;
    var done = function () { toast('Copied'); };
    if (navigator.clipboard) navigator.clipboard.writeText(t.textContent).then(done, function () { toast('Copy failed: select the text instead'); });
  },
  'reset-all': function () {
    var keepLoc = S.loc, keepRecents = S.recents, keepAI = S.ai;
    S = clone(DEFAULTS); S.loc = keepLoc; S.recents = keepRecents; S.ai = keepAI;
    save(); applyTheme(); render(); toast('Everything reset to default (location kept)');
  },
  'pick': function (el) { pickResult(+el.dataset.i); },
  'example': function (el) { var q = $('#q'); q.value = el.dataset.q; runSearch(); q.focus(); },
  'worldwide': function () { worldwide(); },
  'geolocate': function () { geolocate(); }
};
function tileMove(id, dir, focusSel) {
  var cat = catalog(S.loc), order = currentOrder(cat);
  var nb = visibleNeighbor(order, id, dir); if (!nb) return;
  var o = order.slice(), i = o.indexOf(id); o.splice(i, 1);
  var j = o.indexOf(nb); o.splice(dir < 0 ? j : j + 1, 0, id);
  S.order = o; save(); rerenderStats(focusSel);
}
function tileSpan(id, d) {
  var t = catalog(S.loc).filter(function (x) { return x.id === id; })[0];
  var cur = S.spans[id] || t.span;
  S.spans[id] = Math.max(1, Math.min(4, cur + d)); save();
}

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  var fn = ACTIONS[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('input', function (e) {
  var el = e.target, k = el.dataset && el.dataset.input;
  if (!k) return;
  if (k === 'predT') { S.predT = +el.value; updatePred(); save(); }
  else if (k === 'radius') { S.radius = +el.value; applyTheme(); var o = $('#radius-out'); if (o) o.textContent = S.radius + ' px'; }
  else if (k === 'pinCount') { var p = $('#pin-out'); if (p) p.textContent = el.value; }
  else if (k === 'accent') { S.accent = el.value; applyTheme(); }
  else if (k === 'q') runSearch();
  else if (k.indexOf('ai.') === 0) { S.ai[k.slice(3)] = el.value.trim(); save(); }
  else if (k.indexOf('key.') === 0) { AI_KEYS[k.slice(4)] = el.value.trim(); saveKeys(); }
});
document.addEventListener('change', function (e) {
  var el = e.target, k = el.dataset && el.dataset.input;
  if (!k) return;
  if (k === 'pinCount') { S.pinCount = +el.value; save(); rerender(); }
  else if (k === 'radius' || k === 'accent') { save(); rerender(); }
  else if (k === 'weather') { S.weather = el.value; save(); rerender(); }
});
document.addEventListener('submit', function (e) {
  if (e.target.id === 'ask-form') { e.preventDefault(); if (aiAbort) { aiAbort.abort(); return; } var i = $('#ask-input'); ask(i.value); i.value = ''; }
});

// Drag and drop for the stats grid
document.addEventListener('dragstart', function (e) {
  var t = e.target.closest && e.target.closest('.grid.editing .tile');
  if (!t) return;
  dragId = t.dataset.id; t.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
});
document.addEventListener('dragover', function (e) {
  var t = e.target.closest && e.target.closest('.grid.editing .tile');
  if (!t || !dragId) return;
  e.preventDefault();
  document.querySelectorAll('.drop-target').forEach(function (x) { if (x !== t) x.classList.remove('drop-target'); });
  if (t.dataset.id !== dragId) t.classList.add('drop-target');
});
document.addEventListener('drop', function (e) {
  var t = e.target.closest && e.target.closest('.grid.editing .tile');
  if (!t || !dragId) return;
  e.preventDefault();
  var target = t.dataset.id;
  if (target !== dragId) {
    var o = currentOrder(catalog(S.loc)).slice();
    var from = o.indexOf(dragId), to = o.indexOf(target);
    o.splice(from, 1); o.splice(o.indexOf(target) + (from < to ? 1 : 0), 0, dragId);
    S.order = o; save();
  }
  dragId = null; rerenderStats();
});
document.addEventListener('dragend', function () {
  dragId = null;
  document.querySelectorAll('.dragging,.drop-target').forEach(function (x) { x.classList.remove('dragging', 'drop-target'); });
});

/* ============================================================
   Location search
   Accepts: place names (EN / 中文), decimal or DMS coordinates,
   IATA (3-letter) and ICAO (4-letter) airport codes, universities.
   ============================================================ */
var results = [], active = -1, lastFocus = null, wwSeq = 0;

function parseCoords(q) {
  var s = q.replace(/\b(lat(itude)?|lon(gitude)?|lng)\b\s*[:=]?/gi, ' ').replace(/[()\[\]]/g, ' ').trim();
  if (!/\d/.test(s)) return null;
  var re = /([+-]?\d+(?:\.\d+)?)\s*(?:°|º|d|deg)?\s*(?:(\d+(?:\.\d+)?)\s*(?:'|′|’|m)\s*)?(?:(\d+(?:\.\d+)?)\s*(?:"|″|”|''|s)\s*)?\s*([NSEW])?/gi;
  var parts = [], m, rest = s;
  while ((m = re.exec(s)) !== null) {
    if (m[0].trim() === '') { re.lastIndex++; continue; }
    parts.push(m);
    rest = rest.replace(m[0], ' ');
  }
  if (parts.length !== 2) return null;
  if (rest.replace(/[\s,;\/]+/g, '') !== '') return null;
  var vals = parts.map(function (p) {
    var v = Math.abs(parseFloat(p[1])) + (p[2] ? parseFloat(p[2]) / 60 : 0) + (p[3] ? parseFloat(p[3]) / 3600 : 0);
    var neg = /^-/.test(p[1]) || /[SW]/i.test(p[4] || '');
    return { v: neg ? -v : v, h: (p[4] || '').toUpperCase() };
  });
  var lat = vals[0], lon = vals[1];
  if (/[EW]/.test(lat.h) || /[NS]/.test(lon.h)) { var tmp = lat; lat = lon; lon = tmp; }
  if (!isFinite(lat.v) || !isFinite(lon.v) || Math.abs(lat.v) > 90 || Math.abs(lon.v) > 180) return null;
  return { lat: lat.v, lon: lon.v };
}

function textScore(p, nq) {
  var best = 0;
  p.keys.forEach(function (a) {
    if (a === nq) best = Math.max(best, 100);
    else if (a.indexOf(nq) === 0) best = Math.max(best, 70);
    else if (a.split(' ').some(function (w) { return w.indexOf(nq) === 0; })) best = Math.max(best, 55);
    else if (nq.length >= 2 && a.indexOf(nq) >= 0) best = Math.max(best, 35);
  });
  // multi-word queries: every word must appear somewhere
  if (!best && nq.indexOf(' ') > 0) {
    var all = p.keys.join(' ');
    if (nq.split(' ').every(function (w) { return all.indexOf(w) >= 0; })) best = 40;
  }
  if (best && p.kind === 'City') best += 3;
  return best;
}

function search(q) {
  var out = [], seen = {};
  var push = function (r) { var key = r.id || (r.lat.toFixed(4) + ',' + r.lon.toFixed(4)); if (seen[key]) return; seen[key] = true; out.push(r); };
  var c = parseCoords(q);
  if (c) {
    var al = autoLoc(c.lat, c.lon, 'Coordinates', fmtCoord(c.lat, c.lon));
    push({ kind: 'Coordinates', tag: 'coords', name: fmtCoord(c.lat, c.lon), sub: al.name === fmtCoord(c.lat, c.lon) ? (al.sub === 'Coordinates' ? 'Point forecast from Windy' : al.sub) : al.name + ' · ' + al.sub.split(' · ').slice(0, 2).join(' · '), lat: c.lat, lon: c.lon, loc: al });
    return out;
  }
  // Taiwan postal codes: 408, 40852, 408052, or an address that starts with one (408台中市南屯區…)
  var pm = /^\s*(\d{3})(?:\d{2,3})?(?!\d)\s*(.*)$/.exec(q);
  if (pm) {
    var rest = norm(pm[2] || '');
    var hits = PLACES.filter(function (p) { return p.postal === pm[1]; });
    if (rest) {
      var narrowed = hits.filter(function (p) { return textScore(p, rest) > 0 || p.keys.some(function (k) { return rest.indexOf(k) >= 0 && k.length > 1 && !/^\d+$/.test(k); }); });
      if (narrowed.length) hits = narrowed;
    }
    hits.forEach(function (p) { push(districtResult(p, true)); });
    if (!hits.length) out.push({ note: 'No Taiwan district has postal code ' + pm[1] + '.' });
    return out;
  }
  var code = q.trim().toUpperCase();
  var codeNote = null;
  if (/^[A-Z]{3}$/.test(code)) {
    var a3 = PLACES.filter(function (p) { return p.iata === code; })[0];
    if (a3) push(airportResult(a3, 'IATA'));
    else codeNote = 'No airport with IATA code ' + code + ' in the offline list.';
  } else if (/^[A-Z]{4}$/.test(code)) {
    var a4 = PLACES.filter(function (p) { return p.icao === code; })[0];
    if (a4) push(airportResult(a4, 'ICAO'));
    else codeNote = 'No airport with ICAO code ' + code + ' in the offline list.';
  }
  var nq = norm(q);
  if (nq) {
    PLACES.map(function (p) { return { p: p, s: textScore(p, nq) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 8)
      .forEach(function (x) { push(x.p.kind === 'Airport' ? airportResult(x.p, 'Airport') : x.p.kind === 'District' ? districtResult(x.p, false) : placeResult(x.p)); });
  }
  if (codeNote && !out.length) out.push({ note: codeNote + ' Try searching worldwide below.' });
  return out;
}
function airportResult(p, how) {
  return { id: p.id, kind: how, tag: how.toLowerCase(), name: p.name, sub: 'IATA ' + p.iata + ' · ICAO ' + p.icao + ' · ' + p.sub, lat: p.lat, lon: p.lon,
    loc: { name: p.name.replace(/ International Airport| Airport/, '') + ' Airport (' + p.iata + ')', sub: p.sub, lat: p.lat, lon: p.lon, kind: 'Airport' } };
}
function districtResult(p, byCode) {
  return { id: p.id, kind: byCode ? 'Postal ' + p.postal : 'District', tag: 'district', name: p.name + ' ' + p.zh, sub: p.sub, lat: p.lat, lon: p.lon,
    loc: { name: p.locName, sub: p.locSub, lat: p.lat, lon: p.lon, kind: 'District' } };
}
function placeResult(p) {
  return { id: p.id, kind: p.kind, tag: p.kind.toLowerCase(), name: p.name, sub: p.sub, lat: p.lat, lon: p.lon,
    loc: { name: p.name, sub: p.sub, lat: p.lat, lon: p.lon, kind: p.kind } };
}

var ICONS = {
  coords: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  airport: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
  university: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg>',
  place: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  district: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v14H4z"/><path d="M7 9h4M7 13h10M7 16h6"/></svg>',
  recent: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
};
function iconFor(tag) { return tag === 'coords' ? ICONS.coords : (tag === 'iata' || tag === 'icao' || tag === 'airport') ? ICONS.airport : tag === 'university' ? ICONS.university : tag === 'district' ? ICONS.district : tag === 'recent' ? ICONS.recent : ICONS.place; }

function resultsHTML(list) {
  return '<ul class="results" id="results" role="listbox" aria-label="Locations">' + list.map(function (r, i) {
    if (r.note) return '<li class="res note-row" role="presentation">' + esc(r.note) + '</li>';
    return '<li class="res" role="option" id="opt-' + i + '" aria-selected="' + (i === active) + '" data-action="pick" data-i="' + i + '">' +
      '<span class="ico" aria-hidden="true">' + iconFor(r.tag) + '</span>' +
      '<span class="txt"><span class="nm">' + esc(r.name) + '</span><span class="sb">' + esc(r.sub || '') + '</span></span>' +
      '<span class="tag k-' + esc(r.tag) + '">' + esc(r.kind) + '</span></li>';
  }).join('') + '</ul>';
}
function runSearch() {
  var q = $('#q').value, body = $('#search-body'), ww = $('#ww-btn');
  wwSeq++;
  if (!q.trim()) {
    results = S.recents.map(function (l) { return { kind: 'Recent', tag: 'recent', name: l.name, sub: l.sub || fmtCoord(l.lat, l.lon), lat: l.lat, lon: l.lon, loc: l }; });
    active = -1;
    var ex = [['25.0330, 121.5654', 'Coordinates'], ['23°58′N 121°36′E', 'DMS'], ['TPE', 'IATA'], ['RCKH', 'ICAO'], ['NTU', 'University'], ['清華大學', '中文'], ['408', 'Postal code'], ['北屯區', 'District'], ['Hualien', 'City']];
    body.innerHTML = '<div class="s-label">Try</div><div class="examples">' + ex.map(function (e) { return '<button type="button" data-action="example" data-q="' + esc(e[0]) + '"><b>' + esc(e[0]) + '</b> · ' + e[1] + '</button>'; }).join('') + '</div>' +
      (results.length ? '<div class="s-label">Recent</div>' + resultsHTML(results) : '');
    ww.hidden = true;
    $('#q').removeAttribute('aria-activedescendant');
    return;
  }
  results = search(q);
  active = results.length && !results[0].note ? 0 : -1;
  body.innerHTML = results.length ? resultsHTML(results) : '<div class="res note-row">Nothing in the offline list matches “' + esc(q) + '”.</div>';
  var isCoord = results[0] && results[0].tag === 'coords';
  ww.hidden = isCoord;
  ww.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>Search worldwide for “' + esc(q.trim()) + '”';
  syncActive();
}
function syncActive() {
  document.querySelectorAll('#results .res[role=option]').forEach(function (li) { li.setAttribute('aria-selected', String(+li.dataset.i === active)); });
  var q = $('#q');
  if (active >= 0) { q.setAttribute('aria-activedescendant', 'opt-' + active); var el = $('#opt-' + active); if (el) el.scrollIntoView({ block: 'nearest' }); }
  else q.removeAttribute('aria-activedescendant');
}
function worldwide() {
  var q = $('#q').value.trim(); if (!q) return;
  var seq = ++wwSeq, body = $('#search-body');
  body.insertAdjacentHTML('beforeend', '<div class="s-label" id="ww-status">Searching worldwide…</div>');
  fetch('https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=' + encodeURIComponent(q))
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (j) {
      if (seq !== wwSeq) return;
      var st = $('#ww-status'); if (st) st.remove();
      var extra = (j.results || []).map(function (g) {
        var sub = [g.admin1, g.country].filter(Boolean).join(', ');
        return { kind: 'Place', tag: 'place', name: g.name, sub: sub + ' · ' + fmtCoord(g.latitude, g.longitude), lat: g.latitude, lon: g.longitude,
          loc: { name: g.name, sub: sub, lat: g.latitude, lon: g.longitude, kind: 'Place' } };
      });
      results = results.filter(function (r) { return !r.note; }).concat(extra);
      if (!results.length) { body.innerHTML = '<div class="res note-row">No places found for “' + esc(q) + '”.</div>'; return; }
      if (active < 0) active = 0;
      body.innerHTML = resultsHTML(results) + (extra.length ? '' : '<div class="res note-row">No extra worldwide matches.</div>');
      syncActive();
    })
    .catch(function () {
      if (seq !== wwSeq) return;
      var st = $('#ww-status'); if (st) st.textContent = 'Worldwide search is unavailable (offline?). Coordinates still work.';
    });
}
function pickResult(i) {
  var r = results[i]; if (!r || !r.loc) return;
  setLocation(r.loc);
}
function setLocation(loc) {
  S.loc = { name: loc.name, sub: loc.sub || '', lat: +loc.lat, lon: +loc.lon, kind: loc.kind || 'Place' };
  S.recents = [S.loc].concat(S.recents.filter(function (x) { return !(Math.abs(x.lat - S.loc.lat) < 1e-4 && Math.abs(x.lon - S.loc.lon) < 1e-4); })).slice(0, 5);
  save(); closeSearch(true);
  var src = nearestSource(S.loc);
  var r = route();
  if (r.page === 'home' || r.page === 'settings' || r.page === 'ask') rerender(); else render();
  toast('Showing ' + S.loc.name + ' · nearest source: ' + src.name + (src.dist ? ' (' + src.dist + ')' : ''));
}
function geolocate() {
  if (!navigator.geolocation) { toast('This browser can’t share your location.'); return; }
  toast('Finding your location…');
  navigator.geolocation.getCurrentPosition(function (pos) {
    setLocation(autoLoc(pos.coords.latitude, pos.coords.longitude, 'GPS', 'Current location'));
  }, function (err) {
    toast(err.code === 1 ? 'Location permission was denied.' : 'Couldn’t get your location.');
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}
function openSearch() {
  var ov = $('#search');
  if (!ov.hidden) { $('#q').focus(); return; }
  lastFocus = document.activeElement;
  ov.hidden = false;
  var q = $('#q'); q.value = ''; runSearch(); q.focus();
}
function closeSearch(skipRestore) {
  var ov = $('#search'); if (ov.hidden) return;
  ov.hidden = true; wwSeq++;
  if (!skipRestore && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
$('#search').addEventListener('click', function (e) { if (e.target.id === 'search') closeSearch(); });
document.addEventListener('keydown', function (e) {
  var ov = $('#search'), open = !ov.hidden;
  var typing = /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) || e.target.isContentEditable;
  if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open ? closeSearch() : openSearch(); return; }
  if (!open && e.key === '/' && !typing) { e.preventDefault(); openSearch(); return; }
  if (!open) return;
  if (e.key === 'Escape') { e.preventDefault(); closeSearch(); return; }
  if (e.target.id === 'q') {
    var opts = results.map(function (r, i) { return r.note ? -1 : i; }).filter(function (i) { return i >= 0; });
    if (e.key === 'ArrowDown' && opts.length) { e.preventDefault(); var k = opts.indexOf(active); active = opts[(k + 1) % opts.length]; syncActive(); }
    else if (e.key === 'ArrowUp' && opts.length) { e.preventDefault(); var k2 = opts.indexOf(active); active = opts[(k2 - 1 + opts.length) % opts.length]; syncActive(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) pickResult(active);
      else if ($('#q').value.trim()) worldwide();
    }
  }
  if (e.key === 'Tab') { // keep focus inside the dialog
    var f = Array.prototype.filter.call(ov.querySelectorAll('button:not([hidden]),input,[tabindex]'), function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

/* ============================================================
   中文 (Traditional, Taiwan). Views render in English; this layer
   swaps visible text and placeholders/labels when Language = 中文.
   ============================================================ */
var ZH = {
  'Home': '首頁', 'Predictions': '預測', 'Ask AI': '問 AI', 'Settings': '設定', 'Search': '搜尋',
  'Search any place, coordinates, airport…': '搜尋地點、座標、機場…',
  'Demo: station conditions': '示範：測站天氣',
  'Clear day': '晴天', 'Partly cloudy': '晴時多雲', 'Cloudy': '多雲', 'Rain': '雨', 'Thunderstorm': '雷雨', 'Clear night': '晴朗夜晚', 'Dawn': '清晨', 'Dusk': '黃昏',
  'Sunny · UV high until 3 PM': '晴朗 · 紫外線偏高至下午 3 點', 'Thunderstorms likely 4–7 PM': '下午 4–7 點可能有雷雨',
  'Overcast · light rain after 6 PM': '陰天 · 晚上 6 點後有小雨', 'Rain · 12 mm in the next hour': '下雨 · 未來一小時 12 毫米',
  'Thunderstorm · lightning 3 km away': '雷雨 · 閃電距離 3 公里', 'Clear · low of 19° before dawn': '晴朗 · 清晨前低溫 19°',
  'Sunrise 6:12 AM · clear morning': '日出 6:12 · 早晨晴朗', 'Sunset 5:18 PM · storms clearing': '日落 17:18 · 雷雨漸散',
  'Outside Taiwan: PM2.5, landslide and Predictions cover Taiwan only': '台灣以外：PM2.5、山崩與預測僅涵蓋台灣',
  'All stats ↓': '所有數據 ↓', 'All stats': '所有數據', 'Customize': '自訂', 'Done': '完成', 'Reset layout': '重設版面',
  'Drag a tile to move it, or use its buttons. Make tiles bigger or smaller, or hide the ones you don’t need. Hidden tiles wait below so you can bring them back.': '拖曳磚塊即可移動，或使用按鈕。可以放大、縮小或隱藏不需要的磚塊，隱藏的會留在下方，隨時加回來。',
  'Hidden:': '已隱藏：', 'Smaller': '縮小', 'Bigger': '放大', 'Hide': '隱藏',
  'Sample data for the mockup. In the app, every reading comes from the source closest to your location (CWA station, Windy point forecast, or other APIs). Typhoon tracks come from CWA warnings, because Windy’s API doesn’t provide them.': '示範資料。正式版中，每項數據都來自離你最近的來源（中央氣象署測站、Windy 點預報或其他 API）。颱風路徑來自中央氣象署警報，因為 Windy 的 API 不提供。',
  'Hourly': '逐時', 'Live map': '即時地圖', 'Thunderstorm risk': '雷雨風險', 'Storm outlook · 72h': '風暴展望 · 72 小時', 'Typhoon watch': '颱風動態',
  'Landslide risk': '山崩風險', '7-day forecast': '7 天預報', 'Wind & gusts': '風與陣風', 'Rain today': '今日雨量', 'Cloud layers': '雲層',
  'Humidity': '濕度', 'Pressure': '氣壓', 'Visibility': '能見度', 'Coast & waves': '海岸與浪高', 'UV index': '紫外線指數', 'Climate outlook · 30 days': '氣候展望 · 30 天',
  'High': '高', 'Low': '低', '2 events': '2 次',
  'CAPE 2,400 J/kg · storms likely 4–7 PM': 'CAPE 2,400 J/kg · 下午 4–7 點可能有雷雨',
  'Afternoon storms Sat and Sun. Hail possible Sat (code 96).': '週六、週日午後雷雨。週六可能有冰雹（代碼 96）。',
  'Moderate · peaks 9 PM': '普通 · 晚上 9 點最高', 'Rises to Medium if rain tops 80 mm': '雨量超過 80 毫米會升至中度',
  'Gusts 38 km/h · from NE': '陣風 38 km/h · 東北風', 'Mostly convective, 4–7 PM': '多為對流降雨，下午 4–7 點',
  'Low 40% · Mid 55% · High 70% · Base 900 m': '低雲 40% · 中雲 55% · 高雲 70% · 雲底 900 公尺',
  'Falling. Storms are building.': '下降中，雷雨正在發展。', 'Drops to 3 km in storms': '雷雨時降至 3 公里',
  'NE swell · avoid the Keelung coast': '東北湧浪 · 避開基隆海岸', 'High until 3 PM': '偏高至下午 3 點',
  'Warmer and wetter than normal (115% of normal rain)': '比常年暖且濕（雨量為常年 115%）',
  'TD-27 · 860 km SE': 'TD-27 · 東南方 860 公里',
  'Sample storm. Moving NW at 18 km/h. A sea warning is possible in about 48h.': '示範颱風。以每小時 18 公里向西北移動，約 48 小時後可能發布海上警報。',
  'Open map': '開啟地圖', 'Now': '現在', 'Today': '今天', 'Sun': '週日', 'Mon': '週一', 'Tue': '週二', 'Wed': '週三', 'Thu': '週四', 'Fri': '週五', 'Sat': '週六',
  'Taiwan only': '僅限台灣',
  'Pick a dataset to open its map, then scrub back through the past or forward into the forecast.': '選擇資料集開啟地圖，再拖曳時間軸查看過去或未來的預測。',
  'By Skyline': 'Skyline 自製', 'Our own Taiwan models': '我們自己的台灣模型', 'Others': '其他來源', 'Pulled from Windy, CWA and other APIs': '來自 Windy、中央氣象署與其他 API',
  'Satellite': '衛星', 'PM2.5 forecast': 'PM2.5 預報', 'Thunderstorms': '雷雨', 'Typhoon track': '颱風路徑', 'Climate projection': '氣候推估',
  'Fine-particle pollution by region, up to 7 days ahead.': '各地區細懸浮微粒污染，最多預測 7 天。',
  'Slope-failure risk from satellite data, rain and soil saturation.': '依衛星資料、降雨與土壤飽和度推估的邊坡崩塌風險。',
  'Hourly rainfall totals.': '每小時累積雨量。', 'Storm energy (CAPE) and thunderstorm warnings.': '對流能量（CAPE）與雷雨警示。',
  'Sustained wind and peak gusts.': '平均風速與最大陣風。', 'Storm position, forecast cone and local impact.': '颱風位置、預測範圍與在地影響。',
  'Wave height and swell along the coast.': '沿海浪高與湧浪。', 'Seasonal temperature anomaly vs 1991–2020.': '相較 1991–2020 年的季節溫度距平。',
  '← All predictions': '← 所有預測', 'Past ← Now → Prediction': '過去 ← 現在 → 預測', 'Observed (past)': '實測（過去）', 'Prediction': '預測', 'Observed': '實測',
  'Ask the AI about this map': '問 AI 這張地圖', 'Map base': '地圖底圖',
  'Good': '良好', 'Moderate': '普通', 'Sensitive': '敏感族群不健康', 'Unhealthy': '不健康',
  'Good (0–15)': '良好 (0–15)', 'Moderate (16–35)': '普通 (16–35)', 'Sensitive (36–54)': '敏感族群 (36–54)', 'Unhealthy (55+)': '不健康 (55+)',
  'Medium': '中', 'Very high': '極高', 'Unlikely': '不太可能', 'Possible': '可能', 'Likely': '很可能', 'Severe': '劇烈',
  'Calm': '平靜', 'Breezy': '微風', 'Strong': '強風', 'Gale': '強烈陣風', 'None': '無', 'Watch': '注意', 'Warning': '警報', 'Direct hit': '直接侵襲', 'No impact': '無影響', 'Direct impact': '直接影響',
  'West-coast haze builds as the northeast monsoon weakens. The east coast stays clean behind the Central Range.': '東北季風減弱後，西半部霾害增加。東部有中央山脈屏障，空氣維持乾淨。',
  'Saturated slopes in Nantou and Hualien. Risk peaks 12–24h after the heaviest rain. Watch Provincial Highway 8.': '南投與花蓮的邊坡已飽和。風險在最大雨後 12–24 小時達到高峰，請留意台 8 線。',
  'A frontal band moves south over the next 48 hours, with the heaviest totals on the east coast.': '鋒面雨帶未來 48 小時南移，東部累積雨量最多。',
  'Afternoon storms form over the western foothills. Hail is possible where CAPE tops 2,500 J/kg (code 96).': '午後雷雨在西部山麓形成。CAPE 超過 2,500 J/kg 的地方可能下冰雹（代碼 96）。',
  'The northeast monsoon funnels strong gusts through the Taiwan Strait and along the east coast.': '東北季風在台灣海峽與東部沿海帶來強陣風。',
  'Sample storm TD-27 tracks northwest. The east coast enters the watch area in about 48 hours.': '示範颱風 TD-27 向西北移動，東部約 48 小時後進入警戒範圍。',
  'Northeast swell builds on the north and east coasts. Keep away from the Keelung and Yilan shores.': '北部與東部沿海東北湧浪增強，請遠離基隆與宜蘭海岸。',
  'The coming season is projected warmer than the baseline, with more intense short bursts of rain.': '下一季預估比基準期溫暖，短時強降雨更劇烈。',
  'You’re looking at': '你正在查看', '. Predictions and the team models cover Taiwan only, so these maps always show Taiwan.': '。預測與團隊模型僅涵蓋台灣，因此地圖一律顯示台灣。',
  'Taipei': '台北', 'Taichung': '台中', 'Nantou': '南投', 'Hualien': '花蓮', 'Chiayi': '嘉義', 'Kaohsiung': '高雄', 'Taitung': '台東', 'Tainan': '台南',
  'RAG + MCP over our data': '以我們的資料進行 RAG + MCP', 'Ask Skyline': '問 Skyline',
  'PM2.5 tonight?': '今晚 PM2.5？', 'Typhoon outlook': '颱風展望', 'Will it storm this afternoon?': '今天下午會有雷雨嗎？', 'Do I need an umbrella?': '需要帶傘嗎？', 'Landslide risk on Highway 8': '台 8 線山崩風險',
  'Ask': '送出', 'Ask a question': '提出問題', 'Ask about Taiwan weather…': '詢問台灣天氣…', 'Checking the nearest sources…': '正在查詢最近的來源…',
  'Safe to drive Suhua Highway this weekend?': '這週末開蘇花公路安全嗎？',
  'Everything in Skyline can be changed here, down to the colors. What you see now are the defaults.': 'Skyline 的一切都能在這裡調整，連顏色也可以。目前顯示的是預設值。',
  'Location': '位置', 'Change': '變更', 'Nearest source': '最近的來源', 'Home screen': '首頁畫面', 'Pinned items under the temperature': '溫度下方的釘選項目',
  '(not shown)': '（不顯示）', 'Customize All stats →': '自訂所有數據 →', 'Data sources': '資料來源',
  'Each reading always comes from the closest enabled source. Turning off a model or map hides its tiles and prediction cards.': '每項數據一律來自最近且已啟用的來源。關閉模型或地圖會隱藏相關的磚塊與預測卡片。',
  'CWA weather stations': '中央氣象署測站', 'Observed conditions': '實測天氣', 'Forecasts at your exact point': '你所在位置的點預報', 'Live maps': '即時地圖',
  'Team PM2.5 model': '團隊 PM2.5 模型', 'Team landslide model': '團隊山崩模型', 'Taiwan only, satellite-based': '僅限台灣，以衛星資料為基礎', 'CWA typhoon warnings': '中央氣象署颱風警報',
  'Theme & colors': '主題與顏色', 'Default': '預設', 'Custom': '自訂', 'Accent color': '強調色', 'Risk color scale': '風險色階', 'Color-blind safe': '色盲友善',
  'Background': '背景', 'Follows the nearest station': '跟隨最近的測站', 'Live weather': '即時天氣', 'Static': '靜態', 'Tile style': '磚塊樣式', 'Glass': '玻璃', 'Solid': '實色',
  'Fonts': '字型', 'System': '系統', 'Corner roundness': '圓角', 'Skyline art': '天際線圖', 'Taiwan city silhouettes': '台灣城市剪影', 'Follow my city': '跟隨我的城市', 'Off': '關閉',
  'Default for prediction maps': '預測地圖的預設', 'Auto': '自動', 'Auto: satellite for Skyline models, Windy for everything else.': '自動：Skyline 模型用衛星，其他用 Windy。',
  'Reset theme to default': '將主題重設為預設', 'Motion': '動態效果', 'Reduce motion': '減少動態效果', 'Stops drifting clouds, rain, lightning and map flow': '停止雲、雨、閃電與地圖流線動畫',
  'Units & language': '單位與語言', 'Temperature': '溫度', 'Language': '語言', 'AI answers stay in English in the mockup': '示範版的 AI 回答仍為英文', 'Temperature unit': '溫度單位',
  'Reset everything to default': '全部重設為預設', 'Custom accent color': '自訂強調色', 'Sun yellow (default)': '陽光黃（預設）', 'Coral': '珊瑚紅', 'Sky blue': '天空藍', 'Jade': '玉綠', 'Orchid': '蘭紫',
  'City, district, postal code, 25.03, 121.56, TPE, or a university': '城市、行政區、郵遞區號、25.03, 121.56、TPE 或大學', 'Place, coordinates, airport code or university': '地點、座標、機場代碼或大學',
  'Try': '試試', 'Recent': '最近', 'Use my location': '使用我的位置', 'Locations': '地點', 'Searching worldwide…': '全球搜尋中…',
  'Coordinates': '座標', 'District': '行政區', 'Postal code': '郵遞區號', 'University': '大學', 'City': '城市', 'Landmark': '地標', 'Airport': '機場', 'Place': '地點', 'DMS': '度分秒', '中文': '中文',
'Current weather': '目前天氣', 'Region values': '各地區數值', 'Map': '地圖', 'Main': '主選單',
  // Ask AI: Skyline (no setup) provider, Demo answers
  'Skyline (no setup)': 'Skyline（免設定）', 'Demo answers': '示範回答', 'Thinking…': '思考中…', 'Check settings': '檢查設定', 'Check again': '重新檢查', 'Checking…': '檢查中…',
  'Skyline (no setup) isn’t available on this server. Demo or your own provider still work.': '這台伺服器沒有提供 Skyline（免設定）。仍可使用示範回答或你自己的供應商。',
  'No key and nothing to set up. Your question and the Skyline data shown for your location go to the Skyline server, which asks a shared model for you.': '不需要金鑰，也不用設定。你的問題與目前位置顯示的 Skyline 資料會送到 Skyline 伺服器，由它代你詢問共用模型。',
  'Checking whether Skyline AI is available…': '正在確認 Skyline AI 是否可用…', 'Model:': '模型：', 'Shared budget left:': '剩餘共用額度：',
  'Ask AI can answer with Skyline’s shared model or your own. It gets the same Skyline data the screens show for your location.': '「問 AI」可以用 Skyline 的共用模型或你自己的模型回答，並會取得畫面上為你的位置顯示的同一份 Skyline 資料。',
  'The shared Skyline AI budget is used up for now. Demo answers still work, or add your own key in Settings.': 'Skyline AI 的共用額度暫時用完了。仍可使用示範回答，或在設定中加入你自己的金鑰。',
  'Skyline AI is busy: too many questions in a short time. Wait a moment and ask again.': 'Skyline AI 忙碌中：短時間內的提問太多。請稍候再問一次。',
  'Skyline AI isn’t available on this server. Pick Demo or your own provider in Settings.': '這台伺服器沒有提供 Skyline AI。請在設定中改用示範回答或你自己的供應商。',
  'Skyline AI had a problem answering. Try again in a moment.': 'Skyline AI 回答時發生問題，請稍後再試。',
  'Couldn’t reach the Skyline server. Check your connection and try again.': '無法連上 Skyline 伺服器。請檢查網路連線後再試一次。',
  'Demo AI answers follow this too': '示範 AI 回答也會跟著切換'
};
// District names in 中文 come straight from the postal table
PLACES.forEach(function (p) { if (p.kind === 'District' && !ZH[p.locName]) ZH[p.locName] = p.zh; });
var ZHP = [
  [/^(· )?([A-Za-z' ]+) · (\d{3}) (\S+)$/, function (m) { return (m[1] || '') + zh(m[2]) + ' · ' + m[3] + ' ' + m[4]; }],
  [/^Live from nearest source: (.*)$/, function (m) { return '即時資料來源（最近）：' + m[1]; }],
  [/^Each reading uses the source nearest (.*)\.$/, function (m) { return '每項數據都來自離' + zh(m[1]) + '最近的來源。'; }],
  [/^Confidence: (.*)$/, function (m) { return '信心度：' + zh(m[1]); }],
  [/^Search worldwide for “(.*)”$/, function (m) { return '全球搜尋「' + m[1] + '」'; }],
  [/^Shows the first (\d+)\. Reorder to choose which ones\.$/, function (m) { return '顯示前 ' + m[1] + ' 項。調整順序來選擇要顯示哪些。'; }],
  [/^(Observed \(past\)|Now|Prediction) · (.*)$/, function (m) { return zh(m[1]) + ' · ' + m[2]; }],
  [/^Postal (\d{3})$/, function (m) { return '郵遞區號 ' + m[1]; }],
  [/^No Taiwan district has postal code (\d{3})\.$/, function (m) { return '沒有行政區使用郵遞區號 ' + m[1] + '。'; }],
  [/^H:(.+)$/, function (m) { return '高 ' + m[1]; }],
  [/^L:(.+)$/, function (m) { return '低 ' + m[1]; }],
  [/^Dew point (.*)$/, function (m) { return '露點 ' + m[1]; }],
  [/^Nearest: (.*)$/, function (m) { return '最近：' + m[1]; }],
  [/^Nothing in the offline list matches “(.*)”\.$/, function (m) { return '離線清單中找不到「' + m[1] + '」。'; }],
  [/^No airport with (IATA|ICAO) code (\w+) in the offline list\. Try searching worldwide below\.$/, function (m) { return '離線清單中沒有 ' + m[1] + ' 代碼 ' + m[2] + ' 的機場，請試試下方的全球搜尋。'; }],
  [/^Answers are grounded in .* for (.*)\. In this mockup the answers are canned\.$/, function (m) { return '回答依據中央氣象署測站、Windy 與團隊的 PM2.5、山崩模型，地點：' + zh(m[1]) + '。示範版的回答為預設內容（英文）。'; }],
  [/^Move (.*) (earlier|later|up|down)$/, function (m) { return '移動' + zh(m[1]) + ({ earlier: '往前', later: '往後', up: '上移', down: '下移' })[m[2]]; }],
  [/^Location: (.*)\. Change location$/, function (m) { return '位置：' + m[1] + '。變更位置'; }],
  [/^(· )?([A-Za-z' ]+) · (\d{3}) (\S+) · near (.+) border$/, function (m) { return (m[1] || '') + zh(m[2]) + ' · ' + m[3] + ' ' + m[4] + ' · 靠近' + zh(m[5]) + '邊界'; }],
  [/^Live Windy map \((.*) layer\)\. The slider opened it at (.*) \(as far as Windy’s free forecast reaches\); .*$/, function (m) { return '即時 Windy 地圖（' + m[1] + ' 圖層）。時間軸已讓地圖從 ' + m[2] + ' 開啟（以 Windy 免費預報的範圍為限）；之後可用地圖底部 Windy 自己的時間軸繼續調整。右側的各地區數值會跟著時間軸變化。'; }],
  [/^Live Windy map \((.*) layer\)\. Windy’s embed can’t open in the past, so the map stays at now\. At (.*) the slider only .*$/, function (m) { return '即時 Windy 地圖（' + m[1] + ' 圖層）。Windy 嵌入地圖無法從過去的時間開啟，所以地圖停在現在。在 ' + m[2] + ' 時，時間軸只會改變右側的各地區數值。'; }],
  [/^Live Windy map \((.*) layer\)\. Drag and zoom it\. Move the slider into the forecast .*$/, function (m) { return '即時 Windy 地圖（' + m[1] + ' 圖層）。可以拖曳與縮放。把時間軸移到預測時段，Windy 會從該時間重新開啟；右側的各地區數值會跟著時間軸變化。'; }]
];
// 中文 for the live-data strings (kept apart so they never override an entry above)
var ZH_LIVE = {
  'Live weather': '即時天氣', 'Open-Meteo · live': 'Open-Meteo · 即時', 'Sample data · loading live conditions…': '示範資料 · 正在載入即時天氣…',
  'Clear': '晴', 'Mainly clear': '大致晴朗', 'Partly cloudy': '晴時多雲', 'Overcast': '陰', 'Fog': '霧', 'Freezing fog': '凍霧',
  'Light drizzle': '毛毛雨', 'Drizzle': '細雨', 'Heavy drizzle': '較大細雨', 'Freezing drizzle': '凍毛毛雨', 'Light rain': '小雨', 'Rain': '雨', 'Heavy rain': '大雨',
  'Freezing rain': '凍雨', 'Light snow': '小雪', 'Snow': '雪', 'Heavy snow': '大雪', 'Snow grains': '米雪', 'Light showers': '短暫小陣雨', 'Showers': '陣雨',
  'Violent showers': '強烈陣雨', 'Snow showers': '陣雪', 'Thunderstorm': '雷雨', 'Thunderstorm with hail': '雷雨夾冰雹', 'Unknown': '不明',
  'Low': '低', 'Moderate': '普通', 'High': '高', 'Severe': '嚴重', 'Very high': '很高', 'Extreme': '極高', 'None': '無', 'Today': '今天',
  'No thunderstorms in the 3-day forecast': '未來 3 天預報沒有雷雨',
  'Falling over the next 3 hours': '未來 3 小時下降', 'Rising over the next 3 hours': '未來 3 小時上升', 'Steady over the next 3 hours': '未來 3 小時持平',
  'nearest sea point': '最近的海面格點',
  'No active typhoon': '目前沒有颱風', 'No tropical cyclone is being tracked near Taiwan right now.': '目前台灣附近沒有追蹤中的熱帶氣旋。',
  'No active typhoon near Taiwan right now.': '目前台灣附近沒有活動中的颱風。',
  'Model forecast': '模式預報', 'Forecast track': '預報路徑',
  'Rain that fell in the 24 hours up to each time, at seven cities. Open-Meteo forecast models.': '七個城市在各時間點之前 24 小時的累積雨量。資料來自 Open-Meteo 預報模式。',
  'Storm energy (CAPE) at seven cities. High CAPE means storms can form, not that one will. Open-Meteo forecast models.': '七個城市的對流可用位能（CAPE）。CAPE 高代表有條件形成雷雨，不代表一定發生。資料來自 Open-Meteo 預報模式。',
  'Peak gusts at seven cities. Open-Meteo forecast models.': '七個城市的最大陣風。資料來自 Open-Meteo 預報模式。',
  'Readings marked “live” come from Open-Meteo at your coordinates, the team PM2.5 model or the typhoon feed. Anything marked “Sample” is a placeholder, not a measurement.': '標示「即時」的數據來自 Open-Meteo（依你的座標）、團隊 PM2.5 模型或颱風資料。標示「示範」的是佔位數值，不是實際觀測。',
  'Live conditions, forecast, air quality and waves at your coordinates. Off shows sample values.': '依你的座標提供即時天氣、預報、空氣品質與浪高。關閉後顯示示範數值。',
  'Team model (Taichung) + Open-Meteo CAMS': '團隊模型（台中）+ Open-Meteo CAMS', 'Team model + Open-Meteo CAMS': '團隊模型 + Open-Meteo CAMS',
  'Open-Meteo · CAPE + weather codes': 'Open-Meteo · CAPE 與天氣代碼', 'Open-Meteo Marine': 'Open-Meteo 海象', 'Climate projections': '氣候推估'
};
Object.keys(ZH_LIVE).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(ZH, k)) ZH[k] = ZH_LIVE[k]; });
var ZH_DIR = { N: '北', NE: '東北', E: '東', SE: '東南', S: '南', SW: '西南', W: '西', NW: '西北' };
ZHP.push(
  [/^Open-Meteo · live · updated (\d\d:\d\d)$/, function (m) { return 'Open-Meteo · 即時 · ' + m[1] + ' 更新'; }],
  [/^Sample data · nearest source: (.*)$/, function (m) { return '示範資料 · 最近的來源：' + zh(m[1]); }],
  [/^Demo sky: (.*)$/, function (m) { return '示範天空：' + zh(m[1]); }],
  [/^Sample · (.*)$/, function (m) { return '示範 · ' + zh(m[1]); }],
  [/^(.+) · live$/, function (m) { return zh(m[1]) + ' · 即時'; }],
  [/^(.+) · feels like (\S+)$/, function (m) { return zh(m[1]) + ' · 體感 ' + m[2]; }],
  [/^(\d{1,2}) (AM|PM)$/, function (m) { return (m[2] === 'AM' ? '上午 ' : '下午 ') + m[1] + ' 點'; }],
  [/^CAPE up to ([\d,]+) J\/kg in 24 h(?: · peak around (.+))?$/, function (m) { return '24 小時內 CAPE 最高 ' + m[1] + ' J/kg' + (m[2] ? ' · 高峰約在' + zh(m[2]) : ''); }],
  [/^(\d+) days?$/, function (m) { return m[1] + ' 天'; }],
  [/^Thunderstorms forecast: (.*)$/, function (m) { return '預報有雷雨：' + m[1].split(', ').map(zh).join('、'); }],
  [/^Gusts (\d+) km\/h · from ([NSEW]{1,2})$/, function (m) { return '陣風 ' + m[1] + ' km/h · ' + ZH_DIR[m[2]] + '風'; }],
  [/^Chance of rain today: (\d+)%$/, function (m) { return '今日降雨機率：' + m[1] + '%'; }],
  [/^Low (\d+)% · Mid (\d+)% · High (\d+)%$/, function (m) { return '低雲 ' + m[1] + '% · 中雲 ' + m[2] + '% · 高雲 ' + m[3] + '%'; }],
  [/^Lowest in the next 24 h: (.*)$/, function (m) { return '未來 24 小時最低：' + m[1]; }],
  [/^(Low|Moderate|High|Very high|Extreme) at today’s peak$/, function (m) { return '今日最高時：' + ZH_LIVE[m[1]]; }],
  [/^(Good|Moderate|Sensitive|Unhealthy) · peaks (\d+) µg\/m³ around (.+)$/, function (m) { return zh(m[1]) + ' · ' + zh(m[3]) + '前後最高 ' + m[2] + ' µg/m³'; }],
  [/^(Good|Moderate|Sensitive|Unhealthy) · tomorrow ([\d.]+) µg\/m³ \(team model\)$/, function (m) { return zh(m[1]) + ' · 明天 ' + m[2] + ' µg/m³（團隊模型）'; }],
  [/^Tomorrow’s average, (.*) \(team model\)$/, function (m) { return '明日平均，' + zh(m[1]) + '（團隊模型）'; }],
  [/^(?:Swell ([\d.]+) m · )?(?:from ([NSEW]{1,2}) · )?nearest sea point$/, function (m) { return (m[1] ? '湧浪 ' + m[1] + ' 公尺 · ' : '') + (m[2] ? '來自' + ZH_DIR[m[2]] + '方 · ' : '') + '最近的海面格點'; }],
  [/^(.+) · ([\d.,]+) km (N|NE|E|SE|S|SW|W|NW)$/, function (m) { return m[1] + ' · ' + ZH_DIR[m[3]] + '方 ' + m[2] + ' 公里'; }],
  [/^Max wind (\d+) km\/h(.*)$/, function (m) { return '最大風速 ' + m[1] + ' km/h' + m[2]; }],
  [/^Track of (.+)\. Region levels are estimated from each city’s distance to the track\. They are not official warnings\.$/, function (m) { return m[1] + ' 的路徑。各地等級依城市與路徑的距離估算，並非官方警報。'; }],
  [/^PM2\.5 at seven cities from the Copernicus CAMS model, via Open-Meteo\. These are model estimates, not station readings\. The forecast ends about four days ahead, so later steps repeat the last value\.(?: Team model, Taichung, (\S+): ([\d.]+) µg\/m³ \((.*)\)\.)?$/,
    function (m) { return '七個城市的 PM2.5，來自 Copernicus CAMS 模式（經 Open-Meteo）。這是模式估計值，不是測站觀測。預報約到四天後，之後的時間點沿用最後一筆數值。' + (m[1] ? ' 團隊模型，台中，' + m[1] + '：' + m[2] + ' µg/m³（' + zh(m[3]) + '）。' : ''); }]
);
function zh(t) {
  if (Object.prototype.hasOwnProperty.call(ZH, t)) return ZH[t];
  for (var i = 0; i < ZHP.length; i++) { var m = t.match(ZHP[i][0]); if (m) return ZHP[i][1](m); }
  return t;
}
var I18N_ORIG = new WeakMap(), I18N_ATTRS = ['placeholder', 'aria-label'];
function translateTree(root) {
  var toZh = S.lang === 'zh';
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) { var pe = n.parentNode, p = pe && pe.nodeName; return p === 'SCRIPT' || p === 'STYLE' || (pe && pe.closest && pe.closest('.msg.ai')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
  });
  var n;
  while ((n = w.nextNode())) {
    var orig = I18N_ORIG.has(n) ? I18N_ORIG.get(n) : n.nodeValue;
    var t = orig.trim(); if (!t) continue;
    var out = toZh ? orig.replace(t, zh(t)) : orig;
    if (out !== n.nodeValue) { I18N_ORIG.set(n, orig); n.nodeValue = out; }
  }
  var els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[aria-label]') : [];
  Array.prototype.forEach.call(els, function (el) {
    var saved = I18N_ORIG.get(el) || {};
    I18N_ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var o = saved[a] != null ? saved[a] : el.getAttribute(a);
      var v = toZh ? zh(o) : o;
      if (v !== el.getAttribute(a)) { saved[a] = o; el.setAttribute(a, v); }
    });
    I18N_ORIG.set(el, saved);
  });
}
function startI18n() {
  var queued = false;
  var run = function () { queued = false; translateTree(document.body); };
  new MutationObserver(function () { if (!queued) { queued = true; Promise.resolve().then(run); } })
    .observe(document.body, { childList: true, subtree: true });
  run();
}

/* ============================================================
   Boot
   ============================================================ */
window.addEventListener('hashchange', render);
applyTheme();
render();
startI18n();
// Refresh live feeds once their 10-minute cache runs out (only while the tab is visible)
setInterval(function () { if (!document.hidden) loadLive(route().page); }, 60000);
})();
