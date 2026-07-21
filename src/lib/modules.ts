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

export type IndustryCategory =
  | "electrical_mechanical"
  | "plumbing"
  | "construction"
  | "finishing"
  | "cleaning_waste"
  | "security_specialist"
  | "professional"
  | "logistics_other";

export interface IndustryCategoryDef {
  key: IndustryCategory;
  label: string;
}

export const INDUSTRY_CATEGORIES: IndustryCategoryDef[] = [
  { key: "electrical_mechanical", label: "Electrical & Mechanical Services" },
  { key: "plumbing", label: "Plumbing & Related" },
  { key: "construction", label: "Construction & Renovation" },
  { key: "finishing", label: "Finishing & Exterior" },
  { key: "cleaning_waste", label: "Cleaning & Waste" },
  { key: "security_specialist", label: "Security & Specialist" },
  { key: "professional", label: "Professional Services" },
  { key: "logistics_other", label: "Logistics & Other" },
];

export type BusinessType =
  // Electrical & Mechanical
  | "electrical_av"
  | "electrician"
  | "hvac"
  | "appliance_services"
  | "appliance"
  | "fire_services"
  // Plumbing
  | "plumbing_gas"
  | "plumber"
  // Construction & Renovation
  | "property_maintenance"
  | "residential_renovations"
  | "new_residential_builds"
  | "commercial_construction"
  | "industrial_construction"
  | "carpentry"
  | "carpenter"
  | "roofing"
  | "flooring"
  | "glazing"
  | "concreting"
  | "earthworks"
  | "fencing_decking"
  | "engineering"
  | "builder"
  // Finishing & Exterior
  | "painting"
  | "painter"
  | "landscaping_lawns"
  | "landscaper"
  // Cleaning & Waste
  | "cleaning"
  | "cleaner"
  | "rubble"
  // Security & Specialist
  | "security_services"
  // Professional Services
  | "bookkeeping"
  | "consultant"
  | "it_services"
  | "it"
  // Logistics & Other
  | "transporter"
  | "carwash"
  | "mechanic"
  | "pool"
  | "photographer"
  | "caterer"
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
  icon: string;
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
  category: IndustryCategory;
  defaultModules: ModuleKey[];
}

