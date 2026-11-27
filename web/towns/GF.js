// Towns of GF (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Cayenne",494,-5233,2],["Matoury",485,-5232,7],["Saint-Laurent-du-Maroni",550,-5403,7],["Kourou",516,-5264,7],["Rémire-Montjoly",492,-5227,7],["Apatou",516,-5434,8],["Grand-Santi",427,-5438,8],["Macouria",491,-5237,8],["Maripasoula",364,-5403,8],["Mana",567,-5378,9],["Sinnamary",538,-5296,9],["Saint-Georges",389,-5180,10],["Résidence Cogneau-Larivot",489,-5234,10],["Roura",473,-5232,10],["Régina",431,-5213,10],["Charvein",558,-5390,10],["Awala-Yalimapo",574,-5391,10],["Iracoubo",548,-5321,10],["Rémire",489,-5228,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["GF"] = T;
})(typeof window !== "undefined" ? window : globalThis);
