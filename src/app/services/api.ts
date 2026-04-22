/**
 * API Service Layer — connects to the local Express + MySQL backend
 *
 * Backend lives in /backend/  →  run:
 *   cd backend && npm install && cp .env.example .env
 *   (edit .env with your MySQL credentials)
 *   npm run dev
 *
 * The backend will start on http://localhost:3001
 */

export const BASE_URL = "http://localhost:3001/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountType = "driver" | "commuter";

export interface User {
  id: number;
  name: string;
  email: string;
  accountType: AccountType;
}

export interface Route {
  id: number;
  name: string;
  designation: string;
  startPoint: string;
  endPoint: string;
  fare: number;
  type: "jeepney" | "bus" | "taxi" | "train";
  waypoints: [number, number][];
}

export interface Vehicle {
  id: number;
  driverId: number;
  routeId: number;
  type: "jeepney" | "bus" | "taxi";
  plateNo: string;
  seatsTotal: number;
  seatsOccupied: number;
  lat: number;
  lng: number;
}

export interface TrafficSegment {
  id: number;
  name: string;
  level: "clear" | "moderate" | "heavy";
  latStart: number;
  lngStart: number;
  latEnd: number;
  lngEnd: number;
}

// ─── Driver vehicle / fuel types ──────────────────────────────────────────────

export type FuelType = "gasoline" | "diesel" | "premium" | "lpg" | "electric";

export interface UserVehicle {
  id?: number;
  userId: number;
  make: string;
  model: string;
  year: number;
  engineType: string;
  fuelType: FuelType;
  mileage: number;    // L/100km city average
  tankMax: number;    // liters
  tankCurrent: number;// liters
  isManual: boolean;
}

export interface FuelLog {
  id?: number;
  userId: number;
  litersAdded: number;
  pricePerL: number;
  totalCost: number;
  odometerKm?: number;
  notes?: string;
  loggedAt?: string;
}

export interface FuelPrice {
  fuelType: string;
  pricePerLiter: number;
  effectiveDate: string;
  lastUpdated: string;
  confidence: string;
  source?: string;
}

// ─── Fallback mock data (used when backend is unreachable) ────────────────────

