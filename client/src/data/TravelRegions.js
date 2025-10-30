// HereMate - TravelRegions (나라 → 도시)
// 한국인 많이 가는 여행지 + 좌표(lat/lng) 추가 버전
// 좌표는 대표 도심/공항 기준 대략값이며, 없는 도시는 국가 중심 좌표로 넣었음.

const TravelRegions = [
  // 1. 🇬🇷 그리스
  {
    code: "GR",
    name: { ko: "그리스", en: "Greece" },
    cities: [
      { ko: "아테네", en: "Athens", lat: 37.9838, lng: 23.7275 },
      { ko: "산토리니", en: "Santorini", lat: 36.3932, lng: 25.4615 },
      { ko: "미코노스", en: "Mykonos", lat: 37.4467, lng: 25.3287 },
      { ko: "크레타", en: "Crete", lat: 35.2401, lng: 24.8093 }
    ]
  },

  // 2. 🇿🇦 남아프리카공화국
  {
    code: "ZA",
    name: { ko: "남아프리카공화국", en: "South Africa" },
    cities: [
      { ko: "케이프타운", en: "Cape Town", lat: -33.9249, lng: 18.4241 },
      { ko: "요하네스버그", en: "Johannesburg", lat: -26.2041, lng: 28.0473 },
      { ko: "크루거 국립공원", en: "Kruger National Park", lat: -23.9884, lng: 31.5547 }
    ]
  },

  // 3. 🇹🇼 대만
  {
    code: "TW",
    name: { ko: "대만", en: "Taiwan" },
    cities: [
      { ko: "타이베이", en: "Taipei", lat: 25.0330, lng: 121.5654 },
      { ko: "타이중", en: "Taichung", lat: 24.1477, lng: 120.6736 },
      { ko: "가오슝", en: "Kaohsiung", lat: 22.6273, lng: 120.3014 },
      { ko: "타이난", en: "Tainan", lat: 22.9997, lng: 120.2270 },
      { ko: "화롄", en: "Hualien", lat: 23.9872, lng: 121.6015 },
      { ko: "신주", en: "Hsinchu", lat: 24.8138, lng: 120.9675 },
      { ko: "기륭", en: "Keelung", lat: 25.1276, lng: 121.7392 }
    ]
  },

  // 4. 🇰🇷 대한민국
  {
    code: "KR",
    name: { ko: "대한민국", en: "Korea, Republic of" },
    cities: [
      { ko: "서울", en: "Seoul", lat: 37.5665, lng: 126.9780 },
      { ko: "부산", en: "Busan", lat: 35.1796, lng: 129.0756 },
      { ko: "제주", en: "Jeju", lat: 33.4996, lng: 126.5312 },
      { ko: "인천", en: "Incheon", lat: 37.4563, lng: 126.7052 },
      { ko: "강릉", en: "Gangneung", lat: 37.7519, lng: 128.8761 },
      { ko: "속초", en: "Sokcho", lat: 38.2070, lng: 128.5910 },
      { ko: "경주", en: "Gyeongju", lat: 35.8562, lng: 129.2247 },
      { ko: "여수", en: "Yeosu", lat: 34.7604, lng: 127.6622 },
      { ko: "전주", en: "Jeonju", lat: 35.8242, lng: 127.1480 },
      { ko: "통영", en: "Tongyeong", lat: 34.8544, lng: 128.4330 }
    ]
  },

  // 5. 🇩🇪 독일
  {
    code: "DE",
    name: { ko: "독일", en: "Germany" },
    cities: [
      { ko: "베를린", en: "Berlin", lat: 52.5200, lng: 13.4050 },
      { ko: "뮌헨", en: "Munich", lat: 48.1351, lng: 11.5820 },
      { ko: "프랑크푸르트", en: "Frankfurt", lat: 50.1109, lng: 8.6821 },
      { ko: "함부르크", en: "Hamburg", lat: 53.5511, lng: 9.9937 },
      { ko: "쾰른", en: "Cologne", lat: 50.9375, lng: 6.9603 },
      { ko: "하이델베르크", en: "Heidelberg", lat: 49.3988, lng: 8.6724 }
    ]
  },

  // 6. 🇷🇺 러시아
  {
    code: "RU",
    name: { ko: "러시아", en: "Russia" },
    cities: [
      { ko: "모스크바", en: "Moscow", lat: 55.7558, lng: 37.6173 },
      { ko: "상트페테르부르크", en: "Saint Petersburg", lat: 59.9311, lng: 30.3609 },
      { ko: "블라디보스토크", en: "Vladivostok", lat: 43.1155, lng: 131.8855 },
      { ko: "이르쿠츠크(바이칼호)", en: "Irkutsk (Lake Baikal)", lat: 52.2869, lng: 104.3050 }
    ]
  },

  // 7. 🇲🇾 말레이시아
  {
    code: "MY",
    name: { ko: "말레이시아", en: "Malaysia" },
    cities: [
      { ko: "쿠알라룸푸르", en: "Kuala Lumpur", lat: 3.1390, lng: 101.6869 },
      { ko: "코타키나발루", en: "Kota Kinabalu", lat: 5.9804, lng: 116.0735 },
      { ko: "랑카위", en: "Langkawi", lat: 6.3520, lng: 99.8000 },
      { ko: "페낭(조지타운)", en: "Penang (George Town)", lat: 5.4141, lng: 100.3288 },
      { ko: "말라카", en: "Malacca", lat: 2.1896, lng: 102.2501 }
    ]
  },

  // 8. 🇲🇳 몽골
  {
    code: "MN",
    name: { ko: "몽골", en: "Mongolia" },
    cities: [
      { ko: "울란바토르", en: "Ulaanbaatar", lat: 47.8864, lng: 106.9057 },
      { ko: "홉스골호", en: "Khövsgöl Lake", lat: 50.5500, lng: 100.2000 },
      { ko: "테를지 국립공원", en: "Terelj National Park", lat: 47.9890, lng: 107.6060 }
    ]
  },

  // 9. 🇺🇸 미국
  {
    code: "US",
    name: { ko: "미국", en: "United States" },
    cities: [
      { ko: "뉴욕", en: "New York", lat: 40.7128, lng: -74.0060 },
      { ko: "워싱턴 D.C.", en: "Washington, D.C.", lat: 38.9072, lng: -77.0369 },
      { ko: "보스턴", en: "Boston", lat: 42.3601, lng: -71.0589 },
      { ko: "시카고", en: "Chicago", lat: 41.8781, lng: -87.6298 },
      { ko: "로스앤젤레스", en: "Los Angeles", lat: 34.0522, lng: -118.2437 },
      { ko: "샌프란시스코", en: "San Francisco", lat: 37.7749, lng: -122.4194 },
      { ko: "라스베이거스", en: "Las Vegas", lat: 36.1699, lng: -115.1398 },
      { ko: "하와이(호놀룰루)", en: "Honolulu (Hawaii)", lat: 21.3069, lng: -157.8583 },
      { ko: "마이애미", en: "Miami", lat: 25.7617, lng: -80.1918 },
      { ko: "올랜도", en: "Orlando", lat: 28.5383, lng: -81.3792 },
      { ko: "시애틀", en: "Seattle", lat: 47.6062, lng: -122.3321 },
      { ko: "포틀랜드", en: "Portland", lat: 45.5152, lng: -122.6784 },
      { ko: "샌디에이고", en: "San Diego", lat: 32.7157, lng: -117.1611 },
      { ko: "댈러스", en: "Dallas", lat: 32.7767, lng: -96.7970 },
      { ko: "휴스턴", en: "Houston", lat: 29.7604, lng: -95.3698 },
      { ko: "뉴올리언스", en: "New Orleans", lat: 29.9511, lng: -90.0715 },
      { ko: "애틀랜타", en: "Atlanta", lat: 33.7490, lng: -84.3880 },
      { ko: "오스틴", en: "Austin", lat: 30.2672, lng: -97.7431 },
      { ko: "필라델피아", en: "Philadelphia", lat: 39.9526, lng: -75.1652 },
      { ko: "덴버", en: "Denver", lat: 39.7392, lng: -104.9903 },
      { ko: "피닉스", en: "Phoenix", lat: 33.4484, lng: -112.0740 },
      { ko: "솔트레이크시티", en: "Salt Lake City", lat: 40.7608, lng: -111.8910 },
      { ko: "샬럿", en: "Charlotte", lat: 35.2271, lng: -80.8431 },
      { ko: "내슈빌", en: "Nashville", lat: 36.1627, lng: -86.7816 },
      { ko: "디트로이트", en: "Detroit", lat: 42.3314, lng: -83.0458 },
      { ko: "미니애폴리스", en: "Minneapolis", lat: 44.9778, lng: -93.2650 }
    ]
  },

  // 10. 🇻🇳 베트남
  {
    code: "VN",
    name: { ko: "베트남", en: "Vietnam" },
    cities: [
      { ko: "하노이", en: "Hanoi", lat: 21.0278, lng: 105.8342 },
      { ko: "호찌민", en: "Ho Chi Minh City", lat: 10.8231, lng: 106.6297 },
      { ko: "다낭", en: "Da Nang", lat: 16.0544, lng: 108.2022 },
      { ko: "나트랑", en: "Nha Trang", lat: 12.2388, lng: 109.1967 },
      { ko: "푸꾸옥", en: "Phu Quoc", lat: 10.2899, lng: 103.9840 },
      { ko: "후에", en: "Hue", lat: 16.4637, lng: 107.5909 },
      { ko: "호이안", en: "Hoi An", lat: 15.8801, lng: 108.3380 }
    ]
  },

  // 11. 🇸🇦 사우디아라비아
  {
    code: "SA",
    name: { ko: "사우디아라비아", en: "Saudi Arabia" },
    cities: [
      { ko: "리야드", en: "Riyadh", lat: 24.7136, lng: 46.6753 },
      { ko: "제다", en: "Jeddah", lat: 21.4858, lng: 39.1925 },
      { ko: "알울라", en: "AlUla", lat: 26.6085, lng: 37.9231 }
    ]
  },

  // 12. 🇪🇸 스페인
  {
    code: "ES",
    name: { ko: "스페인", en: "Spain" },
    cities: [
      { ko: "바르셀로나", en: "Barcelona", lat: 41.3851, lng: 2.1734 },
      { ko: "마드리드", en: "Madrid", lat: 40.4168, lng: -3.7038 },
      { ko: "세비야", en: "Seville", lat: 37.3891, lng: -5.9845 },
      { ko: "그라나다", en: "Granada", lat: 37.1773, lng: -3.5986 },
      { ko: "말라가", en: "Malaga", lat: 36.7213, lng: -4.4214 },
      { ko: "발렌시아", en: "Valencia", lat: 39.4699, lng: -0.3763 }
    ]
  },

  // 13. 🇨🇭 스위스
  {
    code: "CH",
    name: { ko: "스위스", en: "Switzerland" },
    cities: [
      { ko: "취리히", en: "Zurich", lat: 47.3769, lng: 8.5417 },
      { ko: "루체른", en: "Lucerne", lat: 47.0502, lng: 8.3093 },
      { ko: "인터라켄", en: "Interlaken", lat: 46.6863, lng: 7.8632 },
      { ko: "제네바", en: "Geneva", lat: 46.2044, lng: 6.1432 },
      { ko: "체르마트", en: "Zermatt", lat: 46.0207, lng: 7.7491 }
    ]
  },

  // 14. 🇸🇬 싱가포르
  {
    code: "SG",
    name: { ko: "싱가포르", en: "Singapore" },
    cities: [
      { ko: "싱가포르", en: "Singapore", lat: 1.3521, lng: 103.8198 }
    ]
  },

  // 15. 🇦🇪 아랍에미리트
  {
    code: "AE",
    name: { ko: "아랍에미리트", en: "United Arab Emirates" },
    cities: [
      { ko: "두바이", en: "Dubai", lat: 25.2048, lng: 55.2708 },
      { ko: "아부다비", en: "Abu Dhabi", lat: 24.4539, lng: 54.3773 }
    ]
  },

  // 16. 🇦🇹 오스트리아
  {
    code: "AT",
    name: { ko: "오스트리아", en: "Austria" },
    cities: [
      { ko: "빈", en: "Vienna", lat: 48.2082, lng: 16.3738 },
      { ko: "잘츠부르크", en: "Salzburg", lat: 47.8095, lng: 13.0550 },
      { ko: "할슈타트", en: "Hallstatt", lat: 47.5622, lng: 13.6493 }
    ]
  },

  // 17. 🇺🇿 우즈베키스탄
  {
    code: "UZ",
    name: { ko: "우즈베키스탄", en: "Uzbekistan" },
    cities: [
      { ko: "타슈켄트", en: "Tashkent", lat: 41.2995, lng: 69.2401 },
      { ko: "사마르칸트", en: "Samarkand", lat: 39.6542, lng: 66.9597 },
      { ko: "부하라", en: "Bukhara", lat: 39.768, lng: 64.455 }
    ]
  },

  // 18. 🇪🇬 이집트
  {
    code: "EG",
    name: { ko: "이집트", en: "Egypt" },
    cities: [
      { ko: "카이로", en: "Cairo", lat: 30.0444, lng: 31.2357 },
      { ko: "기가", en: "Giza", lat: 29.9773, lng: 31.1325 },
      { ko: "룩소르", en: "Luxor", lat: 25.6872, lng: 32.6396 },
      { ko: "아스완", en: "Aswan", lat: 24.0889, lng: 32.8998 }
    ]
  },

  // 19. 🇮🇹 이탈리아
  {
    code: "IT",
    name: { ko: "이탈리아", en: "Italy" },
    cities: [
      { ko: "로마", en: "Rome", lat: 41.9028, lng: 12.4964 },
      { ko: "베네치아", en: "Venice", lat: 45.4408, lng: 12.3155 },
      { ko: "피렌체", en: "Florence", lat: 43.7696, lng: 11.2558 },
      { ko: "밀라노", en: "Milan", lat: 45.4642, lng: 9.1900 },
      { ko: "나폴리", en: "Naples", lat: 40.8518, lng: 14.2681 },
      { ko: "친퀘테레", en: "Cinque Terre", lat: 44.1460, lng: 9.6440 }
    ]
  },

  // 20. 🇮🇳 인도
  {
    code: "IN",
    name: { ko: "인도", en: "India" },
    cities: [
      { ko: "델리", en: "Delhi", lat: 28.6139, lng: 77.2090 },
      { ko: "아그라", en: "Agra", lat: 27.1767, lng: 78.0081 },
      { ko: "자이푸르", en: "Jaipur", lat: 26.9124, lng: 75.7873 },
      { ko: "뭄바이", en: "Mumbai", lat: 19.0760, lng: 72.8777 },
      { ko: "바라나시", en: "Varanasi", lat: 25.3176, lng: 82.9739 }
    ]
  },

  // 21. 🇮🇩 인도네시아
  {
    code: "ID",
    name: { ko: "인도네시아", en: "Indonesia" },
    cities: [
      { ko: "발리(덴파사르)", en: "Bali (Denpasar)", lat: -8.6705, lng: 115.2126 },
      { ko: "자카르타", en: "Jakarta", lat: -6.2088, lng: 106.8456 }
    ]
  },

  // 22. 🇯🇵 일본
  {
    code: "JP",
    name: { ko: "일본", en: "Japan" },
    cities: [
      { ko: "도쿄(하네다/나리타)", en: "Tokyo (HND/NRT)", lat: 35.6895, lng: 139.6917 },
      { ko: "오사카(간사이)", en: "Osaka (KIX)", lat: 34.6937, lng: 135.5023 },
      { ko: "교토", en: "Kyoto", lat: 35.0116, lng: 135.7681 },
      { ko: "후쿠오카", en: "Fukuoka", lat: 33.5902, lng: 130.4017 },
      { ko: "삿포로(치토세)", en: "Sapporo (CTS)", lat: 43.0618, lng: 141.3545 },
      { ko: "오키나와(나하)", en: "Okinawa (Naha)", lat: 26.2124, lng: 127.6809 },
      { ko: "나고야", en: "Nagoya", lat: 35.1815, lng: 136.9066 },
      { ko: "히로시마", en: "Hiroshima", lat: 34.3853, lng: 132.4553 },
      { ko: "가고시마", en: "Kagoshima", lat: 31.5966, lng: 130.5571 },
      { ko: "구마모토", en: "Kumamoto", lat: 32.8031, lng: 130.7079 },
      { ko: "오이타", en: "Oita", lat: 33.2396, lng: 131.6093 },
      { ko: "미야자키", en: "Miyazaki", lat: 31.9077, lng: 131.4202 },
      { ko: "고베", en: "Kobe", lat: 34.6901, lng: 135.1955 },
      { ko: "기타큐슈", en: "Kitakyushu", lat: 33.8830, lng: 130.8753 },
      { ko: "오카야마", en: "Okayama", lat: 34.6555, lng: 133.9195 },
      { ko: "다카마쓰", en: "Takamatsu", lat: 34.3428, lng: 134.0466 },
      { ko: "시즈오카", en: "Shizuoka", lat: 34.9756, lng: 138.3828 },
      { ko: "센다이", en: "Sendai", lat: 38.2682, lng: 140.8694 },
      { ko: "하코다테", en: "Hakodate", lat: 41.7687, lng: 140.7288 },
      { ko: "아오모리", en: "Aomori", lat: 40.8222, lng: 140.7474 },
      { ko: "니가타", en: "Niigata", lat: 37.9162, lng: 139.0368 },
      { ko: "가나자와", en: "Kanazawa", lat: 36.5613, lng: 136.6562 },
      { ko: "나라", en: "Nara", lat: 34.6851, lng: 135.8048 },
      { ko: "와카야마", en: "Wakayama", lat: 34.2305, lng: 135.1708 },
      { ko: "나가노", en: "Nagano", lat: 36.6486, lng: 138.1948 },
      { ko: "요코하마", en: "Yokohama", lat: 35.4437, lng: 139.6380 },
      { ko: "가마쿠라", en: "Kamakura", lat: 35.3192, lng: 139.5467 },
      { ko: "닛코", en: "Nikko", lat: 36.7190, lng: 139.6983 },
      { ko: "하코네", en: "Hakone", lat: 35.2324, lng: 139.1064 },
      { ko: "가나자와(고마츠)", en: "Kanazawa (Komatsu)", lat: 36.5613, lng: 136.6562 },
      { ko: "도야마", en: "Toyama", lat: 36.6953, lng: 137.2113 },
      { ko: "마쓰야마", en: "Matsuyama", lat: 33.8393, lng: 132.7657 }
    ]
  },

  // 23. 🇯🇴 요르단
  {
    code: "JO",
    name: { ko: "요르단", en: "Jordan" },
    cities: [
      { ko: "암만", en: "Amman", lat: 31.9539, lng: 35.9106 },
      { ko: "페트라", en: "Petra", lat: 30.3285, lng: 35.4444 },
      { ko: "와디럼", en: "Wadi Rum", lat: 29.5328, lng: 35.4194 }
    ]
  },

  // 24. 🇨🇳 중국
  {
    code: "CN",
    name: { ko: "중국", en: "China" },
    cities: [
      { ko: "베이징", en: "Beijing", lat: 39.9042, lng: 116.4074 },
      { ko: "상하이", en: "Shanghai", lat: 31.2304, lng: 121.4737 },
      { ko: "광저우", en: "Guangzhou", lat: 23.1291, lng: 113.2644 },
      { ko: "선전", en: "Shenzhen", lat: 22.5431, lng: 114.0579 },
      { ko: "시안", en: "Xi’an", lat: 34.3416, lng: 108.9398 },
      { ko: "청두", en: "Chengdu", lat: 30.5728, lng: 104.0668 },
      { ko: "충칭", en: "Chongqing", lat: 29.5630, lng: 106.5516 },
      { ko: "항저우", en: "Hangzhou", lat: 30.2741, lng: 120.1551 },
      { ko: "쑤저우", en: "Suzhou", lat: 31.2989, lng: 120.5853 },
      { ko: "난징", en: "Nanjing", lat: 32.0603, lng: 118.7969 },
      { ko: "칭다오", en: "Qingdao", lat: 36.0671, lng: 120.3826 },
      { ko: "샤먼", en: "Xiamen", lat: 24.4798, lng: 118.0894 },
      { ko: "다롄", en: "Dalian", lat: 38.9140, lng: 121.6147 },
      { ko: "하얼빈", en: "Harbin", lat: 45.8038, lng: 126.5349 },
      { ko: "장자제", en: "Zhangjiajie", lat: 29.1171, lng: 110.4792 },
      { ko: "구이린", en: "Guilin", lat: 25.2736, lng: 110.2900 },
      { ko: "싼야", en: "Sanya", lat: 18.2528, lng: 109.5119 }
    ]
  },

  // 25. 🇨🇿 체코
  {
    code: "CZ",
    name: { ko: "체코", en: "Czechia" },
    cities: [
      { ko: "프라하", en: "Prague", lat: 50.0755, lng: 14.4378 },
      { ko: "체스키 크롬로프", en: "Český Krumlov", lat: 48.8127, lng: 14.3175 }
    ]
  },

  // 26. 🇰🇿 카자흐스탄
  {
    code: "KZ",
    name: { ko: "카자흐스탄", en: "Kazakhstan" },
    cities: [
      { ko: "알마티", en: "Almaty", lat: 43.2220, lng: 76.8512 },
      { ko: "아스타나(누르술탄)", en: "Astana (Nur-Sultan)", lat: 51.1605, lng: 71.4704 }
    ]
  },

  // 27. 🇨🇦 캐나다
  {
    code: "CA",
    name: { ko: "캐나다", en: "Canada" },
    cities: [
      { ko: "밴쿠버", en: "Vancouver", lat: 49.2827, lng: -123.1207 },
      { ko: "빅토리아", en: "Victoria", lat: 48.4284, lng: -123.3656 },
      { ko: "토론토", en: "Toronto", lat: 43.6532, lng: -79.3832 },
      { ko: "퀘벡시티", en: "Quebec City", lat: 46.8139, lng: -71.2080 },
      { ko: "몬트리올", en: "Montreal", lat: 45.5019, lng: -73.5674 },
      { ko: "오타와", en: "Ottawa", lat: 45.4215, lng: -75.6972 },
      { ko: "캘거리", en: "Calgary", lat: 51.0447, lng: -114.0719 },
      { ko: "에드먼턴", en: "Edmonton", lat: 53.5461, lng: -113.4938 },
      { ko: "밴프", en: "Banff", lat: 51.1784, lng: -115.5708 },
      { ko: "재스퍼", en: "Jasper", lat: 52.8734, lng: -118.0820 },
      { ko: "위슬러", en: "Whistler", lat: 50.1163, lng: -122.9574 },
      { ko: "핼리팩스", en: "Halifax", lat: 44.6488, lng: -63.5752 },
      { ko: "세인트존스", en: "St. John’s", lat: 47.5615, lng: -52.7126 },
      { ko: "레지나", en: "Regina", lat: 50.4452, lng: -104.6189 },
      { ko: "새스커툰", en: "Saskatoon", lat: 52.1579, lng: -106.6702 }
    ]
  },

  // 28. 🇹🇭 태국
  {
    code: "TH",
    name: { ko: "태국", en: "Thailand" },
    cities: [
      { ko: "방콕", en: "Bangkok", lat: 13.7563, lng: 100.5018 },
      { ko: "푸껫", en: "Phuket", lat: 7.8804, lng: 98.3923 },
      { ko: "치앙마이", en: "Chiang Mai", lat: 18.7061, lng: 98.9817 },
      { ko: "끄라비", en: "Krabi", lat: 8.0863, lng: 98.9063 },
      { ko: "코사무이", en: "Koh Samui", lat: 9.5120, lng: 100.0136 },
      { ko: "파타야", en: "Pattaya", lat: 12.9236, lng: 100.8825 }
    ]
  },

  // 29. 🇹🇷 튀르키예(터키)
  {
    code: "TR",
    name: { ko: "튀르키예(터키)", en: "Türkiye (Turkey)" },
    cities: [
      { ko: "이스탄불", en: "Istanbul", lat: 41.0082, lng: 28.9784 },
      { ko: "카파도키아(괴레메)", en: "Cappadocia (Göreme)", lat: 38.6431, lng: 34.8270 },
      { ko: "안탈리아", en: "Antalya", lat: 36.8969, lng: 30.7133 }
    ]
  },

  // 30. 🇵🇹 포르투갈
  {
    code: "PT",
    name: { ko: "포르투갈", en: "Portugal" },
    cities: [
      { ko: "리스본", en: "Lisbon", lat: 38.7223, lng: -9.1393 },
      { ko: "포르투", en: "Porto", lat: 41.1579, lng: -8.6291 },
      { ko: "신트라", en: "Sintra", lat: 38.8029, lng: -9.3817 },
      { ko: "파루(알가르브)", en: "Faro (Algarve)", lat: 37.0194, lng: -7.9304 }
    ]
  },

  // 31. 🇵🇭 필리핀
  {
    code: "PH",
    name: { ko: "필리핀", en: "Philippines" },
    cities: [
      { ko: "세부", en: "Cebu", lat: 10.3157, lng: 123.8854 },
      { ko: "마닐라", en: "Manila", lat: 14.5995, lng: 120.9842 },
      { ko: "보라카이(카티클란/칼리보)", en: "Boracay (Caticlan/Kalibo)", lat: 11.9674, lng: 121.9248 }
    ]
  },

  // 32. 🇦🇺 호주
  {
    code: "AU",
    name: { ko: "호주", en: "Australia" },
    cities: [
      { ko: "시드니", en: "Sydney", lat: -33.8688, lng: 151.2093 },
      { ko: "멜버른", en: "Melbourne", lat: -37.8136, lng: 144.9631 },
      { ko: "브리즈번", en: "Brisbane", lat: -27.4698, lng: 153.0251 },
      { ko: "골드코스트", en: "Gold Coast", lat: -28.0167, lng: 153.4000 },
      { ko: "케언즈", en: "Cairns", lat: -16.9186, lng: 145.7781 },
      { ko: "퍼스", en: "Perth", lat: -31.9523, lng: 115.8613 }
    ]
  }
];

export default TravelRegions;
