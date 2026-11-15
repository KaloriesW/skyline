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

/* ============================================================
   State (saved in localStorage when available)
   ============================================================ */
// Settings live under KEY. People who used the earlier build have theirs under OLD_KEY: those are
// copied over once (the old entry is left alone) and everything is saved under KEY from then on.
var KEY = 'skyline-v1', OLD_KEY = 'skyline-mockup-v1';
var DEFAULTS = {
  loc: { name: 'Xinyi District', sub: 'Taipei · 110 信義區', lat: 25.0330, lon: 121.5654, kind: 'District' },
  weather: 'live', dataV: 2, uiV: 2, layout: null,
  accent: '#FFC24B', risk: 'default', bgMode: 'live', fonts: 'default', radius: 18, skyline: 'city', mapBase: 'auto',
  reduceMotion: false, units: 'C', lang: 'en',
  sources: { openMeteo: true, windyMap: true, pm25: true, landslide: true, typhoon: true },
  recents: [], predBase: {}, predT: NOW,
  ai: { provider: 'builtin', oaBase: 'https://openrouter.ai/api/v1', oaModel: '', claudeModel: 'claude-opus-5-5', remember: false }
};
var THEME_KEYS = ['accent', 'risk', 'bgMode', 'fonts', 'radius', 'skyline', 'mapBase'];
function clone(o) { return JSON.parse(JSON.stringify(o)); }
var S = clone(DEFAULTS);
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
    // Settings saved before the widget dashboard: the old grid order, sizes, hidden tiles, pinned items and
    // tile style are not carried over (they are not in DEFAULTS), and the old default corner radius becomes the new one.
    if (saved.uiV !== DEFAULTS.uiV) { if (saved.radius === 24) S.radius = DEFAULTS.radius; migrated = true; }
    S.uiV = DEFAULTS.uiV;
    if (S.layout != null && !Array.isArray(S.layout)) S.layout = null;
    if (migrated) localStorage.setItem(KEY, JSON.stringify(S));
  }
} catch (e) { /* storage unavailable: run with defaults */ }
// The sky preview is a session-only control: every load starts on live weather.
S.weather = 'live';
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

var editing = false, chat = null, lastRoute = '', pendingAsk = null;

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
  document.body.classList.toggle('system-fonts', S.fonts === 'system');
  document.body.classList.toggle('reduce-motion', !!S.reduceMotion);
}
function themeIsDefault() { return THEME_KEYS.every(function (k) { return S[k] === DEFAULTS[k]; }); }

/* ============================================================
   Sky
   The background is the team dashboard's: a gradient per "mood" (styles.css) plus the canvas
   effects in sky.js. The mood comes from the live weather at S.loc. Until the weather is known,
   or with Background set to Static, the mood is 'neutral': a plain gradient that implies no weather.
   ============================================================ */
var MOODS = [['clear-day', 'Clear day'], ['partly-day', 'Partly cloudy'], ['cloudy-day', 'Cloudy'], ['rain', 'Rain'], ['storm', 'Thunderstorm'], ['fog', 'Fog'],
  ['dawn', 'Dawn'], ['dusk', 'Dusk'], ['clear-night', 'Clear night'], ['partly-night', 'Partly cloudy night'], ['cloudy-night', 'Cloudy night']];
var NIGHT_MOODS = { 'clear-night': 1, 'partly-night': 1, 'cloudy-night': 1 };
function moodLabel(k) { for (var i = 0; i < MOODS.length; i++) if (MOODS[i][0] === k) return MOODS[i][1]; return ''; }
function previewOn() { return S.weather !== 'live' && !!moodLabel(S.weather); }
function clockMins(iso) { return +String(iso).substr(11, 2) * 60 + +String(iso).substr(14, 2); }
// Mood for live weather: the weather code first, then sunrise/sunset (within 40 minutes), then day or night.
function liveMood(wx) {
  var c = wx.current, dy = wx.daily, di = wxIdx(wx).di, day = !!c.is_day, kind = Icons.wmo(c.weather_code, day).kind;
  if (kind === 'thunder') return 'storm';
  if (kind === 'rain' || kind === 'drizzle' || kind === 'snow') return 'rain';
  if (kind === 'fog') return 'fog';
  var m = clockMins(c.time);
  if (dy.sunset[di] && Math.abs(m - clockMins(dy.sunset[di])) < 40) return 'dusk';
  if (dy.sunrise[di] && Math.abs(m - clockMins(dy.sunrise[di])) < 40) return 'dawn';
  if (kind === 'cloud') return day ? 'cloudy-day' : 'cloudy-night';
  if (kind === 'partly') return day ? 'partly-day' : 'partly-night';
  return day ? 'clear-day' : 'clear-night';
}
// What the sky shows now: a preview pick (Settings) wins, then live weather, else neutral.
function skyState() {
  if (previewOn()) return { mood: S.weather, day: !NIGHT_MOODS[S.weather], wind: 6, haze: 0 };
  var wx = S.bgMode === 'live' ? liveWx() : null;
  if (!wx) return { mood: 'neutral', day: true, wind: 0, haze: 0 };
  var c = wx.current, air = liveAir(), pm = air && isNum(air.current.pm2_5) ? air.current.pm2_5 : 12;
  return { mood: liveMood(wx), day: !!c.is_day, haze: Math.max(0, Math.min(0.6, (pm - 12) / 70)),
    wind: -(c.wind_speed_10m || 0) * Math.sin((c.wind_direction_10m || 0) * Math.PI / 180) };
}
function applySky() {
  var s = skyState();
  document.body.dataset.mood = s.mood;
  document.body.dataset.day = s.day ? '1' : '0';
  if (window.Sky) Sky.start({ mood: s.mood, wind: s.wind, haze: s.haze, reduce: !!S.reduceMotion });
}

// ----- city silhouettes (ours), drawn over the sky at the foot of the Home hero -----
var MTN_TINT = { 'clear-day': '#FFFFFF', 'partly-day': '#FFFFFF', 'cloudy-day': '#DDE3EC', rain: '#9AA6B8', storm: '#6B7486', fog: '#EEF1F4',
  'clear-night': '#3A4C80', 'partly-night': '#3A4C80', 'cloudy-night': '#55607A', dawn: '#6B4E7A', dusk: '#5A3A6A', neutral: '#9FB4DA' };