const MOCK_ROUTES: Route[] = [
  // ── Jeepney Routes ─────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Urgello to Parkmall",
    designation: "01K",
    startPoint: "Urgello",
    endPoint: "Parkmall",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.30464,123.89242],[10.30459,123.89244],[10.30433,123.89254],[10.30424,123.89258],[10.30422,123.89258],[10.30391,123.89271],[10.30351,123.89286],[10.30324,123.89291],[10.30289,123.89295],[10.30250,123.89301],
      [10.30236,123.89302],[10.30205,123.89310],[10.30163,123.89321],[10.30117,123.89335],[10.30062,123.89353],[10.30009,123.89382],[10.29998,123.89384],[10.29991,123.89386],[10.29974,123.89390],[10.29961,123.89392],
      [10.29947,123.89392],[10.29931,123.89391],[10.29924,123.89387],[10.29910,123.89442],[10.29902,123.89494],[10.29892,123.89544],[10.29886,123.89555],[10.29884,123.89556],[10.29882,123.89557],[10.29880,123.89558],
      [10.29859,123.89564],[10.29800,123.89581],[10.29774,123.89589],[10.29729,123.89602],[10.29639,123.89627],[10.29570,123.89645],[10.29547,123.89652],[10.29601,123.89784],[10.29609,123.89797],[10.29613,123.89803],
      [10.29621,123.89816],[10.29626,123.89823],[10.29630,123.89830],[10.29674,123.89903],[10.29687,123.89929],[10.29745,123.90024],[10.29748,123.90028],[10.29749,123.90031],[10.29760,123.90059],[10.29761,123.90063],
      [10.29769,123.90094],[10.29774,123.90126],[10.29779,123.90170],[10.29779,123.90175],[10.29779,123.90180],[10.29780,123.90184],[10.29780,123.90189],[10.29780,123.90203],[10.29788,123.90282],[10.29791,123.90309],
      [10.29794,123.90337],[10.29797,123.90373],[10.29821,123.90371],[10.29840,123.90370],[10.29854,123.90373],[10.29876,123.90377],[10.29862,123.90462],[10.29856,123.90497],[10.29850,123.90533],[10.29845,123.90564],
      [10.29834,123.90606],[10.29854,123.90610],[10.29866,123.90612],[10.29990,123.90633],[10.30000,123.90635],[10.30027,123.90639],[10.30129,123.90654],[10.30153,123.90655],[10.30178,123.90656],[10.30193,123.90655],
      [10.30207,123.90655],[10.30215,123.90654],[10.30225,123.90653],[10.30286,123.90645],[10.30343,123.90636],[10.30369,123.90631],[10.30409,123.90626],[10.30464,123.90617],[10.30492,123.90615],[10.30560,123.90611],
      [10.30572,123.90611],[10.30618,123.90613],[10.30640,123.90614],[10.30649,123.90620],[10.30665,123.90623],[10.30680,123.90625],[10.30698,123.90628],[10.30713,123.90632],[10.30728,123.90638],[10.30742,123.90645],
      [10.30759,123.90654],[10.30777,123.90665],[10.30785,123.90670],[10.30796,123.90676],[10.30807,123.90682],[10.30813,123.90685],[10.30831,123.90691],[10.30845,123.90700],[10.30853,123.90716],[10.30853,123.90718],
      [10.30854,123.90720],[10.30854,123.90722],[10.30855,123.90725],[10.30855,123.90727],[10.30856,123.90729],[10.30856,123.90733],[10.30819,123.90798],[10.30814,123.90807],[10.30781,123.90859],[10.30778,123.90863],
      [10.30742,123.90930],[10.30710,123.90977],[10.30694,123.90991],[10.30643,123.91033],[10.30641,123.91031],[10.30622,123.91008],[10.30600,123.90983],[10.30582,123.90965],[10.30572,123.90957],[10.30563,123.90949],
      [10.30549,123.90940],[10.30530,123.90933],[10.30525,123.90931],[10.30487,123.90917],[10.30474,123.90941],[10.30470,123.90948],[10.30463,123.90956],[10.30449,123.90974],[10.30481,123.90988],[10.30488,123.90992],
      [10.30494,123.90997],[10.30501,123.91003],[10.30521,123.91027],[10.30524,123.91030],[10.30558,123.91072],[10.30570,123.91086],[10.30572,123.91095],[10.30578,123.91103],[10.30586,123.91096],[10.30718,123.90985],
      [10.30752,123.91029],[10.30777,123.91060],[10.30783,123.91067],[10.30922,123.91236],[10.31077,123.91429],[10.31222,123.91605],[10.31228,123.91622],[10.31236,123.91631],[10.31254,123.91652],[10.31281,123.91684],
      [10.31288,123.91687],[10.31293,123.91694],[10.31346,123.91758],[10.31351,123.91764],[10.31365,123.91781],[10.31422,123.91848],[10.31428,123.91857],[10.31431,123.91865],[10.31433,123.91870],[10.31432,123.91876],
      [10.31430,123.91893],[10.31418,123.91960],[10.31406,123.92018],[10.31388,123.92051],[10.31380,123.92063],[10.31372,123.92074],[10.31319,123.92125],[10.31287,123.92150],[10.31280,123.92157],[10.31285,123.92163],
      [10.31325,123.92209],[10.31349,123.92235],[10.31370,123.92255],[10.31389,123.92272],[10.31419,123.92296],[10.31436,123.92310],[10.31460,123.92329],[10.31510,123.92370],[10.31553,123.92403],[10.31568,123.92416],
      [10.31612,123.92450],[10.31619,123.92455],[10.31641,123.92469],[10.31682,123.92494],[10.31686,123.92496],[10.31712,123.92509],[10.31747,123.92525],[10.31792,123.92542],[10.31799,123.92544],[10.31835,123.92556],
      [10.31851,123.92561],[10.31884,123.92572],[10.31891,123.92574],[10.31946,123.92592],[10.31970,123.92599],[10.31978,123.92601],[10.32001,123.92604],[10.32014,123.92606],[10.32019,123.92606],[10.32041,123.92606],
      [10.32053,123.92627],[10.32054,123.92629],[10.32056,123.92634],[10.32063,123.92647],[10.32064,123.92649],[10.32067,123.92661],[10.32070,123.92677],[10.32071,123.92690],[10.32071,123.92704],[10.32070,123.92719],
      [10.32067,123.92735],[10.32063,123.92749],[10.32057,123.92768],[10.32046,123.92793],[10.32002,123.92899],[10.31998,123.92912],[10.31940,123.93052],[10.31933,123.93069],[10.31924,123.93088],[10.31920,123.93095],
      [10.31909,123.93114],[10.31905,123.93121],[10.31884,123.93155],[10.31893,123.93163],[10.31974,123.93239],[10.32100,123.93355],[10.32137,123.93392],[10.32283,123.93522],[10.32366,123.93459],[10.32481,123.93607],
      [10.32489,123.93617],[10.32502,123.93606],[10.32527,123.93586],[10.32579,123.93543],[10.32643,123.93495],[10.32672,123.93473],[10.32681,123.93463],[10.32675,123.93457],[10.32637,123.93405],[10.32600,123.93358],
      [10.32594,123.93351],[10.32590,123.93346],[10.32513,123.93249],[10.32504,123.93238],[10.32477,123.93209],[10.32457,123.93192],[10.32425,123.93167],[10.32384,123.93140],[10.32316,123.93096],[10.32256,123.93058],
      [10.32234,123.93045],[10.32226,123.93039],[10.32181,123.93012],[10.32162,123.93001],[10.32121,123.92973],[10.32081,123.92949],[10.32014,123.92905],[10.32050,123.92818],[10.32070,123.92768],[10.32077,123.92744],
      [10.32081,123.92728],[10.32083,123.92713],[10.32083,123.92694],[10.32083,123.92679],[10.32079,123.92660],[10.32074,123.92644],[10.32074,123.92643],[10.32070,123.92631],[10.32058,123.92605],[10.32081,123.92599],
      [10.32103,123.92593],[10.32101,123.92586],[10.32091,123.92590],[10.32089,123.92591],[10.32077,123.92593],[10.32055,123.92596],[10.32047,123.92597],[10.32041,123.92597],[10.32034,123.92598],[10.32018,123.92598],
      [10.32006,123.92596],[10.32002,123.92596],[10.31983,123.92593],[10.31978,123.92592],[10.31971,123.92590],[10.31957,123.92587],[10.31948,123.92583],[10.31916,123.92573],[10.31894,123.92566],[10.31861,123.92555],
      [10.31853,123.92553],[10.31808,123.92537],[10.31803,123.92535],[10.31781,123.92528],[10.31744,123.92513],[10.31704,123.92495],[10.31689,123.92487],[10.31651,123.92465],[10.31602,123.92432],[10.31574,123.92410],
      [10.31559,123.92399],[10.31513,123.92360],[10.31465,123.92322],[10.31452,123.92313],[10.31414,123.92282],[10.31394,123.92265],[10.31382,123.92256],[10.31360,123.92234],[10.31322,123.92193],[10.31287,123.92150],
      [10.31319,123.92125],[10.31372,123.92074],[10.31380,123.92063],[10.31388,123.92051],[10.31406,123.92018],[10.31418,123.91960],[10.31430,123.91893],[10.31432,123.91876],[10.31433,123.91870],[10.31431,123.91865],
      [10.31428,123.91857],[10.31422,123.91848],[10.31365,123.91781],[10.31351,123.91764],[10.31346,123.91758],[10.31293,123.91694],[10.31288,123.91687],[10.31287,123.91682],[10.31287,123.91681],[10.31286,123.91679],
      [10.31244,123.91626],[10.31236,123.91613],[10.31222,123.91605],[10.31077,123.91429],[10.30922,123.91236],[10.30783,123.91067],[10.30777,123.91060],[10.30752,123.91029],[10.30718,123.90985],[10.30710,123.90977],
      [10.30694,123.90991],[10.30643,123.91033],[10.30641,123.91031],[10.30622,123.91008],[10.30600,123.90983],[10.30582,123.90965],[10.30572,123.90957],[10.30563,123.90949],[10.30549,123.90940],[10.30530,123.90933],
      [10.30525,123.90931],[10.30487,123.90917],[10.30427,123.90898],[10.30350,123.90873],[10.30346,123.90872],[10.30309,123.90859],[10.30306,123.90858],[10.30266,123.90843],[10.30255,123.90840],[10.30246,123.90838],
      [10.30240,123.90837],[10.30233,123.90836],[10.30225,123.90837],[10.30216,123.90840],[10.30205,123.90845],[10.30199,123.90847],[10.30193,123.90846],[10.30195,123.90785],[10.30197,123.90735],[10.30193,123.90655],
      [10.30178,123.90656],[10.30153,123.90655],[10.30129,123.90654],[10.30027,123.90639],[10.30000,123.90635],[10.29990,123.90633],[10.29866,123.90612],[10.29854,123.90610],[10.29834,123.90606],[10.29757,123.90591],
      [10.29698,123.90578],[10.29650,123.90567],[10.29669,123.90517],[10.29687,123.90481],[10.29705,123.90434],[10.29712,123.90415],[10.29718,123.90398],[10.29718,123.90396],[10.29719,123.90394],[10.29719,123.90392],
      [10.29720,123.90390],[10.29720,123.90379],[10.29709,123.90316],[10.29691,123.90217],[10.29690,123.90165],[10.29690,123.90155],[10.29688,123.90140],[10.29685,123.90128],[10.29684,123.90126],[10.29679,123.90108],
      [10.29661,123.90067],[10.29642,123.90027],[10.29641,123.90025],[10.29631,123.90007],[10.29628,123.90002],[10.29674,123.89903],[10.29771,123.89854],[10.29775,123.89852],[10.29779,123.89850],[10.29819,123.89831],
      [10.29793,123.89782],[10.29776,123.89750],[10.29772,123.89741],[10.29729,123.89602],[10.29774,123.89589],[10.29800,123.89581],[10.29859,123.89564],[10.29880,123.89558],[10.29882,123.89557],[10.29884,123.89556],
      [10.29886,123.89555],[10.29892,123.89544],[10.29902,123.89494],[10.29910,123.89442],[10.29924,123.89387],[10.29931,123.89391],[10.29947,123.89392],[10.29961,123.89392],[10.29974,123.89390],[10.29991,123.89386],
      [10.29998,123.89384],[10.30009,123.89382],[10.30062,123.89353],[10.30117,123.89335],[10.30163,123.89321],[10.30205,123.89310],[10.30236,123.89302],[10.30250,123.89301],[10.30289,123.89295],[10.30324,123.89291],
      [10.30347,123.89286],[10.30351,123.89286],[10.30353,123.89306],[10.30356,123.89319],[10.30358,123.89331],[10.30380,123.89326],[10.30437,123.89312],[10.30446,123.89310],[10.30492,123.89304],[10.30488,123.89290],
      [10.30471,123.89239],
    ],
  },
  {
    id: 2,
    name: "Carbon to SM City",
    designation: "04C",
    startPoint: "Carbon Market",
    endPoint: "SM City Cebu",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.2922, 123.9012], [10.2940, 123.9018], [10.2960, 123.9022],
      [10.2985, 123.9030], [10.3010, 123.9050], [10.3040, 123.9075],
      [10.3065, 123.9100], [10.3085, 123.9135], [10.3100, 123.9160],
      [10.3116, 123.9185],
    ],
  },
  {
    id: 3,
    name: "Carbon to Talamban",
    designation: "17B",
    startPoint: "Carbon Market",
    endPoint: "Talamban",
    fare: 15,
    type: "jeepney",
    waypoints: [
      [10.2922, 123.9012], [10.2940, 123.9015], [10.2965, 123.9010],
      [10.3000, 123.8990], [10.3045, 123.8968], [10.3100, 123.8958],
      [10.3155, 123.8958], [10.3200, 123.8985], [10.3250, 123.9018],
      [10.3290, 123.9030], [10.3350, 123.9048], [10.3410, 123.9068],
      [10.3480, 123.9085], [10.3580, 123.9098], [10.3671, 123.9103],
    ],
  },
  {
    id: 4,
    name: "Bulacao to Carbon",
    designation: "10C",
    startPoint: "Bulacao",
    endPoint: "Carbon Market",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.2700, 123.8750], [10.2728, 123.8768], [10.2758, 123.8795],
      [10.2790, 123.8820], [10.2820, 123.8843], [10.2852, 123.8858],
      [10.2878, 123.8868], [10.2903, 123.8878], [10.2922, 123.8895],
      [10.2930, 123.8925], [10.2933, 123.8960], [10.2937, 123.9009],
      [10.2922, 123.9012],
    ],
  },
  {
    id: 5,
    name: "Talisay to Carbon",
    designation: "06H",
    startPoint: "Talisay City",
    endPoint: "Carbon Market",
    fare: 17,
    type: "jeepney",
    waypoints: [
      [10.2444, 123.8456], [10.2490, 123.8498], [10.2535, 123.8535],
      [10.2575, 123.8572], [10.2615, 123.8612], [10.2653, 123.8650],
      [10.2692, 123.8693], [10.2730, 123.8728], [10.2763, 123.8768],
      [10.2797, 123.8808], [10.2820, 123.8832], [10.2855, 123.8855],
      [10.2882, 123.8868], [10.2905, 123.8878], [10.2930, 123.8930],
      [10.2933, 123.8975], [10.2937, 123.9009], [10.2922, 123.9012],
    ],
  },
  {
    id: 6,
    name: "Talamban to SM City",
    designation: "02B",
    startPoint: "Talamban",
    endPoint: "SM City Cebu",
    fare: 15,
    type: "jeepney",
    waypoints: [
      [10.3671, 123.9103], [10.3580, 123.9098], [10.3480, 123.9085],
      [10.3410, 123.9068], [10.3350, 123.9048], [10.3290, 123.9030],
      [10.3250, 123.9018], [10.3200, 123.8985], [10.3155, 123.8958],
      [10.3140, 123.8985], [10.3155, 123.9015], [10.3175, 123.9050],
      [10.3116, 123.9185],
    ],
  },
  {
    id: 7,
    name: "Mandaue to Carbon",
    designation: "11B",
    startPoint: "Mandaue City",
    endPoint: "Carbon Market",
    fare: 17,
    type: "jeepney",
    waypoints: [
      [10.3236, 123.9448], [10.3290, 123.9418], [10.3360, 123.9388],
      [10.3430, 123.9368], [10.3517, 123.9358], [10.3455, 123.9305],
      [10.3385, 123.9255], [10.3310, 123.9205], [10.3230, 123.9160],
      [10.3185, 123.9054], [10.3145, 123.9010], [10.3105, 123.8965],
      [10.3060, 123.8958], [10.3010, 123.8968], [10.2968, 123.8985],
      [10.2945, 123.8998], [10.2937, 123.9009], [10.2922, 123.9012],
    ],
  },
  {
    id: 8,
    name: "IT Park to Carbon",
    designation: "17C",
    startPoint: "Cebu IT Park",
    endPoint: "Carbon Market",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.3277, 123.9055], [10.3242, 123.9055], [10.3205, 123.9050],
      [10.3170, 123.9042], [10.3140, 123.9018], [10.3115, 123.8988],
      [10.3090, 123.8962], [10.3060, 123.8958], [10.3030, 123.8958],
      [10.3000, 123.8960], [10.2975, 123.8968], [10.2958, 123.8982],
      [10.2945, 123.8998], [10.2937, 123.9009], [10.2922, 123.9012],
    ],
  },
  {
    id: 9,
    name: "Banilad to Carbon",
    designation: "22G",
    startPoint: "Banilad",
    endPoint: "Carbon Market",
    fare: 15,
    type: "jeepney",
    waypoints: [
      [10.3373, 123.9000], [10.3335, 123.8992], [10.3295, 123.8985],
      [10.3255, 123.8980], [10.3215, 123.8975], [10.3178, 123.8967],
      [10.3145, 123.8958], [10.3110, 123.8950], [10.3075, 123.8948],
      [10.3040, 123.8948], [10.3010, 123.8952], [10.2980, 123.8960],
      [10.2958, 123.8972], [10.2945, 123.8988], [10.2937, 123.9009],
      [10.2922, 123.9012],
    ],
  },
  {
    id: 10,
    name: "Basak to Carbon",
    designation: "42C",
    startPoint: "Basak",
    endPoint: "Carbon Market",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.2833, 123.8867], [10.2845, 123.8882], [10.2856, 123.8900],
      [10.2868, 123.8920], [10.2879, 123.8940], [10.2892, 123.8958],
      [10.2905, 123.8972], [10.2918, 123.8990], [10.2928, 123.9002],
      [10.2937, 123.9009], [10.2922, 123.9012],
    ],
  },
  {
    id: 11,
    name: "Mambaling to Colon",
    designation: "62C",
    startPoint: "Mambaling",
    endPoint: "Colon Street",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.2700, 123.8900], [10.2718, 123.8910], [10.2740, 123.8922],
      [10.2763, 123.8935], [10.2790, 123.8950], [10.2818, 123.8965],
      [10.2845, 123.8978], [10.2868, 123.8990], [10.2893, 123.9000],
      [10.2918, 123.9006], [10.2937, 123.9009],
    ],
  },
  {
    id: 12,
    name: "Punta Princesa to Carbon",
    designation: "04G",
    startPoint: "Punta Princesa",
    endPoint: "Carbon Market",
    fare: 13,
    type: "jeepney",
    waypoints: [
      [10.3011, 123.8756], [10.3012, 123.8792], [10.3014, 123.8835],
      [10.3016, 123.8875], [10.3018, 123.8912], [10.3020, 123.8942],
      [10.2998, 123.8958], [10.2975, 123.8970], [10.2955, 123.8982],
      [10.2942, 123.8998], [10.2937, 123.9009], [10.2922, 123.9012],
    ],
  },
  // ── Bus Routes ──────────────────────────────────────────────────────────────
  {
    id: 13,
    name: "South Terminal to North Terminal",
    designation: "B-01",
    startPoint: "South Bus Terminal",
    endPoint: "North Bus Terminal",
    fare: 25,
    type: "bus",
    waypoints: [
      [10.2803, 123.8827], [10.2838, 123.8840], [10.2872, 123.8853],
      [10.2908, 123.8867], [10.2945, 123.8885], [10.2978, 123.8902],
      [10.3012, 123.8918], [10.3048, 123.8935], [10.3088, 123.8942],
      [10.3118, 123.8958], [10.3148, 123.8972], [10.3178, 123.9010],
      [10.3200, 123.9045], [10.3250, 123.9072], [10.3340, 123.9095],
      [10.3440, 123.9102], [10.3550, 123.9108],
    ],
  },
  {
    id: 14,
    name: "Ayala to Mactan Airport",
    designation: "B-02",
    startPoint: "Ayala Center Cebu",
    endPoint: "Mactan Airport",
    fare: 35,
    type: "bus",
    waypoints: [
      [10.3185, 123.9054], [10.3165, 123.9082], [10.3145, 123.9128],
      [10.3125, 123.9180], [10.3190, 123.9240], [10.3275, 123.9270],
      [10.3240, 123.9355], [10.3200, 123.9440], [10.3155, 123.9520],
      [10.3110, 123.9610], [10.3085, 123.9690], [10.3074, 123.9755],
      [10.3074, 123.9797],
    ],
  },
  {
    id: 15,
    name: "North Terminal to Mandaue",
    designation: "B-03",
    startPoint: "North Bus Terminal",
    endPoint: "Mandaue City",
    fare: 20,
    type: "bus",
    waypoints: [
      [10.3550, 123.9108], [10.3542, 123.9152], [10.3533, 123.9205],
      [10.3524, 123.9258], [10.3517, 123.9305], [10.3488, 123.9338],
      [10.3455, 123.9355], [10.3418, 123.9368], [10.3382, 123.9390],
      [10.3345, 123.9412], [10.3305, 123.9430], [10.3268, 123.9442],
      [10.3236, 123.9448],
    ],
  },
];

