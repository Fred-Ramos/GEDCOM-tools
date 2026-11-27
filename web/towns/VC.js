// Towns of VC (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Kingstown",1316,-6123,2],["Port Elizabeth",1301,-6124,5],["Layou",1320,-6127,5],["Georgetown",1328,-6112,5],["Chateaubelair",1329,-6124,5],["Barrouallie",1324,-6127,5],["Calliaqua",1313,-6119,7],["Diamond",1314,-6117,10],["Redemption",1316,-6123,10],["New Montrose",1316,-6123,10],["Greiggs",1321,-6116,10],["Byera Village",1326,-6112,11],["Questelles",1318,-6125,11],["Petit Bordel",1329,-6124,11],["Friendly Village",1323,-6113,11],["Peruvian Vale",1318,-6114,11],["Biabou",1319,-6114,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["VC"] = T;
})(typeof window !== "undefined" ? window : globalThis);