// Share of windows that are lit: most at night and in storms, none on a clear day
function litShare(mood, day) {
  if (mood === 'rain') return day ? 0.24 : 0.4;
  return { 'clear-night': 0.42, 'partly-night': 0.42, 'cloudy-night': 0.4, dusk: 0.34, storm: 0.38, dawn: 0.16, fog: 0.18, 'cloudy-day': 0.1 }[mood] || 0;
}
function seededRandom(seed) {
  return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
function litWindows(city, share) {
  if (!share) return '';
  var R = seededRandom(7), w = '';
  city.blds.forEach(function (r) {
    for (var y = r.y + 7; y < 210; y += 9) for (var x = r.x + 5; x <= r.x + r.w - 8; x += 7) if (R() < share) w += '<rect x="' + x + '" y="' + y + '" width="3" height="4"/>';
  });
  return '<g fill="#FFD58A" fill-opacity="0.78">' + w + '</g>';
}
function skylineSVG(city) {
  var s = skyState(), share = litShare(s.mood, s.day), lit = share >= 0.24;
  var blds = city.blds.map(function (r) { return '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="2"/>'; }).join('');
  return '<div class="skyline-wrap"><svg class="skyline" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice" role="img" aria-label="' + esc(city.label) + '">' +
    '<path d="' + city.mtnFar + '" fill="' + (MTN_TINT[s.mood] || MTN_TINT.neutral) + '" fill-opacity="0.3"/>' +
    '<path class="sil" d="' + city.mtnNear + '" fill-opacity="0.42"/>' +
    '<g class="sil" fill-opacity="0.84">' + blds + '</g>' + litWindows(city, share) +
    (city.landmark ? '<path class="sil" d="' + city.landmark + '" fill-opacity="0.96"/>' : '') +
    (city.glass ? '<clipPath id="lm-clip"><rect x="' + city.glassClip[0] + '" y="' + city.glassClip[1] + '" width="' + city.glassClip[2] + '" height="' + city.glassClip[3] + '"/></clipPath><path clip-path="url(#lm-clip)" d="' + city.glass + '" fill="' + (lit ? '#FFD58A' : '#C7D6EE') + '" fill-opacity="' + (lit ? 0.62 : 0.42) + '"/>' : '') +
    '<rect class="sil" x="0" y="214" width="1200" height="8"/></svg></div>';
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
    if (!r.ok) {
      // Keep the error body: /api/predict answers 404 with { error, nearest } away from every city model
      var e = new Error('HTTP ' + r.status); e.status = r.status;
      return r.json().then(function (b) { e.body = b; throw e; }, function () { throw e; });
    }
    return r.json();
  }).then(function (d) { clearTimeout(tm); return d; }, function (e) { clearTimeout(tm); throw e; });
}
// One cached feed per name. Fresh for its ttl (LIVE_TTL unless given). A failed refresh keeps the
// last good data (err is set, so screens can say how old it is) and is retried after RETRY_GAP.
function feed(name, url, ok, ttl) {
  var f = FEEDS[name] || (FEEDS[name] = { t: 0, tried: 0, d: null, busy: false, err: false, code: 0, body: null }), now = Date.now();
  if (f.busy || now - f.t < (ttl || LIVE_TTL) || now - f.tried < RETRY_GAP) return;
  f.busy = true; f.tried = now;
  getJSON(url).then(function (d) {
    f.busy = false;
    if (ok(d)) { f.d = d; f.t = Date.now(); f.err = false; f.code = 200; f.body = null; }
    else { f.err = true; f.code = 0; }
    liveArrived();
  }, function (e) { f.busy = false; f.err = true; f.code = (e && e.status) || 0; f.body = (e && e.body) || null; liveArrived(); });
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
// Where "now" is in a forecast response. The request includes yesterday (the tiles need the last
// 24 hours), so the current hour and today are not at index 0.
function wxIdx(wx) {
  var t = String(wx.current.time || '');
  return { hi: Math.max(0, wx.hourly.time.indexOf(t.slice(0, 13) + ':00')), di: Math.max(0, wx.daily.time.indexOf(t.slice(0, 10))) };
}
function airIdx(a) { return Math.max(0, a.hourly.time.indexOf(String(a.current.time || '').slice(0, 13) + ':00')); }

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

// ----- Skyline PM2.5 city models (/api/predict?lat=&lon=, /api/model?city=) -----
// The server answers from the nearest of its per-city models, and names it (city). Away from every
// modelled city it answers 404 with { error, nearest }.
function pmFeed() { return 'pm@' + ptKey(S.loc); }
function pmData() {
  if (!S.sources.pm25 || feat('pm25') === false) return null;
  var d = feedData(pmFeed());
  if (!d) return null;
  // A server from before the city models answers for Taichung whatever the coordinates: believe it only near Taichung
  if (!d.city && km(S.loc.lat, S.loc.lon, 24.1477, 120.6736) > 25) return null;
  return d;
}
// As apiState, and 'gone' when the answer cannot be used for this location
function pmState() { var st = apiState('pm25', pmFeed()); return (st === 'ok' || st === 'stale') && !pmData() ? 'gone' : st; }
// The nearest modelled city named by a 404, or null
function pmNearest() { var f = FEEDS[pmFeed()]; return f && f.body && f.body.nearest && typeof f.body.nearest === 'object' ? f.body.nearest : null; }
function modelFeed() { var p = pmData(); return p ? 'model@' + ((p.city && p.city.id) || 'taichung') : ''; }
// The test report (metrics.json) of the city model that answered, or null
function modelMetrics() { var n = modelFeed(); return n ? feedData(n) : null; }
function modelState() { var n = modelFeed(); return n ? feedState(n) : 'gone'; }
// An official station reading, when the server sends one with the prediction
function stationData() { var p = pmData(); return p && p.station && typeof p.station === 'object' && p.station.aqi != null ? p.station : null; }

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
  var L = S.loc, k = ptKey(L);
  if (liveOn()) {
    var q = '?latitude=' + L.lat.toFixed(3) + '&longitude=' + L.lon.toFixed(3) + '&timezone=auto';
    // The two responses the widgets read. Same variables as the team server's /api/weather asked
    // for Taichung (skyline/backend/sources.py), for these coordinates, plus what our storm,
    // cloud-layer and visibility readings need (cape, cloud_cover_low/mid/high, current dew point and visibility).
    feed('wx@' + k, OM_WX + q + '&past_days=1&forecast_days=10' +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m,visibility' +
      '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,is_day,visibility,uv_index,dew_point_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,wind_direction_10m,pressure_msl,cape,cloud_cover_low,cloud_cover_mid,cloud_cover_high' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
      function (d) { return !!(d && d.current && isNum(d.current.temperature_2m) && d.hourly && Array.isArray(d.hourly.time) && Array.isArray(d.hourly.temperature_2m) && d.daily && Array.isArray(d.daily.time) && d.daily.time.length); });
    feed('air@' + k, OM_AIR + q + '&domains=cams_global&past_days=2&forecast_days=4' +
      '&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,dust&hourly=pm2_5,pm10,us_aqi,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,dust',
      function (d) { return !!(d && d.current && isNum(d.current.pm2_5) && d.hourly && Array.isArray(d.hourly.time) && Array.isArray(d.hourly.pm2_5) && Array.isArray(d.hourly.pm10)); });
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
  if (S.sources.pm25 && feat('pm25') !== false) {
    feed(pmFeed(), '/api/predict?lat=' + L.lat.toFixed(4) + '&lon=' + L.lon.toFixed(4), function (d) { return !!(d && isNum(d.pm25) && isNum(d.pm10) && isNum(d.aqi)); });
    var mf = modelFeed();
    if (mf) feed(mf, '/api/model?city=' + encodeURIComponent(mf.slice(6)), function (d) { return !!(d && d.chosen && d.results && d.results.pm25 && d.results.warnings); }, 6 * 3600000);
  }
  if (S.sources.typhoon && feat('typhoon') !== false) feed('ty', '/api/typhoon', function (d) { return !!(d && typeof d.active === 'boolean'); });
}
// A feed arrived (or failed): redraw once things settle, without interrupting a drag or an open picker.
function liveArrived() {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(function () {
    var r = route();
    if (dragEl) { liveArrived(); return; }
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
function compass(deg) { return COMPASS[Math.round((((+deg % 360) + 360) % 360) / 45) % 8]; }
function bearing(aLat, aLon, bLat, bLon) {
  var r = Math.PI / 180, dl = (bLon - aLon) * r;
  return Math.atan2(Math.sin(dl) * Math.cos(bLat * r), Math.cos(aLat * r) * Math.sin(bLat * r) - Math.sin(aLat * r) * Math.cos(bLat * r) * Math.cos(dl)) / r;
}
function hourLabel(iso) { var h = +String(iso).substr(11, 2); return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'); }
function weekdayOf(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }); }
function fmtVis(m) { return m >= 10000 ? Math.round(m / 1000) + ' km' : (m / 1000).toFixed(1) + ' km'; }
function pmLevel(v) { return (v >= 15.5) + (v >= 35.5) + (v >= 54.5); }
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
function factState(t) {
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
      var c = wx.current, h = wx.hourly, dy = wx.daily, ix = wxIdx(wx), h0 = ix.hi, d0 = ix.di, n = Math.min(h.time.length, h0 + 24), i, hours = [], tag = liveTag('wx@' + k), OM = 'Open-Meteo' + tag;
      // "Now" is only true of fresh data: an old first hour is labelled with its clock time instead
      var old = Date.now() - FEEDS['wx@' + k].t > 45 * 60000;
      for (i = h0; i < Math.min(n, h0 + 10); i++) hours.push({ t: i > h0 || old ? hourLabel(h.time[i]) : 'Now', temp: fmtT(i > h0 ? h.temperature_2m[i] : c.temperature_2m), rain: Math.round(h.precipitation_probability[i] || 0) + '%' });
      set('hourly', { hours: hours, src: OM });
      set('week', { src: OM });
      // Same scoring as the MCP tool get_thunderstorm_risk, over the next 24 hours
      var top = 0, topI = h0, capeMax = 0;
      for (i = h0; i < n; i++) {
        var cape = h.cape[i] || 0, pop = h.precipitation_probability[i] || 0, code = h.weather_code[i];
        var sc = (code === 96 || code === 99 ? 3 : code === 95 ? 2 : 0) + (cape >= 2500 ? 2 : cape >= 1000 ? 1 : 0) + (pop >= 60 ? 1 : 0);
        if (sc > top) { top = sc; topI = i; }
        if (cape > capeMax) capeMax = cape;
      }
      var lvl = top >= 5 ? 3 : top >= 3 ? 2 : top >= 2 ? 1 : 0;
      set('thunder', { value: ['Low', 'Moderate', 'High', 'Severe'][lvl], sub: 'CAPE up to ' + Math.round(capeMax).toLocaleString('en-US') + ' J/kg in 24 h' + (lvl ? ' · peak around ' + hourLabel(h.time[topI]) : ''), meter: [8, 38, 70, 92][lvl] + '%', src: 'Open-Meteo · CAPE + weather codes' + tag });
      var sd = [];
      for (i = 0; i < 3 && d0 + i < dy.time.length; i++) if (dy.weather_code[d0 + i] >= 95) sd.push(i ? weekdayOf(dy.time[d0 + i]) : 'Today');
      set('storms', { value: sd.length ? sd.length + (sd.length > 1 ? ' days' : ' day') : 'None', sub: sd.length ? 'Thunderstorms forecast: ' + sd.join(', ') : 'No thunderstorms in the 3-day forecast', src: OM });
      if (isNum(c.wind_speed_10m)) set('wind', { value: Math.round(c.wind_speed_10m) + ' km/h', sub: 'Gusts ' + Math.round(c.wind_gusts_10m || 0) + ' km/h · from ' + compass(c.wind_direction_10m || 0), src: OM });
      if (isNum(dy.precipitation_sum[d0])) set('rain', { value: (dy.precipitation_sum[d0] < 10 ? dy.precipitation_sum[d0].toFixed(1) : Math.round(dy.precipitation_sum[d0])) + ' mm', sub: 'Chance of rain today: ' + Math.round(dy.precipitation_probability_max[d0] || 0) + '%', src: OM });
      if (isNum(c.cloud_cover)) set('clouds', { value: Math.round(c.cloud_cover) + '%', sub: 'Low ' + Math.round(h.cloud_cover_low[h0] || 0) + '% · Mid ' + Math.round(h.cloud_cover_mid[h0] || 0) + '% · High ' + Math.round(h.cloud_cover_high[h0] || 0) + '%', src: OM });
      if (isNum(c.relative_humidity_2m)) set('humidity', { value: Math.round(c.relative_humidity_2m) + '%', sub: isNum(c.dew_point_2m) ? 'Dew point ' + fmtT(c.dew_point_2m) : '', src: OM });
      if (isNum(c.pressure_msl)) {
        var dp = isNum(h.pressure_msl[h0 + 3]) && isNum(h.pressure_msl[h0]) ? h.pressure_msl[h0 + 3] - h.pressure_msl[h0] : 0;
        set('pressure', { value: Math.round(c.pressure_msl) + ' hPa', sub: dp <= -1 ? 'Falling over the next 3 hours' : dp >= 1 ? 'Rising over the next 3 hours' : 'Steady over the next 3 hours', src: OM });
      }
      if (isNum(c.visibility)) {
        var vmin = c.visibility;
        for (i = h0; i < n; i++) if (isNum(h.visibility[i]) && h.visibility[i] < vmin) vmin = h.visibility[i];
        set('visibility', { value: fmtVis(c.visibility), sub: 'Lowest in the next 24 h: ' + fmtVis(vmin), src: OM });
      }
      var uv = dy.uv_index_max[d0];
      if (isNum(uv)) set('uv', { value: String(Math.round(uv)), sub: (uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very high' : 'Extreme') + ' at today’s peak', src: OM });
    }
    var nearTc = !!pm;   // a Skyline city model answered for this location
    if (air) {
      var a0 = airIdx(air), p = air.current.pm2_5, hp = air.hourly.pm2_5.slice(a0, a0 + 24), ht = air.hourly.time.slice(a0, a0 + 24), pk = -1, atag = liveTag('air@' + k);
      hp.forEach(function (v, j) { if (isNum(v) && (pk < 0 || v > hp[pk])) pk = j; });
      var cat = DATASETS[0].labels[pmLevel(p)];
      set('pm25', { value: (p < 10 ? p.toFixed(1) : Math.round(p)) + ' µg/m³',
        sub: nearTc ? cat + ' · tomorrow ' + pm.pm25 + ' µg/m³ (team model)' : cat + (pk >= 0 ? ' · peaks ' + Math.round(hp[pk]) + ' µg/m³ around ' + hourLabel(ht[pk]) : ''),
        src: (nearTc ? 'Team model + Open-Meteo CAMS' : 'Open-Meteo CAMS') + atag });
    } else if (nearTc) {
      set('pm25', { value: pm.pm25 + ' µg/m³', sub: 'Tomorrow’s average, ' + esc(pm.category || '') + ' (team model)', src: 'Team PM2.5 model' + liveTag(pmFeed()) });
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
    if (t.live) return;
    t.na = factState(t); t.value = '—'; t.sub = t.na.h === '—' ? t.na.msg : t.na.h;
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
  return '<div class="ty"><svg width="108" height="86" viewBox="0 0 300 240" aria-hidden="true">' +
      '<g' + fit + '><g transform="translate(40,10) scale(0.42)"><path d="' + ISL + '" fill="#3F7A63"/></g>' + art + '</g></svg>' +
    (tv.state === 'active'
      ? '<div><div class="ty-t">' + esc(tv.title) + '</div><p class="note">' + esc(tv.sub) + '</p></div></div>'
      : '<div><div class="ty-t">No active typhoon</div><p class="note">No tropical cyclone is being tracked near Taiwan right now.</p></div></div>');
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
      if (!pos) return null;   // this time is outside the track: no distance is claimed
      var ll = PLACE_LL[p.name], d = km(ll[0], ll[1], pos[0], pos[1]);
      return (d < 700) + (d < 400) + (d < 200);
    });
  });
  return { lv: lv, sig: 'ty:' + stamp + ':' + S.lang + src, src: src, basis: 'Forecast track', none: 'Outside the track',
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
    var pm = pmData(), pmSt = pmState();
    var note = 'PM2.5 at seven cities from the Copernicus CAMS model, via Open-Meteo. These are model estimates, not station readings. The forecast ends about four days ahead, so later steps repeat the last value.';
    var cid = pm ? ((pm.city && pm.city.id) || 'taichung') : '', cn = pm ? ((pm.city && pm.city.name) || 'Taichung') : '';
    if (pm) {
      // The city model that answered for S.loc replaces the CAMS level for tomorrow when it is one of the seven map cities
      MAP_PLACES.forEach(function (p, i) { if (p.name.toLowerCase() === cid) lv[7][i] = pmLevel(pm.pm25); });
      note += ' Team model, ' + esc(cn) + ', ' + esc(pm.date || 'tomorrow') + ': ' + pm.pm25 + ' µg/m³ (' + esc(pm.category || '') + ').';
    } else if (pmSt === 'gone' && !pmNearest()) note += ' The team PM2.5 model isn’t connected on this server.';
    else if (pmSt === 'error') note += ' The team PM2.5 model couldn’t be reached.';
    src = (pm ? 'Team model (' + cn + ') + Open-Meteo CAMS' : 'Open-Meteo CAMS') + liveTag('regAir');
    return { lv: lv, sig: 'pm25:' + FEEDS.regAir.t + ':' + (pm ? FEEDS[pmFeed()].t + cid : pmSt) + src, basis: model, note: note, src: src };
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
// Today's high/low always brackets the current temperature. null without live weather.
function todayHL() {
  var wx = liveWx(), d0 = wx ? wxIdx(wx).di : 0;
  if (wx && isNum(wx.daily.temperature_2m_max[d0]) && isNum(wx.daily.temperature_2m_min[d0])) {
    return { hi: Math.max(wx.daily.temperature_2m_max[d0], wx.current.temperature_2m), lo: Math.min(wx.daily.temperature_2m_min[d0], wx.current.temperature_2m) };
  }
  return null;
}
// Seven days of lows and highs, from today. Empty without live weather.
function weekData() {
  var hl = todayHL(), wx = liveWx(), rows = [];
  if (!wx || !hl) return rows;
  var dy = wx.daily, d0 = wxIdx(wx).di;
  for (var i = 0; i < 7 && d0 + i < dy.time.length; i++) {
    var dlo = i ? dy.temperature_2m_min[d0 + i] : hl.lo, dhi = i ? dy.temperature_2m_max[d0 + i] : hl.hi;
    if (!isNum(dlo) || !isNum(dhi)) break;
    rows.push({ day: i ? weekdayOf(dy.time[d0 + i]) : 'Today', lo: fmtT(dlo), hi: fmtT(dhi) });
  }
  return rows;
}
// The readings as text: one record per topic, each with its value, a line of detail and its source,
// or `na` (a state, never a number). Ask AI reads these (builtinAnswer, skylineContext), and so do
// the storm, typhoon, waves and seasonal-outlook widgets.
function catalog(L) {
  var OM = 'Open-Meteo';
  var stat = function (id, title, src) { return { id: id, title: title, src: src, value: '—', sub: '', kind: 'stat' }; };
  var all = [
    { id: 'hourly', title: 'Hourly', src: OM, kind: 'hourly', hours: [] },
    stat('thunder', 'Thunderstorm risk', 'Open-Meteo · CAPE + weather codes'),
    stat('storms', 'Storm outlook · 72h', OM),
    { id: 'typhoon', title: 'Typhoon watch', src: 'CWA typhoon warnings', kind: 'typhoon' },
    stat('pm25', 'PM2.5', 'Open-Meteo CAMS'),
    stat('landslide', 'Landslide risk', 'Team landslide model'),
    { id: 'week', title: '7-day forecast', src: OM, kind: 'week', week: weekData() },
    stat('wind', 'Wind & gusts', OM),
    stat('rain', 'Rain today', OM),
    stat('clouds', 'Cloud layers', OM),
    stat('humidity', 'Humidity', OM),
    stat('pressure', 'Pressure', OM),
    stat('visibility', 'Visibility', OM),
    stat('waves', 'Coast & waves', 'Open-Meteo Marine'),
    stat('uv', 'UV index', OM),
    stat('climate', 'Seasonal outlook', 'ECMWF SEAS5 · Open-Meteo')
  ];
  var off = { landslide: !S.sources.landslide, typhoon: !S.sources.typhoon };
  liveTiles(all, L);
  return all.filter(function (t) { return !off[t.id]; });
}
function activeSets() {
  return DATASETS.filter(function (d) { return !((d.id === 'landslide' && !S.sources.landslide) || (d.id === 'typhoon' && !S.sources.typhoon)); });
}
// Which base map a dataset opens on
function baseFor(d) {
  if (S.predBase[d.id]) return S.predBase[d.id];
  if (S.mapBase === 'sat' || S.mapBase === 'windy') return S.mapBase;
  // Windy has no seasonal-outlook layer, so that dataset opens on the satellite map with our overlay
  return d.group === 'By Skyline' || d.id === 'climate' ? 'sat' : 'windy';
}

/* ============================================================
   Views
   ============================================================ */
// Options for the sky preview picker (Settings)
function skyOptions() {
  var pv = previewOn();
  return '<option value="live"' + (pv ? '' : ' selected') + '>Live weather</option>' +
    MOODS.map(function (m) { return '<option value="' + m[0] + '"' + (pv && m[0] === S.weather ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('');
}
/* ============================================================
   Home: hero + widgets
   The widget system is the team dashboard's (branch app, skyline/static/app.js): a catalog of
   tiles (TILES) in five sizes, a saved layout (S.layout), edit mode (jiggle, drag to rearrange,
   − to remove, long-press to enter), a gallery sheet to add widgets, and detail sheets.
   Its tiles read the Open-Meteo forecast and air-quality responses directly; here those come
   from our feed layer for S.loc (wctx), so they work for any location. Our own tiles (storms,
   typhoon, waves, seasonal outlook, landslide) are widgets in the same format and read catalog().
   A tile with no data shows a state inside the same chrome: loading, turned off, not connected
   yet, or unavailable with Retry. Old data is labelled with its age.
   ============================================================ */
function tx(en, zhText) { return S.lang === 'zh' ? zhText : en; }
function num(v, d) { return v == null || isNaN(v) ? '--' : Number(v).toFixed(d || 0); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function sumOf(arr) { return arr.reduce(function (s, v) { return s + (v || 0); }, 0); }
// Parts of an Open-Meteo local time string ("2026-11-15T14:30")
function pt(s) {
  var a = String(s).split('T'), d = a[0].split('-').map(Number), t = (a[1] || '00:00').split(':').map(Number);
  return { y: d[0], m: d[1], d: d[2], hh: t[0], mm: t[1], date: a[0], mins: t[0] * 60 + t[1], ts: Date.UTC(d[0], d[1] - 1, d[2], t[0], t[1]) };
}
function hhLabel(hh) { hh = ((hh % 24) + 24) % 24; return S.lang === 'zh' ? (hh < 12 ? '上午' : '下午') + (hh % 12 || 12) + '時' : (hh % 12 || 12) + (hh < 12 ? 'AM' : 'PM'); }
function timeLabel(s) {
  var p = pt(s), hm = (p.hh % 12 || 12) + ':' + ('0' + p.mm).slice(-2);
  return S.lang === 'zh' ? (p.hh < 12 ? '上午' : '下午') + hm : hm + (p.hh < 12 ? 'AM' : 'PM');
}
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function niceDate(date) {
  var p = pt(date);
  return S.lang === 'zh' ? p.m + ' 月 ' + p.d + ' 日（' + zh(weekdayOf(date)) + '）' : weekdayOf(date) + ', ' + MONTHS[p.m - 1] + ' ' + p.d;
}
// A temperature (given in °C) as a number in the chosen unit
function tU(c) { return S.units === 'F' ? c * 9 / 5 + 32 : c; }

// US AQI categories and breakpoints (2024 revision), as in the team model
var CATS = [[50, 'Good', '#3ad06e', 'Clean air. Enjoy the outdoors.'],
  [100, 'Moderate', '#f5d33b', 'Acceptable for most people.'],
  [150, 'Unhealthy for Sensitive Groups', '#ff8c32', 'Sensitive groups: limit long exertion.'],
  [200, 'Unhealthy', '#ff4545', 'Everyone: cut back outdoor exertion.'],
  [300, 'Very Unhealthy', '#a35cd6', 'Avoid outdoor exertion.'],
  [1e9, 'Hazardous', '#8a1538', 'Stay indoors.']];
function aqiCat(v) { for (var i = 0; i < CATS.length; i++) if (v <= CATS[i][0]) return CATS[i]; return CATS[CATS.length - 1]; }
function shortCat(name) { return name === 'Unhealthy for Sensitive Groups' ? 'Unhealthy (Sens.)' : name; }
var PM25_BP = [[0, 9, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]];
var PM10_BP = [[0, 54, 0, 50], [55, 154, 51, 100], [155, 254, 101, 150], [255, 354, 151, 200], [355, 424, 201, 300], [425, 604, 301, 500]];
function subIndex(c, bps) {
  for (var i = 0; i < bps.length; i++) { var b = bps[i]; if (c <= b[1]) return Math.round((b[3] - b[2]) / (b[1] - b[0]) * (Math.max(c, b[0]) - b[0]) + b[2]); }
  return 500;
}
function aqiOf(pm25, pm10) { return Math.max(subIndex(Math.floor(pm25 * 10) / 10, PM25_BP), subIndex(Math.floor(pm10), PM10_BP)); }
// Same wording as the team model's school_advice(), so the fallback reads the same
function schoolAdvice(a) {
  if (a <= 50) return { level: 'go', title: 'Outdoor PE as normal', detail: 'Air should be clean all day. Good day for sports practice outside.' };
  if (a <= 100) return { level: 'go', title: 'Outdoor PE OK', detail: 'Fine for most students. Students with asthma should keep their inhaler nearby.' };
  if (a <= 150) return { level: 'limit', title: 'Shorten hard outdoor exercise', detail: 'Sensitive students (asthma, heart or lung conditions) should do PE indoors or take it easy.' };
  if (a <= 200) return { level: 'indoor', title: 'Move PE indoors', detail: 'Everyone should cut down on long or hard activity outside.' };
  return { level: 'indoor', title: 'Keep students indoors', detail: 'Avoid outdoor activity. Close windows if indoor air is filtered.' };
}
// Colour for a temperature (°C) on the 10-day bars
var TSTOPS = [[0, [61, 139, 255]], [10, [90, 200, 250]], [16, [99, 230, 190]], [21, [255, 214, 10]], [26, [255, 159, 10]], [32, [255, 69, 58]]];
function tcol(t) {
  if (t <= TSTOPS[0][0]) return 'rgb(' + TSTOPS[0][1] + ')';
  for (var i = 1; i < TSTOPS.length; i++) {
    if (t <= TSTOPS[i][0]) {
      var c0 = TSTOPS[i - 1][1], c1 = TSTOPS[i][1], k = (t - TSTOPS[i - 1][0]) / (TSTOPS[i][0] - TSTOPS[i - 1][0]);
      return 'rgb(' + c0.map(function (v, j) { return Math.round(v + (c1[j] - v) * k); }) + ')';
    }
  }
  return 'rgb(' + TSTOPS[TSTOPS.length - 1][1] + ')';
}

// ----- the data the tiles read -----
// The team tiles' context: `w` is the Open-Meteo forecast response and `a` the air-quality
// response for S.loc (the same two objects their /api/weather returned for Taichung), plus the
// indexes of "now". null until the weather has loaded; `a` is null until air quality has.
function wctx() {
  var w = liveWx();
  if (!w) return null;
  var a = liveAir(), cur = w.current, ix = wxIdx(w);
  return { w: w, a: a, cur: cur, hi: ix.hi, di: ix.di, ai: a ? airIdx(a, w) : 0, now: pt(cur.time), isDay: !!cur.is_day };
}
// Tomorrow's daily means from the CAMS forecast (Open-Meteo), in the shape of a model prediction.
// Used when no Skyline city model covers the location. null when the forecast has too few hours.
function camsTomorrow(c) {
  if (!c || !c.a) return null;
  var h = c.a.hourly, day = c.w.daily.time[c.di + 1], today = c.w.daily.time[c.di];
  if (!day) return null;
  var mean = function (key, date) {
    var s = 0, n = 0;
    for (var i = 0; i < h.time.length; i++) if (h.time[i].slice(0, 10) === date && isNum(h[key][i])) { s += h[key][i]; n++; }
    return n >= 12 ? s / n : null;
  };
  var p25 = mean('pm2_5', day), p10 = mean('pm10', day), t25 = mean('pm2_5', today);
  if (p25 == null || p10 == null) return null;
  var a = aqiOf(p25, p10), cat = aqiCat(a);
  return { cams: true, date: day, pm25: Math.round(p25 * 10) / 10, pm10: Math.round(p10 * 10) / 10, aqi: a, category: cat[1], color: cat[2], advice: schoolAdvice(a),
    today: t25 == null ? null : { pm25: Math.round(t25 * 10) / 10 } };
}
// Tomorrow's air for S.loc.
//   { kind: 'model', p, city }  a Skyline city model answered (/api/predict): show it and name the city
//   { kind: 'cams', p, why }    no city model here: tomorrow's CAMS forecast, labelled as such
//   { kind: 'na', na }          nothing to show yet (loading) or at all
function tomorrowAir() {
  var c = wctx(), pm = pmData();
  if (pm) return { kind: 'model', p: pm, city: pm.city || { id: 'taichung', name: 'Taichung City', name_zh: '臺中市' } };
  var st = pmState();
  if (st === 'loading') return { kind: 'na', na: naOf('loading', 'om') };
  var p = camsTomorrow(c);
  if (p) return { kind: 'cams', p: p, why: st };
  var ast = !liveWx() ? wxState() : omState('air');
  return { kind: 'na', na: naOf(ast === 'gone' ? 'error' : ast, 'om') };
}
function cityName(city) { return (S.lang === 'zh' && city.name_zh) || city.name || ''; }
// Why there is no Skyline model for this location, in one sentence
function noModelWhy() {
  var st = pmState(), near = pmNearest();
  if (st === 'off') return tx('The Skyline PM2.5 model is switched off in Settings.', 'Skyline PM2.5 模型已在設定中關閉。');
  if (near) return tx('The nearest city model is ' + (near.name || '') + (isNum(near.distance_km) ? ', ' + Math.round(near.distance_km) + ' km away' : '') + '. Models cover places within 25 km of a modelled city.',
    '最近的城市模型是' + cityName(near) + (isNum(near.distance_km) ? '，距離 ' + Math.round(near.distance_km) + ' 公里' : '') + '。模型只涵蓋城市周圍 25 公里內的地點。');
  if (st === 'error') return tx('The Skyline PM2.5 model couldn’t be reached.', '無法連上 Skyline PM2.5 模型。');
  if (!inTW(S.loc.lat, S.loc.lon)) return tx('Skyline’s PM2.5 models cover 22 cities in Taiwan.', 'Skyline 的 PM2.5 模型涵蓋台灣 22 個縣市。');
  return tx('The Skyline PM2.5 model isn’t connected on this server.', '這台伺服器尚未連接 Skyline PM2.5 模型。');
}

var HOURLY_MODE = 'temp', MAP_LAYER = 'rain';
var MAP_LAYERS = [['rain', 'Rain', ['rain', 'ecmwf']], ['wind', 'Wind', ['wind', 'ecmwf']], ['pm2p5', 'PM2.5', ['pm2p5', 'cams']], ['temp', 'Temp', ['temp', 'ecmwf']]];

// A tile of ours: the value and line that catalog() built for it, in the team tile chrome
function factTile(id, extra) {
  var f = fact(id);
  return '<div class="big' + (String(f.value).length > 7 ? ' long' : '') + '">' + f.value + '</div>' + (extra || '') + '<div class="note">' + f.sub + '</div>';
}
function factNA(id) { var f = fact(id); return f ? f.na || null : naOf('off', 'om'); }
function pmTile(c, key, bps) {
  var v = c.a.current[key], hist = c.a.hourly[key].slice(Math.max(0, c.ai - 23), c.ai + 1).filter(function (x) { return x != null; });
  var avg = hist.length ? sumOf(hist) / hist.length : null, cat = aqiCat(subIndex(v, bps));
  return '<div class="big"><span data-count="' + v + '">' + num(v) + '</span><small>µg/m³</small></div><div class="sub" style="color:' + cat[2] + '">' + shortCat(cat[1]) + '</div>' +
    '<div class="note">' + tx('24-hour average: ', '24 小時平均：') + num(avg, 1) + ' µg/m³</div>';
}

/* needs: which feed a tile cannot render without: 'wx' (default), 'air' (weather and air quality) or 'none'.
   na():  for tiles with their own source, the state to show instead of a body (null = render).
   available(): false leaves the tile out of the layout and the gallery. */
var TILES = {
  hourly: {
    title: 'Hourly Forecast', label: 'Next 24 Hours', icon: 'clock', size: 'h', desc: 'Temperature, air quality or rain for each hour, with sunrise and sunset.',
    head: function () { return '<div class="seg">' + [['temp', 'Temp'], ['air', 'Air'], ['rain', 'Rain']].map(function (o) { return '<button type="button" data-hmode="' + o[0] + '" class="' + (HOURLY_MODE === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>'; },
    render: function (c) {
      var h = c.w.hourly, d = c.w.daily, airAt = {}, items = [], i, k;
      if (c.a) c.a.hourly.time.forEach(function (t, j) { airAt[t] = c.a.hourly.pm2_5[j]; });
      var end = Math.min(h.time.length, c.hi + 25);
      for (i = c.hi; i < end; i++) items.push({ ts: pt(h.time[i]).ts, i: i });
      var t0 = items[0].ts, t1 = items[items.length - 1].ts;
      for (k = c.di; k < Math.min(d.time.length, c.di + 2); k++) {
        [['Sunrise', 'sunrise'], ['Sunset', 'sunset']].forEach(function (s) {
          if (!d[s[1]][k]) return;
          var ts = pt(d[s[1]][k]).ts;
          if (ts > t0 && ts < t1) items.push({ ts: ts, sun: s[0], t: d[s[1]][k] });
        });
      }
      items.sort(function (x, y) { return x.ts - y.ts; });
      return '<div class="hours">' + items.map(function (it) {
        if (it.sun) return '<div class="hour"><span class="t">' + timeLabel(it.t) + '</span>' + Icons.art(it.sun === 'Sunrise' ? 'sunrise' : 'sunset', 30) + '<span class="p"></span><span class="v" style="font-size:13px">' + it.sun + '</span></div>';
        var j = it.i, label = j === c.hi ? 'Now' : hhLabel(pt(h.time[j]).hh), cls = 'hour' + (j === c.hi ? ' now' : '');
        if (HOURLY_MODE === 'air') {
          var pm = airAt[h.time[j]], cat = pm == null ? null : aqiCat(subIndex(pm, PM25_BP)), col = cat ? cat[2] : '#777';
          return '<div class="' + cls + '"><span class="t">' + label + '</span><span class="aq-dot" style="background:' + col + ';color:' + col + '"></span><span class="p" style="color:var(--dim)">µg/m³</span><span class="v">' + num(pm) + '</span></div>';
        }
        if (HOURLY_MODE === 'rain') {
          return '<div class="' + cls + '"><span class="t">' + label + '</span>' + Icons.art(h.precipitation[j] > 0.1 ? 'rain' : 'cloud', 30) + '<span class="p">' + num(h.precipitation[j], 1) + ' mm</span><span class="v">' + num(h.precipitation_probability[j]) + '%</span></div>';
        }
        var pp = h.precipitation_probability[j];
        return '<div class="' + cls + '"><span class="t">' + label + '</span>' + Icons.art(Icons.wmo(h.weather_code[j], !!h.is_day[j]).art, 30) + '<span class="p">' + (pp >= 20 ? pp + '%' : '') + '</span><span class="v">' + num(tU(j === c.hi ? c.cur.temperature_2m : h.temperature_2m[j])) + '°</span></div>';
      }).join('') + '</div>';
    }
  },

  daily: {
    title: '10-Day Forecast', icon: 'calendar', size: 't', desc: 'Highs, lows and rain chance for the next 10 days.',
    render: function (c) {
      var d = c.w.daily, idx = [], k;
      for (k = c.di; k < Math.min(d.time.length, c.di + 10); k++) if (isNum(d.temperature_2m_min[k]) && isNum(d.temperature_2m_max[k])) idx.push(k);
      var lo = Math.min.apply(null, idx.map(function (q) { return d.temperature_2m_min[q]; })), hi = Math.max.apply(null, idx.map(function (q) { return d.temperature_2m_max[q]; }));
      var pos = function (t) { return ((t - lo) / (hi - lo || 1)) * 100; };
      return '<div class="days">' + idx.map(function (q, n) {
        var mn = d.temperature_2m_min[q], mx = d.temperature_2m_max[q], pp = d.precipitation_probability_max[q];
        var dot = n === 0 ? '<b style="left:' + clamp(pos(c.cur.temperature_2m), 0, 100) + '%"></b>' : '';
        return '<div class="day"><span>' + (n === 0 ? 'Today' : weekdayOf(d.time[q])) + '</span>' +
          '<span class="ic">' + Icons.art(Icons.wmo(d.weather_code[q], true).art, 24) + (pp >= 20 ? '<small>' + pp + '%</small>' : '') + '</span>' +
          '<span class="lo">' + num(tU(mn)) + '°</span>' +
          '<span class="bar"><i style="left:' + pos(mn) + '%;width:' + (pos(mx) - pos(mn)) + '%;background:linear-gradient(90deg,' + tcol(mn) + ',' + tcol(mx) + ')"></i>' + dot + '</span>' +
          '<span class="hi">' + num(tU(mx)) + '°</span></div>';
      }).join('') + '</div>';
    }
  },

  tomorrow: {
    title: 'Tomorrow’s Air', icon: 'sparkle', size: 'w', needs: 'none',
    desc: 'Skyline’s own AI forecast of tomorrow’s PM2.5, PM10 and AQI from the nearest city model. Elsewhere, tomorrow’s CAMS forecast.',
    gold: function () { return tomorrowAir().kind === 'model'; },
    head: function () { var t = tomorrowAir(); return t.kind === 'model' ? '<span class="badge">BY SKYLINE</span>' : t.kind === 'cams' ? '<em class="src">CAMS forecast</em>' : ''; },
    open: function () { if (tomorrowAir().kind === 'model') openModel(); else openCamsNote(); },
    na: function () { var t = tomorrowAir(); return t.kind === 'na' ? t.na : null; },
    render: function () {
      var t = tomorrowAir(), p = t.p, trend = '';
      if (p.today && isNum(p.today.pm25)) {
        var diff = p.pm25 - p.today.pm25;
        if (Math.abs(diff) >= 1) trend = '<span class="trend ' + (diff < 0 ? 'down' : 'up') + '">' + (diff < 0 ? '↓' : '↑') + ' ' + num(Math.abs(diff), 1) + tx(' vs today', '（與今天相比）') + '</span>';
      }
      var better = p.model && p.model.baseline_mae ? Math.round((1 - p.model.test_mae / p.model.baseline_mae) * 100) : null;
      var note = t.kind === 'model'
        ? niceDate(p.date) + ' · ' + cityName(t.city) + (better != null ? tx(' · ' + better + '% more accurate than “same as today”', ' · 比「和今天一樣」準 ' + better + '%') : '') + tx(' · tap for details', ' · 點一下看細節')
        : niceDate(p.date) + tx(' · CAMS forecast via Open-Meteo, not a Skyline model', ' · CAMS 預報（經 Open-Meteo），不是 Skyline 模型');
      return '<div class="tm"><div class="aqibig"><span data-count="' + p.aqi + '">' + p.aqi + '</span><small style="color:' + p.color + '">AQI · ' + tx(shortCat(p.category), zh(shortCat(p.category))) + '</small></div>' +
        '<div class="vals"><div><b data-count="' + p.pm25 + '" data-dec="1">' + p.pm25 + '</b>µg/m³ PM2.5 ' + trend +
        (p.pm25_range ? '<br><span class="rng">' + tx('likely ', '可能範圍 ') + p.pm25_range[0] + '–' + p.pm25_range[1] + '</span>' : '') + '</div>' +
        '<div><b data-count="' + p.pm10 + '" data-dec="1">' + p.pm10 + '</b>µg/m³ PM10</div></div></div>' +
        '<div class="note dim">' + note + '</div>';
    }
  },

  advice: {
    title: 'School Outdoor Plan', label: 'School Outdoor Plan · Tomorrow', icon: 'school', size: 'w', needs: 'none',
    desc: 'Turns tomorrow’s PM2.5 forecast into a go / limit / indoors call for PE and sports practice.',
    gold: function () { return tomorrowAir().kind === 'model'; },
    open: function () { if (tomorrowAir().kind === 'model') openModel(); else openCamsNote(); },
    na: function () { var t = tomorrowAir(); return t.kind === 'na' ? t.na : null; },
    render: function () {
      var t = tomorrowAir(), p = t.p, a = p.advice || schoolAdvice(p.aqi), glyph = { go: '✓', limit: '!', indoor: '⌂' }[a.level] || '!';
      return '<div class="advice"><div class="light ' + esc(a.level) + '">' + glyph + '</div><div><h4>' + esc(a.title) + '</h4><p>' + esc(a.detail) + '</p></div></div>' +
        '<div class="note dim">' + (t.kind === 'model'
          ? tx('From Skyline’s forecast for ' + cityName(t.city) + ' (AQI ' + p.aqi + '). Prototype, not official health advice.', '依 Skyline 對' + cityName(t.city) + '的預報（AQI ' + p.aqi + '）。原型，並非官方健康建議。')
          : tx('From tomorrow’s CAMS forecast (AQI ' + p.aqi + '), not a Skyline model. Not official health advice.', '依明天的 CAMS 預報（AQI ' + p.aqi + '），不是 Skyline 模型。並非官方健康建議。')) + '</div>';
    }
  },

  model: {
    title: 'Model Check', icon: 'target', size: 's', needs: 'none',
    desc: 'How much better the Skyline model is than guessing “tomorrow = today”, on 12 months it never saw.',
    gold: function () { return !!modelMetrics(); },
    open: function () { if (modelMetrics()) openModel(); },
    na: function () {
      if (modelMetrics()) return null;
      var st = pmState();
      if (st === 'loading' || (pmData() && modelState() === 'loading')) return naOf('loading', 'om');
      return { st: 'gone', h: 'Not available here', msg: pmData() ? tx('The model report for this city couldn’t be loaded.', '無法載入這個城市的模型報告。') : noModelWhy() };
    },
    render: function () {
      var m = modelMetrics(), ch = m.chosen.pm25, mm = m.results.pm25[ch].mae, bm = m.results.pm25.baseline.mae, pm = pmData();
      var gain = Math.round((1 - mm / bm) * 100);
      return '<div class="big">' + (gain >= 0 ? '−' + gain : '+' + (-gain)) + '%<small>' + tx('error', '誤差') + '</small></div>' +
        '<div class="cmp"><div class="row">' + (pm && pm.city ? cityName(pm.city) : 'Skyline') + ' · ' + num(mm, 1) + ' µg/m³<span class="track"><i style="width:' + Math.min(100, (mm / bm) * 100) + '%;background:var(--gold)"></i></span></div>' +
        '<div class="row">' + tx('Same as today · ', '和今天一樣 · ') + num(bm, 1) + '<span class="track"><i style="width:100%;background:rgba(255,255,255,.45)"></i></span></div></div>';
    }
  },

  pmtrend: {
    title: 'PM2.5 Outlook', icon: 'chart', size: 'w', source: 'CAMS', needs: 'air', desc: 'PM2.5 over the past 2 days and the next 3, with the Skyline forecast for tomorrow where a city model covers you.',
    render: function (c) {
      var a = c.a.hourly, from = Math.max(0, c.ai - 48), to = Math.min(a.time.length, c.ai + 72), vals = a.pm2_5.slice(from, to), n = vals.length;
      if (n < 2) return naHTML(naOf('ok', 'om'));
      var ymax = Math.max.apply(null, [50].concat(vals.filter(function (v) { return v != null; }))) * 1.12;
      var X = function (i) { return (i / (n - 1)) * 300; }, Y = function (v) { return 100 - (v / ymax) * 100; };
      var pts = []; vals.forEach(function (v, i) { if (v != null) pts.push([X(i), Y(v)]); });
      var nowX = X(c.ai - from), past = pts.filter(function (q) { return q[0] <= nowX + 0.01; }), fut = pts.filter(function (q) { return q[0] >= nowX - 0.01; });
      var line = function (ps) { return ps.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(''); };
      var area = past.length ? line(past) + 'L' + past[past.length - 1][0] + ',100L' + past[0][0] + ',100Z' : '', gold = '', pm = pmData();
      if (pm && pm.pm25_range) {
        var s = a.time.indexOf(pm.date + 'T00:00'), e = a.time.indexOf(pm.date + 'T23:00');
        if (s >= from && e > 0) {
          var x0 = X(s - from), x1 = X(Math.min(e, to - 1) - from), y = Y(pm.pm25);
          gold = '<rect x="' + x0 + '" y="' + Y(pm.pm25_range[1]) + '" width="' + (x1 - x0) + '" height="' + (Y(pm.pm25_range[0]) - Y(pm.pm25_range[1])) + '" fill="rgba(255,194,75,.14)"/>' +
            '<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y + '" y2="' + y + '" stroke="#FFC24B" stroke-width="2.5" vector-effect="non-scaling-stroke"/>';
        }
      }
      return '<div class="chart"><svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">' +
        '<defs><linearGradient id="pmFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(120,200,255,.45)"/><stop offset="1" stop-color="rgba(120,200,255,0)"/></linearGradient></defs>' +
        '<line x1="0" x2="300" y1="' + Y(35) + '" y2="' + Y(35) + '" stroke="rgba(255,120,90,.7)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>' +
        '<path d="' + area + '" fill="url(#pmFill)"/>' +
        '<path d="' + line(past) + '" fill="none" stroke="#9fd8ff" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
        '<path d="' + line(fut) + '" fill="none" stroke="#9fd8ff" stroke-width="2" stroke-dasharray="3 4" opacity=".75" vector-effect="non-scaling-stroke"/>' + gold +
        '<line x1="' + nowX + '" x2="' + nowX + '" y1="0" y2="100" stroke="rgba(255,255,255,.5)" vector-effect="non-scaling-stroke"/></svg></div>' +
        '<div class="legend"><span><i style="background:#9fd8ff"></i>' + tx('CAMS hourly (dashed = forecast)', 'CAMS 逐時（虛線為預報）') + '</span>' +
        (gold ? '<span><i style="background:#FFC24B"></i>' + tx('Skyline tomorrow', 'Skyline 明日預報') + '</span>' : '') + '<span><i style="background:rgba(255,120,90,.8)"></i>35 µg/m³</span></div>';
    }
  },

  aqi: {
    title: 'Air Quality', icon: 'leaf', size: 's', source: 'CAMS', needs: 'air', desc: 'US AQI right now, from all pollutants.',
    render: function (c) {
      var cur = c.a.current, v = isNum(cur.us_aqi) ? cur.us_aqi : aqiOf(cur.pm2_5, cur.pm10 || 0), cat = aqiCat(v), st = stationData();
      return '<div class="big" data-count="' + v + '">' + num(v) + '</div><div class="sub"' + (cat[1].length > 12 ? ' style="font-size:14px"' : '') + '>' + shortCat(cat[1]) + '</div>' +
        '<div class="meter aqi"><b style="left:' + clamp(v / 300, 0, 1) * 100 + '%"></b></div>' +
        (st ? '<div class="note dim">' + esc(st.station || '') + ': AQI ' + esc(st.aqi) + ' (' + esc(st.status || '') + ')</div>' : '<div class="note">' + cat[3] + '</div>');
    }
  },
  pm25: { title: 'PM2.5', icon: 'drop', size: 's', source: 'CAMS', needs: 'air', desc: 'Fine particles right now and their 24-hour average.', render: function (c) { return pmTile(c, 'pm2_5', PM25_BP); } },
  pm10: { title: 'PM10', icon: 'drop', size: 's', source: 'CAMS', needs: 'air', desc: 'Coarse particles right now and their 24-hour average.', render: function (c) { return pmTile(c, 'pm10', PM10_BP); } },

  pollutants: {
    title: 'Pollutants', icon: 'layers', size: 'w', source: 'CAMS', needs: 'air', desc: 'Ozone, NO₂, SO₂, CO and dust compared with WHO guidelines.',
    render: function (c) {
      var cur = c.a.current, rows = [['O₃', cur.ozone, 100], ['NO₂', cur.nitrogen_dioxide, 25], ['SO₂', cur.sulphur_dioxide, 40], ['CO', cur.carbon_monoxide, 4000], ['Dust', cur.dust, 50]];
      return '<div class="polls">' + rows.map(function (r) {
        var k = (r[1] || 0) / r[2], col = k <= 0.5 ? '#3ad06e' : k <= 1 ? '#f5d33b' : '#ff8c32';
        return '<div class="p"><b>' + r[0] + '</b><span class="cmp"><span class="track"><i style="width:' + clamp(k, 0.02, 1.5) / 1.5 * 100 + '%;background:' + col + '"></i></span></span><span>' + num(r[1]) + ' µg/m³</span></div>';
      }).join('') + '</div><div class="note dim">Bar = share of the WHO guideline</div>';
    }
  },

  station: {
    title: 'Official Station', icon: 'station', size: 's', source: 'MOENV', needs: 'none', desc: 'Latest reading from the nearest Ministry of Environment station.',
    available: function () { return !!stationData(); },
    render: function () {
      var s = stationData();
      return '<div class="big">' + esc(s.aqi) + '</div><div class="sub">' + esc(s.status || '') + '</div><div class="note">PM2.5 ' + esc(s.pm25) + ' · PM10 ' + esc(s.pm10) + ' µg/m³<br><span class="dim">' + esc(s.station || '') + ' · ' + esc(s.time || '') + '</span></div>';
    }
  },

  wind: {
    title: 'Wind', icon: 'wind', size: 's', desc: 'Speed, gusts and direction with a compass.',
    render: function (c) {
      var dir = c.cur.wind_direction_10m || 0, ticks = '';
      for (var i = 0; i < 72; i++) {
        var a = (i * 5 * Math.PI) / 180, r1 = i % 6 === 0 ? 37 : 40;
        ticks += '<line x1="' + (50 + Math.sin(a) * r1).toFixed(2) + '" y1="' + (50 - Math.cos(a) * r1).toFixed(2) + '" x2="' + (50 + Math.sin(a) * 43).toFixed(2) + '" y2="' + (50 - Math.cos(a) * 43).toFixed(2) + '"/>';
      }
      return '<div class="centerviz"><svg viewBox="0 0 100 100" width="104" height="104" aria-hidden="true">' +
        '<g stroke="rgba(255,255,255,.35)" stroke-width="1">' + ticks + '</g>' +
        '<g font-size="9" font-weight="600" fill="rgba(255,255,255,.75)" text-anchor="middle"><text x="50" y="22">N</text><text x="80" y="53">E</text><text x="50" y="84">S</text><text x="20" y="53">W</text></g>' +
        '<g transform="rotate(' + (dir + 180) + ' 50 50)"><line x1="50" y1="88" x2="50" y2="14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><polygon points="50,9 45,19 55,19" fill="#fff"/><circle cx="50" cy="88" r="3" fill="none" stroke="#fff" stroke-width="2"/></g>' +
        '<circle cx="50" cy="50" r="15" fill="rgba(20,30,50,.75)"/>' +
        '<text x="50" y="50" font-size="13" font-weight="600" fill="#fff" text-anchor="middle">' + num(c.cur.wind_speed_10m) + '</text>' +
        '<text x="50" y="59" font-size="6.5" fill="rgba(255,255,255,.7)" text-anchor="middle">km/h</text></svg></div>' +
        '<div class="note">Gusts ' + Math.round(c.cur.wind_gusts_10m || 0) + ' km/h · from ' + compass(dir) + '</div>';
    }
  },

  uv: {
    title: 'UV Index', icon: 'sun', size: 's', desc: 'Current UV level and when to use sun protection.',
    render: function (c) {
      var h = c.w.hourly, uv = h.uv_index[c.hi] || 0, lvl = uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very High' : 'Extreme';
      var today = c.cur.time.slice(0, 10), strong = [];
      h.time.forEach(function (t, i) { if (t.slice(0, 10) === today && h.uv_index[i] >= 3) strong.push(t); });
      var note = strong.length && pt(strong[strong.length - 1]).hh >= c.now.hh
        ? tx('Use sun protection ', '需要防曬：') + hhLabel(pt(strong[0]).hh) + '–' + hhLabel(pt(strong[strong.length - 1]).hh + 1) + tx('.', '')
        : tx('Low for the rest of the day.', '今天接下來都偏低。');
      return '<div class="big">' + num(uv) + '</div><div class="sub">' + lvl + '</div><div class="meter uv"><b style="left:' + clamp(uv / 11, 0, 1) * 100 + '%"></b></div><div class="note">' + note + '</div>';
    }
  },

  sunrise: {
    title: 'Sunrise', icon: 'sunrise', size: 's', desc: 'Next sunrise or sunset and the sun’s path today.',
    label: function () { var c = wctx(); if (!c || !c.w.daily.sunrise[c.di]) return 'Sunrise'; var m = c.now.mins; return m >= pt(c.w.daily.sunrise[c.di]).mins && m < pt(c.w.daily.sunset[c.di]).mins ? 'Sunset' : 'Sunrise'; },
    render: function (c) {
      var d = c.w.daily;
      if (!d.sunrise[c.di] || !d.sunset[c.di]) return naHTML(naOf('ok', 'om'));
      var sr = pt(d.sunrise[c.di]), ss = pt(d.sunset[c.di]), m = c.now.mins, big, foot, phi;
      var rise = tx('Sunrise: ', '日出：') + timeLabel(d.sunrise[c.di]), set = tx('Sunset: ', '日落：') + timeLabel(d.sunset[c.di]);
      if (m < sr.mins) { big = d.sunrise[c.di]; foot = set; }
      else if (m < ss.mins) { big = d.sunset[c.di]; foot = rise; }
      else { big = d.sunrise[c.di + 1] || d.sunrise[c.di]; foot = set; }
      if (m >= sr.mins && m <= ss.mins) phi = 0.25 + 0.5 * (m - sr.mins) / (ss.mins - sr.mins);
      else { var night = 1440 - (ss.mins - sr.mins), since = (m - ss.mins + 1440) % 1440; phi = (0.75 + 0.5 * since / night) % 1; }
      var curve = ''; for (var i = 0; i <= 60; i++) { var f = i / 60; curve += (i ? 'L' : 'M') + (f * 120).toFixed(1) + ',' + (32 - 22 * Math.sin(2 * Math.PI * (f - 0.25))).toFixed(2); }
      var sx = phi * 120, sy = 32 - 22 * Math.sin(2 * Math.PI * (phi - 0.25)), up = sy <= 32;
      return '<div class="big" style="font-size:30px">' + timeLabel(big) + '</div>' +
        '<div class="centerviz"><svg viewBox="0 6 120 52" width="100%" height="58" aria-hidden="true">' +
        '<defs><clipPath id="above"><rect x="0" y="0" width="120" height="32"/></clipPath><radialGradient id="sunDot"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient></defs>' +
        '<path d="' + curve + '" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.6"/><path d="' + curve + '" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.6" clip-path="url(#above)"/>' +
        '<line x1="0" x2="120" y1="32" y2="32" stroke="rgba(255,255,255,.45)" stroke-width="1"/>' +
        (up ? '<circle cx="' + sx + '" cy="' + sy + '" r="9" fill="url(#sunDot)"/>' : '') +
        '<circle cx="' + sx + '" cy="' + sy + '" r="3.6" fill="' + (up ? '#fff' : 'rgba(255,255,255,.45)') + '"/></svg></div><div class="note">' + foot + '</div>';
    }
  },

  feels: {
    title: 'Feels Like', icon: 'thermo', size: 's', desc: 'Apparent temperature and why it differs.',
    render: function (c) {
      var f = c.cur.apparent_temperature, t = c.cur.temperature_2m, diff = f - t;
      var why = Math.abs(diff) < 2 ? 'Similar to the actual temperature.'
        : diff > 0 ? (c.cur.relative_humidity_2m >= 70 ? 'Humidity is making it feel warmer.' : 'It feels warmer than the actual temperature.')
        : (c.cur.wind_speed_10m >= 15 ? 'Wind is making it feel cooler.' : 'It feels cooler than the actual temperature.');
      return '<div class="big">' + num(tU(f)) + '°</div><div class="note">' + why + '</div>';
    }
  },

  humidity: {
    title: 'Humidity', icon: 'drop', size: 's', desc: 'Relative humidity and dew point.',
    render: function (c) {
      var dp = isNum(c.cur.dew_point_2m) ? c.cur.dew_point_2m : c.w.hourly.dew_point_2m[c.hi];
      return '<div class="big">' + num(c.cur.relative_humidity_2m) + '%</div><div class="note">' + tx('The dew point is ' + num(tU(dp)) + '° right now.', '目前露點 ' + num(tU(dp)) + '°。') + '</div>';
    }
  },

  visibility: {
    title: 'Visibility', icon: 'eye', size: 's', desc: 'How far you can see. Haze from PM2.5 lowers it.',
    render: function (c) {
      var v = isNum(c.cur.visibility) ? c.cur.visibility : c.w.hourly.visibility[c.hi], far = (v || 0) / 1000;
      var note = far >= 20 ? 'Perfectly clear view.' : far >= 10 ? 'Clear view.' : far >= 5 ? 'Light haze or rain is reducing visibility.' : 'Low visibility. Haze or rain is limiting the view.';
      return '<div class="big">' + num(far, far < 10 ? 1 : 0) + '<small>km</small></div><div class="note">' + note + '</div>';
    }
  },

  pressure: {
    title: 'Pressure', icon: 'gauge', size: 's', desc: 'Sea-level pressure and whether it is rising or falling.',
    render: function (c) {
      var h = c.w.hourly, p = c.cur.pressure_msl, later = h.pressure_msl[Math.min(h.time.length - 1, c.hi + 3)];
      var trend = later - p > 0.6 ? ['↑', 'Rising'] : later - p < -0.6 ? ['↓', 'Falling'] : ['=', 'Steady'];
      var k = clamp((p - 980) / 60, 0, 1), a0 = -225, a1 = 45, ang = ((a0 + (a1 - a0) * k) * Math.PI) / 180, rad = Math.PI / 180;
      var arc = 'M' + (50 + 40 * Math.cos(a0 * rad)) + ',' + (50 + 40 * Math.sin(a0 * rad)) + 'A40,40 0 1 1 ' + (50 + 40 * Math.cos(a1 * rad)) + ',' + (50 + 40 * Math.sin(a1 * rad));
      return '<div class="centerviz"><svg viewBox="0 0 100 92" width="108" height="100" aria-hidden="true">' +
        '<path d="' + arc + '" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="7" stroke-linecap="round" stroke-dasharray="1.2 3.2"/>' +
        '<line x1="' + (50 + 30 * Math.cos(ang)) + '" y1="' + (50 + 30 * Math.sin(ang)) + '" x2="' + (50 + 45 * Math.cos(ang)) + '" y2="' + (50 + 45 * Math.sin(ang)) + '" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
        '<text x="50" y="44" text-anchor="middle" font-size="12" fill="#fff">' + trend[0] + '</text>' +
        '<text x="50" y="60" text-anchor="middle" font-size="15" font-weight="600" fill="#fff">' + num(p) + '</text>' +
        '<text x="50" y="71" text-anchor="middle" font-size="7" fill="rgba(255,255,255,.7)">hPa</text></svg></div>' +
        '<div class="note dim" style="text-align:center">' + trend[1] + '</div>';
    }
  },

  precip: {
    title: 'Precipitation', icon: 'umbrella', size: 's', desc: 'Rain in the last 24 hours and expected in the next 24.',
    render: function (c) {
      var h = c.w.hourly.precipitation, past = sumOf(h.slice(Math.max(0, c.hi - 23), c.hi + 1)), next = sumOf(h.slice(c.hi + 1, c.hi + 25));
      return '<div class="big">' + num(past, past < 10 ? 1 : 0) + '<small>mm</small></div><div class="sub" style="font-size:14px">in last 24h</div><div class="note">' + tx(num(next, 1) + ' mm expected in next 24h.', '未來 24 小時預計 ' + num(next, 1) + ' mm。') + '</div>';
    }
  },

  clouds: {
    title: 'Cloud Cover', icon: 'cloud', size: 's', desc: 'How much of the sky is covered by cloud.',
    render: function (c) {
      var v = c.cur.cloud_cover, t = v < 15 ? 'Clear skies' : v < 40 ? 'Mostly clear' : v < 70 ? 'Partly cloudy' : v < 90 ? 'Mostly cloudy' : 'Overcast';
      return '<div class="big">' + num(v) + '%</div><div class="sub">' + t + '</div><div class="meter" style="background:linear-gradient(90deg,#7cc6ff,#c9d4e3)"><b style="left:' + clamp(v, 0, 100) + '%"></b></div>';
    }
  },

  moon: {
    title: 'Moon', icon: 'moon', size: 's', needs: 'none', desc: 'Moon phase, illumination and next full moon.',
    render: function () {
      var syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14), p = ((((Date.now() - ref) / 86400000) % syn) + syn) % syn / syn, lit = (1 - Math.cos(2 * Math.PI * p)) / 2;
      var name = p < 0.03 || p > 0.97 ? 'New Moon' : p < 0.22 ? 'Waxing Crescent' : p < 0.28 ? 'First Quarter' : p < 0.47 ? 'Waxing Gibbous' : p < 0.53 ? 'Full Moon' : p < 0.72 ? 'Waning Gibbous' : p < 0.78 ? 'Last Quarter' : 'Waning Crescent';
      var r = 26, cc = Math.cos(2 * Math.PI * p), rx = r * Math.abs(cc), wax = p < 0.5, wx = liveWx(), opts = { month: 'short', day: 'numeric' };
      var path = 'M32 ' + (32 - r) + 'A' + r + ' ' + r + ' 0 0 ' + (wax ? 1 : 0) + ' 32 ' + (32 + r) + 'A' + rx + ' ' + r + ' 0 0 ' + (cc > 0 ? (wax ? 0 : 1) : (wax ? 1 : 0)) + ' 32 ' + (32 - r) + 'Z';
      if (wx && wx.timezone) opts.timeZone = wx.timezone;
      var full; try { full = new Date(Date.now() + (((0.5 - p + 1) % 1) * syn) * 86400000).toLocaleDateString(S.lang === 'zh' ? 'zh-TW' : 'en-US', opts); } catch (e) { full = ''; }
      return '<div class="centerviz"><svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="rgba(255,255,255,.1)"/><path d="' + path + '" fill="url(#gMoon)"/></svg></div>' +
        '<div class="sub" style="font-size:14px">' + name + '</div><div class="note dim">' + tx(Math.round(lit * 100) + '% lit · Full moon ' + full, '亮面 ' + Math.round(lit * 100) + '% · 滿月 ' + full) + '</div>';
    }
  },

  // ----- ours: storms, typhoon, sea, season, landslide -----
  thunder: {
    title: 'Thunderstorm Risk', icon: 'bolt', size: 's', needs: 'none', desc: 'Storm risk for the next 24 hours from storm energy (CAPE), weather codes and rain chance.',
    na: function () { return factNA('thunder'); },
    render: function () { var f = fact('thunder'); return factTile('thunder', '<div class="meter risk"><b style="left:' + f.meter + '"></b></div>'); }
  },
  storms: {
    title: 'Storm Outlook', label: 'Storm Outlook · 72h', icon: 'bolt', size: 's', needs: 'none', desc: 'Days with thunderstorms in the 3-day forecast.',
    na: function () { return factNA('storms'); },
    render: function () { return factTile('storms'); }
  },
  typhoon: {
    title: 'Typhoon Watch', icon: 'cyclone', size: 'w', source: 'CWA', needs: 'none', desc: 'The active typhoon near Taiwan: its track, distance and strength, from CWA warnings.',
    available: function () { return S.sources.typhoon !== false; },
    open: function () { if (tyStorm()) location.hash = 'predictions/typhoon'; },
    na: function () { return factNA('typhoon'); },
    render: function () { return tyTileHTML(tyView()); }
  },
  waves: {
    title: 'Coast & Waves', icon: 'waves', size: 's', source: 'Marine', needs: 'none', desc: 'Wave height, swell and direction at the nearest sea point.',
    na: function () { return factNA('waves'); },
    render: function () { return factTile('waves'); }
  },
  climate: {
    title: 'Seasonal Outlook', icon: 'season', size: 'w', source: 'ECMWF SEAS5', needs: 'none', desc: 'Next month’s temperature and rain compared with normal, from the ECMWF seasonal forecast.',
    na: function () { return factNA('climate'); },
    render: function () { return factTile('climate'); }
  },
  landslide: {
    title: 'Landslide Risk', icon: 'slope', size: 's', source: 'Skyline', needs: 'none', desc: 'Slope-failure risk from the team landslide model. Shows “Not connected yet” until the model is.',
    available: function () { return S.sources.landslide !== false; },
    na: function () { return naOf('gone', 'landslide'); },
    render: function () { return ''; }
  },

  map: {
    title: 'Live Map', icon: 'map', size: 'l', needs: 'none', desc: 'Interactive Windy.com map: rain radar, wind, PM2.5 or temperature.',
    available: function () { return S.sources.windyMap !== false; },
    head: function () { return '<div class="chips">' + MAP_LAYERS.map(function (o) { return '<button type="button" data-layer="' + o[0] + '" class="' + (MAP_LAYER === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>'; },
    render: function () {
      var lay = MAP_LAYERS.filter(function (o) { return o[0] === MAP_LAYER; })[0] || MAP_LAYERS[0];
      return '<div class="map-wrap">' + windyFrame('Windy map of ' + S.loc.name, windyURL(lay[2], inTW(S.loc.lat, S.loc.lon) ? 8 : 6, 0, true)) + '</div>';
    }
  }
};
var SIZE_NAME = { s: 'Small', w: 'Wide', l: 'Large', t: 'Tall', h: 'Extra wide' };
var TILE_GROUPS = [
  ['By Skyline · our AI models', ['tomorrow', 'advice', 'model', 'pmtrend', 'landslide']],
  ['Air quality', ['aqi', 'pm25', 'pm10', 'pollutants', 'station']],
  ['Weather', ['hourly', 'daily', 'wind', 'uv', 'sunrise', 'feels', 'humidity', 'visibility', 'pressure', 'precip', 'clouds', 'moon']],
  ['Storms & sea', ['thunder', 'storms', 'typhoon', 'waves', 'climate']],
  ['Maps', ['map']]
];
var DEFAULT_LAYOUT = ['hourly', 'tomorrow', 'daily', 'aqi', 'advice', 'pmtrend', 'wind', 'uv', 'sunrise', 'feels', 'map', 'thunder', 'storms', 'typhoon',
  'pm25', 'pm10', 'precip', 'humidity', 'visibility', 'pressure', 'waves', 'climate', 'landslide', 'model'];

// ----- layout (saved in S.layout) -----
function tileOn(id) { var t = TILES[id]; return !!t && (!t.available || t.available()); }
// The saved layout, minus anything unknown (an older build's ids) or not available right now
function layoutIds() {
  var seen = {}, src = Array.isArray(S.layout) ? S.layout : DEFAULT_LAYOUT;
  return src.filter(function (id) { if (seen[id] || !tileOn(id)) return false; seen[id] = 1; return true; });
}
function saveLayout(ids) { S.layout = ids; save(); }

// ----- one tile -----
var FACTS = null;
function fact(id) {
  if (!FACTS) { FACTS = {}; catalog(S.loc).forEach(function (t) { FACTS[t.id] = t; }); }
  return FACTS[id];
}
function naHTML(na) {
  if (na.st === 'loading') return '<div class="tile-load" role="status" aria-label="Loading…"><i></i><i></i><i></i></div>';
  return '<div class="tile-na"><div class="na-h">' + na.h + '</div><p>' + na.msg + '</p>' +
    (na.retry ? '<button type="button" class="tile-retry" data-action="retry-live">Retry</button>' : '') + '</div>';
}
// Why a tile cannot render, or null when it can
function tileNA(t) {
  if (t.na) return t.na();
  if (t.needs === 'none') return null;
  if (!liveWx()) { var ws = wxState(); return naOf(ws === 'gone' ? 'error' : ws, 'om'); }
  if (t.needs === 'air' && !liveAir()) { var as = omState('air'); return naOf(as === 'gone' ? 'error' : as, 'om'); }
  return null;
}
// " · 12 min ago" for a tile whose feed could not be refreshed
function tileAge(t, id) {
  var k = ptKey(S.loc), f = null;
  if (FACT_FEED[id]) { var m = / · (\d+ (?:min|h|days) ago)$/.exec((fact(id) || {}).src || ''); return m ? m[1] : ''; }
  if (t.needs === 'none') return '';
  if (t.needs === 'air' && feedState('air@' + k) === 'stale') f = FEEDS['air@' + k];
  else if (feedState('wx@' + k) === 'stale') f = FEEDS['wx@' + k];
  return f ? fmtAge(f.t) : '';
}
var FACT_FEED = { thunder: 1, storms: 1, typhoon: 1, waves: 1, climate: 1 };
// Everything a tile shows, as strings (compared between updates so an unchanged tile is left alone)
function tileView(id) {
  var t = TILES[id], na = null, body, gold = false;
  try {
    na = tileNA(t);
    body = na ? naHTML(na) : t.render(wctx());
    gold = !na && (typeof t.gold === 'function' ? t.gold() : !!t.gold);
  } catch (e) { if (window.console) console.error(id, e); na = naOf('ok', 'om'); body = naHTML(na); }
  var label = typeof t.label === 'function' ? t.label() : (t.label || t.title), age = na ? '' : tileAge(t, id);
  var right = !na && t.head ? t.head() : '';
  if (!right && (t.source || age)) right = '<em class="src' + (age ? ' stale' : '') + '">' + [t.source, age].filter(Boolean).join(' · ') + '</em>';
  return { cls: 'tile size-' + t.size + (gold ? ' gold' : '') + (t.open && !na ? ' clickable' : '') + (na && na.st !== 'loading' ? ' is-na' : ''),
    head: Icons.ui(t.icon) + '<span>' + label + '</span>' + right, body: body, na: !!na };
}
function paintTile(el, v) {
  var keep = ['pop', 'dragging', 'removing'].filter(function (c) { return el.classList.contains(c); });
  el.className = v.cls + (keep.length ? ' ' + keep.join(' ') : '');
  $('.tile-head', el).innerHTML = v.head;
  $('.tile-body', el).innerHTML = v.body;
  el._sig = v.cls + '\n' + v.head + '\n' + v.body; el._na = v.na;
}
function tileEl(id, i, anim) {
  var t = TILES[id], el = document.createElement('article');
  el.dataset.id = id;
  el.style.setProperty('--i', i);
  if (!anim) el.style.animation = 'none';
  el.draggable = editing;
  el.setAttribute('aria-label', t.title);
  el.innerHTML = '<button type="button" class="remove-badge" data-remove="' + id + '" aria-label="Remove ' + t.title + '">−</button><header class="tile-head"></header><div class="tile-body"></div>';
  paintTile(el, tileView(id));
  return el;
}
function reduced() { return !!S.reduceMotion || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
// Numbers count up from zero when a tile first shows a value
function countUp(root) {
  if (reduced()) return;
  root.querySelectorAll('[data-count]').forEach(function (el) {
    var to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), node = el.firstChild;
    if (isNaN(to) || !node || node.nodeType !== 3) return;
    var t0 = performance.now(), step = function (t) {
      var k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3);
      node.nodeValue = (to * e).toFixed(dec);   // the text node, so the 中文 layer is not woken every frame
      if (k < 1 && node.parentNode) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
function renderGrid(anim) {
  var grid = $('#grid'); if (!grid) return;
  grid.innerHTML = '';
  layoutIds().forEach(function (id, i) { grid.appendChild(tileEl(id, i, anim)); });
  if (anim) countUp(grid);
}
// Brings the grid up to date without rebuilding it: only tiles whose content changed are touched,
// so maps keep their iframe, the hourly strip keeps its scroll position and nothing re-animates.
function syncGrid() {
  var grid = $('#grid'); if (!grid) return;
  var ids = layoutIds(), have = Array.prototype.filter.call(grid.children, function (e) { return !e.classList.contains('removing'); }).map(function (e) { return e.dataset.id; });
  if (ids.join() !== have.join()) { renderGrid(false); return; }
  Array.prototype.forEach.call(grid.children, function (el) {
    if (el.classList.contains('removing')) return;
    var v = tileView(el.dataset.id), wasNA = el._na;
    if (el._sig === v.cls + '\n' + v.head + '\n' + v.body) return;
    paintTile(el, v);
    if (wasNA && !v.na) countUp(el);
  });
}
function rerenderTile(id) {
  var el = document.querySelector('#grid [data-id="' + id + '"]');
  if (el) paintTile(el, tileView(id));
}
// Animate tiles from where they were to where a layout change put them
function flip(mutate) {
  var grid = $('#grid'), first = new Map();
  Array.prototype.forEach.call(grid.children, function (e) { first.set(e, e.getBoundingClientRect()); });
  mutate();
  if (reduced()) return;
  Array.prototype.forEach.call(grid.children, function (e) {
    var f = first.get(e); if (!f || !e.animate) return;
    var l = e.getBoundingClientRect(), dx = f.left - l.left, dy = f.top - l.top;
    if (dx || dy) e.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}
function addTile(id) {
  if (!tileOn(id)) return;
  saveLayout(layoutIds().concat(id));
  var grid = $('#grid'); if (!grid) return;
  var el = tileEl(id, 0, false);
  el.classList.add('pop');
  grid.appendChild(el);
  countUp(el);
  setTimeout(function () { el.classList.remove('pop'); }, 900);
}
function removeTile(id) {
  var el = document.querySelector('#grid [data-id="' + id + '"]');
  saveLayout(layoutIds().filter(function (x) { return x !== id; }));
  if (!el) return;
  el.classList.add('removing');
  setTimeout(function () { if (el.parentNode) flip(function () { el.remove(); }); }, 260);
}
function resetLayout() { S.layout = null; save(); renderGrid(true); toast('Layout reset to default'); }

// ----- hero -----
function heroHTML(first) {
  var L = S.loc, nowWx = wxNow(), hl = todayHL(), tw = inTW(L.lat, L.lon), pv = previewOn();
  var retry = '<button type="button" class="chip act" data-action="retry-live">Retry</button>', chips, cond;
  if (nowWx.live) {
    cond = esc(nowWx.label);
    chips = nowWx.stale ? '<span class="chip warn">Open-Meteo · updated ' + fmtAge(nowWx.t) + ' · couldn’t refresh</span>' + retry
      : '<span class="chip"><span class="dot" aria-hidden="true"></span>Open-Meteo · live' + (nowWx.time ? ' · updated ' + nowWx.time : '') + '</span>';
  } else if (nowWx.state === 'loading') {
    cond = 'Loading live weather…'; chips = '<span class="chip">Open-Meteo · loading…</span>';
  } else if (nowWx.state === 'off') {
    cond = 'Live weather is turned off'; chips = '<span class="chip warn">Open-Meteo is switched off</span><a class="chip act" href="#settings">Open Settings</a>';
  } else {
    cond = 'Live weather is unavailable'; chips = '<span class="chip warn">' + (offline() ? 'You’re offline' : 'Couldn’t reach Open-Meteo') + '</span>' + retry;
  }
  chips += '<button type="button" class="chip act unit" data-action="toggle-units" aria-label="Temperature unit">' + (S.units === 'F' ? '°C · <b>°F</b>' : '<b>°C</b> · °F') + '</button>';
  if (pv) chips += '<span class="chip warn">Preview sky: ' + moodLabel(S.weather) + '</span><button type="button" class="chip act" data-action="sky-live">Back to live</button>';
  if (!tw) chips += '<span class="chip warn">Outside Taiwan: Skyline models and Predictions cover Taiwan only</span>';
  // Tomorrow's air: gold and "Tomorrow" for a Skyline city model, plain and "CAMS forecast" otherwise
  var ta = tomorrowAir(), pill = '';
  if (ta.kind !== 'na') {
    var p = ta.p, catName = tx(shortCat(p.category), zh(shortCat(p.category)));
    pill = '<button type="button" class="headline' + (ta.kind === 'model' ? '' : ' plain') + (first ? ' first' : '') + '" data-action="open-tomorrow">' +
      '<span class="dot" style="background:' + esc(p.color) + ';color:' + esc(p.color) + '"></span><span class="tag">' + (ta.kind === 'model' ? 'Tomorrow' : 'CAMS forecast · Tomorrow') + '</span>' +
      tx(catName + ' air · PM2.5 ≈ ' + p.pm25 + ' µg/m³', '空氣' + catName + ' · PM2.5 ≈ ' + p.pm25 + ' µg/m³') + (ta.kind === 'model' ? ' · ' + esc(cityName(ta.city)) : '') + '</button>';
  }
  return '<button type="button" class="place" data-action="open-search" aria-label="Location: ' + esc(L.name) + '. Change location">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>' +
      '<span>' + esc(L.name) + '</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' +
    (L.sub ? '<div class="place-sub">' + esc(L.sub) + '</div>' : '') +
    (nowWx.live ? '<div class="temp" aria-label="Temperature ' + fmtT(nowWx.temp) + '">' + (first ? '<span data-count="' + Math.round(tU(nowWx.temp)) + '">' + Math.round(tU(nowWx.temp)) + '</span>' : Math.round(tU(nowWx.temp))) + '<span class="deg">°</span></div>'
                : '<div class="temp na" aria-label="Temperature not available">—</div>') +
    '<div class="cond">' + cond + '</div>' +
    '<div class="hl"' + (hl ? ' aria-label="Today: high ' + fmtT(hl.hi) + ', low ' + fmtT(hl.lo) + '"><span>H:' + fmtT(hl.hi) + '</span><span>L:' + fmtT(hl.lo) + '</span>' : '>&nbsp;') + '</div>' +
    pill + '<div class="chips">' + chips + '</div>' +
    (S.skyline === 'city' ? skylineSVG(skylineFor(L)) : '');
}
function footHTML() {
  var pm = pmData(), m = modelMetrics();
  return 'Weather: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> forecast · Air quality: Copernicus CAMS via Open-Meteo · Waves: Open-Meteo Marine · Season: ECMWF SEAS5 · Map: <a href="https://www.windy.com" target="_blank" rel="noopener">Windy.com</a><br>' +
    (pm ? tx('Tomorrow’s air: Skyline model for ' + cityName(pm.city || { name: 'Taichung City' }) + (m ? ' (trained ' + m.trained_on + ', tested ' + m.tested_on + ')' : '') + '. Prototype, not official health advice.',
            '明日空氣：Skyline 模型（' + cityName(pm.city || { name: 'Taichung City', name_zh: '臺中市' }) + (m ? '，訓練 ' + m.trained_on + '，測試 ' + m.tested_on : '') + '）。原型，並非官方健康建議。')
        : 'Tomorrow’s air: CAMS forecast where no Skyline city model covers the location. Not official health advice.') + '<br>' +
    'A widget whose source isn’t connected or can’t be reached says so and shows no number.';
}
function homeView() {
  return '<div class="home"><section class="hero" id="hero" aria-label="Current weather"></section>' +
    '<section class="grid" id="grid" aria-label="Widgets"></section><footer class="foot" id="foot"></footer></div>';
}
// Fills Home from the feeds. Called after the first paint and whenever a feed arrives or the location changes.
function homeUpdate(first) {
  var hero = $('#hero'); if (!hero) return;
  FACTS = null;
  applySky();
  var h = heroHTML(false);
  if (hero._h !== h) {
    var anim = first || (hero._na && wxNow().live);
    hero.innerHTML = anim ? heroHTML(true) : h; hero._h = h; hero._na = !wxNow().live;
    if (anim) countUp(hero);
  }
  if (first) renderGrid(true); else syncGrid();
  var foot = footHTML(), fe = $('#foot');
  if (fe._h !== foot) { fe.innerHTML = foot; fe._h = foot; }
  syncCompact();
}
// The compact title in the top bar (shown once the hero has scrolled away)
function syncCompact() {
  var w = wxNow();
  $('#compactPlace').textContent = S.loc.name;
  $('#compactTemp').textContent = w.live ? fmtT(w.temp) : '—';
  $('#compactCond').textContent = w.live ? w.label : '';
}
function onScroll() {
  var y = window.scrollY || 0, home = document.body.dataset.page === 'home', hero = $('#hero');
  if (home && hero) {
    hero.style.opacity = String(clamp(1 - y / 300, 0, 1));
    hero.style.transform = reduced() ? '' : 'translateY(' + (y * 0.3).toFixed(1) + 'px) scale(' + (1 - clamp(y / 2400, 0, 0.1)).toFixed(4) + ')';
  }
  $('#topbar').classList.toggle('scrolled', y > (home ? 170 : 8));
  $('#topbar').classList.toggle('show-compact', home && y > 170);
}
window.addEventListener('scroll', onScroll, { passive: true });

// ----- edit mode -----
function setEditing(on) {
  editing = !!on;
  document.body.classList.toggle('editing', editing);
  var b = $('#editBtn'); if (b) b.setAttribute('aria-pressed', String(editing));
  document.querySelectorAll('#grid .tile').forEach(function (t) { t.draggable = editing; });
}
document.addEventListener('click', function (e) {
  var grid = e.target.closest && e.target.closest('#grid');
  if (!grid) return;
  var rm = e.target.closest('[data-remove]');
  if (rm) { removeTile(rm.dataset.remove); return; }
  if (editing) return;
  var hm = e.target.closest('[data-hmode]');
  if (hm) { HOURLY_MODE = hm.dataset.hmode; rerenderTile('hourly'); return; }
  var ml = e.target.closest('[data-layer]');
  if (ml) { MAP_LAYER = ml.dataset.layer; rerenderTile('map'); return; }
  if (e.target.closest('button,a,iframe')) return;
  var t = e.target.closest('.tile.clickable');
  if (t && TILES[t.dataset.id].open) TILES[t.dataset.id].open();
});
var dragEl = null, lastMove = 0;
document.addEventListener('dragstart', function (e) {
  var t = e.target.closest && e.target.closest('#grid .tile');
  if (!t) return;
  dragEl = editing ? t : null;
  if (!dragEl) { e.preventDefault(); return; }
  dragEl.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', dragEl.dataset.id); } catch (err) { /* Safari quirk */ }
});
document.addEventListener('dragover', function (e) {
  if (!dragEl) return;
  e.preventDefault();
  var over = e.target.closest && e.target.closest('#grid .tile');
  if (!over || over === dragEl || performance.now() - lastMove < 150) return;
  var r = over.getBoundingClientRect(), before = e.clientX - r.left < r.width / 2;
  if ((before && over.previousElementSibling === dragEl) || (!before && over.nextElementSibling === dragEl)) return;
  lastMove = performance.now();
  flip(function () { over.parentNode.insertBefore(dragEl, before ? over : over.nextElementSibling); });
});
document.addEventListener('dragend', function () {
  if (!dragEl) return;
  dragEl.classList.remove('dragging');
  dragEl = null;
  var grid = $('#grid');
  if (grid) saveLayout(Array.prototype.map.call(grid.children, function (el) { return el.dataset.id; }).filter(tileOn));
});
// Long-press a tile to enter edit mode; the pointer also moves the tile's soft spotlight
var pressTimer = 0, pressAt = null;
document.addEventListener('pointerdown', function (e) {
  if (editing || !e.target.closest || !e.target.closest('#grid .tile') || e.target.closest('iframe,button,a')) return;
  pressAt = [e.clientX, e.clientY];
  clearTimeout(pressTimer);
  pressTimer = setTimeout(function () { setEditing(true); }, 600);
});
document.addEventListener('pointermove', function (e) {
  var t = e.target.closest && e.target.closest('#grid .tile');
  if (t) { var r = t.getBoundingClientRect(); t.style.setProperty('--mx', (e.clientX - r.left) + 'px'); t.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
  if (pressAt && Math.hypot(e.clientX - pressAt[0], e.clientY - pressAt[1]) > 8) { clearTimeout(pressTimer); pressAt = null; }
});
['pointerup', 'pointercancel'].forEach(function (ev) { document.addEventListener(ev, function () { clearTimeout(pressTimer); pressAt = null; }); });

// ----- sheets (widget gallery, model details) -----
var CLOSE_BTN = '<button type="button" class="round-btn close" data-action="close-sheet" aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
var sheetFocus = null, sheetTimer = 0;
function openSheet(html, label) {
  var bd = $('#sheetBackdrop'), sh = $('#sheet');
  clearTimeout(sheetTimer);
  if (bd.hidden) sheetFocus = document.activeElement;
  sh.innerHTML = html; sh.scrollTop = 0; sh.setAttribute('aria-label', label || 'Details');
  bd.hidden = false;
  requestAnimationFrame(function () { bd.classList.add('open'); sh.focus({ preventScroll: true }); });
}
function closeSheet() {
  var bd = $('#sheetBackdrop');
  if (bd.hidden) return false;
  bd.classList.remove('open');
  sheetTimer = setTimeout(function () { bd.hidden = true; }, reduced() ? 0 : 320);
  if (sheetFocus && sheetFocus.focus && document.contains(sheetFocus)) sheetFocus.focus({ preventScroll: true });
  return true;
}
$('#sheetBackdrop').addEventListener('click', function (e) { if (e.target.id === 'sheetBackdrop') closeSheet(); });
function openGallery() {
  var on = layoutIds();
  var card = function (id) {
    var t = TILES[id], has = on.indexOf(id) >= 0;
    return '<div class="gcard' + (t.gold || id === 'landslide' ? ' gold' : '') + '"><div class="gi">' + Icons.ui(t.icon, 20) + '</div><div class="gb">' +
      '<div class="gt">' + t.title + '</div><div class="gd">' + t.desc + '</div>' +
      '<div class="gm"><span class="size">' + SIZE_NAME[t.size] + '</span><button type="button" class="add-btn' + (has ? ' added' : '') + '" data-action="toggle-widget" data-id="' + id + '" aria-pressed="' + has + '">' + (has ? 'Added ✓' : '+ Add') + '</button></div></div></div>';
  };
  openSheet('<div class="sheet-head"><h2>Add widgets</h2>' + CLOSE_BTN + '</div>' +
    '<p>Pick what shows on your dashboard. Tap a widget’s button again to remove it, or use Edit (···) to drag widgets around.</p>' +
    TILE_GROUPS.map(function (g) {
      var list = g[1].filter(tileOn);
      return list.length ? '<h3>' + g[0] + '</h3><div class="gallery">' + list.map(card).join('') + '</div>' : '';
    }).join('') +
    '<h3>Layout</h3><button type="button" class="text-btn" data-action="reset-widgets" style="padding-left:0">Reset to the default layout</button>', 'Add widgets');
}
// What the CAMS fallback is, for the tiles that show it
function openCamsNote() {
  var t = tomorrowAir();
  if (t.kind !== 'cams') return;
  openSheet('<div class="sheet-head"><h2>' + tx('Tomorrow’s air here is a CAMS forecast', '這裡的明日空氣是 CAMS 預報') + '</h2>' + CLOSE_BTN + '</div>' +
    '<p>' + noModelWhy() + '</p>' +
    '<p>' + tx('So for ' + esc(S.loc.name) + ' the widgets show tomorrow’s average PM2.5 (' + t.p.pm25 + ' µg/m³) and PM10 (' + t.p.pm10 + ' µg/m³) from the Copernicus CAMS global forecast, via Open-Meteo. That is a model estimate for a grid cell tens of kilometres wide, not a station reading and not a Skyline prediction, so it has no accuracy report here.',
      '因此' + esc(zh(S.loc.name)) + '的小工具顯示的是 Copernicus CAMS 全球預報（經 Open-Meteo）的明日平均 PM2.5（' + t.p.pm25 + ' µg/m³）與 PM10（' + t.p.pm10 + ' µg/m³）。這是數十公里網格的模式估計值，不是測站觀測，也不是 Skyline 的預測，所以這裡沒有準確度報告。') + '</p>' +
    '<p>' + tx('The AQI and the school plan are worked out from those two numbers with the same US AQI breakpoints the Skyline model uses.', 'AQI 與學校戶外建議是用這兩個數字、以 Skyline 模型相同的美國 AQI 分級算出來的。') + '</p>', 'CAMS forecast');
}
function lineChart(series, keys, colors, ymaxHint) {
  var n = series[keys[0]].length, all = [ymaxHint];
  keys.forEach(function (k) { all = all.concat(series[k]); });
  var ymax = Math.max.apply(null, all) * 1.08;
  var path = function (arr) { return arr.map(function (v, i) { return (i ? 'L' : 'M') + ((i / (n - 1)) * 800).toFixed(1) + ',' + (220 - (v / ymax) * 220).toFixed(1); }).join(''); };
  var y35 = 220 - (35 / ymax) * 220;
  return '<svg viewBox="0 0 800 220" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">' +
    '<line x1="0" x2="800" y1="' + y35 + '" y2="' + y35 + '" stroke="rgba(255,120,90,.7)" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>' +
    keys.map(function (k, i) { return '<path d="' + path(series[k]) + '" fill="none" stroke="' + colors[i] + '" stroke-width="' + (i === 0 ? 1.6 : 1.3) + '" vector-effect="non-scaling-stroke" opacity="' + (i === 2 ? 0.55 : 1) + '"/>'; }).join('') + '</svg>';
}
// How the Skyline model did on its test year, for the city model that answered for S.loc
function openModel() {
  var m = modelMetrics(), p = pmData();
  if (!m) { if (p) toast('The model report for this city isn’t available right now.'); return; }
  var city = cityName((p && p.city) || m.city || { name: 'Taichung City', name_zh: '臺中市' });
  var ch = m.chosen.pm25, ch10 = m.chosen.pm10, R = m.results, W = R.warnings, WT = W.tuned, isZh = S.lang === 'zh';
  // Two metrics shapes: the first model (ridge / boosted) and v2 (v1 / ridge / boosted / blend with upwind inputs, plus a tuned warning)
  var v2 = !!(R.pm25.v1 || R.pm25.blend || WT);
  var NAMES = v2 ? {
    baseline: tx('Tomorrow = today (baseline)', '明天 = 今天（基準）'),
    v1: tx('First model: Ridge, 25 inputs', '第一版模型：Ridge，25 項輸入'),
    ridge: tx('Ridge + upwind inputs', 'Ridge + 上風處輸入'),
    boosted: tx('Boosted trees + upwind inputs', '提升樹 + 上風處輸入'),
    blend: tx('Ridge + trees blend + upwind inputs', 'Ridge 與提升樹混合 + 上風處輸入'),
    blend_no_weather: tx('Blend without weather forecast', '不含天氣預報的混合模型')
  } : {
    baseline: tx('Tomorrow = today (baseline)', '明天 = 今天（基準）'),
    ridge: tx('Linear regression (Ridge)', '線性迴歸（Ridge）'),
    boosted: tx('Gradient-boosted trees', '梯度提升樹'),
    boosted_no_weather: tx('Boosted trees without weather forecast', '不含天氣預報的提升樹')
  };
  var nameOf = function (k) { return NAMES[k] || esc(k); };
  var F = m.features && !Array.isArray(m.features) ? m.features : {};
  var usesUp = function (t) { return (F[t] || []).indexOf('up_north') >= 0; };
  var better = Math.round((1 - R.pm25[ch].mae / R.pm25.baseline.mae) * 100);
  var WK = WT || W[ch] || W.baseline;   // the warning rule Skyline actually uses
  var rows = Object.keys(NAMES).filter(function (k) { return R.pm25[k] && W[k]; }).map(function (k) {
    return '<tr class="' + (k === ch ? 'best' : '') + '"><td>' + NAMES[k] + '</td><td>' + num(R.pm25[k].mae, 2) + (k === ch ? ' ✓' : '') + '</td><td>' + (R.pm10 && R.pm10[k] ? num(R.pm10[k].mae, 2) + (k === ch10 ? ' ✓' : '') : '–') + '</td><td>' + W[k].caught + '/' + W[k].bad_days + '</td><td>' + (W[k].warned - W[k].caught) + '</td></tr>';
  }).join('') + (WT ? '<tr class="best"><td>' + tx('Skyline warning (forecast above ' + num(WT.threshold, 1) + ')', 'Skyline 警示（預測高於 ' + num(WT.threshold, 1) + '）') + '</td><td></td><td></td><td>' + WT.caught + '/' + WT.bad_days + ' ✓</td><td>' + (WT.warned - WT.caught) + '</td></tr>' : '');
  var nw = R.pm25.blend_no_weather || R.pm25.boosted_no_weather, wb = R.pm25.blend_no_weather ? R.pm25.blend : R.pm25.boosted;
  var noWx = nw && wb && nw.mae > wb.mae * 1.03 ? tx(' Removing tomorrow’s weather forecast raises the error from ' + num(wb.mae, 2) + ' to ' + num(nw.mae, 2) + ' µg/m³, so rain and wind are a big part of what the model learns.', '把明天的天氣預報拿掉，誤差會從 ' + num(wb.mae, 2) + ' 升到 ' + num(nw.mae, 2) + ' µg/m³，可見雨和風是模型學到的重要因素。') : '';
  var nFail = (m.failures || []).length, under = (m.failures || []).filter(function (f) { return f.actual > f.model; }).length, over = nFail - under;
  var failParts = [], failPartsZh = [];
  if (under) { failParts.push(under + (under === 1 ? ' is a sudden spike' : ' are sudden spikes') + ' the model under-predicted'); failPartsZh.push(under + ' 天是模型低估的突發污染高峰'); }
  if (over) { failParts.push(over + (over === 1 ? ' is a day' : ' are days') + ' that cleared up faster than it expected'); failPartsZh.push(over + ' 天是空氣比預期更快變好'); }
  var failWhy = tx(
    'The ' + nFail + ' biggest misses on the test year. ' + (failParts.length ? 'Of these, ' + failParts.join(' and ') + '. ' : '') + (usesUp('pm25')
      ? 'The model only sees daily averages here and at four upwind points, so a sudden stagnant day or a short burst of polluted air can still surprise it.'
      : 'It only knows this city’s own weather and today’s levels, so polluted air blown in from elsewhere, or a sudden stagnant day, can push PM2.5 far above what today suggests.'),
    '測試年中誤差最大的 ' + nFail + ' 天。' + (failPartsZh.length ? '其中 ' + failPartsZh.join('，') + '。' : '') + (usesUp('pm25')
      ? '模型只看得到這裡和四個上風處的日平均值，所以突然的滯留天氣或短暫的污染團仍可能讓它措手不及。'
      : '模型只知道這個城市自己的天氣和今天的濃度，所以外地吹來的污染或突然的滯留天氣，都可能讓 PM2.5 遠高於今天的水準。'));
  var upBoth = usesUp('pm25') && usesUp('pm10');
  var upText = !usesUp('pm25') && !usesUp('pm10') ? '' : tx(
    ' The ' + (upBoth ? 'PM2.5 and PM10 models also get' : (usesUp('pm25') ? 'PM2.5' : 'PM10') + ' model also gets') + ' 3- and 7-day PM2.5 averages, the day-to-day change, today’s PM2.5 at four points that pollution often blows in from (Taoyuan/Hsinchu, the Fujian coast, the Changhua/Yunlin coast and Kaohsiung), and how hard tomorrow’s north wind will push the northern air south.',
    (upBoth ? 'PM2.5 與 PM10 模型' : (usesUp('pm25') ? 'PM2.5' : 'PM10') + ' 模型') + '另外還會用到 PM2.5 的 3 日與 7 日平均、與前一天的變化、四個污染常吹來的上風處（桃園／新竹、福建沿海、彰化／雲林沿海、高雄）今天的 PM2.5，以及明天的北風會把北部空氣往南推多少。');
  var months = (m.monthly && m.monthly.pm25) || [], mmax = Math.max.apply(null, [1].concat(months.map(function (x) { return Math.max(x.model, x.baseline); })));
  var monthBars = months.map(function (x) {
    return '<div class="mrow"><span class="mm">' + esc(x.month) + '</span><span class="mb"><span class="cmp"><span class="track"><i style="width:' + x.model / mmax * 100 + '%;background:var(--gold)"></i></span></span><span class="cmp"><span class="track"><i style="width:' + x.baseline / mmax * 100 + '%;background:rgba(255,255,255,.45)"></i></span></span></span>' +
      '<span class="mv">' + num(x.model, 1) + ' vs ' + num(x.baseline, 1) + '</span></div>';
  }).join('');
  var dates = m.test_dates || [], ticks = dates.filter(function (d) { return /-01$/.test(d); }).map(function (d) {
    return '<span style="left:' + dates.indexOf(d) / Math.max(1, dates.length - 1) * 100 + '%">' + (isZh ? +d.slice(5, 7) + '月' : MONTHS[+d.slice(5, 7) - 1]) + '</span>';
  }).join('');
  var fails = (m.failures || []).map(function (f) {
    return '<div class="fail"><b>' + esc(f.date) + '</b><span>' + tx('Actual ', '實際 ') + '<b>' + f.actual + '</b> · ' + tx('we said ', '我們預測 ') + '<b style="color:var(--gold)">' + f.model + '</b> · ' + tx('baseline ', '基準 ') + f.baseline + ' µg/m³ <span class="dim">(' +
      tx('forecast rain ' + f.tomorrow_rain_mm + ' mm, wind ' + f.tomorrow_wind_kmh + ' km/h', '預報雨量 ' + f.tomorrow_rain_mm + ' mm、風速 ' + f.tomorrow_wind_kmh + ' km/h') + ')</span></span></div>';
  }).join('');
  var intro = !p ? '' : '<p>' + tx(
    'For <b>' + niceDate(p.date) + '</b> the ' + esc(city) + ' model expects an average PM2.5 of <b>' + p.pm25 + ' µg/m³</b>' + (p.pm25_range ? ' (likely ' + p.pm25_range[0] + '–' + p.pm25_range[1] + ')' : '') + ' and PM10 of <b>' + p.pm10 + ' µg/m³</b>. That is AQI <b>' + p.aqi + ', ' + esc(p.category) + '</b>.' +
      (p.today ? ' Today is averaging ' + p.today.pm25 + ' µg/m³' + (p.tomorrow_weather ? ', and tomorrow’s forecast has ' + p.tomorrow_weather.rain_mm + ' mm of rain and ' + p.tomorrow_weather.wind_kmh + ' km/h of wind.' : '.') : '') +
      (p.city && isNum(p.city.distance_km) ? ' The model is for ' + esc(city) + ', ' + Math.round(p.city.distance_km) + ' km from ' + esc(S.loc.name) + '.' : ''),
    '<b>' + niceDate(p.date) + '</b>，' + esc(city) + '模型預測 PM2.5 平均 <b>' + p.pm25 + ' µg/m³</b>' + (p.pm25_range ? '（可能範圍 ' + p.pm25_range[0] + '–' + p.pm25_range[1] + '）' : '') + '、PM10 <b>' + p.pm10 + ' µg/m³</b>，相當於 AQI <b>' + p.aqi + '，' + zh(p.category) + '</b>。' +
      (p.today ? '今天平均 ' + p.today.pm25 + ' µg/m³' + (p.tomorrow_weather ? '，明天預報雨量 ' + p.tomorrow_weather.rain_mm + ' mm、風速 ' + p.tomorrow_weather.wind_kmh + ' km/h。' : '。') : '') +
      (p.city && isNum(p.city.distance_km) ? '這個模型是為' + esc(city) + '訓練的，距離' + esc(zh(S.loc.name)) + ' ' + Math.round(p.city.distance_km) + ' 公里。' : '')) + '</p>';
  openSheet('<div class="sheet-head"><h2>' + tx('How Skyline predicts tomorrow’s air · ' + esc(city), 'Skyline 如何預測明天的空氣 · ' + esc(city)) + '</h2>' + CLOSE_BTN + '</div>' + intro +
    '<h3>' + tx('Results on 12 months the model never saw (' + esc(m.tested_on) + ')', '在模型沒看過的 12 個月上的結果（' + esc(m.tested_on) + '）') + '</h3>' +
    '<div class="kpis">' +
      '<div class="kpi"><b>' + num(R.pm25[ch].mae, 1) + '</b><span>' + tx('µg/m³ average error, Skyline', 'µg/m³ 平均誤差，Skyline') + '</span></div>' +
      '<div class="kpi"><b>' + num(R.pm25.baseline.mae, 1) + '</b><span>' + tx('µg/m³ average error, “same as today”', 'µg/m³ 平均誤差，「和今天一樣」') + '</span></div>' +
      '<div class="kpi"><b style="color:var(--gold)">' + Math.abs(better) + '%</b><span>' + (better >= 0 ? tx('less error than the baseline', '誤差比基準少') : tx('more error than the baseline', '誤差比基準多')) + '</span></div>' +
      '<div class="kpi"><b>' + WK.caught + '/' + WK.bad_days + '</b><span>' + tx('days over 35 µg/m³ warned (' + (WK.warned - WK.caught) + ' false alarms)', '超過 35 µg/m³ 的日子有事先警示（誤報 ' + (WK.warned - WK.caught) + ' 次）') + '</span></div>' +
    '</div>' +
    (m.series && m.series.pm25 ? '<div class="bigchart">' + lineChart(m.series.pm25, ['actual', 'model', 'baseline'], ['#9fd8ff', '#FFC24B', '#ffffff'], 40) + '</div><div class="ticks-row">' + ticks + '</div>' +
      '<div class="legend"><span><i style="background:#9fd8ff"></i>' + tx('Actual daily PM2.5', '每日實際 PM2.5') + '</span><span><i style="background:#FFC24B"></i>' + tx('Skyline prediction', 'Skyline 預測') + '</span><span><i style="background:rgba(255,255,255,.6)"></i>' + tx('Same as today', '和今天一樣') + '</span><span><i style="background:rgba(255,120,90,.8)"></i>35 µg/m³</span></div>' : '') +
    '<h3>' + tx('All models compared', '各模型比較') + '</h3>' +
    '<p class="fine">' + tx('PM2.5 and PM10 columns are mean absolute error in µg/m³ (lower is better).', 'PM2.5 與 PM10 欄是平均絕對誤差（µg/m³），越低越好。') + '</p>' +
    '<div class="table-scroll"><table class="metrics"><tr><th>' + tx('Model', '模型') + '</th><th>PM2.5</th><th>PM10</th><th>' + tx('Bad days warned', '警示到的壞空氣日') + '</th><th>' + tx('False alarms', '誤報') + '</th></tr>' + rows + '</table></div>' +
    '<p class="fine">' + (v2
      ? tx('✓ marks what Skyline uses for ' + esc(city) + '. Every choice was made by cross-validation inside the training years' + (m.cv_on ? ', ' + esc(m.cv_on) : '') + ', not on the test year. That picked “' + nameOf(ch) + '” for PM2.5 and “' + nameOf(ch10) + '” for PM10.',
           '✓ 代表 Skyline 在' + esc(city) + '實際使用的模型。所有選擇都是在訓練年份內以交叉驗證決定' + (m.cv_on ? '，' + esc(String(m.cv_on).replace(/\s*\((\d+) folds\)/, '（$1 折）')) : '') + '，沒有用到測試年。結果 PM2.5 選了「' + nameOf(ch) + '」，PM10 選了「' + nameOf(ch10) + '」。') +
        (WT && WT.threshold < 35 ? tx(' The warning threshold is set lower than 35 on purpose: for a school, a missed bad-air day is worse than a false alarm, so Skyline warns when its forecast is above ' + num(WT.threshold, 1) + ' µg/m³.', '警示門檻刻意訂得比 35 低：對學校來說，漏報壞空氣日比誤報更糟，所以 Skyline 在預測高於 ' + num(WT.threshold, 1) + ' µg/m³ 時就會警示。') : '')
      : tx('The model is picked on a validation slice of the training data, not on the test year.', '模型是用訓練資料中的驗證區段挑選的，不是用測試年。')) + noWx + '</p>' +
    (monthBars ? '<h3>' + tx('Error by month (Skyline vs baseline)', '各月誤差（Skyline 與基準）') + '</h3><div class="mrows">' + monthBars + '</div>' : '') +
    (fails ? '<h3>' + tx('Where it fails', '哪裡會失準') + '</h3><p>' + failWhy + '</p><div class="fails">' + fails + '</div>' : '') +
    '<h3>' + tx('How it works', '運作方式') + '</h3>' +
    '<p>' + tx('<b>Inputs:</b> today’s and yesterday’s PM2.5 and PM10 (daily average, peak, evening level), today’s weather, and the weather forecast for tomorrow (rain, wind speed and direction, humidity, temperature, pressure, mixing-layer height), plus season and weekend.',
      '<b>輸入：</b>今天與昨天的 PM2.5 和 PM10（日平均、最高值、傍晚濃度）、今天的天氣、明天的天氣預報（雨量、風速與風向、濕度、氣溫、氣壓、混合層高度），以及季節與是否週末。') + upText + '</p>' +
    '<p>' + tx('<b>Training:</b> ' + m.n_train + ' days (' + esc(m.trained_on) + '). Tested once on the next ' + m.n_test + ' days. One model is trained per city, and the live model is then refit on every day.', '<b>訓練：</b>' + m.n_train + ' 天（' + esc(m.trained_on) + '），並在之後的 ' + m.n_test + ' 天測試一次。每個縣市各訓練一個模型，上線用的模型會再用全部天數重新訓練。') + '</p>' +
    '<p>' + tx('<b>Honest caveats:</b> the PM2.5/PM10 history comes from the Copernicus CAMS model via Open-Meteo, not from ground stations, so the absolute numbers need checking against Ministry of Environment (MOENV) station data. CAMS puts ' + W.baseline.bad_days + ' of ' + m.n_test + ' test days above 35 µg/m³ here. In training, the weather that actually happened stood in for the “forecast”, so live accuracy will be a little worse than the test score.',
      '<b>老實說的限制：</b>PM2.5／PM10 的歷史資料來自 Copernicus CAMS 模式（經 Open-Meteo），不是地面測站，所以絕對數值還需要和環境部測站資料比對。CAMS 在這裡把 ' + m.n_test + ' 個測試日中的 ' + W.baseline.bad_days + ' 天估為超過 35 µg/m³。訓練時是用實際發生的天氣當作「預報」，因此實際上線的準確度會比測試分數略差。') + '</p>',
    'Model details');
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
// Windy embed overlay + model per dataset
var WINDY_LAYER = { pm25: ['pm2p5', 'cams'], rain: ['rain', 'ecmwf'], thunder: ['thunder', 'ecmwf'], wind: ['wind', 'ecmwf'], typhoon: ['wind', 'ecmwf'], waves: ['waves', 'ecmwfWaves'], climate: ['temp', 'ecmwf'] };

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
// here: centre on S.loc wherever it is (the Home widget). Otherwise a location outside Taiwan shows Taiwan (Predictions).
function windyURL(layer, zoom, hours, here) {
  var L = S.loc, tw = here || inTW(L.lat, L.lon);
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
    var l = lvlAt(d, i, t), ll = PLACE_LL[p.name], shown = l != null && !d.quiet;
    if (shown) L.circle(ll, { pane: 'data', radius: 24000 + l * 9000, stroke: false, fillColor: P[l], fillOpacity: 0.8, interactive: false }).addTo(live.data);
    L.circleMarker(ll, { radius: 4, color: '#05172E', weight: 1, fillColor: '#fff', fillOpacity: 1 })
      .bindTooltip(d.quiet ? p.name : p.name + ' · ' + lvlText(d, l), { permanent: true, direction: 'right', offset: [6, 0], className: 'map-label' }).addTo(live.marks);
  });
  if (d.id === 'typhoon') drawTy(L, t);   // draws the real track, or nothing when no storm is active
  if (inTW(S.loc.lat, S.loc.lon)) {
    L.circleMarker([S.loc.lat, S.loc.lon], { radius: 7, color: '#fff', weight: 2, fillColor: S.accent, fillOpacity: 1 })
      .bindTooltip('You: ' + S.loc.name).addTo(live.marks);
  }
}

// Card previews: one real satellite still of Taiwan (a single cached request shared by every
// card). Each dataset gets its own crop and, once its data has loaded, an overlay of the current
// region levels, a small icon motif and a key naming the worst region. A dataset with no data
// shows the bare still and its state ("Not connected yet", "Unavailable", "Loading…").
// Crop per dataset: [centre lat, centre lon, width in still pixels] (the still is 384 × 456).
var THUMB_VIEW = { pm25: [23.35, 120.6, 320], landslide: [23.95, 121.25, 280], rain: [24.3, 121.15, 330], thunder: [24.0, 120.9, 310],
  wind: [24.45, 120.6, 350], typhoon: [23.7, 121.3, 300], waves: [24.6, 121.15, 290], climate: [23.7, 120.9, 384] };
function thumbHTML(d, base) {
  var P = pal(), W = 384, H = 456;
  var px = function (ll) { return [(ll[1] - TW_BOX[0]) / (TW_BOX[2] - TW_BOX[0]) * W, (TW_BOX[3] - ll[0]) / (TW_BOX[3] - TW_BOX[1]) * H]; };
  var f1 = function (n) { return n.toFixed(1); };
  var inBox = function (ll) { return ll[1] >= TW_BOX[0] && ll[1] <= TW_BOX[2] && ll[0] >= TW_BOX[1] && ll[0] <= TW_BOX[3]; };
  var v = THUMB_VIEW[d.id] || THUMB_VIEW.climate, has = !!d.lv && !d.quiet;
  var ty = d.id === 'typhoon' && has ? tyStorm() : null;
  if (ty && ty.active && inBox(ty.cur.ll)) v = [ty.cur.ll[0] - 0.3, ty.cur.ll[1] - 0.6, v[2]];   // centre the crop on the storm when it is on the still
  var vw = Math.min(W, v[2]), vh = vw / 1.7, c = px(v);
  var vx = Math.max(0, Math.min(W - vw, c[0] - vw / 2)), vy = Math.max(0, Math.min(H - vh, c[1] - vh / 2));
  var at = MAP_PLACES.map(function (p) { return px(PLACE_LL[p.name]); });
  var now = MAP_PLACES.map(function (p, i) { return has ? lvlAt(d, i, NOW) : null; });
  var spots = at.map(function (q, i) {
    var l = now[i];
    return l == null ? '' : '<circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="' + (20 + l * 9) + '" fill="' + P[l] + '" fill-opacity="' + (base === 'sat' ? 0.55 : 0.7) + '" filter="url(#sk-b16)"/>';
  }).join('');
  var mark = function (minL, fn) { return at.map(function (q, i) { return now[i] != null && now[i] >= minL ? fn(q, now[i]) : ''; }).join(''); };
  var rows = function (n, fn) { var s = ''; for (var i = 0; i < n; i++) s += fn(i, vy + (i + 0.5) * vh / n); return s; };
  var motif = '';
  if (!has) {
    motif = '';
  } else if (d.id === 'rain') {      // slanted rain streaks
    motif = '<g fill="none" stroke="#CFE8FF" stroke-opacity="0.55" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="9 13">' +
      rows(18, function (i) { return '<path d="M' + f1(vx + i * 24) + ',' + f1(vy - 10) + ' l-44,' + f1(vh + 20) + '"/>'; }) + '</g>';
  } else if (d.id === 'thunder') {   // lightning bolts where storms are likely
    motif = mark(2, function (q) { return '<path transform="translate(' + f1(q[0]) + ' ' + f1(q[1]) + ')" d="M2,-14 L-7,2 H-1 L-3,14 L8,-3 H2 Z" fill="#FFE066" stroke="#05172E" stroke-width="1" stroke-linejoin="round"/>'; });
  } else if (d.id === 'wind') {      // flow lines (an icon for wind, not a measured direction)
    motif = '<g fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="10 14">' +
      rows(6, function (i, y) { return '<path d="M' + f1(vx + vw + 10) + ',' + f1(y) + ' C' + f1(vx + vw * 0.66) + ',' + f1(y - 14) + ' ' + f1(vx + vw * 0.33) + ',' + f1(y + 14) + ' ' + f1(vx - 10) + ',' + f1(y) + '"/>'; }) + '</g>';
  } else if (ty && ty.active) {      // the real track and the storm's current position
    var s = px(ty.cur.ll);
    motif = '<polyline points="' + ty.pts.map(function (p) { var q = px(p.ll); return f1(q[0]) + ',' + f1(q[1]); }).join(' ') + '" fill="none" stroke="#FFC24B" stroke-width="2.5" stroke-dasharray="7 7" stroke-linecap="round"/>' +
      '<circle cx="' + f1(s[0]) + '" cy="' + f1(s[1]) + '" r="34" fill="#EF4444" fill-opacity="0.18" stroke="#fff" stroke-opacity="0.5" stroke-width="1"/>' +
      '<circle cx="' + f1(s[0]) + '" cy="' + f1(s[1]) + '" r="18" fill="#EF4444" fill-opacity="0.32" stroke="#fff" stroke-width="2"/><circle cx="' + f1(s[0]) + '" cy="' + f1(s[1]) + '" r="4.5" fill="#fff"/>';
  } else if (d.id === 'waves') {     // swell lines
    var humps = Math.ceil((vw + 20) / 26), tail = ''; for (var k = 1; k < humps; k++) tail += ' t26,0';
    motif = '<g fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="1.3" stroke-linecap="round">' +
      rows(7, function (i, y) { return '<path d="M' + f1(vx - 10 - (i % 2) * 13) + ',' + f1(y) + ' q13,-9 26,0' + tail + ' t26,0"/>'; }) + '</g>';
  }
  var windy = base === 'windy' ? '<rect width="' + W + '" height="' + H + '" fill="url(#sk-windy)" fill-opacity="0.72"/>' : '';
  var worst = -1; now.forEach(function (l, i) { if (l != null && (worst < 0 || l > now[worst])) worst = i; });
  var tag = !d.lv ? '<span class="thumb-peak na">' + (d.na.h === '—' ? d.na.msg : d.na.h) + '</span>'
    : d.quiet ? '<span class="thumb-peak na">' + d.quiet + '</span>'
    : worst < 0 ? '' : '<span class="thumb-peak"><i style="background:' + P[now[worst]] + '"></i><span>' + esc(MAP_PLACES[worst].name) + '</span><span>' + esc(d.labels[now[worst]]) + '</span></span>';
  return '<svg viewBox="' + f1(vx) + ' ' + f1(vy) + ' ' + f1(vw) + ' ' + f1(vh) + '" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + esc(d.title) + ' preview on ' + (base === 'sat' ? 'satellite' : 'Windy') + ' map">' +
    '<rect width="' + W + '" height="' + H + '" fill="#05172E"/><image href="' + TW_IMG + '" width="' + W + '" height="' + H + '" preserveAspectRatio="none" style="filter:brightness(1.45) saturate(1.15)"/>' + windy + spots + motif + '</svg>' + tag +
    (has ? '<span class="thumb-key" aria-hidden="true">' + P.map(function (col) { return '<i style="background:' + col + '"></i>'; }).join('') + '</span>' : '');
}

function predView(sub) {
  var tw = inTW(S.loc.lat, S.loc.lon);
  var banner = tw ? '' : '<div class="banner">You’re looking at <b>' + esc(S.loc.name) + '</b>. Predictions and the team models cover Taiwan only, so these maps always show Taiwan.</div>';
  var d = activeSets().filter(function (x) { return x.id === sub; })[0];
  if (!d) {
    var groups = [['By Skyline', 'Our own Taiwan models'], ['Others', 'From Open-Meteo, ECMWF and CWA']];
    return '<div class="page"><header><div class="eyebrow">Taiwan only</div><h1>Predictions</h1>' +
      '<p class="lede">Pick a dataset to open its map, then scrub back through the past or forward into the forecast.</p></header>' + banner +
      groups.map(function (g) {
        return '<section aria-labelledby="g-' + g[0].replace(/\s/g, '') + '"><div class="group-head"><h2 id="g-' + g[0].replace(/\s/g, '') + '">' + g[0] + '</h2><span>' + g[1] + '</span></div><div class="pred-grid">' +
          activeSets().filter(function (x) { return x.group === g[0]; }).map(function (x) {
            var base = baseFor(x), own = x.group === 'By Skyline';
            return '<a class="pcard' + (own ? ' own' : '') + (x.lv ? '' : ' na') + '" href="#predictions/' + x.id + '"><div class="thumb">' +
              thumbHTML(x, base) +
              (x.lv ? '<span class="base-tag">' + (base === 'sat' ? 'Satellite' : 'Windy') + '</span>' : '') + (own ? '<span class="own-tag">Skyline</span>' : '') + '</div>' +
              '<div class="pc-body"><h3>' + x.title + '</h3><p>' + x.desc + '</p><span class="src">' + x.src + '</span></div></a>';
          }).join('') + '</div></section>';
      }).join('') + '</div>';
  }
  var own = d.group === 'By Skyline';
  var head = '<div class="page"><header class="pm-head"><a class="btn ghost" href="#predictions">← All predictions</a>' +
    '<div><div class="eyebrow">' + d.group + '</div><h1>' + d.title + '</h1></div><div class="grow"></div>' +
    '<span class="chip ' + (own ? 'own' : 'solid') + '">' + d.src + '</span></header>' + banner;
  // No data: say why. No map, overlay, track, region values or ranking are drawn.
  if (!d.lv) return head + '<section class="pm-na" role="status"><h2>' + (d.na.h === '—' ? d.na.msg : d.na.h) + '</h2>' +
    (d.na.h === '—' ? '' : '<p>' + d.na.msg + '</p>') + '<p>' + d.desc + '</p>' +
    (d.na.retry ? '<button type="button" class="btn accent" data-action="retry-live">Retry</button>' : '') + '</section></div>';
  return head +
    '<div class="pm-body"><section class="pm-map" aria-label="Map">' +
      '<div class="map-bar"><span class="mode" id="pm-mode"></span>' +
        '<div class="seg" role="group" aria-label="Map base"><button type="button" data-action="set-base" data-base="sat" id="base-sat">Satellite</button><button type="button" data-action="set-base" data-base="windy" id="base-windy">Windy</button></div></div>' +
        '<div class="map-box"><div id="pm-live" class="pm-live"></div></div>' +
        '<p class="map-note" id="pm-note"></p>' +
      '<div class="slider"><label for="pred-time"><span>Past ← Now → Prediction</span><span class="now" id="pm-time"></span></label>' +
        '<input id="pred-time" class="time" type="range" min="0" max="11" step="1" value="' + S.predT + '" data-input="predT" aria-valuetext="' + TIMES[S.predT] + '">' +
        '<div class="ticks" aria-hidden="true">' + TIMES.map(function (l, i) { return '<span' + (i === NOW ? ' class="is-now"' : '') + '>' + l + '</span>'; }).join('') + '</div></div>' +
      '<div class="legend" id="pm-legend"></div></section>' +
    '<aside class="pm-side" aria-label="Region values"><div class="side-note"><div class="k" id="pm-k"></div><p>' + d.note + '</p><div class="conf" id="pm-conf"></div></div>' +
      '<div class="regions" id="pm-rows"></div>' +
      '<a class="btn accent" href="#ask" data-action="ask-about" data-q="' + esc('What does the ' + d.title + ' map show near ' + S.loc.name + '?') + '" style="border-radius:14px;min-height:50px">Ask the AI about this map</a></aside></div></div>';
}
function updatePred() {
  var sub = route().sub, d = activeSets().filter(function (x) { return x.id === sub; })[0];
  if (!d || !d.lv || !$('#pm-live')) return;
  var t = S.predT, base = baseFor(d), P = pal();
  var mode = t < NOW ? ['Past', '#5B6F99', '#fff'] : t === NOW ? ['Now', '#fff', '#0B1B3F'] : ['Prediction', 'var(--accent)', 'var(--accent-ink)'];
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
  $('#pm-conf').textContent = d.basis;
  $('#base-sat').setAttribute('aria-pressed', base === 'sat');
  $('#base-windy').setAttribute('aria-pressed', base === 'windy');
  var yours = inTW(S.loc.lat, S.loc.lon) ? nearestMapPlace() : -1;
  $('#pm-rows').innerHTML = d.quiet ? '<div class="region"><span>' + d.quiet + '</span></div>' : MAP_PLACES.map(function (p, i) {
    var l = lvlAt(d, i, t);
    return '<div class="region' + (i === yours ? ' you' : '') + '"><span>' + p.name + '</span>' +
      (l == null ? '<b class="none">' + d.none + '</b>' : '<b style="background:' + P[l] + ';color:' + inkFor(P[l]) + '">' + d.labels[l] + '</b>') + '</div>';
  }).join('');
  $('#pm-legend').innerHTML = d.quiet ? '' : d.legend.map(function (l, i) { return '<span><i style="background:' + P[i] + '"></i>' + l + '</span>'; }).join('');
  var r = $('#pred-time'); r.setAttribute('aria-valuetext', TIMES[t] + ', ' + mode[0]);
}
function nearestMapPlace() {
  var y = project(S.loc), bi = 0, bd = Infinity;
  MAP_PLACES.forEach(function (p, i) { var d = Math.hypot(p.x - y.x, p.y - y.y); if (d < bd) { bd = d; bi = i; } });
  return bi;
}

/* ---------- Ask AI ---------- */
// What a question is about, for the built-in (no model) assistant. '' when it is none of these.
function askTopic(q) {
  var l = q.toLowerCase();
  if (/landslide|slope|mudslide|山崩|土石流|邊坡|坍/.test(l)) return 'landslide';
  if (/pm ?2\.?5|\bair\b|haze|aqi|smog|pollut|空氣|空汙|空污|霾/.test(l)) return 'pm25';
  if (/typhoon|cyclone|颱風|台風/.test(l)) return 'typhoon';
  if (/thunder|storm|lightning|hail|雷|閃電|冰雹/.test(l)) return 'thunder';
  if (/rain|umbrella|shower|drizzle|\bwet\b|下雨|雨|傘/.test(l)) return 'rain';
  if (/wind|gust|breez|風/.test(l)) return 'wind';
  if (/wave|swell|surf|\bsea\b|coast|浪|海/.test(l)) return 'waves';
  if (/season|next month|climate|outlook|氣候|季|下個月/.test(l)) return 'season';
  if (/weather|temperature|\bhot\b|\bcold\b|\bwarm\b|outside|right now|forecast|天氣|氣溫|溫度|熱|冷|現在|預報/.test(l)) return 'now';
  return '';
}
function tr(s) { return S.lang === 'zh' ? zh(s) : s; }
// The built-in assistant: no model, no network. It reads out the same live values the tiles show
// (catalog), with their real sources, and says so. Anything else it cannot answer.
function builtinAnswer(q, lang) {
  var L = S.loc, isZh = lang === 'zh', z = function (s) { return isZh ? zh(s) : s; };
  var cat = catalog(L), by = {}, lines = [], src = [], topic = askTopic(q);
  cat.forEach(function (t) { by[t.id] = t; });
  var use = function (s) { if (s && src.indexOf(s) < 0) src.push(s); };
  var tile = function (id) {
    var t = by[id]; if (!t) return;
    if (t.na) { lines.push('<strong>' + z(t.title) + '</strong>' + (isZh ? '：' : ': ') + z(t.na.h === '—' ? t.na.msg : t.na.h) + (t.na.h === '—' ? '' : (isZh ? '。' : '. ') + z(t.na.msg))); return; }
    lines.push('<strong>' + z(t.title) + '</strong>' + (isZh ? '：' : ': ') + z(t.value) + (t.sub ? ' · ' + z(t.sub) : ''));
    use(z(t.src));
  };
  var now = function () {
    var w = wxNow(), hl = todayHL(), name = esc(z(L.name));
    if (!w.live) { lines.push(isZh ? name + '目前沒有即時天氣資料：' + zh(naOf(w.state, 'om').msg) : 'There’s no live weather for ' + name + ' right now: ' + naOf(w.state, 'om').msg); return; }
    lines.push(isZh
      ? name + '現在 <strong>' + fmtT(w.temp) + '</strong>，' + esc(zh(w.headline)) + '。' + (hl ? '今天高溫 ' + fmtT(hl.hi) + '、低溫 ' + fmtT(hl.lo) + '。' : '') + (w.stale ? '（資料為' + zh(fmtAge(w.t)) + '，尚未更新。）' : '')
      : 'Now in ' + name + ': <strong>' + fmtT(w.temp) + '</strong>, ' + esc(w.headline) + '.' + (hl ? ' Today: high ' + fmtT(hl.hi) + ', low ' + fmtT(hl.lo) + '.' : '') + (w.stale ? ' (Data from ' + fmtAge(w.t) + '; it couldn’t be refreshed.)' : ''));
    use(z('Open-Meteo' + liveTag('wx@' + ptKey(L))));
  };
  var rainPeak = function () {
    var t = by.hourly, best = -1, bi = -1;
    if (!t || t.na) return;
    t.hours.forEach(function (h, i) { var v = parseInt(h.rain, 10); if (v > best) { best = v; bi = i; } });
    if (bi < 0) return;
    lines.push(isZh ? '未來數小時降雨機率最高 ' + best + '%（' + zh(t.hours[bi].t) + '）。' + (best >= 50 ? '建議帶傘。' : best < 20 ? '短時間內不太會下雨。' : '')
      : 'Highest chance of rain in the next hours: ' + best + '% (' + t.hours[bi].t + ').' + (best >= 50 ? ' Take an umbrella.' : best < 20 ? ' Rain looks unlikely for now.' : ''));
    use(z(t.src));
  };
  var typhoon = function () {
    var tv = tyView();
    if (tv.state === 'active') { lines.push('<strong>' + z('Typhoon watch') + '</strong>' + (isZh ? '：' : ': ') + esc(z(tv.title)) + (tv.sub ? ' · ' + esc(z(tv.sub)) : '')); use(esc(z(tv.src))); }
    else if (tv.state === 'none') { lines.push('<strong>' + z('Typhoon watch') + '</strong>' + (isZh ? '：' : ': ') + z('No tropical cyclone is being tracked near Taiwan right now.')); use(esc(z(tv.src))); }
    else if (by.typhoon) tile('typhoon');
    else lines.push(isZh ? '颱風資料已在設定中關閉。' : 'The typhoon feed is switched off in Settings.');
  };
  if (topic === 'now') { now(); tile('wind'); tile('humidity'); tile('rain'); }
  else if (topic === 'rain') { tile('rain'); rainPeak(); tile('storms'); }
  else if (topic === 'thunder') { tile('thunder'); tile('storms'); }
  else if (topic === 'wind') tile('wind');
  else if (topic === 'pm25') tile('pm25');
  else if (topic === 'waves') tile('waves');
  else if (topic === 'season') tile('climate');
  else if (topic === 'typhoon') typhoon();
  else if (topic === 'landslide') { if (by.landslide) tile('landslide'); else lines.push(isZh ? '山崩模型已在設定中關閉。' : 'The landslide model is switched off in Settings.'); }
  else {
    lines.push(isZh ? '沒有 AI 模型，我無法回答這個問題。我只能讀出畫面上的即時資料：' : 'I can’t answer that without an AI model. All I can do is read out the live data on screen:');
    now(); tile('rain'); tile('thunder'); tile('wind'); tile('pm25');
  }
  lines.push('<span class="ai-fine">' + (isZh ? '這是 Skyline 內建的即時資料摘要，不是 AI 模型；除了目前天氣、降雨、雷雨、風、PM2.5、浪高、颱風與季節展望之外，其他問題都無法回答。要問其他問題，請到「設定」選擇模型。'
    : 'This is Skyline’s built-in summary of the live data, not an AI model. It covers current conditions, rain, thunderstorms, wind, PM2.5, waves, typhoons and the seasonal outlook, and can’t answer anything else. For other questions, choose a model in Settings.') + '</span>');
  return { text: lines.join('<br>'), src: src };
}
// Both languages are built when the question is asked, so switching language keeps the same facts.
function builtinMsg(q) { return { me: false, builtin: true, en: builtinAnswer(q, 'en'), zh: builtinAnswer(q, 'zh') }; }
function msgHTML(m) {
  if (m.me) return '<div class="msg me">' + esc(m.text) + '</div>';
  // AI bubbles are skipped by the 中文 layer (model text must stay as written), so fixed strings use tr().
  if (m.llm) return '<div class="msg ai' + (m.live ? ' live' : '') + '">' +
    (m.error ? '<p class="err">' + esc(tr(m.error)) + ' <a class="link" href="#settings">' + tr('Check settings') + '</a></p>'
             : '<p class="body">' + (m.plain ? mdLite(m.plain) : (m.live ? '<span class="thinking">' + tr('Thinking…') + '</span>' : '')) + '</p>') +
    '<div class="srcs">' + m.src.map(function (x) { return '<span>' + esc(tr(x)) + '</span>'; }).join('') + '</div></div>';
  if (m.typing) return '<div class="msg ai typing">' + tr('Reading the live data…') + '</div>';
  var a = S.lang === 'zh' ? m.zh : m.en;
  return '<div class="msg ai"><p>' + a.text + '</p><div class="srcs"><span class="own">' + tr('Built-in summary (no AI model)') + '</span>' + a.src.map(function (s) { return '<span>' + s + '</span>'; }).join('') + '</div></div>';
}
function emptyChatHTML() {
  return '<div class="chat-empty"><h2>No questions yet</h2><p>Ask about the weather for ' + esc(S.loc.name) + ', or start with one of the suggestions below.</p></div>';
}
function askView() {
  if (!chat) chat = [];
  var sugg = ['What’s it like outside right now?', 'Do I need an umbrella?', 'Will it storm today?', 'How is the air (PM2.5)?', 'How windy is it?', 'Any typhoon near Taiwan?'];
  return '<div class="page"><header><div class="eyebrow">Grounded in live data</div><h1>Ask Skyline</h1>' +
    '<p class="lede">Answers use the live Skyline data for ' + esc(S.loc.name) + ': Open-Meteo weather, air quality and waves, plus the team PM2.5 model and the CWA typhoon feed when they are connected.</p>' +
    '<p class="lede ai-using">Answering with: <strong>' + esc(aiLabel()) + '</strong> · <a class="link" href="#settings">Change</a></p>' +
    '<p class="lede ai-note"' + (aiProvider() === 'builtin' ? '' : ' hidden') + '>No AI model is connected. The built-in assistant only reads out the live data on screen and can’t answer other questions.</p></header>' +
    '<div class="chat" id="chat" aria-live="polite">' + (chat.length ? chat.map(msgHTML).join('') : emptyChatHTML()) + '</div>' +
    '<div class="suggest">' + sugg.map(function (s) { return '<button type="button" data-action="ask" data-q="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
    '<form class="ask-form" id="ask-form"><label for="ask-input" class="sr-only">Ask a question</label><input id="ask-input" type="text" placeholder="Ask about the weather…" autocomplete="off"><button type="submit" id="ask-btn">' + (aiAbort ? 'Stop' : 'Ask') + '</button></form></div>';
}
function ask(q) {
  q = q.trim(); if (!q) return;
  if (aiAbort) return;
  // Asked before the server probe came back (4 s at most): wait, so the right provider answers.
  if (skyAI.state === 'checking' && (S.ai.provider === 'skyline' || !aiConfigured())) { probeSkyAI().then(function () { ask(q); }); return; }
  if (aiProvider() !== 'builtin') {
    var btn = $('#ask-btn'); if (btn) btn.textContent = 'Stop';
    llmAsk(q).then(function () { var b2 = $('#ask-btn'); if (b2) b2.textContent = 'Ask'; });
    return;
  }
  chat.push({ me: true, text: q }, { typing: true });
  renderChat();
  setTimeout(function () {
    chat.pop(); chat.push(builtinMsg(q));
    renderChat();
  }, 300);
}
function renderChat() {
  var c = $('#chat'); if (!c) return;
  c.innerHTML = chat.length ? chat.map(msgHTML).join('') : emptyChatHTML();
  var last = c.lastElementChild; if (last) last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ============================================================
   Bring-your-own AI for Ask Skyline.
   - Built-in (no model): reads out the live data on screen (builtinAnswer). No network.
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
  return 'Built-in summary (no AI model)';
}
function hostOf(u) { try { return new URL(u).host; } catch (e) { return u || 'no URL set'; } }

// Everything the model may use: the same data the screens show for the current location.
// Each line carries its source. Whatever has no data is listed as unavailable, never with a value.
function skylineContext() {
  var L = S.loc, nowWx = wxNow(), tv = tyView(), hl = todayHL();
  applyLiveSets();
  var cat = catalog(L), lines = [];
  lines.push('Location: ' + L.name + (L.sub ? ' (' + L.sub + ')' : '') + ' at ' + fmtCoord(L.lat, L.lon) + (inTW(L.lat, L.lon) ? '' : ' — outside Taiwan: team models and prediction maps do not cover it'));
  if (nowWx.live) {
    var wxSrc = 'Open-Meteo forecast API' + (nowWx.stale ? ', last updated ' + fmtAge(nowWx.t) + ' (refresh failed, may be out of date)' : ', live' + (nowWx.time ? ', updated ' + nowWx.time + ' local time' : ''));
    lines.push('Now: ' + fmtT(nowWx.temp) + ', ' + nowWx.label + '. Headline: ' + nowWx.headline + ' [source: ' + wxSrc + ']');
    if (hl) lines.push('Today: high ' + fmtT(hl.hi) + ', low ' + fmtT(hl.lo) + ' [source: ' + wxSrc + ']');
  } else lines.push('Now: UNAVAILABLE — ' + naOf(nowWx.state, 'om').msg);
  var gone = function (t) { return '- ' + t.title + ': UNAVAILABLE — ' + (t.na.h === '—' ? '' : t.na.h + '. ') + t.na.msg; };
  cat.forEach(function (t) {
    if (t.id === 'map') return;
    if (t.na) { lines.push(gone(t)); return; }
    if (t.kind === 'stat') lines.push('- ' + t.title + ': ' + t.value + ' — ' + t.sub + ' [source: ' + t.src + ']');
    if (t.kind === 'hourly') lines.push('- Hourly: ' + t.hours.map(function (h) { return h.t + ' ' + h.temp + ' rain ' + h.rain; }).join('; ') + ' [source: ' + t.src + ']');
    if (t.kind === 'week') lines.push('- 7-day forecast (low–high): ' + t.week.map(function (w) { return w.day + ' ' + w.lo + '–' + w.hi; }).join('; ') + ' [source: ' + t.src + ']');
    if (t.kind === 'typhoon') lines.push(tv.state === 'active' ? '- Typhoon watch: ' + tv.title + ' of this location' + (tv.sub ? '; ' + tv.sub : '') + ' [source: ' + tv.src + ']'
      : '- Typhoon watch: no active typhoon near Taiwan [source: ' + tv.src + ']');
  });
  var air = liveAir(), ta = tomorrowAir();
  if (air && isNum(air.current.us_aqi)) lines.push('- Air quality now: US AQI ' + Math.round(air.current.us_aqi) + ' (' + aqiCat(air.current.us_aqi)[1] + ')' + (isNum(air.current.pm10) ? ', PM10 ' + Math.round(air.current.pm10) + ' µg/m³' : '') + ' [source: Open-Meteo CAMS' + liveTag('air@' + ptKey(L)) + ']');
  if (ta.kind !== 'na') lines.push('- Tomorrow’s air (' + ta.p.date + ', daily average): PM2.5 ' + ta.p.pm25 + ' µg/m³, PM10 ' + ta.p.pm10 + ' µg/m³, AQI ' + ta.p.aqi + ' (' + ta.p.category + '). School outdoor plan: ' + (ta.p.advice || schoolAdvice(ta.p.aqi)).title +
    (ta.kind === 'model' ? ' [source: Skyline PM2.5 model for ' + (ta.city.name || 'the nearest city') + ', live]' : ' [source: Copernicus CAMS forecast via Open-Meteo, live; not a Skyline model: no city model covers this location]'));
  lines.push('Taiwan prediction maps (region levels now / +24h / +72h):');
  activeSets().forEach(function (d) {
    if (!d.lv) { lines.push('- ' + d.title + ': UNAVAILABLE — ' + (d.na.h === '—' ? '' : d.na.h + '. ') + d.na.msg); return; }
    if (d.quiet) { lines.push('- ' + d.title + ' [' + d.src + ']: ' + d.quiet + '.'); return; }
    var at = function (t) { return MAP_PLACES.map(function (p, i) { return p.name + ' ' + lvlText(d, lvlAt(d, i, t)); }).join(', '); };
    lines.push('- ' + d.title + ' [' + d.src + ']: now: ' + at(NOW) + ' | +24h: ' + at(7) + ' | +72h: ' + at(9) + '. Note: ' + d.note);
  });
  return 'You are Skyline, a weather assistant for Taiwan. Answer using only the data in <skyline_data>. ' +
    'If the data does not cover the question, say so plainly instead of guessing. Name the source for each fact (for example "Open-Meteo", "team PM2.5 model", "CWA typhoon feed"). ' +
    'Keep answers short and practical: two to five sentences, plain text, no headings. Reply in the language the user writes in (English or Traditional Chinese). ' +
    'Temperatures are in °' + S.units + '. Each line names its source. Sources ending in "live" are real, current data. A line marked UNAVAILABLE has no data: ' +
    'say it is not available (and why, if the line says) and never estimate a value for it.\n\n' +
    '<skyline_data>\n' + lines.join('\n') + '\n</skyline_data>';
}

// Conversation so far, as alternating user/assistant text (skips failed turns).
function chatHistory() {
  var out = [];
  for (var i = 0; i < chat.length; i++) {
    var m = chat[i];
    if (m.typing || m.error || m.live) continue;
    var text = m.me ? m.text : (m.plain || (m.builtin ? stripHTML(m.en.text) : ''));
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
  budget: 'The shared Skyline AI budget is used up for now. The built-in summary still works, or add your own key in Settings.',
  rate: 'Skyline AI is busy: too many questions in a short time. Wait a moment and ask again.',
  gone: 'Skyline AI isn’t available on this server. Use the built-in summary or your own provider in Settings.',
  server: 'Skyline AI had a problem answering. Try again in a moment.',
  net: 'Couldn’t reach the Skyline server. Check your connection and try again.'
};
// Has the user picked a provider themselves? (Untouched installs get Skyline AI when the server offers it.)
function aiConfigured() { return !!S.ai.chosen || S.ai.provider !== 'builtin'; }
// The provider actually used right now.
function aiProvider() {
  var p = S.ai.provider;
  if (p === 'skyline') return skyAI.state === 'off' ? 'builtin' : 'skyline';
  if (p === 'builtin' && !S.ai.chosen && skyAI.state === 'ok') return 'skyline';
  return p;
}
function probeSkyAI(force) {
  if (skyAI.promise && !force) return skyAI.promise;
  var done = function () { skyAIChanged(); return skyAI; };
  if (!SAME_ORIGIN) { skyAI.state = 'off'; return (skyAI.promise = Promise.resolve().then(done)); }
  // /api/health first: when it says this server has no Ask AI, the status request is skipped.
  skyAI.promise = loadHealth().then(function () {
    if (feat('ask') === false && !force) { skyAI.state = 'off'; return null; }
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 4000);
    return fetch('/api/ask/status', { signal: ctrl.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
      .then(function (j) {
        skyAI.state = j && j.available === true ? 'ok' : 'off';
        skyAI.model = j && typeof j.model === 'string' ? j.model : '';
        skyAI.remaining = j && typeof j.remaining_usd === 'number' ? j.remaining_usd : null;
      })
      .catch(function () { skyAI.state = 'off'; })
      .then(function () { clearTimeout(timer); });
  }).then(done);
  return skyAI.promise;
}
// Refresh what is on screen after a probe, without rebuilding a form someone is typing in.
function skyAIChanged() {
  var r = route();
  if (r.page === 'ask') {
    var s = $('.ai-using strong'); if (s) s.textContent = aiLabel();
    var nt = $('.ai-note'); if (nt) nt.hidden = aiProvider() !== 'builtin';
  }
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
  var segH = '<div class="seg" role="group" aria-label="AI provider" style="flex-wrap:wrap">' + [['skyline', 'Skyline (no setup)'], ['builtin', 'Built-in (no model)'], ['openai', 'OpenAI-compatible'], ['claude', 'Claude']].map(function (o) {
    var dis = o[0] === 'skyline' && skyOff;
    return '<button type="button" data-action="ai-provider" data-val="' + o[0] + '" aria-pressed="' + (p === o[0]) + '"' + (dis ? ' disabled style="opacity:.45;cursor:not-allowed"' : '') + '>' + o[1] + '</button>';
  }).join('') + '</div>';
  if (skyOff) segH += '<p class="hint">Skyline (no setup) isn’t available on this server. The built-in summary or your own provider still work. <button type="button" class="light-btn" data-action="ai-recheck">Check again</button></p>';
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
    body = '<p class="hint">No AI model. Ask AI reads out the live data on screen (current conditions, rain, thunderstorms, wind, PM2.5, waves, typhoons, seasonal outlook) with its sources, and can’t answer anything else. Pick a provider to use a real model.</p>';
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
    (feat('mcp') === true ? '<div class="field"><span class="lbl">This server (connect by URL)</span>' + codeBlock('mcp-here', location.origin + '/mcp') + '</div>' : '') +
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
// One-line status of a same-origin feature, for the Data sources card
function featNote(feature, feedName) {
  var st = feature === 'pm25' ? pmState() : apiState(feature, feedName);
  if (feature === 'pm25' && st === 'gone' && pmNearest()) return 'No city model within 25 km of this location';
  return st === 'gone' ? 'Not connected on this server' : st === 'error' ? 'Couldn’t be reached' : st === 'loading' ? 'Checking…' : st === 'off' ? 'Turned off' : 'Connected';
}
function settingsView() {
  var swatches = [['#FFC24B', 'Sun yellow (default)'], ['#FF6B5A', 'Coral'], ['#4C8DFF', 'Sky blue'], ['#2FBF9B', 'Jade'], ['#C084FC', 'Orchid']];
  var isPreset = swatches.some(function (s) { return s[0].toLowerCase() === S.accent.toLowerCase(); });
  return '<div class="page"><header><h1>Settings</h1><p class="lede">Everything in Skyline can be changed here, down to the colors. What you see now are the defaults.</p></header>' +
  '<div class="settings-grid"><div style="display:flex;flex-direction:column;gap:20px">' +

  '<section class="card" aria-labelledby="st-loc"><h2 id="st-loc">Location</h2>' +
    setRow(esc(S.loc.name), esc((S.loc.sub ? S.loc.sub + ' · ' : '') + fmtCoord(S.loc.lat, S.loc.lon)), '<button type="button" class="light-btn" data-action="open-search">Change</button>') +
  '</section>' +

  '<section class="card" aria-labelledby="st-home"><h2 id="st-home">Home screen</h2>' +
    setRow('Widgets', layoutIds().length + ' on your dashboard', '<a class="light-btn" href="#home">Open Home</a>') +
    '<p class="hint">On Home, use + to add widgets and ··· (or a long press on a widget) to drag them around or remove them.</p>' +
    '<button type="button" class="light-btn" data-action="reset-widgets"' + (S.layout == null ? ' disabled' : '') + '>Reset to the default layout</button>' +
  '</section>' +

  '<section class="card" aria-labelledby="st-data"><h2 id="st-data">Data sources</h2><p class="hint">Every value in Skyline comes from one of these. Turning one off hides or empties what depends on it; nothing is filled in with made-up numbers.</p>' +
    setRow('Open-Meteo', 'Live conditions, forecast, air quality, waves and the seasonal outlook at your coordinates', sw('sources.openMeteo', 'Open-Meteo')) +
    setRow('Windy maps', 'Live map embeds', sw('sources.windyMap', 'Windy maps')) +
    setRow('Team PM2.5 model', 'Next-day forecast from the nearest of 22 city models · ' + featNote('pm25'), sw('sources.pm25', 'Team PM2.5 model')) +
    setRow('Team landslide model', 'Not connected yet', sw('sources.landslide', 'Team landslide model')) +
    setRow('CWA typhoon warnings', featNote('typhoon', 'ty'), sw('sources.typhoon', 'CWA typhoon warnings')) +
  '</section></div>' +

  '<div style="display:flex;flex-direction:column;gap:20px">' +
  '<section class="card" aria-labelledby="st-theme"><div style="display:flex;justify-content:space-between;align-items:center"><h2 id="st-theme">Theme &amp; colors</h2>' +
    (themeIsDefault() ? '<span class="badge">Default</span>' : '<span class="badge custom">Custom</span>') + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px"><span style="font-weight:600;font-size:15px">Accent color</span><div class="swatches" role="group" aria-label="Accent color">' +
      swatches.map(function (s) { return '<button type="button" class="swatch" style="background:' + s[0] + '" aria-label="' + s[1] + '" aria-pressed="' + (s[0].toLowerCase() === S.accent.toLowerCase()) + '" data-action="set" data-key="accent" data-val="' + s[0] + '"></button>'; }).join('') +
      '<input type="color" id="accent-custom" data-input="accent" value="' + S.accent + '" aria-label="Custom accent color"' + (isPreset ? '' : ' class="on"') + '></div></div>' +
    setRow('Risk color scale', '<span style="display:flex;gap:3px;margin-top:4px">' + pal().map(function (c) { return '<i style="display:block;width:18px;height:10px;border-radius:3px;background:' + c + '"></i>'; }).join('') + '</span>',
      seg('risk', 'Risk color scale', [['default', 'Default'], ['cb', 'Color-blind safe']])) +
    setRow('Sky', 'Follows live weather at your location, on every screen', seg('bgMode', 'Sky', [['live', 'Live weather'], ['static', 'Static']])) +
    setRow('Fonts', '', seg('fonts', 'Fonts', [['default', 'Bricolage + Inter'], ['system', 'System']])) +
    '<div class="set-row"><label for="radius" class="lbl">Corner roundness<small id="radius-out">' + S.radius + ' px</small></label><input id="radius" class="plain" style="max-width:200px" type="range" min="6" max="36" value="' + S.radius + '" data-input="radius"></div>' +
    setRow('Skyline art', 'Taiwan city silhouettes under the temperature on Home', seg('skyline', 'Skyline art', [['city', 'Follow my city'], ['off', 'Off']])) +
    setRow('Map base', 'Default for prediction maps', seg('mapBase', 'Map base', [['auto', 'Auto'], ['sat', 'Satellite'], ['windy', 'Windy']])) +
    '<p class="hint" style="margin-top:-4px">Auto: satellite for Skyline models, Windy for everything else.</p>' +
    '<button type="button" class="light-btn" data-action="reset-theme"' + (themeIsDefault() ? ' disabled' : '') + '>Reset theme to default</button>' +
  '</section>' +

  aiSettingsHTML() + mcpSettingsHTML() +
  '<section class="card" aria-labelledby="st-sky"><h2 id="st-sky">Sky preview</h2><p class="hint">A preview control for demos and testing. It shows another sky behind every screen until you switch back or reload. Readings are never changed: they stay live.</p>' +
    '<div class="set-row"><label for="demo-weather" class="lbl">Preview a sky<small>Default: live weather</small></label><select id="demo-weather" data-input="weather">' + skyOptions() + '</select></div>' +
  '</section>' +
  '<section class="card" aria-labelledby="st-look"><h2 id="st-look">Motion</h2>' +
    setRow('Reduce motion', 'Stops drifting clouds, rain, lightning, count-up numbers and widget motion', sw('reduceMotion', 'Reduce motion')) +
  '</section>' +

  '<section class="card" aria-labelledby="st-units"><h2 id="st-units">Units &amp; language</h2>' +
    setRow('Temperature', '', seg('units', 'Temperature unit', [['C', '°C'], ['F', '°F']])) +
    setRow('Language', 'The built-in Ask AI summary follows this too', seg('lang', 'Language', [['zh', '中文'], ['en', 'English']])) +
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
  var r = route(), key = r.page + '/' + r.sub, app = $('#app');
  document.body.dataset.page = r.page;
  destroyLive();
  loadLive(r.page); applyLiveSets();
  if (key !== lastRoute) { closeSheet(); setEditing(false); }
  // Home already on screen (a feed arrived, the location or unit changed): update it in place, so
  // widgets keep their state and nothing re-animates. Otherwise build the page.
  if (r.page === 'home' && key === lastRoute && $('#grid')) homeUpdate(false);
  else {
    app.innerHTML = r.page === 'home' ? homeView() : r.page === 'predictions' ? predView(r.sub) : r.page === 'ask' ? askView() : settingsView();
    if (r.page === 'home') homeUpdate(true); else { applySky(); syncCompact(); }
  }
  document.querySelectorAll('[data-nav]').forEach(function (a) {
    if (a.dataset.nav === r.page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (r.page === 'predictions' && r.sub) updatePred();
  if (r.page === 'ask' && pendingAsk) { var pq = pendingAsk; pendingAsk = null; ask(pq); }
  document.documentElement.lang = S.lang === 'zh' ? 'zh-Hant-TW' : 'en';
  document.title = { home: S.loc.name + ' · Skyline', predictions: 'Predictions · Skyline', ask: 'Ask AI · Skyline', settings: 'Settings · Skyline' }[r.page];
  if (key !== lastRoute) {
    if (r.stats) { var st = $('#grid'); if (st) st.scrollIntoView(); }
    else window.scrollTo(0, 0);
  }
  lastRoute = key;
  onScroll();
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
/* ============================================================
   Actions
   ============================================================ */
var ACTIONS = {
  'open-search': function () { openSearch(); },
  'close-search': function () { closeSearch(); },
  'edit-widgets': function () { setEditing(!editing); },
  'done-widgets': function () { setEditing(false); },
  'add-widget': function () { openGallery(); },
  'reset-widgets': function () { resetLayout(); closeSheet(); if (route().page === 'settings') rerender(); },
  'toggle-widget': function (el) {
    var id = el.dataset.id, has = layoutIds().indexOf(id) >= 0;
    if (has) removeTile(id); else addTile(id);
    el.classList.toggle('added', !has); el.setAttribute('aria-pressed', String(!has)); el.textContent = has ? '+ Add' : 'Added ✓';
  },
  'close-sheet': function () { closeSheet(); },
  'open-tomorrow': function () { TILES.tomorrow.open(); },
  'toggle-units': function () { S.units = S.units === 'F' ? 'C' : 'F'; save(); rerender(); },
  'set-base': function (el) { var sub = route().sub; S.predBase[sub] = el.dataset.base; save(); updatePred(); },
  'ask': function (el) { ask(el.dataset.q); },
  'ask-about': function (el) { pendingAsk = el.dataset.q; location.hash = 'ask'; },
  'set': function (el) { S[el.dataset.key] = el.dataset.val; save(); applyTheme(); rerender(); },
  'toggle': function (el) {
    var k = el.dataset.key;
    if (k.indexOf('sources.') === 0) { var sk = k.split('.')[1]; S.sources[sk] = !S.sources[sk]; } else S[k] = !S[k];
    save(); applyTheme(); rerender();
  },
  'reset-theme': function () { THEME_KEYS.forEach(function (k) { S[k] = DEFAULTS[k]; }); save(); applyTheme(); render(); toast('Theme reset to default'); },
  'retry-live': function () { retryLive(); },
  'sky-live': function () { S.weather = 'live'; rerender(); },
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
  else if (k === 'accent') { S.accent = el.value; applyTheme(); }
  else if (k === 'q') runSearch();
  else if (k.indexOf('ai.') === 0) { S.ai[k.slice(3)] = el.value.trim(); save(); }
  else if (k.indexOf('key.') === 0) { AI_KEYS[k.slice(4)] = el.value.trim(); saveKeys(); }
});
document.addEventListener('change', function (e) {
  var el = e.target, k = el.dataset && el.dataset.input;
  if (!k) return;
  if (k === 'radius' || k === 'accent') { save(); rerender(); }
  else if (k === 'weather') { S.weather = el.value; rerender(); }   // session only: not saved
});
document.addEventListener('submit', function (e) {
  if (e.target.id === 'ask-form') { e.preventDefault(); if (aiAbort) { aiAbort.abort(); return; } var i = $('#ask-input'); ask(i.value); i.value = ''; }
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
  var r = route();
  if (r.page === 'home' || r.page === 'settings' || r.page === 'ask') rerender(); else render();
  toast('Showing ' + S.loc.name);
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
  closeSheet();
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
  if (!open && e.key === 'Escape') { if (!closeSheet()) setEditing(false); return; }
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
  'Clear day': '晴天', 'Partly cloudy': '晴時多雲', 'Cloudy': '多雲', 'Rain': '雨', 'Thunderstorm': '雷雨', 'Clear night': '晴朗夜晚', 'Dawn': '清晨', 'Dusk': '黃昏',


  'Done': '完成',
  'Hourly': '逐時', 'Thunderstorm risk': '雷雨風險', 'Storm outlook · 72h': '風暴展望 · 72 小時', 'Typhoon watch': '颱風動態',
  'Landslide risk': '山崩風險', '7-day forecast': '7 天預報', 'Wind & gusts': '風與陣風', 'Rain today': '今日雨量', 'Cloud layers': '雲層',
  'Humidity': '濕度', 'Pressure': '氣壓', 'Visibility': '能見度', 'Coast & waves': '海岸與浪高', 'UV index': '紫外線指數',
  'High': '高', 'Low': '低',





  'Now': '現在', 'Today': '今天', 'Sun': '週日', 'Mon': '週一', 'Tue': '週二', 'Wed': '週三', 'Thu': '週四', 'Fri': '週五', 'Sat': '週六',
  'Taiwan only': '僅限台灣',
  'Pick a dataset to open its map, then scrub back through the past or forward into the forecast.': '選擇資料集開啟地圖，再拖曳時間軸查看過去或未來的預測。',
  'By Skyline': 'Skyline 自製', 'Our own Taiwan models': '我們自己的台灣模型', 'Others': '其他來源',
  'Satellite': '衛星', 'PM2.5 forecast': 'PM2.5 預報', 'Thunderstorms': '雷雨', 'Typhoon track': '颱風路徑',
  'Slope-failure risk from satellite data, rain and soil saturation.': '依衛星資料、降雨與土壤飽和度推估的邊坡崩塌風險。',

  '← All predictions': '← 所有預測', 'Past ← Now → Prediction': '過去 ← 現在 → 預測', 'Prediction': '預測',
  'Ask the AI about this map': '問 AI 這張地圖', 'Map base': '地圖底圖',
  'Good': '良好', 'Moderate': '普通', 'Sensitive': '敏感族群不健康', 'Unhealthy': '不健康',
  'Good (0–15)': '良好 (0–15)', 'Moderate (16–35)': '普通 (16–35)', 'Sensitive (36–54)': '敏感族群 (36–54)', 'Unhealthy (55+)': '不健康 (55+)',
  'Medium': '中', 'Very high': '極高', 'Unlikely': '不太可能', 'Possible': '可能', 'Likely': '很可能', 'Severe': '劇烈',
  'Calm': '平靜', 'Breezy': '微風', 'Strong': '強風', 'Gale': '強烈陣風', 'None': '無',




  'You’re looking at': '你正在查看', '. Predictions and the team models cover Taiwan only, so these maps always show Taiwan.': '。預測與團隊模型僅涵蓋台灣，因此地圖一律顯示台灣。',
  'Taipei': '台北', 'Taichung': '台中', 'Nantou': '南投', 'Hualien': '花蓮', 'Chiayi': '嘉義', 'Kaohsiung': '高雄', 'Taitung': '台東', 'Tainan': '台南',
  'Ask Skyline': '問 Skyline',
  'Do I need an umbrella?': '需要帶傘嗎？',
  'Ask': '送出', 'Ask a question': '提出問題',
  'Everything in Skyline can be changed here, down to the colors. What you see now are the defaults.': 'Skyline 的一切都能在這裡調整，連顏色也可以。目前顯示的是預設值。',
  'Location': '位置', 'Change': '變更', 'Home screen': '首頁畫面',
  'Data sources': '資料來源',

  'Team PM2.5 model': '團隊 PM2.5 模型', 'Team landslide model': '團隊山崩模型', 'CWA typhoon warnings': '中央氣象署颱風警報',
  'Theme & colors': '主題與顏色', 'Default': '預設', 'Custom': '自訂', 'Accent color': '強調色', 'Risk color scale': '風險色階', 'Color-blind safe': '色盲友善',
  'Sky': '天空', 'Live weather': '即時天氣', 'Static': '靜態',
  'Fonts': '字型', 'System': '系統', 'Corner roundness': '圓角', 'Skyline art': '天際線圖', 'Taiwan city silhouettes under the temperature on Home': '首頁溫度下方的台灣城市剪影', 'Follow my city': '跟隨我的城市', 'Off': '關閉',
  'Default for prediction maps': '預測地圖的預設', 'Auto': '自動', 'Auto: satellite for Skyline models, Windy for everything else.': '自動：Skyline 模型用衛星，其他用 Windy。',
  'Reset theme to default': '將主題重設為預設', 'Motion': '動態效果', 'Reduce motion': '減少動態效果', 'Stops drifting clouds, rain, lightning, count-up numbers and widget motion': '停止雲、雨、閃電、數字跳動與小工具的動態',
  'Units & language': '單位與語言', 'Temperature': '溫度', 'Language': '語言', 'Temperature unit': '溫度單位',
  'Reset everything to default': '全部重設為預設', 'Custom accent color': '自訂強調色', 'Sun yellow (default)': '陽光黃（預設）', 'Coral': '珊瑚紅', 'Sky blue': '天空藍', 'Jade': '玉綠', 'Orchid': '蘭紫',
  'City, district, postal code, 25.03, 121.56, TPE, or a university': '城市、行政區、郵遞區號、25.03, 121.56、TPE 或大學', 'Place, coordinates, airport code or university': '地點、座標、機場代碼或大學',
  'Try': '試試', 'Recent': '最近', 'Use my location': '使用我的位置', 'Locations': '地點', 'Searching worldwide…': '全球搜尋中…',
  'Coordinates': '座標', 'District': '行政區', 'Postal code': '郵遞區號', 'University': '大學', 'City': '城市', 'Landmark': '地標', 'Airport': '機場', 'Place': '地點', 'DMS': '度分秒', '中文': '中文',
'Current weather': '目前天氣', 'Region values': '各地區數值', 'Map': '地圖', 'Main': '主選單',
  // Ask AI: Skyline (no setup) provider, Demo answers
  'Skyline (no setup)': 'Skyline（免設定）', 'Thinking…': '思考中…', 'Check settings': '檢查設定', 'Check again': '重新檢查', 'Checking…': '檢查中…',
  'No key and nothing to set up. Your question and the Skyline data shown for your location go to the Skyline server, which asks a shared model for you.': '不需要金鑰，也不用設定。你的問題與目前位置顯示的 Skyline 資料會送到 Skyline 伺服器，由它代你詢問共用模型。',
  'Checking whether Skyline AI is available…': '正在確認 Skyline AI 是否可用…', 'Model:': '模型：', 'Shared budget left:': '剩餘共用額度：',
  'Ask AI can answer with Skyline’s shared model or your own. It gets the same Skyline data the screens show for your location.': '「問 AI」可以用 Skyline 的共用模型或你自己的模型回答，並會取得畫面上為你的位置顯示的同一份 Skyline 資料。',
  'Skyline AI is busy: too many questions in a short time. Wait a moment and ask again.': 'Skyline AI 忙碌中：短時間內的提問太多。請稍候再問一次。',
  'Skyline AI had a problem answering. Try again in a moment.': 'Skyline AI 回答時發生問題，請稍後再試。',
  'Couldn’t reach the Skyline server. Check your connection and try again.': '無法連上 Skyline 伺服器。請檢查網路連線後再試一次。',
  'The built-in Ask AI summary follows this too': '內建的「問 AI」摘要也會跟著切換'
};
// District names in 中文 come straight from the postal table
PLACES.forEach(function (p) { if (p.kind === 'District' && !ZH[p.locName]) ZH[p.locName] = p.zh; });
var ZHP = [
  [/^(· )?([A-Za-z' ]+) · (\d{3}) (\S+)$/, function (m) { return (m[1] || '') + zh(m[2]) + ' · ' + m[3] + ' ' + m[4]; }],
  [/^Search worldwide for “(.*)”$/, function (m) { return '全球搜尋「' + m[1] + '」'; }],
  [/^(Past|Now|Prediction) · (.*)$/, function (m) { return zh(m[1]) + ' · ' + m[2]; }],
  [/^Postal (\d{3})$/, function (m) { return '郵遞區號 ' + m[1]; }],
  [/^No Taiwan district has postal code (\d{3})\.$/, function (m) { return '沒有行政區使用郵遞區號 ' + m[1] + '。'; }],
  [/^H:(.+)$/, function (m) { return '高 ' + m[1]; }],
  [/^L:(.+)$/, function (m) { return '低 ' + m[1]; }],
  [/^Dew point (.*)$/, function (m) { return '露點 ' + m[1]; }],
  [/^Nothing in the offline list matches “(.*)”\.$/, function (m) { return '離線清單中找不到「' + m[1] + '」。'; }],
  [/^No airport with (IATA|ICAO) code (\w+) in the offline list\. Try searching worldwide below\.$/, function (m) { return '離線清單中沒有 ' + m[1] + ' 代碼 ' + m[2] + ' 的機場，請試試下方的全球搜尋。'; }],
  [/^Location: (.*)\. Change location$/, function (m) { return '位置：' + m[1] + '。變更位置'; }],
  [/^(· )?([A-Za-z' ]+) · (\d{3}) (\S+) · near (.+) border$/, function (m) { return (m[1] || '') + zh(m[2]) + ' · ' + m[3] + ' ' + m[4] + ' · 靠近' + zh(m[5]) + '邊界'; }],
  [/^Live Windy map \((.*) layer\)\. The slider opened it at (.*) \(as far as Windy’s free forecast reaches\); .*$/, function (m) { return '即時 Windy 地圖（' + m[1] + ' 圖層）。時間軸已讓地圖從 ' + m[2] + ' 開啟（以 Windy 免費預報的範圍為限）；之後可用地圖底部 Windy 自己的時間軸繼續調整。右側的各地區數值會跟著時間軸變化。'; }],
  [/^Live Windy map \((.*) layer\)\. Windy’s embed can’t open in the past, so the map stays at now\. At (.*) the slider only .*$/, function (m) { return '即時 Windy 地圖（' + m[1] + ' 圖層）。Windy 嵌入地圖無法從過去的時間開啟，所以地圖停在現在。在 ' + m[2] + ' 時，時間軸只會改變右側的各地區數值。'; }],
  [/^Live Windy map \((.*) layer\)\. Drag and zoom it\. Move the slider into the forecast .*$/, function (m) { return '即時 Windy 地圖（' + m[1] + ' 圖層）。可以拖曳與縮放。把時間軸移到預測時段，Windy 會從該時間重新開啟；右側的各地區數值會跟著時間軸變化。'; }]
];
// 中文 for the live-data strings (kept apart so they never override an entry above)
var ZH_LIVE = {
  'Live weather': '即時天氣', 'Open-Meteo · live': 'Open-Meteo · 即時', 
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
  
  
  'Team model + Open-Meteo CAMS': '團隊模型 + Open-Meteo CAMS',
  'Open-Meteo · CAPE + weather codes': 'Open-Meteo · CAPE 與天氣代碼', 'Open-Meteo Marine': 'Open-Meteo 海象', 
};
Object.keys(ZH_LIVE).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(ZH, k)) ZH[k] = ZH_LIVE[k]; });
var ZH_DIR = { N: '北', NE: '東北', E: '東', SE: '東南', S: '南', SW: '西南', W: '西', NW: '西北' };
ZHP.push(
  [/^Open-Meteo · live · updated (\d\d:\d\d)$/, function (m) { return 'Open-Meteo · 即時 · ' + m[1] + ' 更新'; }],
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
  [/^(?:Swell ([\d.]+) m · )?(?:from ([NSEW]{1,2}) · )?(?:nearest sea point|off (.+), ([\d.,]+ km) away)$/, function (m) { return (m[1] ? '湧浪 ' + m[1] + ' 公尺 · ' : '') + (m[2] ? '來自' + ZH_DIR[m[2]] + '方 · ' : '') + (m[3] ? zh(m[3]) + '外海，距離 ' + m[4] : '最近的海面格點'); }],
  [/^(.+) · ([\d.,]+) km (N|NE|E|SE|S|SW|W|NW)$/, function (m) { return m[1] + ' · ' + ZH_DIR[m[3]] + '方 ' + m[2] + ' 公里'; }],
  [/^Max wind (\d+) km\/h(.*)$/, function (m) { return '最大風速 ' + m[1] + ' km/h' + m[2]; }],
  [/^Track of (.+)\. Each region shows how far the storm centre is from it along the track\. These are distances, not official warnings\.$/, function (m) { return m[1] + ' 的路徑。各地區顯示颱風中心沿路徑與該地的距離。這是距離，並非官方警報。'; }],
  [/^PM2\.5 at seven cities from the Copernicus CAMS model, via Open-Meteo\. These are model estimates, not station readings\. The forecast ends about four days ahead, so later steps repeat the last value\.(?: Team model, (.+?), (\S+): ([\d.]+) µg\/m³ \((.*?)\)\.)?( The team PM2\.5 model isn’t connected on this server\.)?( The team PM2\.5 model couldn’t be reached\.)?$/,
    function (m) { return '七個城市的 PM2.5，來自 Copernicus CAMS 模式（經 Open-Meteo）。這是模式估計值，不是測站觀測。預報約到四天後，之後的時間點沿用最後一筆數值。' + (m[1] ? ' 團隊模型，' + zh(m[1]) + '，' + m[2] + '：' + m[3] + ' µg/m³（' + zh(m[4]) + '）。' : '') + (m[5] ? ' 這台伺服器尚未連接團隊 PM2.5 模型。' : '') + (m[6] ? ' 無法連上團隊 PM2.5 模型。' : ''); }]
);
// 中文 for the live-app strings: states (loading, not connected, unavailable), the built-in Ask AI
// summary, the seasonal outlook and the sky preview. Added the same way, so nothing above is overridden.
var ZH_APP = {
  'Loading live weather…': '正在載入即時天氣…', 'Open-Meteo · loading…': 'Open-Meteo · 載入中…', 'Live weather is turned off': '即時天氣已關閉', 'Open-Meteo is switched off': 'Open-Meteo 已關閉', 'Open Settings': '開啟設定',
  'Live weather is unavailable': '目前無法取得即時天氣', 'You’re offline': '目前離線', 'Couldn’t reach Open-Meteo': '無法連上 Open-Meteo', 'Retry': '重試', 'Back to live': '回到即時天氣', 'Preview a sky': '預覽天空', 'Temperature not available': '沒有溫度資料',
  'Not connected yet': '尚未連接', 'Loading…': '載入中…', 'Turned off': '已關閉', 'Unavailable': '無法取得', 'No sea nearby': '附近沒有海域',
  'Open-Meteo is switched off in Settings.': 'Open-Meteo 已在設定中關閉。',
  'Open-Meteo Marine has no sea point near this location.': 'Open-Meteo 海象在這個位置附近沒有海面格點。',
  'The CWA typhoon feed isn’t connected on this server.': '這台伺服器尚未連接中央氣象署颱風資料。',
  'No reading from the source right now.': '來源目前沒有提供數值。',
  'You’re offline. Reconnect, then retry.': '目前離線。請恢復連線後重試。',
  'Couldn’t load the typhoon feed.': '無法載入颱風資料。', 'Couldn’t reach Open-Meteo.': '無法連上 Open-Meteo。',
  'The landslide model is on the server, but this version of the app can’t show its output yet.': '伺服器已連接山崩模型，但這個版本的 App 還無法顯示它的結果。',
  'The team landslide model isn’t connected yet. No value is shown until it is.': '團隊的山崩模型尚未連接，連接之前不會顯示任何數值。',
  'Seasonal outlook': '季節展望', 'Team PM2.5 model + Open-Meteo CAMS': '團隊 PM2.5 模型 + Open-Meteo CAMS',
  'January': '1 月', 'February': '2 月', 'March': '3 月', 'April': '4 月', 'May': '5 月', 'June': '6 月', 'July': '7 月', 'August': '8 月', 'September': '9 月', 'October': '10 月', 'November': '11 月', 'December': '12 月',
  'Keelung': '基隆', 'Tamsui': '淡水', 'Taoyuan': '桃園', 'Hsinchu': '新竹', 'Miaoli': '苗栗', 'Taichung Port': '台中港', 'Changhua': '彰化', 'Yunlin': '雲林', 'Donggang': '東港', 'Kenting': '墾丁', 'Chenggong': '成功', 'Su’ao': '蘇澳', 'Toucheng': '頭城', 'Fulong': '福隆',
  'From Open-Meteo, ECMWF and CWA': '來自 Open-Meteo、ECMWF 與中央氣象署',
  'Fine-particle pollution by region, about four days ahead.': '各地區細懸浮微粒污染，預測約四天。',
  'Rain that fell in the 24 hours up to each time.': '各時間點之前 24 小時的累積雨量。',
  'Storm energy (CAPE): where thunderstorms can form.': '對流能量（CAPE）：哪裡有條件形成雷雨。',
  'Peak gusts by region.': '各地區最大陣風。',
  'Storm position, forecast track and its distance from each region.': '颱風位置、預報路徑，以及與各地區的距離。',
  'Wave height at the coast nearest each region.': '各地區最近海岸的浪高。',
  'Next month’s temperature compared with normal, from the ECMWF seasonal forecast.': '下個月氣溫與常態的差距，來自 ECMWF 季節預報。',
  '700+ km away': '距離 700 公里以上', '+1.5 °C or more': '+1.5 °C 以上', 'No coast': '不臨海', 'Past': '過去',
  'Model data, not station readings': '模式資料，非測站觀測', 'Seasonal forecast': '季節預報', 'CWA typhoon feed': '中央氣象署颱風資料',
  'Grounded in live data': '以即時資料為依據', 'Answering with:': '回答來源：',
  'No AI model is connected. The built-in assistant only reads out the live data on screen and can’t answer other questions.': '尚未連接 AI 模型。內建助理只會讀出畫面上的即時資料，無法回答其他問題。',
  'No questions yet': '還沒有提問',
  'What’s it like outside right now?': '現在外面天氣如何？', 'Will it storm today?': '今天會有雷雨嗎？', 'How is the air (PM2.5)?': '空氣品質（PM2.5）如何？', 'How windy is it?': '風大嗎？', 'Any typhoon near Taiwan?': '台灣附近有颱風嗎？',
  'Ask about the weather…': '詢問天氣…', 'Reading the live data…': '正在讀取即時資料…', 'Built-in summary (no AI model)': '內建摘要（無 AI 模型）', 'Stop': '停止',
  'Built-in (no model)': '內建（無模型）',
  'No AI model. Ask AI reads out the live data on screen (current conditions, rain, thunderstorms, wind, PM2.5, waves, typhoons, seasonal outlook) with its sources, and can’t answer anything else. Pick a provider to use a real model.': '沒有 AI 模型。「問 AI」會讀出畫面上的即時資料（目前天氣、降雨、雷雨、風、PM2.5、浪高、颱風、季節展望）並附上來源，其他問題無法回答。選擇供應商即可使用真正的模型。',
  'Skyline (no setup) isn’t available on this server. The built-in summary or your own provider still work.': '這台伺服器沒有提供 Skyline（免設定）。仍可使用內建摘要或你自己的供應商。',
  'The shared Skyline AI budget is used up for now. The built-in summary still works, or add your own key in Settings.': 'Skyline AI 的共用額度暫時用完了。仍可使用內建摘要，或在設定中加入你自己的金鑰。',
  'Skyline AI isn’t available on this server. Use the built-in summary or your own provider in Settings.': '這台伺服器沒有提供 Skyline AI。請在設定中改用內建摘要或你自己的供應商。',
  'Every value in Skyline comes from one of these. Turning one off hides or empties what depends on it; nothing is filled in with made-up numbers.': 'Skyline 的每個數值都來自以下來源。關閉其中一項會隱藏或清空相關內容，絕不會以虛構數字填補。',
  'Live conditions, forecast, air quality, waves and the seasonal outlook at your coordinates': '依你的座標提供即時天氣、預報、空氣品質、浪高與季節展望',
  'Windy maps': 'Windy 地圖', 'Live map embeds': '嵌入的即時地圖',
  'Not connected on this server': '這台伺服器尚未連接', 'Couldn’t be reached': '無法連線', 'Connected': '已連接',
  'Follows live weather at your location, on every screen': '每個畫面都跟隨你所在位置的即時天氣',
  'Sky preview': '天空預覽', 'This server (connect by URL)': '這台伺服器（以網址連線）', 'Outside the track': '不在路徑時間範圍內', 'Default: live weather': '預設：即時天氣',
  'A preview control for demos and testing. It shows another sky behind every screen until you switch back or reload. Readings are never changed: they stay live.': '示範與測試用的預覽控制。每個畫面都會顯示另一種天空，直到你切換回來或重新載入。數據不會改變，一律維持即時資料。'
};
Object.keys(ZH_APP).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(ZH, k)) ZH[k] = ZH_APP[k]; });
ZHP.push(
  [/^Open-Meteo · updated (.+) · couldn’t refresh$/, function (m) { return 'Open-Meteo · ' + zh(m[1]) + '更新 · 無法重新整理'; }],
  [/^(\d+) min ago$/, function (m) { return m[1] + ' 分鐘前'; }],
  [/^(\d+) h ago$/, function (m) { return m[1] + ' 小時前'; }],
  [/^(\d+) days ago$/, function (m) { return m[1] + ' 天前'; }],
  [/^(.+) · (\d+ (?:min|h|days) ago)$/, function (m) { return zh(m[1]) + ' · ' + zh(m[2]); }],
  [/^Preview sky: (.*)$/, function (m) { return '預覽天空：' + zh(m[1]); }],
  [/^(.+): not available$/, function (m) { return zh(m[1]) + '：沒有資料'; }],
  [/^(January|February|March|April|May|June|July|August|September|October|November|December) · (warmer than normal|cooler than normal|near normal)(?: · rain ([+−])(\d+) mm vs normal)?$/,
    function (m) { return zh(m[1]) + ' · ' + { 'warmer than normal': '比常態溫暖', 'cooler than normal': '比常態涼', 'near normal': '接近常態' }[m[2]] + (m[3] ? ' · 雨量較常態 ' + m[3] + m[4] + ' 毫米' : ''); }],
  [/^Next-day forecast from the nearest of 22 city models · (.*)$/, function (m) { return '由 22 個縣市模型中最近的一個預測隔日 · ' + zh(m[1]); }],
  [/^Ask about the weather for (.*), or start with one of the suggestions below\.$/, function (m) { return '詢問' + zh(m[1]) + '的天氣，或從下方的建議問題開始。'; }],
  [/^Answers use the live Skyline data for (.*): Open-Meteo weather, air quality and waves, plus .*$/, function (m) { return '回答使用' + zh(m[1]) + '的 Skyline 即時資料：Open-Meteo 的天氣、空氣品質與浪高，以及已連接時的團隊 PM2.5 模型與中央氣象署颱風資料。'; }],
  [/^Wave height at the coast point nearest each city \((.*)\)\. Nantou has no coast\. Open-Meteo Marine wave models\.$/,
    function (m) { return '各城市最近海岸點的浪高（' + m[1].split(', ').map(function (x) { var q = x.split(': '); return zh(q[0]) + '：' + zh(q[1]); }).join('、') + '）。南投不臨海。資料來自 Open-Meteo 海象波浪模式。'; }],
  [/^Temperature anomaly for (\w+) (\d{4}) at seven cities, from the ECMWF SEAS5 seasonal forecast via Open-Meteo\. .*$/,
    function (m) { return '七個城市 ' + m[2] + ' 年 ' + zh(m[1]) + '的氣溫距平，來自 ECMWF SEAS5 季節預報（經 Open-Meteo）。「常態」指模式本身的長期氣候平均。這是月展望，所以時間軸不會改變它。'; }]
);
// 中文 for the widget dashboard (tile titles, labels, descriptions, gallery, edit bar, AQI categories,
// school advice). Sentences built from numbers are written in both languages where they are made (tx).
var ZH_WIDGETS = {
  'Search for a location': '搜尋地點', 'Edit widgets': '編輯小工具', 'Add widget': '新增小工具', 'Details': '詳細資料', 'Close': '關閉', 'Widgets': '小工具',
  'Drag widgets to rearrange · tap − to remove': '拖曳小工具可重新排列 · 點 − 可移除', 'Reset': '重設',
  'Add widgets': '新增小工具', 'Layout': '版面', 'Reset to the default layout': '重設為預設版面', '+ Add': '+ 加入', 'Added ✓': '已加入 ✓', 'Layout reset to default': '版面已重設為預設',
  'Pick what shows on your dashboard. Tap a widget’s button again to remove it, or use Edit (···) to drag widgets around.': '選擇要顯示在首頁的內容。再點一次按鈕可移除小工具，或用「編輯」（···）拖曳排列。',
  'By Skyline · our AI models': 'Skyline 自製 · 我們的 AI 模型', 'Air quality': '空氣品質', 'Weather': '天氣', 'Storms & sea': '風暴與海象', 'Maps': '地圖',
  'Small': '小', 'Wide': '寬', 'Large': '大', 'Tall': '高', 'Extra wide': '特寬',
  'Hourly Forecast': '逐時預報', 'Next 24 Hours': '未來 24 小時', '10-Day Forecast': '10 天預報', 'Tomorrow’s Air': '明日空氣', 'School Outdoor Plan': '學校戶外活動建議',
  'School Outdoor Plan · Tomorrow': '學校戶外活動建議 · 明天', 'Model Check': '模型檢驗', 'PM2.5 Outlook': 'PM2.5 展望', 'Air Quality': '空氣品質', 'Pollutants': '污染物',
  'Official Station': '官方測站', 'Wind': '風', 'UV Index': '紫外線指數', 'Sunrise': '日出', 'Sunset': '日落', 'Feels Like': '體感溫度', 'Precipitation': '降水',
  'Cloud Cover': '雲量', 'Moon': '月相', 'Thunderstorm Risk': '雷雨風險', 'Storm Outlook': '風暴展望', 'Storm Outlook · 72h': '風暴展望 · 72 小時',
  'Typhoon Watch': '颱風動態', 'Coast & Waves': '海岸與浪高', 'Seasonal Outlook': '季節展望', 'Landslide Risk': '山崩風險', 'Live Map': '即時地圖',
  'Temp': '氣溫', 'Air': '空氣', 'BY SKYLINE': 'SKYLINE 自製', 'CAMS forecast': 'CAMS 預報', 'CAMS forecast · Tomorrow': 'CAMS 預報 · 明天', 'Tomorrow': '明天',
  'Temperature, air quality or rain for each hour, with sunrise and sunset.': '每小時的氣溫、空氣品質或降雨，並標出日出與日落。',
  'Highs, lows and rain chance for the next 10 days.': '未來 10 天的高低溫與降雨機率。',
  'Skyline’s own AI forecast of tomorrow’s PM2.5, PM10 and AQI from the nearest city model. Elsewhere, tomorrow’s CAMS forecast.': 'Skyline 自家 AI 以最近的城市模型預測明天的 PM2.5、PM10 與 AQI。沒有城市模型的地方，改用明天的 CAMS 預報。',
  'Turns tomorrow’s PM2.5 forecast into a go / limit / indoors call for PE and sports practice.': '把明天的 PM2.5 預報換成體育課與運動練習的建議：照常、減量或改室內。',
  'How much better the Skyline model is than guessing “tomorrow = today”, on 12 months it never saw.': 'Skyline 模型比「明天 = 今天」的猜法好多少，以它沒看過的 12 個月來檢驗。',
  'PM2.5 over the past 2 days and the next 3, with the Skyline forecast for tomorrow where a city model covers you.': '過去 2 天與未來 3 天的 PM2.5；所在地有城市模型時，加上 Skyline 的明日預報。',
  'US AQI right now, from all pollutants.': '目前的美國 AQI，綜合所有污染物。',
  'Fine particles right now and their 24-hour average.': '目前的細懸浮微粒與 24 小時平均。', 'Coarse particles right now and their 24-hour average.': '目前的懸浮微粒與 24 小時平均。',
  'Ozone, NO₂, SO₂, CO and dust compared with WHO guidelines.': '臭氧、NO₂、SO₂、CO 與沙塵，和 WHO 指引值比較。',
  'Latest reading from the nearest Ministry of Environment station.': '最近的環境部測站的最新讀數。',
  'Speed, gusts and direction with a compass.': '風速、陣風與風向，附羅盤。', 'Current UV level and when to use sun protection.': '目前的紫外線等級，以及需要防曬的時段。',
  'Next sunrise or sunset and the sun’s path today.': '下一次日出或日落，以及今天的太陽軌跡。', 'Apparent temperature and why it differs.': '體感溫度，以及它和實際氣溫不同的原因。',
  'Relative humidity and dew point.': '相對濕度與露點。', 'How far you can see. Haze from PM2.5 lowers it.': '可以看多遠。PM2.5 造成的霾會降低能見度。',
  'Sea-level pressure and whether it is rising or falling.': '海平面氣壓，以及正在上升或下降。', 'Rain in the last 24 hours and expected in the next 24.': '過去 24 小時的雨量，以及未來 24 小時的預計雨量。',
  'How much of the sky is covered by cloud.': '天空被雲遮住的比例。', 'Moon phase, illumination and next full moon.': '月相、亮面比例與下一次滿月。',
  'Storm risk for the next 24 hours from storm energy (CAPE), weather codes and rain chance.': '依對流能量（CAPE）、天氣代碼與降雨機率推估未來 24 小時的雷雨風險。',
  'Days with thunderstorms in the 3-day forecast.': '未來 3 天預報中有雷雨的日子。',
  'The active typhoon near Taiwan: its track, distance and strength, from CWA warnings.': '台灣附近活動中的颱風：路徑、距離與強度，來自中央氣象署警報。',
  'Wave height, swell and direction at the nearest sea point.': '最近海面格點的浪高、湧浪與方向。',
  'Next month’s temperature and rain compared with normal, from the ECMWF seasonal forecast.': '下個月的氣溫與雨量和常態的差距，來自 ECMWF 季節預報。',
  'Slope-failure risk from the team landslide model. Shows “Not connected yet” until the model is.': '團隊山崩模型的邊坡崩塌風險。模型連接之前會顯示「尚未連接」。',
  'Interactive Windy.com map: rain radar, wind, PM2.5 or temperature.': '可互動的 Windy.com 地圖：降雨雷達、風、PM2.5 或氣溫。',
  'Unhealthy for Sensitive Groups': '對敏感族群不健康', 'Unhealthy (Sens.)': '敏感族群不健康', 'Very Unhealthy': '非常不健康', 'Hazardous': '危害',
  'Clean air. Enjoy the outdoors.': '空氣乾淨，適合戶外活動。', 'Acceptable for most people.': '多數人可以接受。', 'Sensitive groups: limit long exertion.': '敏感族群：減少長時間的劇烈活動。',
  'Everyone: cut back outdoor exertion.': '所有人：減少戶外劇烈活動。', 'Avoid outdoor exertion.': '避免戶外劇烈活動。', 'Stay indoors.': '請留在室內。',
  'Outdoor PE as normal': '戶外體育課照常', 'Air should be clean all day. Good day for sports practice outside.': '整天空氣應該都很乾淨，適合在戶外練習運動。',
  'Outdoor PE OK': '可以上戶外體育課', 'Fine for most students. Students with asthma should keep their inhaler nearby.': '多數學生沒問題。有氣喘的學生請把吸入器帶在身邊。',
  'Shorten hard outdoor exercise': '縮短戶外劇烈運動', 'Sensitive students (asthma, heart or lung conditions) should do PE indoors or take it easy.': '敏感的學生（氣喘、心臟或肺部疾病）應在室內上體育課，或放慢強度。',
  'Move PE indoors': '體育課改在室內', 'Everyone should cut down on long or hard activity outside.': '所有人都應減少在戶外長時間或劇烈的活動。',
  'Keep students indoors': '讓學生留在室內', 'Avoid outdoor activity. Close windows if indoor air is filtered.': '避免戶外活動。室內有空氣清淨設備時請關窗。',
  'Bar = share of the WHO guideline': '長條 = 佔 WHO 指引值的比例', 'Dust': '沙塵', 'Very High': '很高',
  'Similar to the actual temperature.': '和實際氣溫差不多。', 'Humidity is making it feel warmer.': '濕度讓體感更熱。', 'It feels warmer than the actual temperature.': '體感比實際氣溫高。',
  'Wind is making it feel cooler.': '風讓體感更涼。', 'It feels cooler than the actual temperature.': '體感比實際氣溫低。',
  'Perfectly clear view.': '視野非常清晰。', 'Clear view.': '視野清晰。', 'Light haze or rain is reducing visibility.': '薄霾或降雨讓能見度下降。', 'Low visibility. Haze or rain is limiting the view.': '能見度低。霾或降雨限制了視野。',
  'Rising': '上升', 'Falling': '下降', 'Steady': '持平', 'in last 24h': '過去 24 小時', 'Clear skies': '晴空', 'Mostly clear': '大致晴朗', 'Mostly cloudy': '多雲時陰',
  'New Moon': '新月', 'Waxing Crescent': '眉月', 'First Quarter': '上弦月', 'Waxing Gibbous': '盈凸月', 'Full Moon': '滿月', 'Waning Gibbous': '虧凸月', 'Last Quarter': '下弦月', 'Waning Crescent': '殘月',
  'Not available here': '這裡無法提供', 'Partly cloudy night': '晴時多雲的夜晚', 'Cloudy night': '多雲的夜晚',
  'Outside Taiwan: Skyline models and Predictions cover Taiwan only': '台灣以外：Skyline 模型與預測僅涵蓋台灣',
  'Weather:': '天氣：', 'forecast · Air quality: Copernicus CAMS via Open-Meteo · Waves: Open-Meteo Marine · Season: ECMWF SEAS5 · Map:': '預報 · 空氣品質：Copernicus CAMS（經 Open-Meteo）· 浪高：Open-Meteo 海象 · 季節：ECMWF SEAS5 · 地圖：',
  'Tomorrow’s air: CAMS forecast where no Skyline city model covers the location. Not official health advice.': '明日空氣：所在地沒有 Skyline 城市模型時，使用 CAMS 預報。並非官方健康建議。',
  'A widget whose source isn’t connected or can’t be reached says so and shows no number.': '來源尚未連接或無法取得時，小工具會直接說明，不顯示任何數字。',
  'Open Home': '開啟首頁', 'On Home, use + to add widgets and ··· (or a long press on a widget) to drag them around or remove them.': '在首頁用 + 新增小工具，用 ···（或長按小工具）拖曳排列或移除。',
  'No city model within 25 km of this location': '這個位置 25 公里內沒有城市模型',
  'The model report for this city isn’t available right now.': '目前無法取得這個城市的模型報告。',
  'AI assistant': 'AI 助理', 'Copy': '複製', 'Copied': '已複製', 'Use Skyline in your own assistant (MCP)': '在你自己的助理中使用 Skyline（MCP）', 'Model': '模型', 'Preset': '預設組合', 'Base URL': '基礎網址'
};
Object.keys(ZH_WIDGETS).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(ZH, k)) ZH[k] = ZH_WIDGETS[k]; });
ZHP.push(
  [/^Remove (.+)$/, function (m) { return '移除' + zh(m[1]); }],
  [/^(\d+) on your dashboard$/, function (m) { return '首頁上有 ' + m[1] + ' 個'; }],
  [/^Team model \((.+)\) \+ Open-Meteo CAMS$/, function (m) { return '團隊模型（' + zh(m[1]) + '）+ Open-Meteo CAMS'; }]
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
Icons.mount();
applyTheme();
render();
startI18n();
loadHealth();
// Back online: retry whatever failed while the connection was down
window.addEventListener('online', retryLive);
// Refresh live feeds once their 10-minute cache runs out (only while the tab is visible)
setInterval(function () { if (!document.hidden) loadLive(route().page); }, 60000);
})();
