// Towns of BH (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Manama",2623,5059,2],["Al Muharraq",2626,5061,4],["Madīnat Ḩamad",2612,5051,5],["Ar Rifā‘",2613,5056,5],["Sitrah",2615,5062,5],["Jidd Ḩafş",2622,5055,6],["Dār Kulayb",2607,5050,6],["Madīnat ‘Īsá",2617,5055,6],["Al Ḩadd",2625,5065,8],["Az Zallāq",2605,5049,8],["Sanābis",2623,5055,9],["Sār",2619,5048,9]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["BH"] = T;
})(typeof window !== "undefined" ? window : globalThis);
