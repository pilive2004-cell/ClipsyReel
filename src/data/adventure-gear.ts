import { AdventureCatalogOption, AdventureEquipmentCategory } from "@/types";

export const MOTORCYCLE_OPTIONS: AdventureCatalogOption[] = [
  { brand: "BMW Motorrad", models: ["R1300GS", "R1250GS Adventure", "F900GS"], usageCount: 184, rating: 4.9 },
  { brand: "KTM", models: ["1290 Super Adventure", "890 Adventure R", "690 Enduro R"], usageCount: 131, rating: 4.7 },
  { brand: "Honda", models: ["Africa Twin", "Transalp 750", "CRF300L"], usageCount: 149, rating: 4.8 },
  { brand: "Ducati", models: ["Multistrada V4", "DesertX"], usageCount: 72, rating: 4.6 },
  { brand: "Yamaha", models: ["Tenere 700", "Tracer 9 GT"], usageCount: 142, rating: 4.8 },
  { brand: "Triumph", models: ["Tiger 900", "Tiger 1200 Rally Pro"], usageCount: 94, rating: 4.7 },
];

export const HELMET_OPTIONS: AdventureCatalogOption[] = [
  { brand: "Shoei", models: ["Neotec 3", "Hornet ADV"], usageCount: 166, rating: 4.9 },
  { brand: "Schuberth", models: ["C5", "E2"], usageCount: 101, rating: 4.8 },
  { brand: "Arai", models: ["Tour-X5", "Tour-X4"], usageCount: 87, rating: 4.8 },
  { brand: "AGV", models: ["AX9", "K6 S"], usageCount: 69, rating: 4.6 },
  { brand: "HJC", models: ["RPHA 91", "V60"], usageCount: 58, rating: 4.5 },
  { brand: "Klim", models: ["Krios Pro", "Krios"], usageCount: 73, rating: 4.7 },
];

export const CAMERA_OPTIONS: AdventureCatalogOption[] = [
  { brand: "GoPro", models: ["Hero 14 Black", "Hero 13 Black", "Hero 12 Black"], usageCount: 241, rating: 4.8 },
  { brand: "DJI", models: ["Osmo Action 5 Pro", "Osmo Action 4", "Pocket 3"], usageCount: 118, rating: 4.7 },
  { brand: "Insta360", models: ["X4", "Ace Pro 2", "GO 3S"], usageCount: 109, rating: 4.7 },
  { brand: "Sony", models: ["RX100 VII", "ZV-1"], usageCount: 44, rating: 4.6 },
  { brand: "Apple", models: ["iPhone 16 Pro", "iPhone 15 Pro"], usageCount: 138, rating: 4.7 },
  { brand: "Android", models: ["Android Phone", "Samsung Galaxy S25 Ultra", "Google Pixel 10 Pro"], usageCount: 81, rating: 4.5 },
];

export const DRONE_OPTIONS: AdventureCatalogOption[] = [
  { brand: "DJI", models: ["Mini 4 Pro", "Air 3S", "Mavic 3 Pro"], usageCount: 126, rating: 4.8 },
  { brand: "Autel", models: ["EVO Lite+", "EVO Nano+"], usageCount: 44, rating: 4.5 },
  { brand: "Skydio", models: ["Skydio 2+", "Skydio X2"], usageCount: 22, rating: 4.4 },
  { brand: "Parrot", models: ["Anafi USA", "Anafi Ai"], usageCount: 19, rating: 4.3 },
  { brand: "Potensic", models: ["Atom", "Atom SE"], usageCount: 31, rating: 4.2 },
];

export const LUGGAGE_OPTIONS: AdventureCatalogOption[] = [
  { brand: "Touratech", models: ["Adventure Cases", "Zega Evo"], usageCount: 91, rating: 4.8 },
  { brand: "SW-Motech", models: ["Trax Adventure", "SysBag WP"], usageCount: 78, rating: 4.6 },
  { brand: "Givi", models: ["Trekker Outback", "Canyon"], usageCount: 103, rating: 4.6 },
  { brand: "Mosko Moto", models: ["Backcountry", "Reckless 80"], usageCount: 88, rating: 4.8 },
  { brand: "Kriega", models: ["OS-Base", "OS-32 Soft Pannier"], usageCount: 63, rating: 4.7 },
  { brand: "Lone Rider", models: ["MotoBags", "Overlander 48"], usageCount: 55, rating: 4.6 },
];

export const TIRE_OPTIONS: AdventureCatalogOption[] = [
  { brand: "Michelin", models: ["Anakee Adventure", "Anakee Wild"], usageCount: 167, rating: 4.8 },
  { brand: "Metzeler", models: ["Karoo 4", "Tourance Next 2"], usageCount: 122, rating: 4.7 },
  { brand: "Continental", models: ["TKC 70", "TKC 80"], usageCount: 119, rating: 4.8 },
  { brand: "Bridgestone", models: ["Battlax Adventurecross", "A41"], usageCount: 74, rating: 4.5 },
  { brand: "Pirelli", models: ["Scorpion Rally STR", "Scorpion Trail III"], usageCount: 82, rating: 4.6 },
  { brand: "Dunlop", models: ["Trailmax Mission", "Mutant"], usageCount: 52, rating: 4.5 },
];

export const NAVIGATION_APP_OPTIONS = [
  "Google Maps",
  "Kurviger",
  "Calimoto",
  "Scenic",
  "TomTom GO",
  "Garmin Explore",
  "BMW Connected",
  "MyRouteApp",
  "Waze",
  "OsmAnd",
  "DMD2",
  "Other",
] as const;

export const OFFROAD_EXPERIENCE_LABELS = [
  { level: 0, label: "Road only" },
  { level: 2, label: "Easy gravel" },
  { level: 4, label: "Occasional off-road" },
  { level: 6, label: "Regular off-road" },
  { level: 8, label: "Advanced off-road" },
  { level: 10, label: "Expert adventure rider" },
] as const;

export const ADVENTURE_CATALOGS: Record<AdventureEquipmentCategory, AdventureCatalogOption[]> = {
  motorcycle: MOTORCYCLE_OPTIONS,
  helmet: HELMET_OPTIONS,
  camera: CAMERA_OPTIONS,
  drone: DRONE_OPTIONS,
  luggage: LUGGAGE_OPTIONS,
  tires: TIRE_OPTIONS,
};
