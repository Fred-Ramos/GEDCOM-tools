// Towns of NR (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Yaren",-55,16693,2],["Yangor",-54,16691,5],["Uaboe",-51,16692,5],["Baiti",-51,16693,5],["Ijuw",-52,16696,5],["Anibare",-53,16695,5],["Anabar",-51,16695,5],["Arijejen",-53,16691,10],["Denigomodu",-53,16691,10],["Menen",-55,16695,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["NR"] = T;
})(typeof window !== "undefined" ? window : globalThis);
