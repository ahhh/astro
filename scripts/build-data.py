#!/usr/bin/env python3
"""Build the static datasets for Celestial Birth Atlas.

Star and constellation data come from the sibling ../starexplorer project,
which already imported the HYG Database v4.1 (Hipparcos / Yale BSC / Gliese)
and the IAU J2000 constellation boundaries + figures (via d3-celestial).
City data comes from a GeoNames cities15000 dump (CC BY 4.0) passed as an
argument, so birthplaces can be resolved fully offline.

Usage:
    python3 scripts/build-data.py [path/to/geonames_dir]

Outputs (all J2000 / ICRS-aligned unless noted):
    data/stars.json          naked-eye stars (V <= 6.5) with proper motion
    data/fixed-stars.json    curated traditional fixed stars, matched to HYG
    data/constellations.json IAU boundaries, figures, names
    data/cities.json         compact gazetteer with IANA time zones
"""

import csv
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAREXPLORER = os.path.join(os.path.dirname(ROOT), "starexplorer")
HYG_CSV = os.path.join(STAREXPLORER, "scripts", ".cache", "hyg.csv")
CONSTELLATIONS = os.path.join(STAREXPLORER, "data", "constellations.json")
OUT = os.path.join(ROOT, "data")

MAG_LIMIT = 6.5

