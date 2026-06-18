require('dotenv').config();
const { pool } = require('./pool');

const PROPERTIES = [
  { id:1,  name:'Хрущёвка',              location:'Москва, Россия',         icon:'🏢', minLvl:1,  cost:500,      incomeBase:0.5,    lat:55.7558,  lng:37.6173  },
  { id:2,  name:'Уличный ларёк',          location:'Стамбул, Турция',        icon:'🏪', minLvl:1,  cost:300,      incomeBase:0.3,    lat:41.0082,  lng:28.9784  },
  { id:3,  name:'Студия в Берлине',       location:'Берлин, Германия',       icon:'🏠', minLvl:1,  cost:800,      incomeBase:0.8,    lat:52.5200,  lng:13.4050  },
  { id:4,  name:'Рыбный рынок',           location:'Токио, Япония',          icon:'🐟', minLvl:1,  cost:700,      incomeBase:0.7,    lat:35.6762,  lng:139.6503 },
  { id:5,  name:'Квартира в Барселоне',   location:'Барселона, Испания',     icon:'🏘️', minLvl:2,  cost:1500,     incomeBase:1.5,    lat:41.3851,  lng:2.1734   },
  { id:6,  name:'Лавка специй',           location:'Дубай, ОАЭ',             icon:'🫙', minLvl:2,  cost:1200,     incomeBase:1.2,    lat:25.2048,  lng:55.2708  },
  { id:7,  name:'Офис в Сити',            location:'Лондон, Великобритания', icon:'🏦', minLvl:3,  cost:5000,     incomeBase:5.0,    lat:51.5074,  lng:-0.1278  },
  { id:8,  name:'Пентхаус на Манхэттене', location:'Нью-Йорк, США',         icon:'🌆', minLvl:3,  cost:8000,     incomeBase:8.0,    lat:40.7128,  lng:-74.0060 },
  { id:9,  name:'Ресторан в Париже',      location:'Париж, Франция',         icon:'🥐', minLvl:3,  cost:4500,     incomeBase:4.5,    lat:48.8566,  lng:2.3522   },
  { id:10, name:'Торговый центр',         location:'Шанхай, Китай',          icon:'🛍️', minLvl:4,  cost:12000,    incomeBase:12.0,   lat:31.2304,  lng:121.4737 },
  { id:11, name:'Отель в Майами',         location:'Майами, США',            icon:'🏖️', minLvl:4,  cost:15000,    incomeBase:15.0,   lat:25.7617,  lng:-80.1918 },
  { id:12, name:'Небоскрёб Бурдж',        location:'Дубай, ОАЭ',             icon:'🗼', minLvl:5,  cost:50000,    incomeBase:50.0,   lat:25.1972,  lng:55.2744  },
  { id:13, name:'Казино в Лас-Вегасе',    location:'Лас-Вегас, США',        icon:'🎰', minLvl:5,  cost:80000,    incomeBase:80.0,   lat:36.1699,  lng:-115.1398},
  { id:14, name:'Завод в Мюнхене',        location:'Мюнхен, Германия',       icon:'🏭', minLvl:6,  cost:60000,    incomeBase:60.0,   lat:48.1351,  lng:11.5820  },
  { id:15, name:'Квартал в Токио',        location:'Синдзюку, Япония',       icon:'🗾', minLvl:6,  cost:100000,   incomeBase:100.0,  lat:35.6938,  lng:139.7034 },
  { id:16, name:'Дворец в Монако',        location:'Монако',                 icon:'🏰', minLvl:7,  cost:300000,   incomeBase:300.0,  lat:43.7384,  lng:7.4246   },
  { id:17, name:'Острова Мальдивы',       location:'Мальдивы',               icon:'🏝️', minLvl:7,  cost:500000,   incomeBase:500.0,  lat:4.1755,   lng:73.5093  },
  { id:18, name:'Порт Гонконга',          location:'Гонконг',                icon:'⚓', minLvl:8,  cost:800000,   incomeBase:800.0,  lat:22.3193,  lng:114.1694 },
  { id:19, name:'Район Уолл-стрит',       location:'Нью-Йорк, США',         icon:'💹', minLvl:8,  cost:1000000,  incomeBase:1000.0, lat:40.7069,  lng:-74.0089 },
  { id:20, name:'Эйфелева башня',         location:'Париж, Франция',         icon:'🗽', minLvl:10, cost:5000000,  incomeBase:5000.0, lat:48.8584,  lng:2.2945   },
  { id:21, name:'Таймс-сквер',            location:'Нью-Йорк, США',         icon:'🌟', minLvl:10, cost:8000000,  incomeBase:8000.0, lat:40.7580,  lng:-73.9855 },
  { id:22, name:'Биг Бен',               location:'Лондон, Великобритания', icon:'🕰️', minLvl:12, cost:12000000, incomeBase:12000.0,lat:51.5007,  lng:-0.1246  },
  { id:23, name:'Сиднейская опера',       location:'Сидней, Австралия',      icon:'🎭', minLvl:12, cost:10000000, incomeBase:10000.0,lat:-33.8568, lng:151.2153 },
  { id:24, name:'Тяньаньмэнь',           location:'Пекин, Китай',           icon:'🏯', minLvl:15, cost:50000000, incomeBase:50000.0,lat:39.9042,  lng:116.4074 },
  { id:25, name:'Кремль',                location:'Москва, Россия',         icon:'🔴', minLvl:18, cost:200000000,incomeBase:200000.0,lat:55.7520, lng:37.6175  },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding properties…');
    for (const p of PROPERTIES) {
      await client.query(`
        INSERT INTO properties (id, name, location, icon, min_level, cost, income_base, lat, lng)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET
          name        = EXCLUDED.name,
          location    = EXCLUDED.location,
          icon        = EXCLUDED.icon,
          min_level   = EXCLUDED.min_level,
          cost        = EXCLUDED.cost,
          income_base = EXCLUDED.income_base,
          lat         = EXCLUDED.lat,
          lng         = EXCLUDED.lng
      `, [p.id, p.name, p.location, p.icon, p.minLvl, p.cost, p.incomeBase, p.lat, p.lng]);
    }
    console.log(`✅ Seeded ${PROPERTIES.length} properties.`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
