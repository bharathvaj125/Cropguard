import { INDIAN_CROPS } from '../data/cropCalendar.js';

/**
 * Supported Indian Languages for Voice & Text
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', ttsLang: 'en-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', ttsLang: 'hi-IN' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', ttsLang: 'ta-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', ttsLang: 'te-IN' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', ttsLang: 'kn-IN' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', ttsLang: 'mr-IN' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', ttsLang: 'bn-IN' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', ttsLang: 'pa-IN' },
];

/**
 * Detect which crop is mentioned in the farmer's question.
 */
export function detectCrop(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [key, crop] of Object.entries(INDIAN_CROPS)) {
    if (lower.includes(key)) return crop;
  }
  // Alternate aliases & vernacular names
  if (lower.includes('rice') || lower.includes('dhan') || lower.includes('धान') || lower.includes('நெல்') || lower.includes('వరి')) {
    return INDIAN_CROPS.paddy;
  }
  if (lower.includes('gehun') || lower.includes('गेहूं') || lower.includes('கோதுமை') || lower.includes('గోధుమ')) {
    return INDIAN_CROPS.wheat;
  }
  if (lower.includes('kapas') || lower.includes('कपास') || lower.includes('பருத்தி') || lower.includes('పత్తి')) {
    return INDIAN_CROPS.cotton;
  }
  if (lower.includes('tamatar') || lower.includes('टमाटर') || lower.includes('தக்காளி') || lower.includes('టమోటా')) {
    return INDIAN_CROPS.tomato;
  }
  if (lower.includes('makka') || lower.includes('मक्का') || lower.includes('corn')) {
    return INDIAN_CROPS.maize;
  }
  return null;
}

/**
 * Detect farming topic/intent from question.
 */
export function detectTopic(text) {
  const lower = (text || '').toLowerCase();
  if (lower.match(/sow|plant|seed|window|when\s+to\s+grow|boai|बोआई|வித/)) return 'sowing';
  if (lower.match(/water|irrigat|moisture|dry|sinchai|सिंचाई|பாசன|నీరు/)) return 'irrigation';
  if (lower.match(/fertiliz|urea|dap|potash|nutrient|feed|khad|खाद|உரம்|ఎరువు/)) return 'nutrient';
  if (lower.match(/pest|insect|bug|spray|disease|blight|keeda|कीड़ा|பூச்சி|పురుగు/)) return 'protection';
  if (lower.match(/harvest|cut|yield|maturity|katayi|कटाई|அறுவடை|కోత/)) return 'harvest';
  return 'general';
}

/**
 * Context-aware advisory engine fulfilling SRS Section 5.4.
 * Flags missing context and generates practical recommendations.
 */