# Traditional fixed stars. "nature" is the Ptolemaic planetary nature as
# given in Ptolemy's Tetrabiblos I.9 (via Robson, "The Fixed Stars and
# Constellations in Astrology", 1923). Keywords are a short paraphrase of
# that traditional lore. They are symbolic, not physical, claims.
FIXED_STARS = [
    ("Algol", "Saturn/Jupiter", "The 'Demon Star' of Medusa's head; traditionally the most feared star, linked to intensity, loss of head, and raw passion."),
    ("Alcyone", "Moon/Mars", "Brightest of the Pleiades; tradition associates it with vision, sorrow, and things seen through tears."),
    ("Prima Hyadum", "Saturn/Mercury", "Leader of the Hyades, the 'rain-makers'; linked to turbulence and upheaval."),
    ("Aldebaran", "Mars", "Eye of the Bull and one of the four Royal Stars of Persia (Watcher of the East); integrity, courage, success that must be earned honestly."),
    ("Rigel", "Jupiter/Saturn", "The left foot of Orion; associated with teaching, technical skill and lasting achievement."),
    ("Capella", "Mars/Mercury", "The 'little she-goat'; curiosity, inquisitiveness and love of learning."),
    ("Bellatrix", "Mars/Mercury", "The 'female warrior' on Orion's shoulder; quick success and sharp speech."),
    ("Elnath", "Mars", "Tip of the Bull's northern horn; tradition gives it eminence and good fortune."),
    ("Mintaka", "Saturn/Mercury", "Westernmost star of Orion's belt; good fortune and steady character."),
    ("Alnilam", "Jupiter/Saturn", "Central star of Orion's belt, a 'string of pearls'; fleeting public honours."),
    ("Alnitak", "Saturn/Mercury", "Easternmost star of Orion's belt; associated with determination."),
    ("Betelgeuse", "Mars/Mercury", "Orion's shoulder; martial honours and lasting success."),
    ("Alhena", "Mercury/Venus", "The 'mark' on the foot of Pollux; artistic and spiritual interests."),
    ("Sirius", "Jupiter/Mars", "The Dog Star, brightest in the night sky; fame, ambition, and the burning heat of devotion."),
    ("Canopus", "Saturn/Jupiter", "The ship Argo's pilot; voyages, education, and turning evil into good."),
    ("Castor", "Mercury", "The mortal twin; keen intellect, sudden reversals."),
    ("Pollux", "Mars", "The immortal twin; boldness, a sting in the tail."),
    ("Procyon", "Mercury/Mars", "'Before the dog'; sudden rise that may be short-lived."),
    ("Asellus Borealis", "Mars/Sun", "Northern donkey, beside the Praesepe cluster; patience and care."),
    ("Asellus Australis", "Mars/Sun", "Southern donkey; tradition gives it a fiery, charitable nature."),
    ("Acubens", "Saturn/Mercury", "The claw of the Crab; tenacity and a hidden nature."),
    ("Alphard", "Saturn/Venus", "The 'solitary one' in the Hydra's heart; passions and wisdom born of trouble."),
    ("Regulus", "Mars/Jupiter", "Heart of the Lion and Royal Star (Watcher of the North); greatness and leadership, lost through revenge."),
    ("Zosma", "Saturn/Venus", "On the Lion's back; benefit through misfortune, a sense of being a victim."),
    ("Denebola", "Saturn/Venus", "The Lion's tail; swift judgement and going against convention."),
    ("Vindemiatrix", "Saturn/Mercury", "The 'grape-gatherer'; tradition links it with widowhood and gathering what was sown."),
    ("Algorab", "Mars/Saturn", "The Raven's wing; scavenging, persistence, and charm."),
    ("Spica", "Venus/Mars", "The ear of wheat held by the Virgin; gifts, brilliance and protection - widely called the most fortunate fixed star."),
    ("Arcturus", "Mars/Jupiter", "The 'bear-watcher'; pathfinding and success through new methods."),
    ("Zubenelgenubi", "Saturn/Mars", "The southern claw (of the Scorpion, now in Libra); social reform and the price of ambition."),
    ("Zubeneschamali", "Jupiter/Mercury", "The northern claw; tradition gives it good fortune and high ambition."),
    ("Alphecca", "Venus/Mercury", "The gem of the Northern Crown; artistic gifts and dignity."),
    ("Unukalhai", "Saturn/Mars", "The Serpent's neck; tradition flags danger and poison, also endurance."),
    ("Antares", "Mars/Jupiter", "Heart of the Scorpion and Royal Star (Watcher of the West); intensity, obsession and success through conflict."),
    ("Rasalhague", "Saturn/Venus", "Head of the Serpent-bearer (Ophiuchus); healing and medicine."),
    ("Rasalgethi", "Mars/Venus", "The kneeler's head (Hercules); boldness and audacity."),
    ("Lesath", "Mercury/Mars", "The Scorpion's sting; danger and acidity in tradition."),
    ("Shaula", "Mercury/Mars", "The raised sting of the Scorpion; tradition links it to sharp edges."),
    ("Sabik", "Saturn/Venus", "In the knee of Ophiuchus; sincerity and moral courage."),
    ("Kaus Australis", "Jupiter/Mars", "The Archer's bow; tradition links it to directed aim."),
    ("Nunki", "Jupiter/Mercury", "The Archer's arrow-hand; truthfulness and religious feeling."),
    ("Vega", "Venus/Mercury", "The falling eagle of the Lyre; charisma and artistic talent."),
    ("Altair", "Mars/Jupiter", "The flying eagle; boldness and sudden but short-lived wealth."),
    ("Deneb Algedi", "Saturn/Jupiter", "The Sea-goat's tail; law and justice, sorrow and joy alternating."),
    ("Sadalsuud", "Saturn/Mercury", "'Luck of lucks' in Aquarius; good fortune in tradition."),
    ("Sadalmelik", "Saturn/Mercury", "'Luck of the king' in Aquarius; persecution followed by vindication."),
    ("Fomalhaut", "Venus/Mercury", "Mouth of the Southern Fish and Royal Star (Watcher of the South); idealism and fame, with a warning against corruption."),
    ("Deneb", "Venus/Mercury", "Tail of the Swan (Deneb Adige); quick intellect and an artistic temperament."),
    ("Markab", "Mars/Mercury", "The saddle of Pegasus; honours and riches, also danger from cuts or fire."),
    ("Scheat", "Mars/Mercury", "Leg of Pegasus; independent thinking and misfortune in tradition."),
    ("Algenib", "Mars/Mercury", "Wing of Pegasus; notoriety, determination, quick action."),
    ("Alpheratz", "Jupiter/Venus", "Navel of the Horse / head of Andromeda; independence and freedom."),
    ("Mirach", "Venus", "Girdle of Andromeda; beauty, love and kindliness."),
    ("Hamal", "Mars/Saturn", "Forehead of the Ram; independence and headstrong action."),
    ("Schedar", "Saturn/Venus", "Breast of Cassiopeia; dignity and command."),
    ("Menkar", "Saturn", "Jaw of the sea-monster Cetus; tradition links it to collective burdens."),
    ("Diphda", "Saturn", "Tail of Cetus (Deneb Kaitos); self-destruction and forced inertia in tradition."),
    ("Achernar", "Jupiter", "River's end in Eridanus; success in public office and religion."),
    ("Mirfak", "Jupiter/Saturn", "Brightest star of Perseus; the hero's courage."),
    ("Polaris", "Saturn/Venus", "The Pole Star; a fixed guide, illness and trouble in tradition."),
    ("Dubhe", "Mars", "The Great Bear's back; tradition gives it a destructive power."),
    ("Alkaid", "Mars", "Tip of the Great Bear's tail (Benetnash); tradition links it to mourning."),
    ("Thuban", "Saturn/Mars", "Pole star of ancient Egypt, in the Dragon; guardian of treasure."),
    ("Acrux", "Jupiter", "Foot of the Southern Cross; ceremonial magic and justice."),
    ("Hadar", "Venus/Jupiter", "Foreleg of the Centaur (Agena); friendship, honour and health."),
    ("Rigil Kentaurus", "Venus/Jupiter", "Foot of the Centaur (Toliman); refinement and friendships. Physically the nearest bright star."),
    ("Adhara", "Venus", "Hindquarters of the Great Dog; tradition links it to the voice."),
    ("Alderamin", "Saturn/Jupiter", "Right arm of Cepheus; dignity and authority."),
]