export const BUSINESS_TYPES: BusinessTypeDef[] = [
  // Electrical & Mechanical Services
  { key: "electrical_av", label: "Electrical & AV", category: "electrical_mechanical", defaultModules: ["location", "time", "materials", "equipment", "compliance"] },
  { key: "electrician", label: "Electrician", category: "electrical_mechanical", defaultModules: ["location", "time", "materials", "compliance"] },
  { key: "hvac", label: "HVAC & Refrigeration", category: "electrical_mechanical", defaultModules: ["location", "time", "materials", "equipment", "compliance"] },
  { key: "appliance_services", label: "Appliance Services", category: "electrical_mechanical", defaultModules: ["location", "equipment", "time", "materials", "compliance"] },
  { key: "appliance", label: "Appliance Repair Technician", category: "electrical_mechanical", defaultModules: ["location", "equipment", "time", "materials", "compliance"] },
  { key: "fire_services", label: "Fire Services", category: "electrical_mechanical", defaultModules: ["location", "equipment", "time", "materials", "compliance"] },

  // Plumbing & Related
  { key: "plumbing_gas", label: "Plumbing & Gas", category: "plumbing", defaultModules: ["location", "time", "materials", "measurements", "compliance"] },
  { key: "plumber", label: "Plumber", category: "plumbing", defaultModules: ["location", "time", "materials", "measurements", "compliance"] },

  // Construction & Renovation
  { key: "property_maintenance", label: "Property Maintenance", category: "construction", defaultModules: ["location", "time", "materials", "equipment", "compliance"] },
  { key: "residential_renovations", label: "Residential Renovations", category: "construction", defaultModules: ["location", "time", "materials", "measurements", "waste", "compliance"] },
  { key: "new_residential_builds", label: "New Residential Builds", category: "construction", defaultModules: ["location", "time", "materials", "measurements", "compliance"] },
  { key: "commercial_construction", label: "Commercial Construction", category: "construction", defaultModules: ["location", "time", "materials", "measurements", "waste", "compliance"] },
  { key: "industrial_construction", label: "Industrial Construction", category: "construction", defaultModules: ["location", "time", "materials", "measurements", "waste", "compliance"] },
  { key: "carpentry", label: "Carpentry", category: "construction", defaultModules: ["location", "time", "materials", "measurements"] },
  { key: "carpenter", label: "Carpenter / Furniture Maker", category: "construction", defaultModules: ["location", "time", "materials", "measurements"] },
  { key: "roofing", label: "Roofing", category: "construction", defaultModules: ["location", "time", "materials", "measurements", "compliance"] },
  { key: "flooring", label: "Flooring", category: "construction", defaultModules: ["location", "time", "materials", "measurements"] },
  { key: "glazing", label: "Glazing", category: "construction", defaultModules: ["location", "time", "materials", "measurements", "compliance"] },
  { key: "concreting", label: "Concreting", category: "construction", defaultModules: ["location", "time", "materials", "measurements", "waste"] },
  { key: "earthworks", label: "Earthworks", category: "construction", defaultModules: ["location", "time", "materials", "measurements", "waste", "vehicle"] },
  { key: "fencing_decking", label: "Fencing / Decking", category: "construction", defaultModules: ["location", "time", "materials", "measurements"] },
  { key: "engineering", label: "Engineering", category: "construction", defaultModules: ["location", "time", "materials", "measurements", "compliance"] },
  { key: "builder", label: "Builder / Contractor", category: "construction", defaultModules: ["location", "time", "materials", "waste", "measurements", "compliance"] },

  // Finishing & Exterior
  { key: "painting", label: "Painting", category: "finishing", defaultModules: ["location", "time", "materials", "measurements", "compliance"] },
  { key: "painter", label: "Painter / Wall Finishing", category: "finishing", defaultModules: ["location", "time", "materials", "measurements", "compliance"] },
  { key: "landscaping_lawns", label: "Landscaping & Lawns", category: "finishing", defaultModules: ["location", "time", "materials", "waste", "measurements"] },
  { key: "landscaper", label: "Landscaper / Gardener", category: "finishing", defaultModules: ["location", "time", "materials", "waste", "measurements"] },

  // Cleaning & Waste
  { key: "cleaning", label: "Cleaning", category: "cleaning_waste", defaultModules: ["location", "time"] },
  { key: "cleaner", label: "Domestic / House Cleaner", category: "cleaning_waste", defaultModules: ["location", "time"] },
  { key: "rubble", label: "Rubble Removal / Waste Hauler", category: "cleaning_waste", defaultModules: ["location", "waste", "measurements"] },

  // Security & Specialist
  { key: "security_services", label: "Security Services", category: "security_specialist", defaultModules: ["location", "time", "equipment", "compliance"] },

  // Professional Services
  { key: "bookkeeping", label: "Bookkeeping & Accounting", category: "professional", defaultModules: ["time"] },
  { key: "consultant", label: "Business Consultant / Freelance Professional", category: "professional", defaultModules: ["time"] },
  { key: "it_services", label: "IT Services", category: "professional", defaultModules: ["equipment", "time", "compliance"] },
  { key: "it", label: "IT Technician / Computer Repair", category: "professional", defaultModules: ["equipment", "time", "compliance"] },

  // Logistics & Other
  { key: "transporter", label: "Transporter / Truck Operator", category: "logistics_other", defaultModules: ["location", "vehicle", "time", "waste", "delivery"] },
  { key: "carwash", label: "Mobile Car Wash / Detailing", category: "logistics_other", defaultModules: ["location", "vehicle", "time"] },
  { key: "mechanic", label: "Mechanic / Auto Repair", category: "logistics_other", defaultModules: ["vehicle", "equipment", "time", "materials", "compliance"] },
  { key: "pool", label: "Pool Maintenance", category: "logistics_other", defaultModules: ["location", "equipment", "time", "materials", "compliance"] },
  { key: "photographer", label: "Freelance Photographer", category: "logistics_other", defaultModules: ["location", "time", "delivery"] },
  { key: "caterer", label: "Caterer / Prepared Meals", category: "logistics_other", defaultModules: ["location", "materials", "delivery"] },
  { key: "other", label: "Other", category: "logistics_other", defaultModules: [] },
];

export function defaultModulesFor(type: BusinessType | undefined | null): ModuleKey[] {
  const t = BUSINESS_TYPES.find((b) => b.key === type);
  return t ? [...t.defaultModules] : [];
}

export function businessTypeLabel(type: BusinessType | undefined | null): string {
  return BUSINESS_TYPES.find((b) => b.key === type)?.label ?? "Not set";
}

export function businessTypesByCategory(): Array<{ category: IndustryCategoryDef; types: BusinessTypeDef[] }> {
  return INDUSTRY_CATEGORIES.map((category) => ({
    category,
    types: BUSINESS_TYPES.filter((b) => b.category === category.key),
  }));
}
