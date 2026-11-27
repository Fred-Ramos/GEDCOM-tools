// Towns of KN (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Basseterre",1730,-6272,2],["Trinity",1730,-6278,5],["Sandy Point Town",1736,-6285,5],["Saint Paul’s",1741,-6284,5],["Nicola Town",1738,-6275,5],["Newcastle",1720,-6258,5],["Monkey Hill",1732,-6273,5],["Middle Island",1733,-6281,5],["Market Shop",1713,-6257,5],["Fig Tree",1713,-6260,5],["Dieppe Bay Town",1741,-6281,5],["Cotton Ground",1717,-6262,5],["Charlestown",1713,-6262,5],["Cayon",1735,-6273,5],["Old Road Town",1732,-6280,10],["Sadlers",1740,-6279,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["KN"] = T;
})(typeof window !== "undefined" ? window : globalThis);
