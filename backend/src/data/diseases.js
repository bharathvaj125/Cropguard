/**
 * Knowledge base for the 38 classes the disease model can output (PlantVillage labels).
 *
 * The model only returns a label and a score. Everything a farmer actually reads
 * (what it is, how to recognise it, what to do) comes from here.
 *
 * The advice is general integrated-disease-management guidance. Product names are
 * common active ingredients, not endorsements; what is registered and at what dose
 * differs by country and crop, so the UI always tells the user to check the label
 * and their local extension officer.
 */

const HEALTHY_CARE = {
  Apple: 'Keep up dormant-season pruning for an open canopy and clear fallen leaves in autumn.',
  Blueberry: 'Maintain acidic soil (pH 4.5 to 5.5), mulch well and prune out old canes each winter.',
  Cherry: 'Prune in dry weather for airflow and avoid wetting the canopy when irrigating.',
  Corn: 'Rotate with a non-cereal crop next season and keep scouting the lower leaves weekly.',
  Grape: 'Keep the canopy open with shoot positioning and leaf removal around the bunches.',
  Peach: 'Thin the canopy during dormant pruning and avoid overhead irrigation.',
  'Bell pepper': 'Water at the base, keep spacing generous and rotate away from tomato and potato.',
  Potato: 'Hill the rows to cover tubers and keep scouting after every spell of wet weather.',
  Raspberry: 'Remove canes that have fruited and keep the row narrow so air can move through.',
  Soybean: 'Rotate crops and scout from flowering onwards for leaf spots and pod feeders.',
  Strawberry: 'Renew mulch, remove old leaves after harvest and avoid overhead watering.',
  Tomato: 'Stake or trellis plants, remove leaves touching the soil and water at the base.',
};

function healthy(crop) {
  return {
    crop,
    name: 'Healthy',
    type: 'healthy',
    pathogen: '',
    severity: 'none',
    summary: `No disease symptoms were detected on this ${crop.toLowerCase()} leaf.`,
    symptoms: [],
    conditions: '',
    treatment: { cultural: [HEALTHY_CARE[crop]], organic: [], chemical: [] },
    prevention: [
      'Keep scouting the crop at least once a week; early detection is the cheapest control.',
      'Photograph any new spots, yellowing or curling and run another scan.',
    ],
  };
}

