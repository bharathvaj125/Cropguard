"""Mapping from the 102 fine-grained IP102 classes to the pest groups CropGuard reports.

IP102 labels are very fine-grained (three different cutworms, eight different aphids).
A farmer needs to know "this is an aphid" and what to do about it, and the management
advice is the same within a group, so we merge related species into one class. Classes
that are too rare or too region-specific to be useful are left out.

Keys are the group ids used everywhere else (labels.json, backend knowledge base).
Values are the original IP102 class names exactly as they appear in the dataset.
"""

PEST_GROUPS: dict[str, list[str]] = {
    "aphids": [
        "aphids",
        "english grain aphid",
        "bird cherry-oataphid",
        "green bug",
        "Aphis citricola Vander Goot",
        "Toxoptera aurantii",
        "Toxoptera citricidus",
        "therioaphis maculata Buckton",
    ],
    "leafhoppers": [
        "Cicadellidae",
        "Cicadella viridis",
        "rice leafhopper",
        "Erythroneura apicalis",
        "Mango flat beak leafhopper",
    ],
    "planthoppers": [
        "brown plant hopper",
        "white backed plant hopper",
        "small brown plant hopper",
    ],
    "mirid_bugs": [
        "Miridae",
        "tarnished plant bug",
        "alfalfa plant bug",
        "Apolygus lucorum",
    ],
    "spotted_lanternfly": ["Lycorma delicatula"],
    "stem_borers": [
        "corn borer",
        "asiatic rice borer",
        "yellow rice borer",
        "peach borer",
    ],
    "armyworms": [
        "army worm",
        "beet army worm",
        "cabbage army worm",
        "Prodenia litura",
    ],
    "cutworms": ["black cutworm", "large cutworm", "yellow cutworm"],
    "blister_beetles": ["blister beetle", "legume blister beetle", "lytta polita"],
    "mole_crickets": ["mole cricket"],
    "locusts_grasshoppers": ["Locustoidea"],
    "thrips": [
        "Thrips",
        "Scirtothrips dorsalis Hood",
        "wheat phloeothrips",
        "odontothrips loti",
        "grain spreader thrips",
    ],
    "whiteflies": ["Trialeurodes vaporariorum", "Aleurocanthus spiniferus"],
    "spider_mites": [
        "red spider",
        "Panonchus citri McGregor",
        "longlegged spider mite",
        "penthaleus major",
    ],
    "white_grubs": ["grub"],
    "wireworms": ["wireworm"],
    "weevils": [
        "rice water weevil",
        "alfalfa weevil",
        "beet weevil",
        "Sternochetus frigidus",
    ],
    "flea_beetles": ["flea beetle"],
    "rice_leaf_folders": ["rice leaf roller", "rice leaf caterpillar"],
    "fruit_flies": [
        "Dacus dorsalis(Hendel)",
        "Tetradacus c Bactrocera minax",
        "Bactrocera tsuneonis",
    ],
    "scales_mealybugs": [
        "Icerya purchasi Maskell",
        "Unaspis yanonensis",
        "Ceroplastes rubens",
        "Chrysomphalus aonidum",
        "Pseudococcus comstocki Kuwana",
        "Nipaecoccus vastalor",
        "Parlatoria zizyphus Lucus",
    ],
    "slug_caterpillars": ["Limacodidae"],
    "gall_midges": ["rice gall midge", "wheat blossom midge", "Dasineura sp"],
    "longhorn_beetles": ["Xylotrechus", "Rhytidodera bowrinii white"],
    "budworms_bollworms": ["flax budworm"],
}

# Extra class built from plain leaf photos, so that a leaf with no insect on it has
# somewhere to go other than "the least unlikely pest".
NO_PEST_LABEL = "no_pest"


def ip102_to_group() -> dict[str, str]:
    """Return {original IP102 class name: group id}."""
    out: dict[str, str] = {}
    for group, members in PEST_GROUPS.items():
        for name in members:
            if name in out:
                raise ValueError(f"{name!r} is listed in two groups")
            out[name] = group
    return out
