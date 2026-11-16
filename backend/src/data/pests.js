/**
 * Knowledge base for the pest groups the pest model can output.
 * Keys match ml-service/training/pest_groups.py.
 *
 * Advice follows integrated pest management: monitor first, use cultural and
 * biological control where possible, and treat chemicals as the last step. Active
 * ingredients are examples; registration and dose depend on the country and crop.
 */

export const PESTS = {
  aphids: {
    name: 'Aphids',
    scientific: 'Aphididae (many species)',
    severity: 'medium',
    summary:
      'Small, soft-bodied insects that cluster on shoots and leaf undersides, sucking sap and spreading plant viruses.',
    damage: [
      'Curled, puckered and yellowing young leaves',
      'Sticky honeydew on leaves, followed by black sooty mold',
      'Stunted shoots; many aphid species transmit viruses',
    ],
    crops: ['Wheat', 'Mustard', 'Cotton', 'Vegetables', 'Citrus', 'Pulses'],
    management: {
      cultural: ['Avoid excess nitrogen fertiliser', 'Remove weeds that host aphids', 'Wash colonies off with a strong jet of water'],
      biological: ['Conserve ladybird beetles, lacewings and hoverflies', 'Avoid broad-spectrum sprays that kill these predators'],
      chemical: ['Neem oil or insecticidal soap for light infestations', 'Imidacloprid, thiamethoxam or flonicamid if the threshold is crossed'],
    },
    monitoring: 'Check shoot tips and leaf undersides twice a week; use yellow sticky traps to catch winged aphids arriving.',
  },
  leafhoppers: {
    name: 'Leafhoppers',
    scientific: 'Cicadellidae',
    severity: 'medium',
    summary:
      'Wedge-shaped, fast-moving sap suckers. Feeding causes "hopper burn" and several species spread viral and phytoplasma diseases.',
    damage: [
      'Leaf edges yellow, then turn brown and curl (hopper burn)',
      'White stippling on leaves',
      'Stunted plants; transmission of diseases such as rice tungro',
    ],
    crops: ['Rice', 'Cotton', 'Okra', 'Brinjal', 'Mango', 'Grape', 'Potato'],
    management: {
      cultural: ['Grow tolerant varieties (for example hairy-leaved cotton)', 'Avoid very early or very late sowing', 'Keep field borders free of grassy weeds'],
      biological: ['Conserve spiders, mirid bugs and egg parasitoids'],
      chemical: ['Neem-based sprays', 'Imidacloprid, thiamethoxam or buprofezin when counts exceed the local threshold'],
    },
    monitoring: 'Tap plants over a tray or count nymphs under leaves; light traps show when adults are flying.',
  },
  planthoppers: {
    name: 'Planthoppers',
    scientific: 'Nilaparvata lugens, Sogatella furcifera, Laodelphax striatellus',
    severity: 'high',
    summary:
      'The most damaging sucking pests of rice. They feed at the base of the plant and can dry out whole patches ("hopper burn").',
    damage: [
      'Circular patches of yellowing, then brown, dried-up rice plants',
      'Insects crowded at the base of the tillers near the water line',
      'Sooty mold on honeydew; spread of grassy stunt and ragged stunt viruses',
    ],
    crops: ['Rice'],
    management: {
      cultural: [
        'Drain the field for three to four days when hoppers build up',
        'Avoid close spacing and heavy nitrogen',
        'Leave alleyways every few metres for airflow',
      ],
      biological: ['Conserve spiders and mirid bugs (Cyrtorhinus), which eat hopper eggs and nymphs'],
      chemical: [
        'Avoid pyrethroids and early-season sprays, which trigger hopper resurgence',
        'Buprofezin, pymetrozine or dinotefuran directed at the base of the plants when above threshold',
      ],
    },
    monitoring: 'Part the canopy and count hoppers at the base of 20 hills each week from tillering onwards.',
  },
  mirid_bugs: {
    name: 'Mirid plant bugs',
    scientific: 'Miridae (Lygus, Apolygus, Adelphocoris)',
    severity: 'medium',
    summary:
      'Fast-moving bugs that pierce buds, flowers and young fruit, causing them to drop or grow misshapen.',
    damage: [
      'Buds, flowers and small bolls or pods shed',
      'Ragged holes in young leaves as they expand',
      'Misshapen fruit with corky scars',
    ],
    crops: ['Cotton', 'Alfalfa', 'Tea', 'Beans', 'Strawberry', 'Grape'],
    management: {
      cultural: ['Manage flowering weeds around fields', 'Cut alfalfa in strips so bugs are not driven into nearby crops all at once'],
      biological: ['Conserve damsel bugs, big-eyed bugs and spiders'],
      chemical: ['Sulfoxaflor, flonicamid or acetamiprid at the squaring and flowering stage if counts exceed threshold'],
    },
    monitoring: 'Sweep-net or beat-sheet sampling in the early morning, when the bugs are least active.',
  },
  spotted_lanternfly: {
    name: 'Spotted lanternfly',
    scientific: 'Lycorma delicatula',
    severity: 'high',
    summary:
      'An invasive planthopper that feeds in large groups on vines and fruit trees, weakening them and coating everything in honeydew.',
    damage: [
      'Oozing sap and wilting on trunks and canes',
      'Heavy honeydew and sooty mold on leaves and fruit',
      'Reduced vigour and winter hardiness in grapevines',
    ],
    crops: ['Grape', 'Apple', 'Peach', 'Plum', 'Walnut'],
    management: {
      cultural: ['Scrape off and destroy egg masses in winter', 'Remove tree-of-heaven (Ailanthus), its preferred host, near orchards'],
      biological: ['Sticky bands or circle traps on trunks to catch climbing nymphs'],
      chemical: ['Dinotefuran, bifenthrin or carbaryl on infested vines and trees where registered'],
    },
    monitoring: 'Inspect trunks at dusk, when the insects gather. In regulated areas, report sightings to the agriculture department.',
  },
  stem_borers: {
    name: 'Stem borers',
    scientific: 'Chilo suppressalis, Scirpophaga incertulas, Ostrinia furnacalis and related moths',
    severity: 'high',
    summary:
      'Moth caterpillars that tunnel inside stems. The growing point dies ("dead heart") or the ear head turns white and empty.',
    damage: [
      'Central shoot dries and pulls out easily (dead heart)',
      'Empty, white ear heads in rice (white ear)',
      'Bore holes with frass on maize stalks and cobs; plants lodge',
    ],
    crops: ['Rice', 'Maize', 'Sugarcane', 'Sorghum', 'Peach'],
    management: {
      cultural: [
        'Plough in or destroy stubble after harvest to kill overwintering larvae',
        'Clip the tips of rice seedlings before transplanting to remove egg masses',
        'Synchronise planting across the village',
      ],
      biological: ['Release Trichogramma egg parasitoids', 'Pheromone traps for monitoring and mass trapping'],
      chemical: ['Chlorantraniliprole or cartap hydrochloride granules at the threshold', 'Bacillus thuringiensis sprays into the maize whorl'],
    },
    monitoring: 'Look for egg masses on leaves and count dead hearts per 100 tillers; act at about 5 percent.',
  },
  armyworms: {
    name: 'Armyworms',
    scientific: 'Spodoptera and Mythimna species',
    severity: 'high',
    summary:
      'Caterpillars that feed mostly at night and move in large numbers from field to field, stripping leaves to the midrib.',
    damage: [
      'Windowpane patches scraped by small larvae',
      'Ragged holes and whole leaves eaten, leaving only the midrib',
      'Wet, sawdust-like frass in maize whorls',
    ],
    crops: ['Maize', 'Rice', 'Wheat', 'Sorghum', 'Cabbage', 'Soybean', 'Cotton'],
    management: {
      cultural: ['Deep plough after harvest to expose pupae', 'Hand-pick egg masses and young larvae', 'Dig a trench around the field to stop marching larvae'],
      biological: ['Trichogramma and Telenomus egg parasitoids', 'Bacillus thuringiensis, NPV or Metarhizium while larvae are small'],
      chemical: ['Emamectin benzoate, spinetoram or chlorantraniliprole, applied in the evening into the whorl'],
    },
    monitoring: 'Scout at dawn or dusk. Pheromone traps show when moths arrive; check 20 plants in five places.',
  },
  cutworms: {
    name: 'Cutworms',
    scientific: 'Agrotis species',
    severity: 'medium',
    summary:
      'Fat, greasy-looking caterpillars that hide in the soil by day and cut seedlings off at ground level at night.',
    damage: [
      'Seedlings cut off at or just below the soil line',
      'Wilted plants with chewed stems',
      'Gaps in the row soon after emergence',
    ],
    crops: ['Maize', 'Potato', 'Tomato', 'Tobacco', 'Chickpea', 'Vegetable seedlings'],
    management: {
      cultural: ['Plough two to three weeks before sowing and keep the field weed-free', 'Flood irrigation drives larvae to the surface for birds', 'Collars around transplants in small plots'],
      biological: ['Encourage birds with perches', 'Entomopathogenic nematodes (Steinernema) in moist soil'],
      chemical: ['Bran bait with a registered insecticide placed in the evening', 'Chlorpyrifos or lambda-cyhalothrin soil-directed spray along the rows'],
    },
    monitoring: 'Dig around freshly cut plants to find the curled larva; check the crop daily in the first three weeks.',
  },
  blister_beetles: {
    name: 'Blister beetles',
    scientific: 'Meloidae (Mylabris, Epicauta, Lytta)',
    severity: 'low',
    summary:
      'Brightly banded beetles that feed on flowers and pollen. They release a fluid that blisters skin and is toxic to livestock in fodder.',
    damage: [
      'Flowers and tender pods eaten, reducing pod set',
      'Ragged feeding on leaves by swarms',
      'Contaminated hay can poison horses and cattle',
    ],
    crops: ['Pigeon pea', 'Cowpea', 'Green gram', 'Okra', 'Alfalfa', 'Soybean'],
    management: {
      cultural: ['Hand-collect beetles in the early morning with gloves on and drop them in soapy water', 'Do not crush beetles on bare skin'],
      biological: ['Tolerate small numbers; the larvae feed on grasshopper eggs and are partly beneficial'],
      chemical: ['Spot treatment with a registered pyrethroid only if swarms are damaging flowers'],
    },
    monitoring: 'Check flowers at mid-morning during flowering; beetles gather in groups and are easy to see.',
  },
  mole_crickets: {
    name: 'Mole crickets',
    scientific: 'Gryllotalpidae',
    severity: 'medium',
    summary:
      'Burrowing insects with shovel-like front legs that tunnel just under the soil surface, cutting roots and uprooting seedlings.',
    damage: [
      'Raised, winding tunnels on the soil surface',
      'Seedlings wilt and die because roots are cut',
      'Holes chewed in tubers and groundnut pods',
    ],
    crops: ['Rice nurseries', 'Potato', 'Groundnut', 'Vegetable seedlings', 'Turf'],
    management: {
      cultural: ['Flood the field for a day to force them out', 'Deep plough to expose eggs and nymphs', 'Use well-decomposed manure only'],
      biological: ['Light traps catch flying adults in the evening', 'Entomopathogenic nematodes (Steinernema scapterisci)'],
      chemical: ['Poison bait of bran with a registered insecticide broadcast at dusk'],
    },
    monitoring: 'Pour soapy water over one square metre of soil; crickets come to the surface within minutes.',
  },
  locusts_grasshoppers: {
    name: 'Locusts and grasshoppers',
    scientific: 'Acrididae',
    severity: 'high',
    summary:
      'Chewing insects that eat almost any green plant. Swarming locusts can strip a field in hours.',
    damage: ['Leaves eaten from the edges inwards', 'Whole plants stripped to the stalk during outbreaks', 'Ear heads and pods chewed'],
    crops: ['Cereals', 'Millets', 'Pulses', 'Vegetables', 'Pasture'],
    management: {
      cultural: ['Plough field bunds and fallow land after harvest to expose egg pods', 'Keep bunds clear of grassy weeds'],
      biological: ['Metarhizium acridum biopesticide against hopper bands', 'Encourage birds and poultry in the field'],
      chemical: ['Malathion or lambda-cyhalothrin on young hopper bands', 'Report locust swarms to the locust control office; control is coordinated regionally'],
    },
    monitoring: 'Walk field edges and bunds; treat while hoppers are still wingless and grouped.',
  },
  thrips: {
    name: 'Thrips',
    scientific: 'Thysanoptera (Thrips, Scirtothrips, Frankliniella)',
    severity: 'medium',
    summary:
      'Tiny, slender insects that rasp the leaf surface and suck the sap. They also carry tospoviruses such as bud necrosis.',
    damage: [
      'Silvery streaks and speckling on leaves with tiny black dots of excrement',
      'Leaves curl upward and become brittle',
      'Scarred, deformed fruit and flowers',
    ],
    crops: ['Chilli', 'Onion', 'Cotton', 'Groundnut', 'Rice', 'Citrus', 'Grape'],
    management: {
      cultural: ['Overhead irrigation or rain knocks populations down', 'Reflective mulch', 'Remove weed hosts and crop residue'],
      biological: ['Predatory mites (Amblyseius) and minute pirate bugs (Orius)', 'Blue sticky traps'],
      chemical: ['Spinosad or spinetoram', 'Fipronil or acetamiprid, rotating groups because thrips develop resistance quickly'],
    },
    monitoring: 'Tap flowers and shoot tips over white paper and count; blue sticky traps track adult numbers.',
  },
  whiteflies: {
    name: 'Whiteflies',
    scientific: 'Aleyrodidae (Bemisia tabaci, Trialeurodes vaporariorum)',
    severity: 'high',
    summary:
      'Small white, moth-like insects on leaf undersides. They weaken plants and transmit leaf curl and yellow mosaic viruses.',
    damage: [
      'Clouds of white insects fly up when the plant is shaken',
      'Yellowing leaves, honeydew and sooty mold',
      'Leaf curl and mosaic virus symptoms',
    ],
    crops: ['Cotton', 'Tomato', 'Chilli', 'Okra', 'Brinjal', 'Pulses', 'Citrus'],
    management: {
      cultural: ['Remove alternate weed hosts', 'Avoid overlapping crops; observe a host-free period', 'Raise seedlings under insect-proof net'],
      biological: ['Yellow sticky traps', 'Encarsia and Eretmocerus parasitoids', 'Neem oil or insecticidal soap on leaf undersides'],
      chemical: ['Pyriproxyfen, spiromesifen, diafenthiuron or flonicamid in rotation', 'Avoid repeated pyrethroid sprays, which cause flare-ups'],
    },
    monitoring: 'Count adults on the underside of the third leaf from the top in the early morning.',
  },
  spider_mites: {
    name: 'Spider mites',
    scientific: 'Tetranychidae (Tetranychus, Panonychus) and related mites',
    severity: 'medium',
    summary:
      'Tiny eight-legged pests, barely visible, that suck out cell contents and spin fine webbing. Worst in hot, dry weather.',
    damage: [
      'Fine yellow or white stippling on leaves',
      'Bronzing, drying and leaf drop',
      'Fine webbing on leaf undersides and shoot tips',
    ],
    crops: ['Cotton', 'Tea', 'Citrus', 'Okra', 'Brinjal', 'Beans', 'Wheat'],
    management: {
      cultural: ['Keep plants well watered; water stress favours mites', 'Wash leaf undersides with a jet of water', 'Reduce dust on field roads'],
      biological: ['Predatory mites (Phytoseiulus, Neoseiulus)', 'Avoid pyrethroids, which kill predators and cause outbreaks'],
      chemical: ['Wettable sulfur or horticultural oil', 'Miticides such as spiromesifen, propargite or fenpyroximate in rotation'],
    },
    monitoring: 'Check leaf undersides with a hand lens, or tap a leaf over white paper and look for moving specks.',
  },
  white_grubs: {
    name: 'White grubs',
    scientific: 'Scarabaeidae larvae (Holotrichia and others)',
    severity: 'high',
    summary:
      'C-shaped white larvae of chafer beetles that live in the soil and eat roots, killing plants in patches.',
    damage: [
      'Plants wilt and die in patches and pull out easily with no roots',
      'Holes in tubers and groundnut pods',
      'Adult beetles chew tree leaves at night after the first rains',
    ],
    crops: ['Groundnut', 'Sugarcane', 'Potato', 'Maize', 'Soybean', 'Upland rice'],
    management: {
      cultural: ['Deep summer ploughing to expose grubs to birds', 'Collect adult beetles from host trees at night after the first monsoon showers'],
      biological: ['Metarhizium anisopliae or Beauveria brongniartii mixed with compost', 'Entomopathogenic nematodes (Heterorhabditis)'],
      chemical: ['Seed treatment or soil drench with imidacloprid or chlorpyrifos at sowing in fields with a history of grubs'],
    },
    monitoring: 'Dig several 30 cm pits before sowing; more than one grub per square metre justifies treatment.',
  },
  wireworms: {
    name: 'Wireworms',
    scientific: 'Elateridae larvae (click beetles)',
    severity: 'medium',
    summary:
      'Hard, shiny, yellow-brown larvae that live in the soil for years and bore into seeds, roots and tubers.',
    damage: ['Seeds hollowed out before they germinate', 'Narrow, clean tunnels in potato tubers and carrots', 'Thin stands and wilting seedlings'],
    crops: ['Potato', 'Maize', 'Wheat', 'Carrot', 'Sugar beet'],
    management: {
      cultural: ['Avoid planting susceptible crops straight after pasture or grassy fallow', 'Plough in summer to dry out and expose larvae', 'Harvest tubers promptly once mature'],
      biological: ['Rotate with mustard or buckwheat, which suppress wireworms', 'Entomopathogenic fungi (Metarhizium)'],
      chemical: ['Insecticide seed treatment or in-furrow application at planting where populations are high'],
    },
    monitoring: 'Bury baits of soaked grain or cut potato 10 cm deep before planting and count larvae after a week.',
  },
  weevils: {
    name: 'Weevils',
    scientific: 'Curculionidae',
    severity: 'medium',
    summary:
      'Beetles with a long snout. Adults notch leaves and the legless larvae feed inside roots, stems, seeds or fruit.',
    damage: [
      'Notches or long scars on leaves from adult feeding',
      'Larvae prune roots, causing stunted, yellow plants',
      'Larvae inside fruit, seeds or stems',
    ],
    crops: ['Rice', 'Alfalfa', 'Sugar beet', 'Mango', 'Cotton', 'Stored grain'],
    management: {
      cultural: ['Drain rice fields briefly to kill root-feeding larvae', 'Collect and destroy fallen fruit', 'Rotate crops and remove residue'],
      biological: ['Beauveria bassiana', 'Entomopathogenic nematodes for soil-dwelling stages'],
      chemical: ['A registered insecticide timed against adults before they lay eggs'],
    },
    monitoring: 'Look for fresh leaf scars and adults at field edges, where infestations usually begin.',
  },
  flea_beetles: {
    name: 'Flea beetles',
    scientific: 'Chrysomelidae: Alticini (Phyllotreta and others)',
    severity: 'medium',
    summary:
      'Small, shiny beetles that jump like fleas when disturbed. They pepper seedling leaves with tiny holes.',
    damage: [
      'Many small round "shot-holes" in leaves',
      'Seedlings stunted or killed in dry, sunny weather',
      'Larvae feed on roots and tubers',
    ],
    crops: ['Mustard', 'Cabbage', 'Radish', 'Brinjal', 'Potato', 'Sugar beet'],
    management: {
      cultural: ['Sow so seedlings grow quickly through the vulnerable stage', 'Floating row covers on small plots', 'Trap crops such as radish around the field'],
      biological: ['Yellow sticky traps', 'Entomopathogenic nematodes against the larvae'],
      chemical: ['Insecticide seed treatment', 'Spinosad or a pyrethroid when more than a quarter of seedling leaf area is lost'],
    },
    monitoring: 'Inspect seedlings on warm, sunny afternoons, when the beetles are most active.',
  },
  rice_leaf_folders: {
    name: 'Rice leaf folders',
    scientific: 'Cnaphalocrocis medinalis and related caterpillars',
    severity: 'medium',
    summary:
      'Caterpillars that fold or roll a rice leaf into a tube and scrape the green tissue from inside it.',
    damage: [
      'Leaves folded lengthwise and stitched with silk',
      'White, papery streaks where the green layer has been scraped off',
      'Scorched look across the field in heavy attacks',
    ],
    crops: ['Rice'],
    management: {
      cultural: ['Avoid excess nitrogen and close planting', 'Remove grassy weeds from bunds', 'Drag a rope across young crops to dislodge larvae'],
      biological: ['Trichogramma chilonis releases', 'Conserve spiders and wasps; the crop tolerates moderate damage before flowering'],
      chemical: ['Chlorantraniliprole, flubendiamide or cartap if damage passes threshold, especially on the flag leaf'],
    },
    monitoring: 'Count damaged leaves per hill; about 10 percent at tillering or 5 percent at flowering is the usual threshold.',
  },
  fruit_flies: {
    name: 'Fruit flies',
    scientific: 'Tephritidae (Bactrocera species)',
    severity: 'high',
    summary:
      'Flies that lay eggs under the skin of ripening fruit. The maggots feed inside, so the fruit rots and drops.',
    damage: [
      'Small punctures on fruit that ooze sap',
      'Soft, rotting patches with maggots inside',
      'Early fruit drop',
    ],
    crops: ['Mango', 'Guava', 'Citrus', 'Gourds', 'Melon', 'Tomato'],
    management: {
      cultural: ['Collect and bury or bag all fallen and infested fruit every few days', 'Harvest at the mature-green stage', 'Bag individual fruit on small plots'],
      biological: ['Methyl eugenol or cue-lure traps for mass trapping males', 'Protein bait sprays on spots of foliage'],
      chemical: ['Bait spray of protein hydrolysate with spinosad or malathion rather than cover sprays'],
    },
    monitoring: 'Hang lure traps from fruit set onwards and check the catch each week.',
  },
  scales_mealybugs: {
    name: 'Scale insects and mealybugs',
    scientific: 'Coccoidea (Icerya, Unaspis, Ceroplastes, Pseudococcus and others)',
    severity: 'medium',
    summary:
      'Sap-sucking insects that look like waxy bumps or white cottony masses stuck to stems, leaves and fruit.',
    damage: [
      'White cottony masses or hard shell-like bumps on bark, leaves and fruit',
      'Honeydew and black sooty mold',
      'Yellowing leaves, twig dieback and blemished fruit',
    ],
    crops: ['Citrus', 'Mango', 'Grape', 'Guava', 'Coffee', 'Cotton', 'Ornamentals'],
    management: {
      cultural: ['Prune out heavily infested branches', 'Control ants, which protect these insects from their enemies', 'Scrub trunks or use sticky bands'],
      biological: ['Release Cryptolaemus ladybird beetles', 'Conserve parasitic wasps and the vedalia beetle (Rodolia)'],
      chemical: ['Horticultural oil against the crawler stage', 'Buprofezin or spirotetramat when crawlers are active'],
    },
    monitoring: 'Check bark crevices, fruit stalks and leaf undersides; trails of ants are an early sign.',
  },
  slug_caterpillars: {
    name: 'Slug caterpillars',
    scientific: 'Limacodidae',
    severity: 'low',
    summary:
      'Short, slug-like caterpillars, often brightly coloured with stinging spines, that feed on leaves of trees and palms.',
    damage: [
      'Young larvae scrape the leaf surface, leaving pale windows',
      'Older larvae eat whole leaves from the edge',
      'Painful sting on contact with skin',
    ],
    crops: ['Tea', 'Coconut', 'Oil palm', 'Mango', 'Banana', 'Fruit trees'],
    management: {
      cultural: ['Prune and destroy infested leaves, wearing gloves', 'Collect cocoons from trunks and soil'],
      biological: ['Light traps for adult moths', 'Bacillus thuringiensis on young larvae; natural viruses often end outbreaks'],
      chemical: ['A registered contact insecticide only in severe outbreaks'],
    },
    monitoring: 'Look at the underside of older leaves for groups of small larvae and scraped patches.',
  },
  gall_midges: {
    name: 'Gall midges',
    scientific: 'Cecidomyiidae (Orseolia, Sitodiplosis, Dasineura)',
    severity: 'medium',
    summary:
      'Tiny mosquito-like flies whose maggots feed inside the growing point or developing grain, turning it into a gall.',
    damage: [
      'Rice tillers become hollow silvery tubes ("onion leaf" or silver shoot) that bear no panicle',
      'Shrivelled, empty grains in wheat',
      'Swollen, distorted leaves or flower buds',
    ],
    crops: ['Rice', 'Wheat', 'Mango', 'Sorghum'],
    management: {
      cultural: ['Plant early and at the same time as neighbours', 'Remove grassy weeds and wild rice that carry the pest over', 'Avoid excess nitrogen'],
      biological: ['Conserve Platygaster parasitoid wasps'],
      chemical: ['Carbofuran or fipronil granules at 10 to 15 days after transplanting where the pest is endemic'],
    },
    monitoring: 'Count silver shoots per hill from the tillering stage; light traps catch adults at night.',
  },
  longhorn_beetles: {
    name: 'Longhorn beetles',
    scientific: 'Cerambycidae (Xylotrechus, Rhytidodera and others)',
    severity: 'high',
    summary:
      'Beetles with very long antennae whose larvae bore inside stems and trunks, ringing or hollowing them.',
    damage: [
      'Ridges, cracks or bore holes on the stem with sawdust-like frass',
      'Wilting and yellowing of branches or whole plants',
      'Stems snap easily at the tunnelled section',
    ],
    crops: ['Coffee', 'Mango', 'Grape', 'Citrus', 'Mulberry'],
    management: {
      cultural: ['Uproot and burn badly infested plants before adults emerge', 'Keep adequate shade in coffee; scrub loose bark from stems'],
      biological: ['Pheromone traps during the flight period', 'Insert a wire into bore holes to kill larvae'],
      chemical: ['Swab stems with lime or a registered insecticide during the flight period', 'Inject bore holes and seal them with mud'],
    },
    monitoring: 'Inspect main stems for ridges and fresh frass before and after the two annual flight periods.',
  },
  budworms_bollworms: {
    name: 'Budworms and bollworms',
    scientific: 'Heliothis and Helicoverpa species',
    severity: 'high',
    summary:
      'Caterpillars that bore into buds, flowers, pods, bolls and fruit, feeding with the head inside and the body outside.',
    damage: [
      'Round holes in buds, pods, bolls and fruit',
      'Flowers and young bolls shed',
      'Frass around entry holes; damaged seed and lint',
    ],
    crops: ['Cotton', 'Chickpea', 'Pigeon pea', 'Tomato', 'Maize', 'Linseed', 'Sunflower'],
    management: {
      cultural: ['Deep summer ploughing to expose pupae', 'Marigold or chickpea trap crops', 'Bird perches in the field'],
      biological: ['HaNPV virus and Bacillus thuringiensis on young larvae', 'Trichogramma releases', 'Pheromone traps'],
      chemical: ['Emamectin benzoate, chlorantraniliprole or indoxacarb at threshold, rotating groups'],
    },
    monitoring: 'Pheromone traps for moths and weekly counts of eggs and small larvae on 20 plants.',
  },
  no_pest: {
    name: 'No pest visible',
    scientific: '',
    severity: 'none',
    summary: 'No insect or mite pest was recognised in this photo.',
    damage: [],
    crops: [],
    management: { cultural: [], biological: [], chemical: [] },
    monitoring:
      'Many pests hide under leaves or in the soil. If you see damage, photograph the insect itself up close and scan again.',
  },
};

export function pestInfo(label) {
  return PESTS[label] || null;
}
