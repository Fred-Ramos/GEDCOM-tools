// Towns of TV (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Funafuti",-852,17919,2],["Toga Village",-629,17631,5],["Tanrake Village",-725,17715,5],["Kulia Village",-611,17733,5],["Asau Village",-749,17868,5],["Savave Village",-803,17831,5]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["TV"] = T;
})(typeof window !== "undefined" ? window : globalThis);