export function generateCropAdvisory({ query, language = 'en', context = {} }) {
  const crop = detectCrop(query) || (context.crop ? detectCrop(context.crop) : null);
  const topic = detectTopic(query);

  const missingContextQuestions = [];
  const keyActions = [];
  let title = '';
  let body = '';
  let voiceSummary = '';

  const location = context.location || context.state || '';
  const irrigation = context.irrigation || '';
  const soilType = context.soilType || '';

  // 1. Missing context detection (SRS Section 5.4 mandate)
  if (topic === 'sowing' && !location) {
    missingContextQuestions.push('Which state or district is your farm in? Sowing windows vary between Northern, Central, and Southern India.');
  }
  if (topic === 'irrigation' && !irrigation) {
    missingContextQuestions.push('Do you have assured irrigation (borewell/canal/drip) or is your plot rainfed?');
  }
  if (topic === 'nutrient' && !soilType) {
    missingContextQuestions.push('Have you completed a Soil Health Card test recently to optimize fertilizer dosages?');
  }

  // 2. Crop-specific agronomic advice
  if (crop) {
    title = `${crop.name} — ${topic.toUpperCase()} ADVISORY`;

    if (topic === 'sowing') {
      const zoneInfo = location.match(/punjab|haryana|uttar|rajasthan|bihar/i)
        ? crop.zones.north?.window
        : location.match(/karnataka|tamil|andhra|telangana|kerala/i)
          ? crop.zones.south?.window || crop.zones.peninsular?.window
          : crop.zones.central?.window || Object.values(crop.zones)[0]?.window || 'Standard seasonal window';

      body = `For **${crop.name}**, the recommended sowing window in your region is **${zoneInfo}**.\n\n` +
        `• **Seed Rate:** ${crop.seedRateKgPerAcre} kg per acre.\n` +
        `• **Seed Treatment:** ${crop.seedTreatment} to protect against early seed and soil-borne infections.\n` +
        `• **Soil Requirement:** Grows best in ${crop.soilTypes.join(', ')} with pH range of ${crop.idealPh}.`;

      keyActions.push(`Procure certified seed @ ${crop.seedRateKgPerAcre} kg/acre`);
      keyActions.push(`Treat seed prior to sowing`);

      voiceSummary = `For ${crop.name}, optimal sowing is ${zoneInfo}. Use ${crop.seedRateKgPerAcre} kg treated seeds per acre.`;
    } else if (topic === 'irrigation') {
      const stagesText = crop.criticalIrrigationStages
        .map((s) => `• **${s.stage} (${s.day}):** ${s.notes} ${s.critical ? '*(CRITICAL)*' : ''}`)
        .join('\n');

      body = `**Critical Irrigation Schedule for ${crop.name}:**\n\n${stagesText}\n\n` +
        `> **Agronomist Tip:** Never allow water deficit during critical flowering or initial root emergence stages, as stress here causes permanent yield penalty.`;

      keyActions.push('Ensure irrigation during Crown Root Initiation and Flowering stages');
      keyActions.push('Avoid water stagnation in heavy clay soil');

      voiceSummary = `Critical water stages for ${crop.name} are initial root establishment and flowering. Avoid moisture stress during these times.`;
    } else if (topic === 'nutrient') {
      body = `**Nutrient Management for ${crop.name}:**\n\n` +
        `• ${crop.nutrientManagement}\n` +
        `• Apply full phosphorus (DAP) and potash (MOP) as basal dose at sowing.\n` +
        `• Split nitrogen (Urea) into 2 to 3 doses to prevent leaching losses.`;

      keyActions.push('Apply basal fertilizer at sowing');
      keyActions.push('Top-dress Urea under moist soil conditions');

      voiceSummary = `For ${crop.name}, apply all DAP and Potash at sowing. Apply Urea in split doses.`;
    } else if (topic === 'protection') {
      body = `**Common Pest and Disease Management for ${crop.name}:**\n\n` +
        `• **Key Risks:** ${crop.commonRisks}\n` +
        `• **Preventive IPM:** Install pheromone traps or yellow sticky traps (5-6 traps/acre).\n` +
        `• **Action:** If pest count exceeds Economic Threshold Level (ETL), spray university-recommended targeted insecticides in calm evening hours.`;

      keyActions.push('Install monitoring sticky/pheromone traps');
      keyActions.push('Spray in late afternoon to safeguard pollinator bees');

      voiceSummary = `Monitor ${crop.name} for ${crop.commonRisks}. Use sticky traps and follow recommended spray windows.`;
    } else if (topic === 'harvest') {
      body = `**Harvesting Guidance for ${crop.name}:**\n\n` +
        `• **Maturity Signs:** ${crop.harvestIndicator}\n` +
        `• Ensure harvesting is done on clear dry days when grain/produce moisture is within safe storage limits.`;

      keyActions.push('Check moisture content before storage');

      voiceSummary = `Harvest ${crop.name} when ${crop.harvestIndicator}.`;
    } else {
      body = `**Cultivation Guide for ${crop.name} (${crop.season} Season):**\n\n` +
        `• **Soil:** ${crop.soilTypes.join(', ')} (pH ${crop.idealPh})\n` +
        `• **Seed Rate:** ${crop.seedRateKgPerAcre} kg/acre (Treated: ${crop.seedTreatment})\n` +
        `• **Nutrient Plan:** ${crop.nutrientManagement}\n` +
        `• **Key Irrigation Stages:** ${crop.criticalIrrigationStages.map((s) => s.stage).join(', ')}`;

      keyActions.push(`Follow recommended crop management for ${crop.name}`);

      voiceSummary = `${crop.name} is a ${crop.season} crop needing ${crop.soilTypes[0]}. Follow recommended seed rate and split fertilizer applications.`;
    }
  } else {
    // General agricultural query
    title = 'KISAN MITRA AGRICULTURAL ADVISORY';
    body = `Hello farmer friend! For specific recommendations, please mention your crop name (e.g. Wheat, Paddy, Cotton, Tomato, Maize) and state.\n\n` +
      `You can ask:\n` +
      `• *"When is the best sowing time for wheat in Punjab?"*\n` +
      `• *"What is the irrigation schedule for paddy?"*\n` +
      `• *"How much fertilizer should I apply for 1 acre of tomato?"*`;

    keyActions.push('Specify crop and farm district');
    voiceSummary = 'Please tell me your crop name and district so I can give you exact sowing, irrigation, and fertilizer guidance.';
  }

  // Language localization for voiceSummary when non-English is requested
  const localizedVoice = localizeVoiceSummary(voiceSummary, language, crop?.name);

  return {
    crop: crop?.id || 'general',
    cropName: crop?.name || 'General Agriculture',
    topic,
    title,
    body,
    voiceSummary: localizedVoice,
    keyActions,
    missingContextQuestions,
    disclaimer:
      'Guidance is formulated from standard agronomic packages of practices. Always cross-verify critical pesticide/disease decisions with your district Krishi Vigyan Kendra (KVK) or extension officer.',
  };
}