const MOCK_TRAFFIC: TrafficSegment[] = [
  { id: 1, name: "Colon Street",      level: "heavy",    latStart: 10.2922, lngStart: 123.9000, latEnd: 10.2980, lngEnd: 123.9030 },
  { id: 2, name: "Osmeña Blvd",       level: "moderate", latStart: 10.2980, lngStart: 123.8930, latEnd: 10.3100, lngEnd: 123.8950 },
  { id: 3, name: "N. Bacalso Ave",    level: "clear",    latStart: 10.2700, lngStart: 123.8750, latEnd: 10.2900, lngEnd: 123.8880 },
  { id: 4, name: "Jones Avenue",      level: "moderate", latStart: 10.2950, lngStart: 123.8960, latEnd: 10.3185, lngEnd: 123.9054 },
  { id: 5, name: "N. Escario Street", level: "clear",    latStart: 10.3000, lngStart: 123.9060, latEnd: 10.3116, lngEnd: 123.9185 },
  { id: 6, name: "Mandaue Bridge",    level: "heavy",    latStart: 10.3300, lngStart: 123.9270, latEnd: 10.3400, lngEnd: 123.9350 },
];

const MOCK_VEHICLES: Vehicle[] = [
  { id:  1, driverId: 1, routeId:  1, type: "jeepney", plateNo: "ABC-1234", seatsTotal: 16, seatsOccupied:  9, lat: 10.3000, lng: 123.9060 },
  { id:  2, driverId: 2, routeId:  2, type: "jeepney", plateNo: "DEF-5678", seatsTotal: 16, seatsOccupied:  3, lat: 10.2980, lng: 123.9020 },
  { id:  3, driverId: 3, routeId:  3, type: "jeepney", plateNo: "GHI-9012", seatsTotal: 16, seatsOccupied: 12, lat: 10.3185, lng: 123.9054 },
  { id:  4, driverId: 1, routeId:  4, type: "jeepney", plateNo: "JKL-3456", seatsTotal: 16, seatsOccupied:  7, lat: 10.2850, lng: 123.8850 },
  { id:  5, driverId: 2, routeId:  5, type: "jeepney", plateNo: "MNO-7890", seatsTotal: 16, seatsOccupied: 14, lat: 10.2650, lng: 123.8680 },
  { id:  6, driverId: 3, routeId:  6, type: "jeepney", plateNo: "PQR-1234", seatsTotal: 16, seatsOccupied:  5, lat: 10.3450, lng: 123.9080 },
  { id:  7, driverId: 1, routeId:  7, type: "jeepney", plateNo: "STU-5678", seatsTotal: 16, seatsOccupied: 11, lat: 10.3300, lng: 123.9350 },
  { id:  8, driverId: 2, routeId:  8, type: "jeepney", plateNo: "VWX-9012", seatsTotal: 16, seatsOccupied:  6, lat: 10.3185, lng: 123.9054 },
  { id:  9, driverId: 3, routeId:  9, type: "jeepney", plateNo: "YZA-3456", seatsTotal: 16, seatsOccupied:  8, lat: 10.3261, lng: 123.8978 },
  { id: 10, driverId: 1, routeId: 10, type: "jeepney", plateNo: "BCD-7890", seatsTotal: 16, seatsOccupied:  2, lat: 10.2833, lng: 123.8867 },
  { id: 11, driverId: 2, routeId: 11, type: "jeepney", plateNo: "EFG-1234", seatsTotal: 16, seatsOccupied: 10, lat: 10.2750, lng: 123.8930 },
  { id: 12, driverId: 3, routeId: 12, type: "jeepney", plateNo: "HIJ-5678", seatsTotal: 16, seatsOccupied:  4, lat: 10.3011, lng: 123.8820 },
  { id: 13, driverId: 1, routeId: 13, type: "bus",     plateNo: "BUS-0001", seatsTotal: 50, seatsOccupied: 35, lat: 10.3100, lng: 123.8940 },
  { id: 14, driverId: 2, routeId: 14, type: "bus",     plateNo: "BUS-0002", seatsTotal: 50, seatsOccupied: 28, lat: 10.3200, lng: 123.9400 },
  { id: 15, driverId: 3, routeId: 15, type: "bus",     plateNo: "BUS-0003", seatsTotal: 50, seatsOccupied: 19, lat: 10.3517, lng: 123.9358 },
];

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // Abort after 2.5 s so the preview never hangs waiting for a backend
  // that isn't running — it falls straight through to the mock-data layer.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
      signal: controller.signal, // placed after spread so it always wins
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    // Normalise abort/timeout into TypeError so isNetworkError() catches it
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new TypeError("Request timed out — backend unreachable");
    }
    throw err;
  }
}

