// Business-type → feature-module mapping and field definitions.
// Single source of truth. Field values live on Doc.moduleData[moduleKey][fieldKey].

export type ModuleKey =
  | "location"
  | "vehicle"
  | "equipment"
  | "time"
  | "materials"
  | "waste"
  | "measurements"
  | "delivery"
  | "compliance";

export type BusinessType =
  | "plumber"
  | "electrician"
  | "mechanic"
  | "transporter"
  | "rubble"
  | "landscaper"
  | "cleaner"
  | "painter"
  | "carpenter"
  | "builder"
  | "caterer"
  | "hairdresser"
  | "beauty"
  | "trainer"
  | "photographer"
  | "it"
  | "appliance"
  | "carwash"
  | "pool"
  | "consultant"
  | "other";

export type FieldType = "text" | "number" | "date" | "time" | "textarea";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  suffix?: string;
  placeholder?: string;
}

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  icon: string; // emoji, keeps bundle small
  description: string;
  fields: FieldDef[];
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  location: {
    key: "location",
    label: "Location",
    icon: "📍",
    description: "Track where the work happened or goods went.",
    fields: [
      { key: "jobSiteAddress", label: "Job site / property address", type: "text" },
      { key: "gps", label: "GPS coordinates", type: "text", placeholder: "-33.9249, 18.4241" },
    ],
  },
  vehicle: {
    key: "vehicle",
    label: "Vehicle",
    icon: "🚗",
    description: "Vehicle-specific details.",
    fields: [
      { key: "registration", label: "Registration #", type: "text" },
      { key: "vin", label: "VIN / Chassis #", type: "text" },
      { key: "makeModel", label: "Make & model", type: "text" },
      { key: "year", label: "Year", type: "number" },
      { key: "odoIn", label: "Odometer in", type: "number", suffix: "km" },
      { key: "odoOut", label: "Odometer out", type: "number", suffix: "km" },
    ],
  },
  equipment: {
    key: "equipment",
    label: "Equipment",
    icon: "🔧",
    description: "Assets being repaired or used.",
    fields: [
      { key: "type", label: "Appliance / tool type", type: "text" },
      { key: "brand", label: "Brand", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "serial", label: "Serial #", type: "text" },
      { key: "fault", label: "Fault reported", type: "textarea" },
    ],
  },
  time: {
    key: "time",
    label: "Time",
    icon: "🕒",
    description: "Billable labour time.",
    fields: [
      { key: "startTime", label: "Start time", type: "time" },
      { key: "endTime", label: "End time", type: "time" },
      { key: "hours", label: "Total labour hours", type: "number", suffix: "hrs" },
      { key: "waiting", label: "Waiting time", type: "number", suffix: "hrs" },
      { key: "workers", label: "Number of workers", type: "number" },
    ],
  },
  materials: {
    key: "materials",
    label: "Materials & parts",
    icon: "📦",
    description: "Physical items used in the job (extra to line items).",
    fields: [
      { key: "partNumbers", label: "Part numbers", type: "textarea" },
      { key: "consumables", label: "Consumables used", type: "textarea" },
    ],
  },
  waste: {
    key: "waste",
    label: "Waste",
    icon: "🗑️",
    description: "Rubbish removal and disposal.",
    fields: [
      { key: "disposalSite", label: "Disposal site address", type: "text" },
      { key: "disposalReceipt", label: "Disposal receipt #", type: "text" },
      { key: "loadDescription", label: "Load description", type: "textarea" },
      { key: "weight", label: "Weight", type: "number", suffix: "kg" },
      { key: "volume", label: "Volume", type: "number", suffix: "m³" },
      { key: "skipSize", label: "Skip size", type: "text" },
    ],
  },
  measurements: {
    key: "measurements",
    label: "Measurements",
    icon: "📏",
    description: "Dimensions for painting, landscaping, etc.",
    fields: [
      { key: "area", label: "Area", type: "number", suffix: "m²" },
      { key: "surfaceType", label: "Surface type", type: "text" },
      { key: "coats", label: "Number of coats", type: "number" },
      { key: "gardenSize", label: "Garden size", type: "text" },
      { key: "paintColour", label: "Paint colour / brand", type: "text" },
    ],
  },
  delivery: {
    key: "delivery",
    label: "Delivery & logistics",
    icon: "📦",
    description: "Packaging and delivery specifics.",
    fields: [
      { key: "portions", label: "Number of portions / meals", type: "number" },
      { key: "dietary", label: "Dietary requirements", type: "textarea" },
      { key: "deliveryDate", label: "Delivery date", type: "date" },
      { key: "deliveryTime", label: "Delivery time", type: "time" },
      { key: "packagingFee", label: "Packaging fee", type: "number" },
      { key: "itemCount", label: "Number of items", type: "number" },
    ],
  },
  compliance: {
    key: "compliance",
    label: "Compliance & warranty",
    icon: "⚙️",
    description: "Legal and quality assurance.",
    fields: [
      { key: "coc", label: "CoC number", type: "text" },
      { key: "warranty", label: "Warranty period", type: "text" },
      { key: "nextService", label: "Next service date", type: "date" },
      { key: "safetyTest", label: "Safety test results", type: "textarea" },
      { key: "waterTest", label: "Water test results", type: "textarea" },
    ],
  },
};

