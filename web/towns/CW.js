// Towns of CW (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Willemstad",1212,-6889,2],["Bandariba",1209,-6883,7],["Bandabou",1227,-6907,8],["St. Michiel",1214,-6899,9],["Santa Rosa",1212,-6888,9],["Sint Michiel Liber",1215,-6898,9],["Brievengat",1215,-6890,9],["Tera Kora",1222,-6903,9],["Barber",1229,-6907,10],["Dorp Soto",1228,-6911,10]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["CW"] = T;
})(typeof window !== "undefined" ? window : globalThis);
