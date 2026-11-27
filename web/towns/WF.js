// Towns of WF (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Mata-Utu",-1328,-17617,2],["Leava",-1429,-17816,5],["Alo",-1431,-17811,5]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["WF"] = T;
})(typeof window !== "undefined" ? window : globalThis);