/**
 * Basic native voice localization for common Indian languages to ensure crisp TTS audio.
 */
function localizeVoiceSummary(englishText, lang, cropName = '') {
  if (lang === 'hi') {
    if (englishText.includes('sowing')) {
      return `किसान भाई, ${cropName || 'फसल'} की बोआई के लिए उपयुक्त समय और बीज दर का ध्यान रखें। बोआई से पहले बीज उपचार अवश्य करें।`;
    }
    if (englishText.includes('water') || englishText.includes('irrigation')) {
      return `${cropName || 'फसल'} के लिए मुख्य सिंचाई कल्ले फूटने और फूल आने के समय दें। खेत में पानी रुकने न दें।`;
    }
    return `किसान मित्र: ${cropName || 'फसल'} के लिए अनुशंसित खाद और कृषि पद्धतियों का पालन करें।`;
  }
  if (lang === 'ta') {
    return `விவசாயி நண்பரே, ${cropName || 'பயிர்'} சாகுபடிக்கு பரிந்துரைக்கப்பட்ட விதைப்பு காலம் மற்றும் உர மேலாண்மையை பின்பற்றவும்.`;
  }
  if (lang === 'te') {
    return `రైతు మిత్రమా, ${cropName || 'పంట'} సాగుకు సిఫార్సు చేసిన విత్తే సమయం మరియు ఎరువుల మోతాదును పాటించండి.`;
  }
  if (lang === 'kn') {
    return `ರೈತ ಮಿತ್ರರೆ, ${cropName || 'ಬೆಳೆ'} ಬಿತ್ತನೆಗೆ ಸೂಕ್ತ ಸಮಯ ಮತ್ತು ಸಮಗ್ರ ಪೋಷಕಾಂಶ ನಿರ್ವಹಣೆಯನ್ನು ಅನುಸರಿಸಿ.`;
  }
  return englishText;
}