/** Returns true when the error is a network failure (backend unreachable),
 *  false when the backend responded with an HTTP error (4xx / 5xx). */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

/** Logs a consistent fallback warning with the actual reason. */
function warnFallback(resource: string, err: unknown): void {
  const reason = isNetworkError(err)
    ? "backend unreachable (is the server running?)"
    : `backend error — ${(err as Error).message}`;
  console.info(`[API] Using mock ${resource}: ${reason}`);
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  async login(email: string, password: string): Promise<User> {
    try {
      return await apiFetch<User>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      warnFallback("login", err);
      const accountType: AccountType =
        email.startsWith("puvpuj") ? "driver" :
        email.startsWith("private") ? "driver" : "commuter";
      return { id: 1, name: email.split("@")[0], email, accountType };
    }
  },

  async register(name: string, email: string, password: string, accountType: AccountType): Promise<User> {
    try {
      return await apiFetch<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, accountType }),
      });
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      warnFallback("register", err);
      return { id: Date.now(), name, email, accountType };
    }
  },
};

// ─── Routes API ───────────────────────────────────────────────────────────────

export const routesApi = {
  async getAll(): Promise<Route[]> {
    try {
      return await apiFetch<Route[]>("/routes");
    } catch (err) {
      warnFallback("routes", err);
      return MOCK_ROUTES;
    }
  },

  async getByType(type: Route["type"]): Promise<Route[]> {
    try {
      return await apiFetch<Route[]>(`/routes/${type}`);
    } catch (err) {
      warnFallback("routes", err);
      return MOCK_ROUTES.filter((r) => r.type === type);
    }
  },
};

