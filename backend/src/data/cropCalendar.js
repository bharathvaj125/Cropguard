/**
 * Comprehensive Indian Agricultural Crop Calendar and Cultivation Almanac.
 * Formatted according to ICAR and State Agricultural Universities (SAUs) packages of practices.
 */

export const INDIAN_CROPS = {
  wheat: {
    id: 'wheat',
    name: 'Wheat (गेहूं / கோதுமை / గోధుమలు)',
    season: 'Rabi',
    soilTypes: ['Well-drained loam', 'Clay loam', 'Alluvial soil'],
    idealPh: '6.0 - 7.5',
    zones: {
      north: { states: ['Punjab', 'Haryana', 'Uttar Pradesh', 'Rajasthan', 'Bihar'], window: 'Nov 1 - Nov 25' },
      central: { states: ['Madhya Pradesh', 'Chhattisgarh', 'Gujarat'], window: 'Oct 25 - Nov 15' },
      peninsular: { states: ['Maharashtra', 'Karnataka', 'Andhra Pradesh'], window: 'Oct 15 - Nov 10' },
    },
    seedRateKgPerAcre: 40,
    seedTreatment: 'Carboxin or Thiram @ 2.5 g/kg seed + Azotobacter culture',
    criticalIrrigationStages: [
      { day: '20-25 DAS', stage: 'CRI (Crown Root Initiation)', critical: true, notes: 'Most critical stage; water stress here drops yield by 30%.' },
      { day: '40-45 DAS', stage: 'Tillering', critical: false, notes: 'Promotes vigorous tiller production.' },
      { day: '60-65 DAS', stage: 'Late Jointing', critical: false, notes: 'Stems elongate rapidly.' },
      { day: '80-85 DAS', stage: 'Flowering / Anthesis', critical: true, notes: 'Essential for spikelet fertility.' },
      { day: '100-105 DAS', stage: 'Milk / Dough Stage', critical: true, notes: 'Ensures plump grain weight.' },
    ],
    nutrientManagement: 'Apply 50 kg Urea + 50 kg DAP + 25 kg MOP at basal, top-dress remaining 50 kg Urea at 1st irrigation.',
    commonRisks: 'Yellow rust in northern plains, thermal stress during grain filling, aphid attacks.',
    harvestIndicator: 'Golden yellow straw, grain moisture drops below 12-14%.',
  },

  paddy: {
    id: 'paddy',
    name: 'Paddy / Rice (धान / நெல் / వరి)',
    season: 'Kharif / Rabi',
    soilTypes: ['Heavy clay', 'Clay loam', 'Deltaic alluvium'],
    idealPh: '5.5 - 7.0',
    zones: {
      north: { states: ['Punjab', 'Haryana', 'Uttar Pradesh'], window: 'Nursery: May 20 - June 10; Transplanting: June 20 - July 15' },
      south: { states: ['Tamil Nadu', 'Andhra Pradesh', 'Telangana', 'Karnataka', 'Kerala'], window: 'Kharif: June-July; Samba: Aug-Oct; Navarai: Dec-Jan' },
      east: { states: ['West Bengal', 'Odisha', 'Assam', 'Bihar'], window: 'Aus (April-May), Aman (June-July), Boro (Nov-Dec)' },
    },
    seedRateKgPerAcre: 15,
    seedTreatment: 'Pseudomonas fluorescens @ 10 g/kg seed or Carbendazim @ 2 g/kg',
    criticalIrrigationStages: [
      { day: 'Transplanting to 7 DAT', stage: 'Establishment', critical: true, notes: 'Maintain 2-3 cm standing water.' },
      { day: '20-30 DAT', stage: 'Active Tillering', critical: true, notes: 'Keep shallow water depth of 2-5 cm.' },
      { day: '45-55 DAT', stage: 'Panicle Initiation', critical: true, notes: 'Never allow moisture stress at panicle emergence.' },
      { day: '70-80 DAT', stage: 'Flowering & Grain Filling', critical: true, notes: 'Drain water 10 days before expected harvest.' },
    ],
    nutrientManagement: 'Urea 65 kg + DAP 40 kg + MOP 30 kg per acre in 3 splits.',
    commonRisks: 'Stem borer (dead hearts), Brown planthopper (hopper burn), Bacterial leaf blight, Blast.',
    harvestIndicator: '80-85% of panicles turn golden straw colored; grain feels hard when pressed.',
  },

  cotton: {
    id: 'cotton',
    name: 'Cotton (कपास / பருத்தி / పత్తి)',
    season: 'Kharif',
    soilTypes: ['Deep black clay (Regur)', 'Medium black soil', 'Alluvial loam'],
    idealPh: '6.5 - 8.0',
    zones: {
      north: { states: ['Punjab', 'Haryana', 'Rajasthan'], window: 'April 15 - May 15' },
      central: { states: ['Maharashtra', 'Gujarat', 'Madhya Pradesh'], window: 'June 15 - July 10 (onset of monsoon)' },
      south: { states: ['Telangana', 'Andhra Pradesh', 'Karnataka', 'Tamil Nadu'], window: 'July 1 - August 15' },
    },
    seedRateKgPerAcre: 1.5,
    seedTreatment: 'Imidacloprid 70WS @ 5 g/kg seed for sucking pest prevention in first 40 days',
    criticalIrrigationStages: [
      { day: '45-50 DAS', stage: 'Square Formation', critical: true, notes: 'Water stress causes square drop.' },
      { day: '70-85 DAS', stage: 'Peak Flowering', critical: true, notes: 'Critical for flower retention.' },
      { day: '100-115 DAS', stage: 'Boll Development', critical: true, notes: 'Prevents boll shedding.' },
    ],
    nutrientManagement: 'RDF 50:25:25 kg NPK/acre. Top-dress nitrogen at squaring and boll bursting.',
    commonRisks: 'Pink bollworm, whitefly (leaf curl virus vector), sucking pests (thrips, aphids, jassids).',
    harvestIndicator: 'Clean bursting of bolls in dry sunny weather; avoid morning dewy picking.',
  },

  tomato: {
    id: 'tomato',
    name: 'Tomato (टमाटर / தக்காளி / టమోటా)',
    season: 'Year-round (Autumn / Spring / Summer)',
    soilTypes: ['Well-drained sandy loam', 'Red loam'],
    idealPh: '6.0 - 7.0',
    zones: {
      all: { states: ['All India'], window: 'Autumn: June-Aug; Spring: Nov-Dec; Summer: Jan-Feb' },
    },
    seedRateKgPerAcre: 0.15, // 150g hybrid
    seedTreatment: 'Trichoderma viride @ 4 g/kg seed against damping-off',
    criticalIrrigationStages: [
      { day: 'After transplanting', stage: 'Establishment', critical: true, notes: 'Immediate light irrigation.' },
      { day: '30-40 DAT', stage: 'Flowering', critical: true, notes: 'Steady moisture; irregular watering causes blossom end rot.' },
      { day: '50-80 DAT', stage: 'Fruit Development & Ripening', critical: true, notes: 'Avoid flood irrigation to prevent fruit cracking.' },
    ],
    nutrientManagement: 'Apply 60 kg Urea, 70 kg DAP, 50 kg MOP per acre with micronutrient spray (Boron + Calcium).',
    commonRisks: 'Early blight, Late blight, Leaf curl virus (whitefly vector), Fruit borer (*Helicoverpa*).',
    harvestIndicator: 'Breaker stage for long-distance transport, full pink/red for local mandi selling.',
  },

  maize: {
    id: 'maize',
    name: 'Maize (मक्का / மக்காச்சோளம் / మొక్కజొన్న)',
    season: 'Kharif / Rabi',
    soilTypes: ['Deep well-drained fertile loam', 'Silt loam'],
    idealPh: '6.5 - 7.5',
    zones: {
      all: { states: ['All India'], window: 'Kharif: June-July; Rabi: Oct-Nov' },
    },
    seedRateKgPerAcre: 8,
    seedTreatment: 'Cyantraniliprole / Chlorantraniliprole against Fall Armyworm',
    criticalIrrigationStages: [
      { day: '45-50 DAS', stage: 'Tasseling', critical: true, notes: 'Water deficit causes barren cobs.' },
      { day: '60-65 DAS', stage: 'Silking', critical: true, notes: 'Critical for pollination.' },
      { day: '75-80 DAS', stage: 'Grain filling', critical: true, notes: 'Determines kernel density.' },
    ],
    nutrientManagement: 'Apply 60 kg Urea, 40 kg DAP, 25 kg MOP per acre. Apply Zinc Sulphate 10 kg.',
    commonRisks: 'Fall Armyworm (FAW) whorl feeding, stem borer, turcicum leaf blight.',
    harvestIndicator: 'Cob husk turns brown and paper-dry; black layer forms at the tip of grains.',
  },
};