export const MODULE_KEYS: ModuleKey[] = [
  "location", "vehicle", "equipment", "time", "materials",
  "waste", "measurements", "delivery", "compliance",
];

export interface BusinessTypeDef {
  key: BusinessType;
  label: string;
  defaultModules: ModuleKey[];
}

export const BUSINESS_TYPES: BusinessTypeDef[] = [
  { key: "plumber", label: "Plumber", defaultModules: ["location", "time", "materials", "measurements", "compliance"] },
  { key: "electrician", label: "Electrician", defaultModules: ["location", "time", "materials", "compliance"] },
  { key: "mechanic", label: "Mechanic / Auto Repair", defaultModules: ["vehicle", "equipment", "time", "materials", "compliance"] },
  { key: "transporter", label: "Transporter / Truck Operator", defaultModules: ["location", "vehicle", "time", "waste", "delivery"] },
  { key: "rubble", label: "Rubble Removal / Waste Hauler", defaultModules: ["location", "waste", "measurements"] },
  { key: "landscaper", label: "Landscaper / Gardener", defaultModules: ["location", "time", "materials", "waste", "measurements"] },
  { key: "cleaner", label: "Domestic / House Cleaner", defaultModules: ["location", "time"] },
  { key: "painter", label: "Painter / Wall Finishing", defaultModules: ["location", "time", "materials", "measurements", "compliance"] },
  { key: "carpenter", label: "Carpenter / Furniture Maker", defaultModules: ["location", "time", "materials", "measurements"] },
  { key: "builder", label: "Builder / Contractor", defaultModules: ["location", "time", "materials", "waste", "measurements", "compliance"] },
  { key: "caterer", label: "Caterer / Prepared Meals", defaultModules: ["location", "materials", "delivery"] },
  { key: "hairdresser", label: "Hairdresser / Barber / Mobile Stylist", defaultModules: ["time", "materials"] },
  { key: "beauty", label: "Beauty Therapist / Nail Technician", defaultModules: ["time", "materials"] },
  { key: "trainer", label: "Personal Trainer / Fitness Coach", defaultModules: ["location", "time"] },
  { key: "photographer", label: "Freelance Photographer", defaultModules: ["location", "time", "delivery"] },
  { key: "it", label: "IT Technician / Computer Repair", defaultModules: ["equipment", "time", "compliance"] },
  { key: "appliance", label: "Appliance Repair Technician", defaultModules: ["location", "equipment", "time", "materials", "compliance"] },
  { key: "carwash", label: "Mobile Car Wash / Detailing", defaultModules: ["location", "vehicle", "time"] },
  { key: "pool", label: "Pool Maintenance", defaultModules: ["location", "equipment", "time", "materials", "compliance"] },
  { key: "consultant", label: "Business Consultant / Freelance Professional", defaultModules: ["time"] },
  { key: "other", label: "Other", defaultModules: [] },
];

export function defaultModulesFor(type: BusinessType | undefined | null): ModuleKey[] {
  const t = BUSINESS_TYPES.find((b) => b.key === type);
  return t ? [...t.defaultModules] : [];
}

export function businessTypeLabel(type: BusinessType | undefined | null): string {
  return BUSINESS_TYPES.find((b) => b.key === type)?.label ?? "Not set";
}
