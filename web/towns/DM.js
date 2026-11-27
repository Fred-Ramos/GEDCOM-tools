// Towns of DM (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Roseau",1530,-6139,2],["Wesley",1557,-6132,5],["Soufrière",1523,-6136,5],["Saint Joseph",1541,-6142,5],["Rosalie",1537,-6127,5],["Portsmouth",1558,-6146,5],["Pont Cassé",1537,-6135,5],["Pointe Michel",1526,-6137,5],["Marigot",1554,-6128,5],["Colihaut",1548,-6146,5],["Berekua",1523,-6132,5],["Mahaut",1536,-6140,10],["Massacre",1535,-6139,10],["Salisbury",1544,-6144,11],["Castle Bruce",1544,-6126,11],["La Plaine",1533,-6125,11],["Woodford Hill",1558,-6133,11],["Calibishie",1559,-6135,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["DM"] = T;
})(typeof window !== "undefined" ? window : globalThis);