def num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_stars():
    stars = []
    by_name = {}
    with open(HYG_CSV, newline="") as handle:
        for row in csv.DictReader(handle):
            if row["id"] == "0":
                continue  # the Sun
            mag = num(row["mag"])
            if mag is None:
                continue
            proper = row["proper"].strip()
            # keep every named star even if faint, so fixed-star lookup works
            if mag > MAG_LIMIT and not proper:
                continue
            ra_h = num(row["ra"])
            dec = num(row["dec"])
            if ra_h is None or dec is None:
                continue
            bayer = row["bayer"].strip()
            flam = row["flam"].strip()
            con = row["con"].strip()
            desig = ""
            if bayer:
                desig = f"{bayer} {con}"
            elif flam:
                desig = f"{flam} {con}"
            rec = {
                "hyg": int(row["id"]),
                "hip": int(row["hip"]) if row["hip"] else None,
                "ra": round(ra_h * 15.0, 5),        # degrees, J2000, epoch 2000.0
                "dec": round(dec, 5),
                "pmra": num(row["pmra"]) or 0.0,     # mas/yr, mu_alpha* (includes cos dec)
                "pmdec": num(row["pmdec"]) or 0.0,  # mas/yr
                "mag": mag,
                "ci": num(row["ci"]),
                "dist": num(row["dist"]),           # parsec (100000 = unknown in HYG)
                "spect": row["spect"].strip(),
                "con": con,
                "name": proper,
                "desig": desig,
            }
            stars.append(rec)
            if proper:
                by_name[proper] = rec
    stars.sort(key=lambda s: s["mag"])
    return stars, by_name


