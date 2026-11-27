// Towns of BM (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Hamilton",3229,-6478,2],["Warwick Parish",3227,-6481,8],["Sandys Parish",3230,-6487,8],["Devonshire Parish",3231,-6476,8],["Southampton Parish",3225,-6485,9],["Hamilton Parish",3234,-6473,9],["Paget Parish",3228,-6478,9],["St George's Parish",3237,-6470,9],["Smith's Parish",3231,-6474,9],["Saint George",3238,-6468,10]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["BM"] = T;
})(typeof window !== "undefined" ? window : globalThis);