// ─── Traffic API ──────────────────────────────────────────────────────────────

export const trafficApi = {
  async getCurrent(): Promise<TrafficSegment[]> {
    try {
      return await apiFetch<TrafficSegment[]>("/traffic");
    } catch (err) {
      warnFallback("traffic", err);
      return MOCK_TRAFFIC;
    }
  },
};

// ─── Vehicles API ─────────────────────────────────────────────────────────────

export const vehiclesApi = {
  async getAll(): Promise<Vehicle[]> {
    try {
      return await apiFetch<Vehicle[]>("/vehicles");
    } catch (err) {
      warnFallback("vehicles", err);
      return MOCK_VEHICLES;
    }
  },

  async updateSeats(vehicleId: number, seatsOccupied: number): Promise<void> {
    try {
      await apiFetch(`/vehicles/${vehicleId}/seats`, {
        method: "PUT",
        body: JSON.stringify({ seatsOccupied }),
      });
    } catch (err) {
      warnFallback("seat update", err);
    }
  },

  async updateLocation(vehicleId: number, lat: number, lng: number): Promise<void> {
    try {
      await apiFetch(`/vehicles/${vehicleId}/location`, {
        method: "PUT",
        body: JSON.stringify({ lat, lng }),
      });
    } catch (err) {
      warnFallback("location update", err);
    }
  },
};