export const DISEASES = {
  Apple___Apple_scab: {
    crop: 'Apple',
    name: 'Apple scab',
    type: 'fungal',
    pathogen: 'Venturia inaequalis',
    severity: 'medium',
    summary:
      'A fungal disease that marks leaves and fruit with dark, velvety spots. Heavy infections cause early leaf drop and cracked, unsaleable fruit.',
    symptoms: [
      'Olive-green to brown velvety spots on the upper leaf surface',
      'Leaves pucker, yellow and fall early',
      'Dark, corky, cracked scabs on fruit',
    ],
    conditions: 'Cool, wet spring weather. The fungus overwinters on fallen leaves.',
    treatment: {
      cultural: [
        'Rake up and destroy or compost fallen leaves in autumn to remove the overwintering fungus',
        'Prune to open the canopy so leaves dry quickly after rain',
      ],
      organic: ['Sulfur or lime-sulfur sprays from green tip through petal fall', 'Potassium bicarbonate sprays'],
      chemical: ['Protectant fungicides such as captan or mancozeb', 'Systemic fungicides such as myclobutanil or difenoconazole, rotated to avoid resistance'],
    },
    prevention: ['Plant scab-resistant varieties where available', 'Avoid overhead irrigation'],
  },
  Apple___Black_rot: {
    crop: 'Apple',
    name: 'Black rot',
    type: 'fungal',
    pathogen: 'Botryosphaeria obtusa (Diplodia seriata)',
    severity: 'medium',
    summary:
      'A fungus that causes "frogeye" leaf spots, a firm brown-black fruit rot and cankers on branches.',
    symptoms: [
      'Purple specks on leaves that grow into brown spots with a tan centre (frogeye leaf spot)',
      'Fruit rot starting at the blossom end, often with concentric rings',
      'Sunken, reddish-brown cankers on limbs',
    ],
    conditions: 'Warm, wet weather. Spores come from dead wood, cankers and mummified fruit left on the tree.',
    treatment: {
      cultural: [
        'Prune out dead wood and cankers, cutting well into healthy wood',
        'Remove mummified fruit from the tree and the ground',
      ],
      organic: ['Copper-based fungicide during the dormant season'],
      chemical: ['Captan or thiophanate-methyl from petal fall onwards'],
    },
    prevention: ['Burn or remove prunings; do not leave them in the orchard', 'Keep trees vigorous; stressed trees are more susceptible'],
  },
  Apple___Cedar_apple_rust: {
    crop: 'Apple',
    name: 'Cedar apple rust',
    type: 'fungal',
    pathogen: 'Gymnosporangium juniperi-virginianae',
    severity: 'medium',
    summary:
      'A rust fungus that needs both apple and juniper (red cedar) to complete its life cycle. It causes bright orange leaf spots and can defoliate trees.',
    symptoms: [
      'Bright yellow-orange spots on the upper leaf surface',
      'Small tube-like structures on the underside of the spots later in the season',
      'Early leaf drop and misshapen fruit in severe cases',
    ],
    conditions: 'Wet spring weather when junipers nearby release spores.',
    treatment: {
      cultural: ['Remove galls from nearby junipers in late winter, or remove the junipers if practical'],
      organic: ['Sulfur sprays from pink bud stage'],
      chemical: ['Myclobutanil or mancozeb from pink bud through about a month after petal fall'],
    },
    prevention: ['Choose rust-resistant apple varieties', 'Avoid planting apples close to junipers and red cedars'],
  },
  Apple___healthy: healthy('Apple'),
  Blueberry___healthy: healthy('Blueberry'),
  'Cherry_(including_sour)___Powdery_mildew': {
    crop: 'Cherry',
    name: 'Powdery mildew',
    type: 'fungal',
    pathogen: 'Podosphaera clandestina',
    severity: 'medium',
    summary:
      'A fungus that grows as a white powder on young leaves and fruit, reducing photosynthesis and fruit quality.',
    symptoms: [
      'White, powdery patches on leaves, mainly young growth',
      'Leaves curl upward, pucker and may drop early',
      'Powdery growth on fruit, which can crack',
    ],
    conditions: 'Warm days, cool nights and high humidity. Unlike most fungi it does not need wet leaves.',
    treatment: {
      cultural: ['Prune for airflow and remove water sprouts, where the disease builds up first'],
      organic: ['Wettable sulfur', 'Potassium bicarbonate', 'Horticultural or neem oil (not within two weeks of sulfur)'],
      chemical: ['Myclobutanil or trifloxystrobin, rotating fungicide groups'],
    },
    prevention: ['Avoid excess nitrogen, which pushes soft, susceptible growth', 'Keep irrigation off the canopy late in the day'],
  },
  'Cherry_(including_sour)___healthy': healthy('Cherry'),
  'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot': {
    crop: 'Corn',
    name: 'Gray leaf spot',
    type: 'fungal',
    pathogen: 'Cercospora zeae-maydis',
    severity: 'high',
    summary:
      'One of the most yield-limiting leaf diseases of maize. Lesions kill leaf tissue during grain fill.',
    symptoms: [
      'Narrow, rectangular tan to gray lesions that run between the leaf veins',
      'Lesions start on lower leaves and move up the plant',
      'Whole leaves blighted in severe cases',
    ],
    conditions: 'Warm, humid weather with long dew periods. Worse where maize follows maize with residue on the surface.',
    treatment: {
      cultural: ['Rotate out of maize for at least one season', 'Bury or manage infected residue where erosion risk allows'],
      organic: [],
      chemical: ['Strobilurin or triazole fungicides (for example azoxystrobin, propiconazole) around tasselling when disease is on the ear leaf or above'],
    },
    prevention: ['Plant hybrids with good gray leaf spot resistance', 'Avoid very dense planting in fields with a history of the disease'],
  },
  'Corn_(maize)___Common_rust_': {
    crop: 'Corn',
    name: 'Common rust',
    type: 'fungal',
    pathogen: 'Puccinia sorghi',
    severity: 'medium',
    summary:
      'A rust fungus that forms brown pustules on both sides of the leaf. Usually moderate, but damaging on susceptible hybrids and sweet corn.',
    symptoms: [
      'Small, oval, cinnamon-brown pustules scattered on both leaf surfaces',
      'Pustules rub off as a rusty powder',
      'Leaves yellow and dry when pustules are dense',
    ],
    conditions: 'Cool to moderate temperatures (16 to 25 °C) with high humidity and heavy dew.',
    treatment: {
      cultural: ['Plant early so the crop matures before rust pressure peaks'],
      organic: [],
      chemical: ['Fungicide (mancozeb, propiconazole or azoxystrobin) only if pustules appear early and cover the upper leaves'],
    },
    prevention: ['Use resistant hybrids', 'Scout from the six-leaf stage in humid seasons'],
  },
  'Corn_(maize)___Northern_Leaf_Blight': {
    crop: 'Corn',
    name: 'Northern leaf blight',
    type: 'fungal',
    pathogen: 'Exserohilum turcicum',
    severity: 'high',
    summary:
      'A fungal blight recognised by long cigar-shaped lesions. Infection before silking can cut yield sharply.',
    symptoms: [
      'Long, elliptical gray-green to tan lesions, 2.5 to 15 cm, shaped like a cigar',
      'Lesions begin on lower leaves and spread upward',
      'Dark sooty spores in the lesions in humid weather',
    ],
    conditions: 'Moderate temperatures (18 to 27 °C) with prolonged leaf wetness.',
    treatment: {
      cultural: ['Rotate crops and manage maize residue', 'Avoid late planting in areas with a history of the disease'],
      organic: [],
      chemical: ['Azoxystrobin, propiconazole or mancozeb when lesions reach the leaves around the ear before tasselling'],
    },
    prevention: ['Choose hybrids with Ht-gene or partial resistance', 'Balanced fertiliser; avoid excessive nitrogen'],
  },
  'Corn_(maize)___healthy': healthy('Corn'),
  Grape___Black_rot: {
    crop: 'Grape',
    name: 'Black rot',
    type: 'fungal',
    pathogen: 'Guignardia bidwellii',
    severity: 'high',
    summary:
      'A fungal disease that spots leaves and turns berries into hard black mummies. It can destroy most of a crop in a wet season.',
    symptoms: [
      'Small tan to brown circular leaf spots with a dark border and tiny black dots inside',
      'Berries turn brown, shrivel and harden into black mummies',
      'Dark, sunken lesions on shoots and tendrils',
    ],
    conditions: 'Warm, rainy weather from bud break to four weeks after bloom.',
    treatment: {
      cultural: ['Remove every mummified berry from the vine and the ground', 'Open the canopy with shoot thinning and leaf removal'],
      organic: ['Copper is only partly effective; sanitation matters most'],
      chemical: ['Mancozeb or captan as protectants', 'Myclobutanil or tebuconazole from before bloom to four weeks after'],
    },
    prevention: ['Prune out infected canes in winter', 'Control weeds under the vines to lower humidity'],
  },
  'Grape___Esca_(Black_Measles)': {
    crop: 'Grape',
    name: 'Esca (black measles)',
    type: 'fungal',
    pathogen: 'A complex of wood fungi including Phaeomoniella chlamydospora and Phaeoacremonium species',
    severity: 'high',
    summary:
      'A trunk disease. Fungi growing in the wood cause striped leaves, spotted berries and, in some vines, sudden collapse.',
    symptoms: [
      'Yellow or red stripes between the leaf veins that dry out ("tiger stripes")',
      'Small dark spots on berries, which may crack and dry',
      'Dark streaks in the wood; vines can wilt suddenly in hot weather',
    ],
    conditions: 'Infection enters through pruning wounds. Symptoms are worst in older vines and after hot, dry spells.',
    treatment: {
      cultural: [
        'There is no cure. Cut the trunk below the dark-streaked wood and retrain a healthy shoot',
        'Remove and burn dead vines and large prunings',
      ],
      organic: ['Biological wound protectants based on Trichoderma applied after pruning'],
      chemical: ['Wound sealants or registered fungicide paint on large pruning cuts'],
    },
    prevention: ['Prune late in the dormant season and in dry weather', 'Disinfect pruning tools between vines'],
  },
  'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)': {
    crop: 'Grape',
    name: 'Leaf blight (Isariopsis leaf spot)',
    type: 'fungal',
    pathogen: 'Pseudocercospora vitis',
    severity: 'low',
    summary:
      'A late-season leaf spot. It is usually minor but can defoliate vines and weaken them for next year.',
    symptoms: [
      'Irregular dark brown spots, often with a yellow halo',
      'Spots merge and leaves dry and fall early',
      'Mostly on older leaves after veraison',
    ],
    conditions: 'Warm, humid weather late in the season.',
    treatment: {
      cultural: ['Collect and destroy fallen leaves', 'Improve airflow through the canopy'],
      organic: ['Copper-based fungicide'],
      chemical: ['Mancozeb; sprays for downy mildew and black rot usually keep it in check'],
    },
    prevention: ['Keep a regular fungicide programme through the wet season', 'Avoid overhead irrigation'],
  },
  Grape___healthy: healthy('Grape'),
  'Orange___Haunglongbing_(Citrus_greening)': {
    crop: 'Orange',
    name: 'Huanglongbing (citrus greening)',
    type: 'bacterial',
    pathogen: 'Candidatus Liberibacter asiaticus, spread by the Asian citrus psyllid',
    severity: 'high',
    summary:
      'The most serious disease of citrus. It is spread by a small insect, has no cure, and infected trees decline and die.',
    symptoms: [
      'Blotchy yellow mottling that is not the same on both halves of the leaf',
      'Yellow shoots, twig dieback and a thin canopy',
      'Small, lopsided, bitter fruit that stays green at the bottom',
    ],
    conditions: 'Spread by psyllids feeding on new flush and by infected planting material.',
    treatment: {
      cultural: [
        'There is no cure. Remove and destroy confirmed infected trees to protect the rest of the orchard',
        'Report suspected cases to the local agriculture department; it is a regulated disease in many regions',
      ],
      organic: ['Encourage the parasitic wasp Tamarixia radiata, a natural enemy of the psyllid'],
      chemical: ['Control the psyllid vector on every new flush with locally recommended insecticides'],
    },
    prevention: ['Plant only certified disease-free nursery trees', 'Monitor for psyllids with yellow sticky traps'],
  },
  Peach___Bacterial_spot: {
    crop: 'Peach',
    name: 'Bacterial spot',
    type: 'bacterial',
    pathogen: 'Xanthomonas arboricola pv. pruni',
    severity: 'medium',
    summary:
      'A bacterial disease that causes shot-holed leaves, early leaf drop and pitted fruit.',
    symptoms: [
      'Small angular, water-soaked spots that turn purple-brown',
      'Centres of the spots fall out, leaving a "shot-hole" look',
      'Sunken, cracked spots on fruit',
    ],
    conditions: 'Warm, wet, windy weather. Worse on sandy soils and stressed trees.',
    treatment: {
      cultural: ['Keep trees vigorous with balanced nutrition', 'Plant windbreaks to reduce leaf injury from blowing sand'],
      organic: ['Copper sprays at leaf fall and before bud break (copper can burn peach foliage in season)'],
      chemical: ['Low-rate copper or oxytetracycline during the season where registered'],
    },
    prevention: ['Choose resistant varieties when planting', 'Avoid overhead irrigation'],
  },
  Peach___healthy: healthy('Peach'),
  'Pepper,_bell___Bacterial_spot': {
    crop: 'Bell pepper',
    name: 'Bacterial spot',
    type: 'bacterial',
    pathogen: 'Xanthomonas species',
    severity: 'medium',
    summary:
      'A seed-borne bacterial disease that spots leaves and fruit and causes heavy leaf drop in warm, wet weather.',
    symptoms: [
      'Small water-soaked spots that turn dark brown, often with a yellow halo',
      'Leaves yellow and drop, exposing fruit to sunscald',
      'Raised, scab-like spots on fruit',
    ],
    conditions: 'Warm (24 to 30 °C), rainy or overhead-irrigated conditions. Spread by splashing water and handling wet plants.',
    treatment: {
      cultural: ['Remove badly affected plants', 'Do not work in the crop while the leaves are wet'],
      organic: ['Copper-based bactericide at the first sign of spotting'],
      chemical: ['Copper tank-mixed with mancozeb improves control where copper-tolerant strains exist'],
    },
    prevention: [
      'Use certified or hot-water-treated seed and disease-free transplants',
      'Rotate away from pepper and tomato for two to three years',
      'Switch to drip irrigation',
    ],
  },
  'Pepper,_bell___healthy': healthy('Bell pepper'),
  Potato___Early_blight: {
    crop: 'Potato',
    name: 'Early blight',
    type: 'fungal',
    pathogen: 'Alternaria solani',
    severity: 'medium',
    summary:
      'A common fungal disease that starts on older leaves as "target" spots and reduces yield by killing foliage early.',
    symptoms: [
      'Dark brown spots with concentric rings, like a target, on older leaves first',
      'Yellowing around the spots; leaves dry and hang on the plant',
      'Dark, sunken, dry lesions on tubers',
    ],
    conditions: 'Warm weather with alternating wet and dry periods. Worse on stressed or nitrogen-deficient plants.',
    treatment: {
      cultural: ['Keep the crop well fed and watered; stressed plants are hit hardest', 'Destroy vines after harvest'],
      organic: ['Copper-based fungicide', 'Bacillus subtilis biofungicide'],
      chemical: ['Chlorothalonil or mancozeb on a 7 to 10 day schedule once spots appear', 'Azoxystrobin or difenoconazole in rotation'],
    },
    prevention: ['Rotate for two years away from potato and tomato', 'Use certified seed tubers'],
  },
  Potato___Late_blight: {
    crop: 'Potato',
    name: 'Late blight',
    type: 'oomycete',
    pathogen: 'Phytophthora infestans',
    severity: 'high',
    summary:
      'The most destructive potato disease. In cool, wet weather it can destroy a field within days and rot tubers in storage.',
    symptoms: [
      'Pale green, water-soaked patches that quickly turn dark brown to black',
      'White fuzzy growth on the underside of leaves in humid conditions',
      'Brown, firm rot under the skin of tubers',
    ],
    conditions: 'Cool (10 to 24 °C), wet, humid weather. Spores travel long distances on the wind.',
    treatment: {
      cultural: [
        'Act immediately: remove and destroy infected plants (do not compost)',
        'Kill the vines two weeks before harvest so spores do not reach the tubers',
      ],
      organic: ['Copper-based fungicide, applied before infection for best effect'],
      chemical: [
        'Protectants: mancozeb or chlorothalonil before wet weather',
        'Systemic or translaminar products (metalaxyl-M, cymoxanil, dimethomorph) following local resistance advice',
      ],
    },
    prevention: [
      'Plant certified seed and resistant varieties',
      'Destroy cull piles and volunteer potatoes',
      'Hill rows well and avoid overhead irrigation in the evening',
    ],
  },
  Potato___healthy: healthy('Potato'),
  Raspberry___healthy: healthy('Raspberry'),
  Soybean___healthy: healthy('Soybean'),
  Squash___Powdery_mildew: {
    crop: 'Squash',
    name: 'Powdery mildew',
    type: 'fungal',
    pathogen: 'Podosphaera xanthii',
    severity: 'medium',
    summary:
      'A very common fungus of squash, pumpkin and cucumber. White powder covers the leaves, which then die early and lower fruit quality.',
    symptoms: [
      'White powdery spots on both sides of the leaves and on stems',
      'Spots spread to cover whole leaves',
      'Leaves yellow, turn brown and papery',
    ],
    conditions: 'Warm, dry days with humid nights. Dense, shaded foliage is affected first.',
    treatment: {
      cultural: ['Remove the worst-affected leaves', 'Give plants more space and full sun'],
      organic: ['Sulfur', 'Potassium bicarbonate', 'Neem oil or horticultural oil'],
      chemical: ['Myclobutanil or azoxystrobin, rotated between fungicide groups'],
    },
    prevention: ['Grow resistant varieties', 'Avoid heavy nitrogen applications'],
  },
  Strawberry___Leaf_scorch: {
    crop: 'Strawberry',
    name: 'Leaf scorch',
    type: 'fungal',
    pathogen: 'Diplocarpon earlianum',
    severity: 'medium',
    summary:
      'A fungal leaf disease. Purple spots merge until leaves look burnt, which weakens plants and lowers next season\'s yield.',
    symptoms: [
      'Many small, irregular dark purple spots on the upper leaf surface',
      'Spots merge and the leaf edges dry and curl as if scorched',
      'No pale centre in the spots (which separates it from common leaf spot)',
    ],
    conditions: 'Long periods of leaf wetness in warm weather.',
    treatment: {
      cultural: ['Remove old and infected leaves after harvest (renovation)', 'Thin runners so air moves through the bed'],
      organic: ['Copper-based fungicide early in the season'],
      chemical: ['Captan or myclobutanil when new leaves emerge'],
    },
    prevention: ['Plant resistant varieties', 'Use drip irrigation', 'Replace old beds every three to four years'],
  },
  Strawberry___healthy: healthy('Strawberry'),
  Tomato___Bacterial_spot: {
    crop: 'Tomato',
    name: 'Bacterial spot',
    type: 'bacterial',
    pathogen: 'Xanthomonas species',
    severity: 'medium',
    summary:
      'A bacterial disease of leaves and fruit, spread by seed, splashing rain and handling. Hard to stop once established.',
    symptoms: [
      'Small, dark, greasy-looking spots on leaves, sometimes with a yellow halo',
      'Leaves yellow and drop from the bottom of the plant',
      'Small raised, scabby spots on green fruit',
    ],
    conditions: 'Warm, wet, windy weather and overhead irrigation.',
    treatment: {
      cultural: ['Remove badly infected plants', 'Stay out of the crop when it is wet'],
      organic: ['Copper-based bactericide at first symptoms'],
      chemical: ['Copper mixed with mancozeb; bacteriophage products where available'],
    },
    prevention: ['Use certified or hot-water-treated seed', 'Rotate for two to three years away from tomato and pepper', 'Mulch and use drip irrigation'],
  },
  Tomato___Early_blight: {
    crop: 'Tomato',
    name: 'Early blight',
    type: 'fungal',
    pathogen: 'Alternaria linariae (Alternaria solani)',
    severity: 'medium',
    summary:
      'A common fungal disease that starts on the oldest leaves and works up the plant, exposing fruit to sunscald.',
    symptoms: [
      'Brown spots with concentric rings ("target" spots) on lower leaves',
      'Yellowing around the spots, then leaf drop',
      'Dark, sunken lesions on stems and at the stem end of fruit',
    ],
    conditions: 'Warm, humid weather with frequent rain or heavy dew.',
    treatment: {
      cultural: ['Remove affected lower leaves', 'Mulch to stop soil splashing onto leaves', 'Stake plants for airflow'],
      organic: ['Copper-based fungicide', 'Bacillus subtilis biofungicide'],
      chemical: ['Chlorothalonil or mancozeb every 7 to 10 days', 'Azoxystrobin or difenoconazole in rotation'],
    },
    prevention: ['Rotate for two years away from tomato, potato and brinjal', 'Water at the base in the morning'],
  },
  Tomato___Late_blight: {
    crop: 'Tomato',
    name: 'Late blight',
    type: 'oomycete',
    pathogen: 'Phytophthora infestans',
    severity: 'high',
    summary:
      'A fast-moving disease that can kill a tomato crop within a week in cool, wet weather. Treat it as an emergency.',
    symptoms: [
      'Large, irregular, greasy gray-green patches that turn brown',
      'White fuzzy growth under the leaf in humid weather',
      'Firm, brown, greasy blotches on fruit',
    ],
    conditions: 'Cool nights, mild days and long wet periods. Spreads on the wind between fields.',
    treatment: {
      cultural: ['Remove and destroy infected plants straight away; bag them, do not compost', 'Warn neighbouring growers'],
      organic: ['Copper-based fungicide as a protectant'],
      chemical: ['Mancozeb or chlorothalonil before wet weather', 'Cymoxanil, dimethomorph or metalaxyl-M mixtures following local advice'],
    },
    prevention: ['Use resistant varieties and healthy transplants', 'Give plants space and avoid wetting foliage', 'Destroy volunteer tomato and potato plants'],
  },
  Tomato___Leaf_Mold: {
    crop: 'Tomato',
    name: 'Leaf mold',
    type: 'fungal',
    pathogen: 'Passalora fulva (Cladosporium fulvum)',
    severity: 'medium',
    summary:
      'A humidity-driven fungus, mostly a problem in greenhouses and polyhouses, that kills leaves from the bottom up.',
    symptoms: [
      'Pale green to yellow spots on the upper leaf surface',
      'Olive-green to brown velvety mold directly underneath',
      'Leaves curl, wither and drop',
    ],
    conditions: 'Relative humidity above 85 percent with poor ventilation.',
    treatment: {
      cultural: ['Ventilate and reduce humidity', 'Remove lower leaves and increase plant spacing'],
      organic: ['Copper-based fungicide'],
      chemical: ['Chlorothalonil or mancozeb; difenoconazole in rotation'],
    },
    prevention: ['Grow resistant varieties', 'Water early in the day at the base', 'Clean and disinfect the structure between crops'],
  },
  Tomato___Septoria_leaf_spot: {
    crop: 'Tomato',
    name: 'Septoria leaf spot',
    type: 'fungal',
    pathogen: 'Septoria lycopersici',
    severity: 'medium',
    summary:
      'A fungal leaf spot that strips the lower leaves after fruit set, weakening the plant and exposing fruit.',
    symptoms: [
      'Many small circular spots with dark borders and gray-white centres',
      'Tiny black dots (fruiting bodies) in the centre of the spots',
      'Lower leaves yellow, brown and fall',
    ],
    conditions: 'Warm, wet weather. Spread by rain splash, tools and hands.',
    treatment: {
      cultural: ['Remove infected lower leaves', 'Mulch and stake plants'],
      organic: ['Copper-based fungicide'],
      chemical: ['Chlorothalonil or mancozeb at 7 to 10 day intervals'],
    },
    prevention: ['Rotate for at least two years', 'Clear crop debris and solanaceous weeds', 'Avoid overhead watering'],
  },
  'Tomato___Spider_mites Two-spotted_spider_mite': {
    crop: 'Tomato',
    name: 'Two-spotted spider mite',
    type: 'pest',
    pathogen: 'Tetranychus urticae (a mite, not a disease)',
    severity: 'medium',
    summary:
      'Tiny mites that suck sap from the underside of leaves. Populations explode in hot, dry, dusty conditions.',
    symptoms: [
      'Fine yellow or white speckling (stippling) on leaves',
      'Leaves turn bronze, dry out and drop',
      'Fine webbing on the underside of leaves and between stems',
    ],
    conditions: 'Hot, dry weather and water-stressed plants. Broad-spectrum insecticides make it worse by killing predators.',
    treatment: {
      cultural: ['Wash mites off with a strong jet of water on the leaf underside', 'Keep plants well watered and reduce dust'],
      organic: ['Release predatory mites (Phytoseiulus persimilis)', 'Neem oil or insecticidal soap, covering leaf undersides'],
      chemical: ['A registered miticide such as abamectin or spiromesifen, rotating modes of action'],
    },
    prevention: ['Avoid unnecessary pyrethroid sprays', 'Check leaf undersides weekly in hot weather'],
  },
  Tomato___Target_Spot: {
    crop: 'Tomato',
    name: 'Target spot',
    type: 'fungal',
    pathogen: 'Corynespora cassiicola',
    severity: 'medium',
    summary:
      'A fungal disease of leaves and fruit, common in warm, humid regions, that is easily confused with early blight.',
    symptoms: [
      'Small brown spots with a light centre and concentric rings, often with a yellow halo',
      'Spots enlarge and merge, starting inside the canopy',
      'Small sunken brown pits on fruit',
    ],
    conditions: 'Warm temperatures with long periods of leaf wetness and dense foliage.',
    treatment: {
      cultural: ['Prune lower leaves and suckers to open the canopy', 'Remove crop residue after harvest'],
      organic: ['Copper-based fungicide (partial control)'],
      chemical: ['Chlorothalonil or mancozeb; azoxystrobin or difenoconazole in rotation'],
    },
    prevention: ['Wider spacing and staking', 'Rotate away from tomato and other host crops'],
  },
  Tomato___Tomato_Yellow_Leaf_Curl_Virus: {
    crop: 'Tomato',
    name: 'Tomato yellow leaf curl virus',
    type: 'viral',
    pathogen: 'Tomato yellow leaf curl virus (a begomovirus), spread by the whitefly Bemisia tabaci',
    severity: 'high',
    summary:
      'A whitefly-borne virus. Plants infected young are stunted and set almost no fruit. There is no cure.',
    symptoms: [
      'Leaves curl upward and turn yellow at the edges',
      'New leaves are small and crumpled; plants are stunted and bushy',
      'Flowers drop and few fruit set',
    ],
    conditions: 'High whitefly populations, especially in warm, dry weather and near older infected crops.',
    treatment: {
      cultural: [
        'Infected plants cannot be cured: pull them out, bag them and remove them from the field',
        'Remove weeds that host whiteflies',
      ],
      organic: ['Yellow sticky traps', 'Neem oil or insecticidal soap against whitefly nymphs', 'Reflective silver mulch'],
      chemical: ['Locally recommended whitefly insecticides, rotating modes of action'],
    },
    prevention: [
      'Grow resistant (Ty-gene) varieties',
      'Raise seedlings under insect-proof net (50 mesh)',
      'Do not plant next to an old tomato crop',
    ],
  },
  Tomato___Tomato_mosaic_virus: {
    crop: 'Tomato',
    name: 'Tomato mosaic virus',
    type: 'viral',
    pathogen: 'Tomato mosaic virus (a tobamovirus)',
    severity: 'medium',
    summary:
      'A very stable virus spread by seed, hands, tools and clothing. It mottles leaves and reduces yield and fruit quality.',
    symptoms: [
      'Light and dark green mosaic or mottling on leaves',
      'Leaves narrow, curl or look fern-like',
      'Stunted plants; fruit may ripen unevenly with brown patches inside',
    ],
    conditions: 'Spread mechanically during transplanting, pruning and tying. It survives for years in dry plant debris.',
    treatment: {
      cultural: [
        'There is no cure. Remove infected plants and wash hands with soap afterwards',
        'Work in healthy rows before infected ones',
      ],
      organic: ['Dip tools in a 10 percent bleach solution or skim-milk solution between plants'],
      chemical: ['None. Chemicals do not control viruses'],
    },
    prevention: ['Use certified, virus-tested seed and resistant varieties', 'Do not handle tobacco products before working in the crop'],
  },
  Tomato___healthy: healthy('Tomato'),
};

/** Crops the disease model was trained on, for the "which crop is this?" selector. */
export const SUPPORTED_CROPS = [...new Set(Object.values(DISEASES).map((d) => d.crop))].sort();

export function diseaseInfo(label) {
  return DISEASES[label] || null;
}

/** Labels belonging to one crop, used to restrict predictions when the farmer names the crop. */
export function labelsForCrop(crop) {
  const wanted = (crop || '').trim().toLowerCase();
  if (!wanted) return [];
  return Object.entries(DISEASES)
    .filter(([, d]) => d.crop.toLowerCase() === wanted)
    .map(([label]) => label);
}
