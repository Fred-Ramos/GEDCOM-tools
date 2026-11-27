// Towns of SS (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Juba",485,3158,2],["Winejok",901,2757,4],["Yei",409,3068,4],["Malakal",953,3166,4],["Wau",770,2799,5],["Yambio",457,2839,5],["Aweil",876,2739,5],["Torit",441,3257,5],["Rumbek",681,2968,5],["Kuacjok",830,2798,5],["Bor",621,3156,5],["Bentiu",926,2980,5],["Pajok",387,3248,6],["Gogrial",853,2810,6],["Leer",830,3014,7],["Tonj",727,2868,7],["Kafia Kingi",927,2442,7],["Maridi",492,2947,8],["Yirol",655,3050,8],["Tambura",560,2747,8],["Kodok",989,3211,8],["Kapoeta",477,3359,8],["Raja",847,2568,9]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["SS"] = T;
})(typeof window !== "undefined" ? window : globalThis);