// ─── User Vehicle API ─────────────────────────────────────────────────────────

export const userVehicleApi = {
  async get(userId: number): Promise<UserVehicle | null> {
    try {
      return await apiFetch<UserVehicle | null>(`/user-vehicle?userId=${userId}`);
    } catch (err) {
      warnFallback("user vehicle", err);
      return null;
    }
  },

  async save(vehicle: UserVehicle): Promise<UserVehicle> {
    try {
      return await apiFetch<UserVehicle>("/user-vehicle", {
        method: "PUT",
        body: JSON.stringify(vehicle),
      });
    } catch (err) {
      warnFallback("vehicle save", err);
      return vehicle;
    }
  },
};

// ─── Fuel Logs API ────────────────────────────────────────────────────────────

export const fuelLogsApi = {
  async getAll(userId: number): Promise<FuelLog[]> {
    try {
      return await apiFetch<FuelLog[]>(`/user-vehicle/fuel-logs?userId=${userId}`);
    } catch (err) {
      warnFallback("fuel logs", err);
      return [];
    }
  },

  async add(log: FuelLog): Promise<FuelLog> {
    try {
      return await apiFetch<FuelLog>("/user-vehicle/fuel-logs", {
        method: "POST",
        body: JSON.stringify(log),
      });
    } catch (err) {
      warnFallback("fuel log add", err);
      return { ...log, id: Date.now(), loggedAt: new Date().toISOString() };
    }
  },
};

