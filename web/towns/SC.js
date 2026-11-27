// Towns of SC (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Victoria",-462,5546,2],["Takamaka",-477,5550,5],["Port Glaud",-466,5542,5],["Cascade",-467,5550,5],["Bel Ombre",-462,5542,5],["Beau Vallon",-462,5543,5],["Anse Royale",-473,5552,5],["Anse Boileau",-472,5548,5],["La Passe",-435,5583,5],["Perseverance",-460,5546,9],["Baie Sainte Anne",-432,5575,9],["Baie Lazare",-475,5548,9],["Anse aux Pins",-469,5552,9],["Glacis",-458,5544,9],["Grand'Anse",-433,5572,9],["English River",-461,5545,9],["Grand'Anse",-467,5547,9],["La Digue",-436,5584,9],["Roche Caïman",-464,5547,9],["Pointe La Rue",-467,5551,9]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["SC"] = T;
})(typeof window !== "undefined" ? window : globalThis);