def write_stars(stars):
    # Columnar layout keeps the file small and makes GPU upload trivial.
    cols = {k: [] for k in ("hyg", "ra", "dec", "pmra", "pmdec", "mag", "ci", "con", "name", "desig", "dist", "spect")}
    for s in stars:
        if s["mag"] > MAG_LIMIT:
            continue
        cols["hyg"].append(s["hyg"])
        cols["ra"].append(s["ra"])
        cols["dec"].append(s["dec"])
        cols["pmra"].append(round(s["pmra"], 2))
        cols["pmdec"].append(round(s["pmdec"], 2))
        cols["mag"].append(round(s["mag"], 2))
        cols["ci"].append(None if s["ci"] is None else round(s["ci"], 3))
        cols["con"].append(s["con"])
        cols["name"].append(s["name"])
        cols["desig"].append(s["desig"])
        d = s["dist"]
        cols["dist"].append(None if d is None or d >= 100000 else round(d, 2))
        cols["spect"].append(s["spect"])
    out = {
        "meta": {
            "source": "HYG Database v4.1 (Hipparcos / Yale BSC / Gliese), via ../starexplorer",
            "url": "https://github.com/astronexus/HYG-Database",
            "frame": "ICRS / J2000 equator, epoch 2000.0",
            "magLimit": MAG_LIMIT,
            "count": len(cols["hyg"]),
            "units": {"ra": "deg", "dec": "deg", "pmra": "mas/yr (mu_alpha*)", "pmdec": "mas/yr", "dist": "pc"},
        },
        **cols,
    }
    with open(os.path.join(OUT, "stars.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    return out["meta"]["count"]


def write_fixed_stars(by_name):
    out = []
    for name, nature, lore in FIXED_STARS:
        s = by_name.get(name)
        if not s:
            print(f"  ! fixed star not in HYG, skipped: {name}", file=sys.stderr)
            continue
        out.append({
            "id": "fs-" + name.lower().replace(" ", "-"),
            "name": name,
            "hyg": s["hyg"],
            "hip": s["hip"],
            "desig": s["desig"],
            "ra": s["ra"],
            "dec": s["dec"],
            "pmra": round(s["pmra"], 2),
            "pmdec": round(s["pmdec"], 2),
            "mag": s["mag"],
            "ci": s["ci"],
            "dist": None if s["dist"] is None or s["dist"] >= 100000 else s["dist"],
            "spect": s["spect"],
            "con": s["con"],
            "nature": nature,
            "lore": lore,
        })
    with open(os.path.join(OUT, "fixed-stars.json"), "w") as f:
        json.dump({
            "meta": {
                "source": "Positions: HYG v4.1. Natures: Ptolemy, Tetrabiblos I.9; lore paraphrased from V. Robson (1923).",
                "frame": "ICRS / J2000, epoch 2000.0",
                "note": "Traditional associations are symbolic lore, not physical properties.",
            },
            "stars": out,
        }, f, indent=1)
    return len(out)


def write_constellations():
    with open(CONSTELLATIONS) as f:
        src = json.load(f)
    out = []
    for c in src["constellations"]:
        figures = [[[round(v["ra"], 3), round(v["dec"], 3)] for v in fig] for fig in c.get("figures", [])]
        boundary = [[[round(p[0], 3), round(p[1], 3)] for p in ring] for ring in c.get("boundary", [])]
        out.append({
            "id": c["id"],
            "name": c["name"],
            "genitive": c.get("genitive"),
            "label": [c["labelRa"], c["labelDec"]],  # degrees
            "figures": figures,
            "boundary": boundary,
        })
    with open(os.path.join(OUT, "constellations.json"), "w") as f:
        json.dump({
            "meta": {
                "source": src["meta"]["source"],
                "url": src["meta"].get("url"),
                "epoch": "J2000",
                "note": "IAU constellations are regions of sky, distinct from the 30-degree zodiac signs.",
            },
            "constellations": out,
        }, f, separators=(",", ":"))
    return len(out)


def write_cities(geonames_dir):
    cities_txt = os.path.join(geonames_dir, "cities15000.txt")
    admin_txt = os.path.join(geonames_dir, "admin1.txt")
    country_txt = os.path.join(geonames_dir, "country.txt")
    if not os.path.exists(cities_txt):
        print("  ! no GeoNames dump given; data/cities.json left untouched", file=sys.stderr)
        return None
    admin = {}
    with open(admin_txt, encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 2:
                admin[parts[0]] = parts[1]
    countries = {}
    with open(country_txt, encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) > 4:
                countries[parts[0]] = parts[4]
    rows = []
    with open(cities_txt, encoding="utf-8") as f:
        for line in f:
            p = line.rstrip("\n").split("\t")
            if len(p) < 18:
                continue
            name, ascii_name = p[1], p[2]
            lat, lon = float(p[4]), float(p[5])
            cc, a1 = p[8], p[10]
            pop = int(p[14] or 0)
            tz = p[17]
            if not tz:
                continue
            region = admin.get(f"{cc}.{a1}", "")
            rows.append([name, ascii_name if ascii_name != name else "", region, cc, round(lat, 4), round(lon, 4), tz, pop])
    rows.sort(key=lambda r: -r[7])
    with open(os.path.join(OUT, "cities.json"), "w", encoding="utf-8") as f:
        json.dump({
            "meta": {
                "source": "GeoNames cities15000 (population >= 15,000)",
                "url": "https://www.geonames.org/",
                "license": "CC BY 4.0",
                "fields": ["name", "ascii", "region", "country", "lat", "lon", "tz", "population"],
            },
            "countries": countries,
            "cities": rows,
        }, f, ensure_ascii=False, separators=(",", ":"))
    return len(rows)


def main():
    os.makedirs(OUT, exist_ok=True)
    stars, by_name = build_stars()
    print("stars:", write_stars(stars))
    print("fixed stars:", write_fixed_stars(by_name))
    print("constellations:", write_constellations())
    if len(sys.argv) > 1:
        print("cities:", write_cities(sys.argv[1]))


if __name__ == "__main__":
    main()