// ─── Fuel Price API ───────────────────────────────────────────────────────────
// Fetches Philippine pump prices.
// TODO: Replace the stub below with the real DOE/RDAC endpoint once available.
//   Possible endpoint: https://www.doe.gov.ph/price-monitoring (no public REST API yet)
//   RDAC dataset: https://data.gov.ph/index/public/dataset/doe-fuel-prices

const MOCK_FUEL_PRICES: Record<string, FuelPrice> = {
  gasoline: { fuelType: "Gasoline",       pricePerLiter: 67.50, effectiveDate: "2026-04-14", lastUpdated: "2026-04-21T08:00:00+08:00", confidence: "mock" },
  diesel:   { fuelType: "Diesel",         pricePerLiter: 57.30, effectiveDate: "2026-04-14", lastUpdated: "2026-04-21T08:00:00+08:00", confidence: "mock" },
  premium:  { fuelType: "Premium Gasoline", pricePerLiter: 72.80, effectiveDate: "2026-04-14", lastUpdated: "2026-04-21T08:00:00+08:00", confidence: "mock" },
  lpg:      { fuelType: "LPG",            pricePerLiter: 52.00, effectiveDate: "2026-04-14", lastUpdated: "2026-04-21T08:00:00+08:00", confidence: "mock" },
  electric: { fuelType: "Electric",       pricePerLiter: 0,     effectiveDate: "2026-04-14", lastUpdated: "2026-04-21T08:00:00+08:00", confidence: "mock" },
};

export const fuelPriceApi = {
  async getCurrent(fuelType: FuelType): Promise<FuelPrice> {
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res   = await fetch(`${BASE_URL}/fuel-prices/${fuelType}`, {
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        fuelType:      data.fuelType,
        pricePerLiter: Number(data.pricePerLiter),
        effectiveDate: data.effectiveDate,
        lastUpdated:   data.lastUpdated,
        confidence:    data.confidence,
        source:        data.source,
      };
    } catch {
      return MOCK_FUEL_PRICES[fuelType] ?? MOCK_FUEL_PRICES.gasoline;
    }
  },
};