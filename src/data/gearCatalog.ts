export const GEAR_CATALOG = {
  motorcycle: {
    label: "Moto",
    brands: {
      BMW: ["R 1300 GS", "F 900 GS", "M 1000 XR"],
      Honda: ["Affica Twin", "Africa Twin", "CRF", "CFR", "XR"],
      Suzuki: ["V-Strom 800DE", "V-Strom 1050DE", "DR-Z4S"],
      Ducati: ["Multistrada V4", "DesertX", "Hypermotard 698"],
      KTM: ["1290 Super Adventure", "890 Adventure R", "690 Enduro R"],
      Yamaha: ["Ténéré 700", "Tracer 9 GT+", "MT-09"],
      Kove: ["450", "800"],
    },
  },
  tires: {
    label: "Pneu",
    brands: {
      Michelin: ["Anakee Adventure", "Road 6", "Anakee Wild"],
      Pirelli: ["Scorpion Trail III", "Scorpion Rally STR", "Scorpion Rally"],
      Metzeler: ["Tourance Next 2", "Karoo 4", "Roadtec 02"],
      Bridgestone: ["Battlax A41", "AX41", "T32"],
      Continental: ["TKC 80", "TrailAttack 3", "TKC 70 Rocks"],
      Dunlop: ["Trailmax Raid", "Roadsmart IV", "Mutant"],
      Mitas: ["E07", "E07+", "Enduro Trail+"],
    },
  },
  helmet: {
    label: "Casque",
    brands: {
      BMW: ["GS Carbon Evo", "System 7 Carbon", "Grand Racer"],
      Arai: ["Tour-X5", "Quantic", "Concept-XE"],
      Shoei: ["Hornet ADV", "Neotec 3", "Glamster"],
      Airoh: ["Commander 2", "Matryx", "Spark 2"],
      Shark: ["Spartan RS", "Skwal i3", "Oxo"],
      Klim: ["Krios Pro", "Krios", "TK1200"],
      Leatt: ["Enduro 3.0", "Moto 9.5", "Adventure 8.5"],
      Fox: ["V3 RS", "V1", "Proframe RS"],
    },
  },
  jacket: {
    label: "Veste",
    brands: {
      BMW: ["GS Rallye GTX", "PaceDry Tour", "Swartberg Air"],
      Alpinestars: ["Andes Air Drystar", "Bogota Pro", "Halo Drystar"],
      RevIt: ["Defender 3 GTX", "Eclipse 2", "Sand 4 H2O"],
      Dainese: ["Antartica 2 Gore-Tex", "Smart Air", "Carve Master 3"],
      Klim: ["Badlands Pro", "Carlsbad", "Marrakesh"],
    },
  },
  pants: {
    label: "Pantalon",
    brands: {
      BMW: ["GS Rallye GTX", "PaceDry Tour", "Swartberg Air"],
      Alpinestars: ["Andes Drystar", "Bogota Pro", "Venture XT"],
      RevIt: ["Defender 3 GTX", "Sand 4 H2O", "Offtrack 2 H2O"],
      Dainese: ["Antartica 2 Gore-Tex", "Carve Master 3", "Tonale D-Dry"],
      Klim: ["Badlands Pro", "Carlsbad", "Latitude"],
    },
  },
  luggage: {
    label: "Bagages",
    brands: {
      BMW: ["Valises aluminium", "Top case Adventure", "Sacoche de selle"],
      Givi: ["Trekker Outback", "Dolomiti", "Easy-T"],
      Kriega: ["OS-32", "US-20", "Roam 34"],
      "SW-Motech": ["Trax ADV", "SysBag WP", "Pro Rackpack"],
      "Mosko Moto": ["Backcountry 35", "Reckless 80", "Nomad Tank Bag"],
      "Lone Rider": ["MotoBags", "Overlander", "MotoArmor"],
    },
  },
  camera: {
    label: "Camera",
    brands: {
      Insta360: ["X3", "X4", "X5", "Ace Pro 2", "GO 3S"],
      GoPro: ["HERO13 Black", "HERO12 Black", "MAX"],
      DJI: ["Osmo Action 5 Pro", "Osmo Pocket 3", "Action 4"],
      Sony: ["ZV-1", "RX0 II", "Alpha ZV-E10"],
    },
  },
  drone: {
    label: "Drone",
    brands: {
      DJI: ["Mini 4 Pro", "Air 3S", "Avata 2", "DJI Lito", "DJI Flip", "DJI Neo", "DJI Avatar"],
      Autel: ["EVO Nano+", "EVO Lite+", "EVO II Pro"],
      HoverAir: ["X1 Pro", "X1 Pro Max"],
      Parrot: ["Anafi AI", "Anafi USA"],
    },
  },
  navigation: {
    label: "Navigation",
    brands: {
      Garmin: ["GPSMAP 276Cx", "Montana 750i", "Edge 1040", "inReach Mini 2"],
      TomTom: ["GO Supreme", "GO Comfort", "GO Expert"],
      DMD2: ["Navigateur", "DMD2 Basic", "DMD2 Pro"],
      Osmand: ["Osmand+", "Osmand Live"],
      Google: ["Google Maps", "Google Maps Offline"],
      CapuRide: ["CapuRide Navigation", "CapuRide Explore"],
      "Cape Iter": ["Cape Iter Standard", "Cape Iter Expert"],
      Autres: ["Viamichelin", "Mappy", "Komoot", "Alltrails"],
    },
  },
} as const;

