// Towns of BB (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Bridgetown",1311,-5962,2],["Welchman Hall",1319,-5958,5],["Crane",1310,-5945,5],["Speightstown",1325,-5964,5],["Oistins",1307,-5955,5],["Holetown",1319,-5964,5],["Greenland",1326,-5958,5],["Four Cross Roads",1317,-5952,5],["Checker Hall",1328,-5964,5],["Bathsheba",1321,-5953,5],["White Hill",1321,-5958,9],["Hastings",1308,-5960,10],["Mile and a Quarter",1327,-5962,11],["Six Cross Roads",1312,-5948,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["BB"] = T;
})(typeof window !== "undefined" ? window : globalThis);