export const GEAR_CATEGORY_KEYS = Object.keys(GEAR_CATALOG) as Array<keyof typeof GEAR_CATALOG>;

export type GearCategoryKey = keyof typeof GEAR_CATALOG;
export type GearBrand = string;

export interface GearItemSelection {
  brand: string;
  model: string;
  customModel: string;
}

export type GearSelections = Record<GearCategoryKey, GearItemSelection>;

export interface GearSummaryEntry {
  label: string;
  value: string;
}

export const DEFAULT_GEAR_ITEM_SELECTION: GearItemSelection = {
  brand: "",
  model: "",
  customModel: "",
};

export const DEFAULT_GEAR_SELECTIONS: GearSelections = {
  motorcycle: { ...DEFAULT_GEAR_ITEM_SELECTION },
  tires: { ...DEFAULT_GEAR_ITEM_SELECTION },
  helmet: { ...DEFAULT_GEAR_ITEM_SELECTION },
  jacket: { ...DEFAULT_GEAR_ITEM_SELECTION },
  pants: { ...DEFAULT_GEAR_ITEM_SELECTION },
  luggage: { ...DEFAULT_GEAR_ITEM_SELECTION },
  camera: { ...DEFAULT_GEAR_ITEM_SELECTION },
  drone: { ...DEFAULT_GEAR_ITEM_SELECTION },
  navigation: { ...DEFAULT_GEAR_ITEM_SELECTION },
};

export const GEAR_LABELS: Record<GearCategoryKey, string> = GEAR_CATEGORY_KEYS.reduce(
  (acc, key) => {
    acc[key] = GEAR_CATALOG[key].label;
    return acc;
  },
  {} as Record<GearCategoryKey, string>
);

export function resolveGearSelection(selection: GearItemSelection): string {
  const brand = selection.brand.trim();
  const model = selection.customModel.trim() || selection.model.trim();
  if (brand && model) return `${brand} · ${model}`;
  return brand || model;
}

export function buildGearSummaryEntries(selections: GearSelections): GearSummaryEntry[] {
  return GEAR_CATEGORY_KEYS
    .map((key) => ({
      label: GEAR_LABELS[key],
      value: resolveGearSelection(selections[key]),
    }))
    .filter((entry) => entry.value.length > 0);
}
